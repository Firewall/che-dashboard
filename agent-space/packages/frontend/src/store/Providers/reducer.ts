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

import { AgentError, OpenshellProvider } from '@/services/types';
import {
  providersErrorAction,
  providersReceiveAction,
  providersRequestAction,
} from '@/store/Providers/actions';

export interface State {
  isLoading: boolean;
  isLoaded: boolean;
  providers: OpenshellProvider[];
  error?: AgentError;
}

export const unloadedState: State = {
  isLoading: false,
  isLoaded: false,
  providers: [],
};

export const reducer = createReducer(unloadedState, builder =>
  builder
    .addCase(providersRequestAction, state => {
      state.isLoading = !state.isLoaded;
    })
    .addCase(providersReceiveAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.providers = action.payload;
      state.error = undefined;
    })
    .addCase(providersErrorAction, (state, action) => {
      state.isLoading = false;
      state.isLoaded = true;
      state.error = action.payload;
    })
    .addDefaultCase(state => state),
);
