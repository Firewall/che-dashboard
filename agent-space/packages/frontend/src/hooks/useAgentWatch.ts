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

import React from 'react';

import { agentsActionCreators } from '@/store/Agents';
import { useAppDispatch } from '@/store/hooks';

/**
 * Keeps one namespace-wide agent subscription open for as long as the app is
 * mounted.
 *
 * It lives above the pages on purpose: the list and the details view read the
 * same stream, so neither has to request anything on its own, and switching
 * between them costs no traffic. It is also what carries the mock's delayed
 * Starting → Running transition into the UI.
 *
 * @param isEnabled the namespace is only known once the bootstrap has finished
 */
export function useAgentWatch(isEnabled: boolean): void {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    if (!isEnabled) {
      return;
    }

    void dispatch(agentsActionCreators.startWatchingAgents());

    return () => {
      dispatch(agentsActionCreators.stopWatchingAgents());
    };
  }, [dispatch, isEnabled]);
}
