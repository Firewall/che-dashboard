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

import { NavGroup, NavItem } from '@patternfly/react-core';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AgentStatusIndicator } from '@/components/AgentStatusIndicator';
import { DeleteAgentModal } from '@/components/DeleteAgentModal';
import { RecentAgentActions } from '@/Layout/RecentList/Actions';
import styles from '@/Layout/RecentList/index.module.css';
import { AGENT_TAB, buildAgentDetailsRoute } from '@/Routes';
import { getAgentPhase } from '@/services/agent';
import { Agent, AgentAction } from '@/services/types';
import {
  agentsActionCreators,
  selectAgentActionPendingName,
  selectAgents,
  selectAgentsDeletingNames,
} from '@/store/Agents';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/** As many as the dashboard keeps in its own recent list. */
export const MAX_RECENT_AGENTS = 5;

function byNewestFirst(a: Agent, b: Agent): number {
  const left = a.metadata.creationTimestamp ?? '';
  const right = b.metadata.creationTimestamp ?? '';
  return right.localeCompare(left);
}

/**
 * The sidebar counterpart of the dashboard's "RECENT WORKSPACES".
 *
 * Clicking an entry opens its details page, which is where its status, its
 * events and its manifest are.
 */
export function RecentAgents(): React.ReactElement | null {
  const agents = useAppSelector(selectAgents);
  const pendingName = useAppSelector(selectAgentActionPendingName);
  const deletingNames = useAppSelector(selectAgentsDeletingNames);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [wantDelete, setWantDelete] = React.useState<string | undefined>(undefined);

  const isPending = pendingName !== undefined || deletingNames !== undefined;

  const recent = React.useMemo(
    () => [...agents].sort(byNewestFirst).slice(0, MAX_RECENT_AGENTS),
    [agents],
  );

  const handleOpen = React.useCallback(
    (agent: Agent) => {
      navigate(buildAgentDetailsRoute(agent.metadata.name));
    },
    [navigate],
  );

  const handleRunAction = React.useCallback(
    (name: string, action: AgentAction) => {
      void dispatch(agentsActionCreators.runAgentAction(name, action));
    },
    [dispatch],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (wantDelete === undefined) {
      return;
    }
    await dispatch(agentsActionCreators.deleteAgent(wantDelete));
    setWantDelete(undefined);
  }, [dispatch, wantDelete]);

  if (recent.length === 0) {
    return null;
  }

  return (
    <>
      <NavGroup title="RECENT AGENTS" style={{ marginTop: '25px' }}>
        {recent.map(agent => {
          const name = agent.metadata.name;
          const detailsRoute = buildAgentDetailsRoute(name);
          return (
            <NavItem
              key={agent.metadata.uid ?? name}
              itemId={detailsRoute}
              className={styles.navItem}
              data-testid={`recent-agent-${name}`}
              isActive={location.pathname === detailsRoute}
              preventDefault={true}
              tabIndex={0}
              onClick={() => handleOpen(agent)}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                // Enter on the kebab, or on an item of its menu, is not a
                // request to open the agent.
                if (event.target !== event.currentTarget) {
                  return;
                }
                event.preventDefault();
                handleOpen(agent);
              }}
            >
              <span>
                <AgentStatusIndicator phase={getAgentPhase(agent)} agentName={name} />
                <span>{name}</span>
              </span>
              <RecentAgentActions
                agent={agent}
                isDisabled={isPending}
                onOpen={name => navigate(buildAgentDetailsRoute(name, AGENT_TAB.AGENT))}
                onRunAction={handleRunAction}
                onDelete={setWantDelete}
              />
            </NavItem>
          );
        })}
      </NavGroup>

      <DeleteAgentModal
        isOpen={wantDelete !== undefined}
        agentNames={wantDelete === undefined ? [] : [wantDelete]}
        isDeleting={pendingName !== undefined && pendingName === wantDelete}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setWantDelete(undefined)}
      />
    </>
  );
}
