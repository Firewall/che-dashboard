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
  Breadcrumb,
  BreadcrumbItem,
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  PageSection,
  Spinner,
  Stack,
  StackItem,
  Tab,
  Tabs,
  Title,
} from '@patternfly/react-core';
import { TrashIcon } from '@patternfly/react-icons';
import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { AgentStatusLabel } from '@/components/AgentStatusLabel';
import { DeleteAgentModal } from '@/components/DeleteAgentModal';
import { ErrorAlert } from '@/components/ErrorAlert';
import { AgentTab } from '@/pages/AgentDetails/AgentTab';
import { EventsTab } from '@/pages/AgentDetails/EventsTab';
import { ManifestTab } from '@/pages/AgentDetails/ManifestTab';
import { OverviewTab } from '@/pages/AgentDetails/OverviewTab';
import { TerminalTab } from '@/pages/AgentDetails/TerminalTab';
import { AGENT_TAB, isAgentTab, ROUTE } from '@/Routes';
import { ACTION_LABELS, getAgentPhase, getAvailableActions } from '@/services/agent';
import { pageTitle, SECTION } from '@/services/pageTitle';
import { AgentAction, AgentPhase } from '@/services/types';
import {
  agentDetailsActionCreators,
  selectAgentDetails,
  selectAgentDetailsError,
  selectAgentDetailsEvents,
  selectAgentDetailsEventsError,
  selectAgentDetailsIsLoading,
  selectAgentDetailsName,
  selectAgentDetailsResourceVersion,
} from '@/store/AgentDetails';
import {
  agentsActionCreators,
  selectAgentActionError,
  selectAgentActionPendingName,
} from '@/store/Agents';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/**
 * How often the Events tab re-reads, while it is the tab on screen. Events are
 * cheap to list and a starting agent produces them steadily.
 */
export const EVENTS_REFRESH_INTERVAL_MS = 10_000;

/**
 * Read view for a single agent, split into tabs the way the dashboard splits
 * workspace details: the session itself - harness chat and terminal - when
 * the agent is running, and what it is, what happened to it, and the manifest
 * it was created from at any time.
 *
 * The active tab lives in `?tab=`, so a tab can be bookmarked and shared.
 */
