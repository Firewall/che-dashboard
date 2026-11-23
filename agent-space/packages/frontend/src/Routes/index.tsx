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

import { Bullseye, EmptyState, Spinner } from '@patternfly/react-core';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AgentDetails } from '@/pages/AgentDetails';
import { AgentList } from '@/pages/AgentList';
import { CreateAgent } from '@/pages/CreateAgent';
import { Workspaces } from '@/pages/Workspaces';
import { CreateWorkspace } from '@/pages/Workspaces/CreateWorkspace';
import { selectAgents, selectAgentsIsLoaded } from '@/store/Agents';
import { useAppSelector } from '@/store/hooks';

export enum ROUTE {
  CREATE = '/create',
  AGENTS = '/agents',
  AGENT_DETAILS = '/agents/:name',
  /** Mock of the Che dashboard Workspaces area, served by this bundle. */
  WORKSPACES = '/workspaces',
  CREATE_WORKSPACE = '/workspaces/create',
}

/**
 * Tabs of the agent details page. The value is both the tab label and the
 * `?tab=` query parameter, so a tab can be linked to and survives a reload -
 * the same contract the dashboard's workspace details page uses.
 */
export enum AGENT_TAB {
  AGENT = 'Agent',
  OVERVIEW = 'Overview',
  EVENTS = 'Events',
  TERMINAL = 'Terminal',
}

export const DEFAULT_AGENT_TAB = AGENT_TAB.OVERVIEW;

export function isAgentTab(value: unknown): value is AGENT_TAB {
  return Object.values<unknown>(AGENT_TAB).includes(value);
}

export function buildAgentDetailsRoute(name: string, tab?: AGENT_TAB): string {
  const path = `/agents/${encodeURIComponent(name)}`;
  return tab === undefined ? path : `${path}?tab=${tab}`;
}

/**
 * Where an empty URL lands: the list when there is something in it, the
 * create form when there is not.
 *
 * The answer only exists once the first list has arrived, so the redirect
 * waits for it rather than guessing - and guessing wrong in the other
 * direction would bounce the user off the form they opened on purpose.
 */
function RootRedirect(): React.ReactElement {
  const agents = useAppSelector(selectAgents);
  const isLoaded = useAppSelector(selectAgentsIsLoaded);

  if (!isLoaded) {
    return (
      <Bullseye>
        <EmptyState icon={Spinner} titleText="Loading agents" />
      </Bullseye>
    );
  }

  return <Navigate to={agents.length > 0 ? ROUTE.AGENTS : ROUTE.CREATE} replace />;
}

export function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path={ROUTE.CREATE} element={<CreateAgent />} />
      <Route path={ROUTE.AGENTS} element={<AgentList />} />
      <Route path={ROUTE.AGENT_DETAILS} element={<AgentDetails />} />
      <Route path={ROUTE.CREATE_WORKSPACE} element={<CreateWorkspace />} />
      <Route path={ROUTE.WORKSPACES} element={<Workspaces />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
