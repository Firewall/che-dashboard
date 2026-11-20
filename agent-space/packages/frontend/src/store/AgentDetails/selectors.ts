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

import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/store';

const selectState = (state: RootState) => state.agentDetails;

export const selectAgentDetails = createSelector(selectState, state => state.agent);

/** Agent the loaded state belongs to, so a page can detect a stale read. */
export const selectAgentDetailsName = createSelector(selectState, state => state.name);

export const selectAgentDetailsEvents = createSelector(selectState, state => state.events);

/** True until the first answer arrives; see the agent list selector. */
export const selectAgentDetailsIsLoading = createSelector(
  selectState,
  state => state.isLoading || !state.isLoaded,
);

export const selectAgentDetailsError = createSelector(selectState, state => state.error);

/** Why the Events tab is empty, when it is empty because listing failed. */
export const selectAgentDetailsEventsError = createSelector(
  selectState,
  state => state.eventsError,
);

/**
 * Changes whenever the watch delivers a new version of this agent, which is
 * what the page keys its event refresh on.
 */
export const selectAgentDetailsResourceVersion = createSelector(
  selectAgentDetails,
  agent => agent?.metadata.resourceVersion,
);