export function AgentDetails(): React.ReactElement {
  const { name = '' } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const dispatch = useAppDispatch();

  const agent = useAppSelector(selectAgentDetails);
  const events = useAppSelector(selectAgentDetailsEvents);
  const eventsError = useAppSelector(selectAgentDetailsEventsError);
  const error = useAppSelector(selectAgentDetailsError);
  const loadedName = useAppSelector(selectAgentDetailsName);
  const resourceVersion = useAppSelector(selectAgentDetailsResourceVersion);
  const pendingName = useAppSelector(selectAgentActionPendingName);
  const actionError = useAppSelector(selectAgentActionError);

  // What the store holds still describes the previous agent until the first
  // request for this one lands, so the route decides whether it may be shown.
  const isLoading = useAppSelector(selectAgentDetailsIsLoading) || loadedName !== name;

  const [wantDelete, setWantDelete] = React.useState(false);

  const tabParam = searchParams.get('tab');
  // The session view is where a running agent is meant to be opened, so it is
  // the default tab then; anything else falls back to the read-only overview.
  const fallbackTab =
    agent !== undefined && getAgentPhase(agent) === AgentPhase.RUNNING
      ? AGENT_TAB.AGENT
      : AGENT_TAB.OVERVIEW;
  const activeTab = isAgentTab(tabParam) ? tabParam : fallbackTab;

  React.useEffect(() => {
    void dispatch(agentDetailsActionCreators.requestAgentDetails(name));
  }, [dispatch, name]);

  // The agent itself is kept current by the namespace watch; its events are
  // not watched, so they are re-read whenever the watch reports a new version.
  // The version the initial load came with is not one of those: its events
  // arrived with it.
  const seen = React.useRef<{ name: string; version: string } | undefined>(undefined);
  React.useEffect(() => {
    if (loadedName !== name || resourceVersion === undefined) {
      return;
    }
    const previous = seen.current;
    seen.current = { name, version: resourceVersion };
    if (previous?.name === name && previous.version !== resourceVersion) {
      void dispatch(agentDetailsActionCreators.requestAgentEvents(name));
    }
  }, [dispatch, loadedName, name, resourceVersion]);

  // The watch is not enough on its own: the mock appends an event for each
  // step of the start sequence, and a slow watch delivery would leave the tab
  // behind. While the tab is open the events are re-read on a timer; closing
  // it stops the polling.
  React.useEffect(() => {
    if (activeTab !== AGENT_TAB.EVENTS || loadedName !== name) {
      return;
    }
    const refresh = () => void dispatch(agentDetailsActionCreators.requestAgentEvents(name));
    refresh();
    const timer = window.setInterval(refresh, EVENTS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeTab, dispatch, loadedName, name]);

  const handleTabSelect = React.useCallback(
    (_event: React.MouseEvent<HTMLElement, MouseEvent>, tab: string | number) => {
      setSearchParams({ tab: String(tab) }, { replace: true });
    },
    [setSearchParams],
  );

  const clearError = React.useCallback(
    () => dispatch(agentsActionCreators.clearActionError()),
    [dispatch],
  );

  const runAction = React.useCallback(
    async (action: AgentAction) => {
      await dispatch(agentsActionCreators.runAgentAction(name, action));
    },
    [dispatch, name],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    await dispatch(agentsActionCreators.deleteAgent(name));
    setWantDelete(false);
    navigate(ROUTE.AGENTS);
  }, [dispatch, name, navigate]);

  if (isLoading) {
    return (
      <PageSection>
        <EmptyState icon={Spinner} titleText="Loading agent" />
      </PageSection>
    );
  }

  if (agent === undefined) {
    return (
      <PageSection>
        <ErrorAlert
          title={`Could not load the agent '${name}'`}
          error={error ?? { statusCode: 404, message: `Agent '${name}' was not found.` }}
        />
        <EmptyState titleText="Agent unavailable">
          <EmptyStateBody>
            <Link to={ROUTE.AGENTS}>Back to the agents list</Link>
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  const phase = getAgentPhase(agent);
  const isBusy = pendingName !== undefined;

  return (
    <>
      <PageSection>
        <Stack hasGutter>
          <StackItem>
            <Breadcrumb>
              <BreadcrumbItem to="#" onClick={() => navigate(ROUTE.AGENTS)}>
                {pageTitle(SECTION.AGENTS)}
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{name}</BreadcrumbItem>
            </Breadcrumb>
          </StackItem>
          <StackItem>
            <Flex>
              <FlexItem alignSelf={{ default: 'alignSelfCenter' }}>
                <Title headingLevel="h1" size="2xl">
                  {name}
                </Title>
              </FlexItem>
              <FlexItem alignSelf={{ default: 'alignSelfCenter' }}>
                <AgentStatusLabel phase={phase} agent={agent} />
              </FlexItem>
              <FlexItem align={{ default: 'alignRight' }}>
                <Flex>
                  <FlexItem>
                    <Button
                      variant={ButtonVariant.secondary}
                      isDisabled={isBusy || phase !== AgentPhase.RUNNING}
                      onClick={() => setSearchParams({ tab: AGENT_TAB.AGENT }, { replace: true })}
                      data-testid="action-open"
                    >
                      Open
                    </Button>
                  </FlexItem>
                  {getAvailableActions(phase).map(action => (
                    <FlexItem key={action}>
                      <Button
                        variant={ButtonVariant.secondary}
                        isDisabled={isBusy}
                        isLoading={pendingName === name}
                        onClick={() => void runAction(action)}
                        data-testid={`action-${action}`}
                      >
                        {ACTION_LABELS[action]}
                      </Button>
                    </FlexItem>
                  ))}
                  <FlexItem>
                    <Button
                      variant={ButtonVariant.danger}
                      icon={<TrashIcon />}
                      iconPosition="left"
                      isDisabled={isBusy}
                      onClick={() => setWantDelete(true)}
                      data-testid="delete-button"
                    >
                      Delete
                    </Button>
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </StackItem>
          <StackItem>
            <ErrorAlert title="The action failed" error={actionError} onClose={clearError} />
          </StackItem>
        </Stack>
      </PageSection>

      <PageSection>
        <Tabs activeKey={activeTab} onSelect={handleTabSelect} data-testid="agent-tabs">
          <Tab eventKey={AGENT_TAB.AGENT} title={AGENT_TAB.AGENT}>
            <AgentTab agent={agent} />
          </Tab>
          <Tab eventKey={AGENT_TAB.OVERVIEW} title={AGENT_TAB.OVERVIEW}>
            <OverviewTab agent={agent} />
          </Tab>
          <Tab eventKey={AGENT_TAB.EVENTS} title={AGENT_TAB.EVENTS}>
            <EventsTab events={events} error={eventsError} />
          </Tab>
          <Tab eventKey={AGENT_TAB.MANIFEST} title={AGENT_TAB.MANIFEST}>
            <ManifestTab agent={agent} />
          </Tab>
          <Tab eventKey={AGENT_TAB.TERMINAL} title={AGENT_TAB.TERMINAL}>
            <TerminalTab agent={agent} />
          </Tab>
        </Tabs>
      </PageSection>

      <DeleteAgentModal
        isOpen={wantDelete}
        agentNames={[name]}
        isDeleting={pendingName === name}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setWantDelete(false)}
      />
    </>
  );
}
