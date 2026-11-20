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

import { EmptyState, EmptyStateBody, PageSection } from '@patternfly/react-core';
import { RobotIcon } from '@patternfly/react-icons';
import React from 'react';

import { PtyTerminal } from '@/components/PtyTerminal';
import styles from '@/pages/AgentDetails/AgentTab/index.module.css';
import {
  getAgentPhase,
  getAgentProviderId,
  getAgentRepository,
  getAgentSandboxName,
  getAgentWorkingDir,
} from '@/services/agent';
import { AgentHarness, getAgentHarness } from '@/services/harnesses';
import { Agent, AgentPhase } from '@/services/types';
import { useAppSelector } from '@/store/hooks';
import { selectProviders } from '@/store/Providers';

export type Props = {
  agent: Agent;
};

/**
 * The session view of an agent: a CLI harness - Claude Code, Codex or the
 * Gemini CLI - running in a terminal against the repository cloned inside
 * the sandbox.
 *
 * The real harnesses are TUIs, so the session is a terminal, not a bespoke
 * chat panel: `PtyTerminal` embeds the actual program over the same relay
 * the production dashboard backend would provide.
 */
export function AgentTab({ agent }: Props): React.ReactElement {
  const harness = getAgentHarness(getAgentProviderId(agent));

  if (getAgentPhase(agent) !== AgentPhase.RUNNING) {
    return (
      <PageSection data-testid="agent-tab">
        <EmptyState icon={RobotIcon} titleText="The agent is not running" headingLevel="h2">
          <EmptyStateBody>
            The harness session is available while the sandbox is running. Start the agent first.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (harness === undefined) {
    return (
      <PageSection data-testid="agent-tab">
        <EmptyState icon={RobotIcon} titleText="No AI provider attached" headingLevel="h2">
          <EmptyStateBody>
            The agent has no AI provider with a harness, so there is nothing to run.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection data-testid="agent-tab">
      <HarnessSession agent={agent} harness={harness} />
    </PageSection>
  );
}

type SessionProps = {
  agent: Agent;
  harness: AgentHarness;
};

/** The terminal session with one harness. */
function HarnessSession({ agent, harness }: SessionProps): React.ReactElement {
  const providers = useAppSelector(selectProviders);
  const providerName =
    providers.find(provider => provider.id === harness.providerId)?.name ?? harness.providerId;

  return (
    <div className={styles.session} data-testid="agent-session">
      <div className={styles.header} data-testid="agent-session-header">
        {harness.name} · {providerName} · {getAgentSandboxName(agent)} · {getAgentWorkingDir(agent)}
      </div>
      {/* The prototype server runs the harness CLI on the host it runs on;
          production would exec it inside the OpenShell sandbox, over the
          dashboard backend's relay, with keys from OpenShell Providers. */}
      <span className={styles.note} data-testid="agent-session-note">
        Prototype: runs on the prototype host, not in an OpenShell sandbox.
      </span>
      <PtyTerminal
        agentName={agent.metadata.name}
        repositoryUrl={getAgentRepository(agent)}
        mode={harness.command}
        sessionName={`${harness.name} session`}
      />
    </div>
  );
}
