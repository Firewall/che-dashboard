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
import { Agent, AgentError, AgentEvent, toAgentError } from '@/services/types';
import { AppThunk } from '@/store';
import { selectNamespace } from '@/store/Bootstrap';

export interface AgentDetailsPayload {
  name: string;
  agent: Agent;
  events: AgentEvent[];
  /** Why the events are missing, when listing them is what failed. */
  eventsError?: AgentError;
}

export interface AgentDetailsErrorPayload {
  name: string;
  error: AgentError;
}

export interface AgentDetailsEventsPayload {
  name: string;
  events: AgentEvent[];
}

export const agentDetailsRequestAction = createAction<string>('agentDetails/request');

export const agentDetailsReceiveAction = createAction<AgentDetailsPayload>('agentDetails/receive');
export const agentDetailsErrorAction = createAction<AgentDetailsErrorPayload>(
  'agentDetails/receiveError',
);
export const agentDetailsEventsReceiveAction = createAction<AgentDetailsEventsPayload>(
  'agentDetails/receiveEvents',
);
export const agentDetailsEventsErrorAction = createAction<AgentDetailsErrorPayload>(
  'agentDetails/receiveEventsError',
);

export const actionCreators = {
  /**
   * Loads one agent together with its events.
   *
   * Event listing is best effort: a user who may read agents but not events
   * should still see the spec and the status.
   */
  requestAgentDetails:
    (name: string): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      const namespace = selectNamespace(getState());
      const client = getAgentClient();

      try {
        dispatch(agentDetailsRequestAction(name));

        const agent = await client.getAgent(namespace, name);

        let events: AgentEvent[] = [];
        let eventsError: AgentError | undefined;
        try {
          events = await client.listEvents(namespace, name);
        } catch (e) {
          // Recorded rather than swallowed: an empty Events tab that means
          // "not allowed to look" must not read as "nothing happened".
          eventsError = toAgentError(e);
        }

        dispatch(agentDetailsReceiveAction({ name, agent, events, eventsError }));
      } catch (e) {
        dispatch(agentDetailsErrorAction({ name, error: toAgentError(e) }));
      }
    },

  /**
   * Re-reads only the events.
   *
   * The status progression appends events without the agent object always
   * changing in step, and the watch cannot be the only thing that triggers a
   * re-read. The details page also calls this on a timer while the Events tab
   * is open.
   */
  requestAgentEvents:
    (name: string): AppThunk =>
    async (dispatch, getState): Promise<void> => {
      try {
        const events = await getAgentClient().listEvents(selectNamespace(getState()), name);
        dispatch(agentDetailsEventsReceiveAction({ name, events }));
      } catch (e) {
        // The spec and the status are already on screen and stay there; only
        // the events pane reports this.
        dispatch(agentDetailsEventsErrorAction({ name, error: toAgentError(e) }));
      }
    },
};
