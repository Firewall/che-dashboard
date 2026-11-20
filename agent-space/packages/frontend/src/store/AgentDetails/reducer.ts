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

import { Agent, AgentError, AgentEvent } from '@/services/types';
import {
  agentDetailsErrorAction,
  agentDetailsEventsErrorAction,
  agentDetailsEventsReceiveAction,
  agentDetailsReceiveAction,
  agentDetailsRequestAction,
} from '@/store/AgentDetails/actions';
import { agentChangeAction, agentsReceiveAction } from '@/store/Agents/actions';

export interface State {
  isLoading: boolean;
  isLoaded: boolean;
  /** Agent the rest of the state describes; the page shows one at a time. */
  name?: string;
  agent?: Agent;
  events: AgentEvent[];
  error?: AgentError;
  /** Set when listing the events failed, which is not a failure of the page. */
  eventsError?: AgentError;
}

export const unloadedState: State = {
  isLoading: false,
  isLoaded: false,
  events: [],
};

export const reducer = createReducer(unloadedState, builder =>
  builder
    .addCase(agentDetailsRequestAction, (state, action) => {
      if (state.name !== action.payload) {
        // Another agent: drop what is on screen rather than showing the
        // previous one's manifest under the new name.
        state.name = action.payload;
        state.agent = undefined;
        state.events = [];
        state.isLoaded = false;
        state.error = undefined;
        state.eventsError = undefined;
      }
      state.isLoading = !state.isLoaded;
    })
    .addCase(agentDetailsReceiveAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.name = action.payload.name;
      state.agent = action.payload.agent;
      state.events = action.payload.events;
      state.error = undefined;
      state.eventsError = action.payload.eventsError;
    })
    .addCase(agentDetailsErrorAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.name = action.payload.name;
      state.error = action.payload.error;
    })
    .addCase(agentDetailsEventsReceiveAction, (state, action) => {
      if (state.name === action.payload.name) {
        state.events = action.payload.events;
        state.eventsError = undefined;
      }
    })
    .addCase(agentDetailsEventsErrorAction, (state, action) => {
      if (state.name === action.payload.name) {
        state.eventsError = action.payload.error;
      }
    })
    .addCase(agentChangeAction, (state, action) => {
      // The namespace-wide watch also feeds this page, so an agent that is
      // stopped from somewhere else updates here without a request.
      const { type, agent } = action.payload;
      if (state.name !== agent.metadata.name) {
        return;
      }
      state.agent = type === 'DELETED' ? undefined : agent;
      state.isLoading = false;
      state.isLoaded = true;
    })
    .addCase(agentsReceiveAction, (state, action) => {
      // A list is also how the watch recovers: when the stream breaks,
      // changes that happened in the meantime arrive this way and not as
      // events. The page has to take them, or it would sit on a status that
      // stopped being true the moment the stream died.
      if (state.name === undefined) {
        return;
      }
      const agent = action.payload.agents.find(item => item.metadata.name === state.name);
      // Only an answer about this agent counts. A list that does not mention
      // it may be a namespace the page is not showing, so the manifest stays
      // until the details request says otherwise.
      if (agent !== undefined) {
        state.agent = agent;
        state.isLoading = false;
        state.isLoaded = true;
      }
    })
    .addDefaultCase(state => state),
);
