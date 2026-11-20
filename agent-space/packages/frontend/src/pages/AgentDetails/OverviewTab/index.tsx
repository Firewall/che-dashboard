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
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  PageSection,
} from '@patternfly/react-core';
import React from 'react';

import {
  getAgentImage,
  getAgentProviderId,
  getAgentRepository,
  getAgentSandboxName,
} from '@/services/agent';
import { formatTimestamp } from '@/services/format';
import { getAgentHarness } from '@/services/harnesses';
import { Agent, AGENT_POLICY } from '@/services/types';
import { useAppSelector } from '@/store/hooks';
import { selectProviders } from '@/store/Providers';

export type Props = {
  agent: Agent;
};

/**
 * What the agent is: the repository it clones, the AI provider it runs with,
 * and the fixed choices the administrator made on its behalf.
 */
export function OverviewTab({ agent }: Props): React.ReactElement {
  const providers = useAppSelector(selectProviders);

  const providerId = getAgentProviderId(agent);
  const providerName =
    providers.find(provider => provider.id === providerId)?.name ?? providerId ?? '-';
  const harness = getAgentHarness(providerId);

  return (
    <PageSection data-testid="overview-tab">
      <DescriptionList isHorizontal columnModifier={{ default: '2Col' }}>
        <DescriptionListGroup>
          <DescriptionListTerm>Name</DescriptionListTerm>
          <DescriptionListDescription>{agent.metadata.name}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Namespace</DescriptionListTerm>
          <DescriptionListDescription>{agent.metadata.namespace ?? '-'}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Repository</DescriptionListTerm>
          <DescriptionListDescription>{getAgentRepository(agent)}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>AI provider</DescriptionListTerm>
          <DescriptionListDescription>{providerName}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Harness</DescriptionListTerm>
          <DescriptionListDescription>{harness?.name ?? '-'}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Sandbox</DescriptionListTerm>
          <DescriptionListDescription>{getAgentSandboxName(agent)}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Container image</DescriptionListTerm>
          <DescriptionListDescription>{getAgentImage(agent)}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Policy</DescriptionListTerm>
          <DescriptionListDescription>
            {AGENT_POLICY} (set by your OpenShell administrator)
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Storage</DescriptionListTerm>
          <DescriptionListDescription>Kept when stopped</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Created</DescriptionListTerm>
          <DescriptionListDescription>
            {formatTimestamp(agent.metadata.creationTimestamp)}
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </PageSection>
  );
}
