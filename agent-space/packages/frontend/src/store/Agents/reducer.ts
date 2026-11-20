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

import { createReducer } from '@reduxjs/toolkit';

import { Agent, AgentError } from '@/services/types';
import {
  agentActionClearErrorAction,
  agentActionErrorAction,
  agentActionReceiveAction,
  agentActionRequestAction,
  agentChangeAction,
  agentsDeleteErrorAction,
  agentsDeleteReceiveAction,
  agentsDeleteRequestAction,
  agentsErrorAction,
  agentsReceiveAction,
  agentsRequestAction,
} from '@/store/Agents/actions';

export interface State {
  isLoading: boolean;
  /** True once a first answer - list or error - has arrived. */
  isLoaded: boolean;
  agents: Agent[];
  error?: AgentError;
  /** Name of the agent a lifecycle action is currently running against. */
  pendingName?: string;
  /** Names a bulk delete is currently running against. */
  deletingNames?: string[];
  actionError?: AgentError;
}

export const unloadedState: State = {
  isLoading: false,
  isLoaded: false,
  agents: [],
};

export const reducer = createReducer(unloadedState, builder =>
  builder
    .addCase(agentsRequestAction, state => {
      // A resync must not blank the table, so the spinner is only claimed
      // while nothing has been shown yet.
      state.isLoading = !state.isLoaded;
    })
    .addCase(agentsReceiveAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.agents = action.payload.agents;
      state.error = undefined;
    })
    .addCase(agentChangeAction, (state, action) => {
      const { type, agent } = action.payload;
      const index = state.agents.findIndex(item => item.metadata.name === agent.metadata.name);

      if (type === 'DELETED') {
        if (index !== -1) {
          state.agents.splice(index, 1);
        }
      } else if (index === -1) {
        state.agents.push(agent);
      } else {
        state.agents[index] = agent;
      }

      // A watch event is an answer too: the table is live even if the initial
      // list failed.
      state.isLoaded = true;
      state.isLoading = false;
    })
    .addCase(agentsErrorAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.error = action.payload;
    })
    .addCase(agentActionRequestAction, (state, action) => {
      state.pendingName = action.payload;
      state.actionError = undefined;
    })
    .addCase(agentActionReceiveAction, state => {
      state.pendingName = undefined;
    })
    .addCase(agentActionErrorAction, (state, action) => {
      state.pendingName = undefined;
      state.actionError = action.payload;
    })
    .addCase(agentsDeleteRequestAction, (state, action) => {
      state.deletingNames = action.payload;
      state.actionError = undefined;
    })
    .addCase(agentsDeleteReceiveAction, state => {
      state.deletingNames = undefined;
    })
    .addCase(agentsDeleteErrorAction, (state, action) => {
      state.deletingNames = undefined;
      state.actionError = action.payload;
    })
    .addCase(agentActionClearErrorAction, state => {
      state.actionError = undefined;
    })
    .addDefaultCase(state => state),
);
