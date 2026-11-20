/*
 * Copyright (c) 2018-2025 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { createAction } from '@reduxjs/toolkit';

import { getAgentClient } from '@/services/client/instance';
import {
  Agent,
  AgentAction,
  AgentChangeEvent,
  AgentError,
  CreateAgentRequest,
  StopWatching,
  toAgentError,
} from '@/services/types';
import { AppThunk } from '@/store';
import { selectNamespace } from '@/store/Bootstrap';

export interface AgentsPayload {
  agents: Agent[];
}

export const agentsRequestAction = createAction('agents/request');
export const agentsReceiveAction = createAction<AgentsPayload>('agents/receive');
export const agentsErrorAction = createAction<AgentError>('agents/receiveError');

/**
 * One change reported by the watch. Both the list and the details slice react
 * to it, which is what keeps the two views in step without either polling.
 */
export const agentChangeAction = createAction<AgentChangeEvent>('agents/change');

/**
 * The subscription handle. It is a live callback, so it cannot live in the
 * store, which must stay serializable.
 */
let stopWatching: StopWatching | undefined;

export const agentActionRequestAction = createAction<string>('agents/action/request');
export const agentActionReceiveAction = createAction('agents/action/receive');
export const agentActionErrorAction = createAction<AgentError>('agents/action/receiveError');
export const agentActionClearErrorAction = createAction('agents/action/clearError');

/**
 * Bulk delete is tracked apart from the single-agent lifecycle actions: it
 * spans several names at once, and only the list page can start one.
 */
export const agentsDeleteRequestAction = createAction<string[]>('agents/bulkDelete/request');
export const agentsDeleteReceiveAction = createAction('agents/bulkDelete/receive');
export const agentsDeleteErrorAction = createAction<AgentError>('agents/bulkDelete/receiveError');

export const actionCreators = {
  requestAgents:
    (): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      try {
        dispatch(agentsRequestAction());

        const agents = await getAgentClient().listAgents(selectNamespace(getState()));
        dispatch(agentsReceiveAction({ agents }));
      } catch (e) {
        dispatch(agentsErrorAction(toAgentError(e)));
      }
    },

  /**
   * Lists once, then subscribes to the changes of the namespace.
   *
   * The list comes first because the watch only reports what happens after it
   * starts; without it the UI would start empty and fill in only as agents
   * happened to change.
   */
  startWatchingAgents:
    (): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      stopWatching?.();
      stopWatching = undefined;

      await dispatch(actionCreators.requestAgents());

      const namespace = selectNamespace(getState());

      stopWatching = getAgentClient().watchAgents(namespace, event => {
        if (event.type === 'ERROR') {
          // Events may have been missed while the stream was down - a deletion
          // in particular is never replayed - so the collection is read again.
          void dispatch(actionCreators.requestAgents());
          return;
        }
        dispatch(agentChangeAction(event));
      });
    },

  stopWatchingAgents: (): AppThunk<void> => (): void => {
    stopWatching?.();
    stopWatching = undefined;
  },

  /**
   * Applies a lifecycle action. The resulting state is not guessed here: the
   * watch reports what the backend - not this UI - actually produced.
   */
  runAgentAction:
    (name: string, action: AgentAction): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      try {
        dispatch(agentActionRequestAction(name));

        const namespace = selectNamespace(getState());
        const client = getAgentClient();
        if (action === 'start') {
          await client.startAgent(namespace, name);
        } else {
          await client.stopAgent(namespace, name);
        }
        dispatch(agentActionReceiveAction());
      } catch (e) {
        dispatch(agentActionErrorAction(toAgentError(e)));
      }
    },

  deleteAgent:
    (name: string): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      try {
        dispatch(agentActionRequestAction(name));

        await getAgentClient().deleteAgent(selectNamespace(getState()), name);
        dispatch(agentActionReceiveAction());
      } catch (e) {
        dispatch(agentActionErrorAction(toAgentError(e)));
      }
    },

  /**
   * Deletes several agents at once.
   *
   * Every name is attempted even when an earlier one fails, so one agent the
   * user may no longer delete does not hide the outcome of the rest; what did
   * fail is then reported together.
   */
  deleteAgents:
    (names: string[]): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      const namespace = selectNamespace(getState());
      const client = getAgentClient();

      dispatch(agentsDeleteRequestAction(names));

      const results = await Promise.allSettled(
        names.map(name => client.deleteAgent(namespace, name)),
      );
      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [`${names[index]}: ${toAgentError(result.reason).message}`]
          : [],
      );

      if (failures.length === 0) {
        dispatch(agentsDeleteReceiveAction());
        return;
      }
      dispatch(
        agentsDeleteErrorAction({
          message:
            names.length === 1
              ? failures[0]
              : `Failed to delete ${failures.length} of ${names.length} agents. ${failures.join('; ')}`,
        }),
      );
    },

  createAgent:
    (request: CreateAgentRequest): AppThunk<Promise<Agent | undefined>> =>
    async (dispatch, getState): Promise<Agent | undefined> => {
      try {
        // The name is derived, so the pending marker cannot know it up front;
        // the request itself is what the button is busy for.
        dispatch(agentActionRequestAction(request.repositoryUrl));

        const created = await getAgentClient().createAgent(selectNamespace(getState()), request);
        dispatch(agentActionReceiveAction());
        return created;
      } catch (e) {
        dispatch(agentActionErrorAction(toAgentError(e)));
        return undefined;
      }
    },

  clearActionError: (): AppThunk<void> => dispatch => dispatch(agentActionClearErrorAction()),
};
