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

const selectState = (state: RootState) => state.agents;

export const selectAgents = createSelector(selectState, state => state.agents);

/**
 * True until the first answer arrives. A resync of an already rendered list is
 * not "loading", otherwise every reconnect would flash the spinner.
 */
export const selectAgentsIsLoading = createSelector(
  selectState,
  state => state.isLoading || !state.isLoaded,
);

export const selectAgentsError = createSelector(selectState, state => state.error);

/**
 * Whether the first answer - list or error - has arrived. The default route
 * waits on it before deciding where to send the user.
 */
export const selectAgentsIsLoaded = createSelector(selectState, state => state.isLoaded);

export const selectAgentActionPendingName = createSelector(selectState, state => state.pendingName);

export const selectAgentsDeletingNames = createSelector(selectState, state => state.deletingNames);

export const selectAgentActionError = createSelector(selectState, state => state.actionError);
