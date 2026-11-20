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
import { AgentError, OpenshellProvider, toAgentError } from '@/services/types';
import { AppThunk } from '@/store';

export const providersRequestAction = createAction('providers/request');
export const providersReceiveAction = createAction<OpenshellProvider[]>('providers/receive');
export const providersErrorAction = createAction<AgentError>('providers/receiveError');

export const actionCreators = {
  /**
   * Loads the OpenShell providers the administrator has published.
   *
   * The create form offers exactly this list, so it has to be answered for
   * before the form can render its checkboxes.
   */
  requestProviders:
    (): AppThunk =>
    async (dispatch): Promise<void> => {
      try {
        dispatch(providersRequestAction());

        const providers = await getAgentClient().listProviders();
        dispatch(providersReceiveAction(providers));
      } catch (e) {
        dispatch(providersErrorAction(toAgentError(e)));
      }
    },
};
