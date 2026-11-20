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

import {
  Button,
  ButtonVariant,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  PageSection,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { CubesIcon, SearchIcon } from '@patternfly/react-icons';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AgentStatusLabel } from '@/components/AgentStatusLabel';
import { DeleteAgentModal } from '@/components/DeleteAgentModal';
import { ErrorAlert } from '@/components/ErrorAlert';
import { AgentListToolbar } from '@/pages/AgentList/Toolbar';
import { AGENT_TAB, buildAgentDetailsRoute, ROUTE } from '@/Routes';
import { getAgentPhase, getAgentProviderId, getAgentRepository } from '@/services/agent';
import { buildAgentActionItems } from '@/services/agentActions';
import match from '@/services/filter';
import { formatAge } from '@/services/format';
import { pageTitle, SECTION } from '@/services/pageTitle';
import { Agent, AgentAction } from '@/services/types';
import {
  agentsActionCreators,
  selectAgentActionError,
  selectAgentActionPendingName,
  selectAgents,
  selectAgentsDeletingNames,
  selectAgentsError,
  selectAgentsIsLoading,
} from '@/store/Agents';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProviders } from '@/store/Providers';

/**
 * Lists the agents of the current namespace with their status and the
 * lifecycle actions that status allows.
 */
export function AgentList(): React.ReactElement {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const agents = useAppSelector(selectAgents);
  const isLoading = useAppSelector(selectAgentsIsLoading);
  const error = useAppSelector(selectAgentsError);
  const pendingName = useAppSelector(selectAgentActionPendingName);
  const deletingNames = useAppSelector(selectAgentsDeletingNames);
  const actionError = useAppSelector(selectAgentActionError);
  const providers = useAppSelector(selectProviders);

  const [wantDelete, setWantDelete] = React.useState<string[] | undefined>(undefined);
  const [checkedNames, setCheckedNames] = React.useState<string[]>([]);
  const [filterValue, setFilterValue] = React.useState('');

  const isPending = pendingName !== undefined || deletingNames !== undefined;

  const visibleAgents = React.useMemo(
    () =>
      filterValue === '' ? agents : agents.filter(agent => match(agent.metadata.name, filterValue)),
    [filterValue, agents],
  );

  // An agent the watch has removed, or the filter has hidden, must not keep a
  // tick the toolbar would act on, so the selection is derived rather than
  // stored on its own.
  const selectedNames = React.useMemo(
    () => checkedNames.filter(name => visibleAgents.some(item => item.metadata.name === name)),
    [checkedNames, visibleAgents],
  );

  const clearError = React.useCallback(
    () => dispatch(agentsActionCreators.clearActionError()),
    [dispatch],
  );

  // Nothing is read back afterwards: the watch reports what the backend
  // actually did, which is not necessarily what the action asked for.
  const runAction = React.useCallback(
    (name: string, action: AgentAction) => {
      void dispatch(agentsActionCreators.runAgentAction(name, action));
    },
    [dispatch],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (wantDelete === undefined) {
      return;
    }
    await dispatch(agentsActionCreators.deleteAgents(wantDelete));
    setCheckedNames(current => current.filter(name => !wantDelete.includes(name)));
    setWantDelete(undefined);
  }, [dispatch, wantDelete]);

  const handleCheck = React.useCallback((name: string, isChecked: boolean) => {
    setCheckedNames(current =>
      isChecked ? [...current, name] : current.filter(item => item !== name),
    );
  }, []);

  const handleCheckAll = React.useCallback(
    (isChecked: boolean) =>
      setCheckedNames(isChecked ? visibleAgents.map(agent => agent.metadata.name) : []),
    [visibleAgents],
  );

  const buildActions = React.useCallback(
    (agent: Agent): IAction[] =>
      buildAgentActionItems({
        agent,
        isDisabled: isPending,
        onOpen: name => navigate(buildAgentDetailsRoute(name, AGENT_TAB.AGENT)),
        onRunAction: runAction,
        onDelete: name => setWantDelete([name]),
      }).map(item =>
        item.kind === 'separator'
          ? { isSeparator: true }
          : {
              title: item.title,
              isDisabled: item.isDisabled,
              onClick: item.onSelect,
            },
      ),
    [isPending, navigate, runAction],
  );

  /** Display name of a provider id, for the AI provider column. */
  const providerName = React.useCallback(
    (id: string): string => providers.find(provider => provider.id === id)?.name ?? id,
    [providers],
  );

  if (isLoading) {
    return (
      <PageSection>
        <EmptyState icon={Spinner} titleText="Loading agents" />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <Title headingLevel="h1" size="2xl">
        {pageTitle(SECTION.AGENTS)}
      </Title>

      <ErrorAlert title="Could not load the agents" error={error} />
      <ErrorAlert title="The action failed" error={actionError} onClose={clearError} />

      {/* The toolbar sits right under the heading, so it carries the gap
          between the two rather than the title carrying a bottom margin. */}
      <AgentListToolbar
        hasAgents={agents.length > 0}
        isAllSelected={visibleAgents.length > 0 && selectedNames.length === visibleAgents.length}
        isDeleteDisabled={selectedNames.length === 0 || isPending}
        onFilter={setFilterValue}
        onToggleSelectAll={handleCheckAll}
        onBulkDelete={() => setWantDelete(selectedNames)}
        onCreate={() => navigate(ROUTE.CREATE)}
      />

      {agents.length > 0 && visibleAgents.length === 0 && (
        <EmptyState
          variant={EmptyStateVariant.sm}
          icon={SearchIcon}
          titleText="Nothing Found"
          data-testid="nothing-found"
        >
          <EmptyStateBody>
            No agents match the filter criteria. Clear filter to show results.
          </EmptyStateBody>
        </EmptyState>
      )}

      {agents.length === 0 && error === undefined ? (
        <EmptyState icon={CubesIcon} titleText="No agents yet">
          <EmptyStateBody>Create your first agent from a git repository.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button
                variant={ButtonVariant.primary}
                onClick={() => navigate(ROUTE.CREATE)}
                data-testid="empty-create-button"
              >
                Create Agent
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <Table aria-label="Agents" variant="compact" data-testid="agents-table">
          <Thead>
            <Tr>
              <Th screenReaderText="Row select" />
              <Th>Status</Th>
              <Th>Name</Th>
              <Th>Repository</Th>
              <Th>AI provider</Th>
              <Th>Age</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {visibleAgents.map((agent, rowIndex) => {
              const name = agent.metadata.name;
              return (
                <Tr key={agent.metadata.uid ?? name} data-testid={`agent-row-${name}`}>
                  <Td
                    select={{
                      rowIndex,
                      isSelected: selectedNames.includes(name),
                      onSelect: (_event, isSelected) => handleCheck(name, isSelected),
                    }}
                  />
                  <Td dataLabel="Status">
                    <AgentStatusLabel phase={getAgentPhase(agent)} agent={agent} />
                  </Td>
                  <Td dataLabel="Name">
                    <Link to={buildAgentDetailsRoute(name)}>{name}</Link>
                  </Td>
                  <Td dataLabel="Repository">
                    <Content component="small">{getAgentRepository(agent)}</Content>
                  </Td>
                  <Td dataLabel="AI provider">
                    {(() => {
                      const id = getAgentProviderId(agent);
                      return id === undefined ? '-' : providerName(id);
                    })()}
                  </Td>
                  <Td dataLabel="Age">{formatAge(agent.metadata.creationTimestamp)}</Td>
                  <Td dataLabel="Actions" isActionCell>
                    <ActionsColumn items={buildActions(agent)} />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      <DeleteAgentModal
        isOpen={wantDelete !== undefined}
        agentNames={wantDelete ?? []}
        isDeleting={deletingNames !== undefined}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setWantDelete(undefined)}
      />
    </PageSection>
  );
}
