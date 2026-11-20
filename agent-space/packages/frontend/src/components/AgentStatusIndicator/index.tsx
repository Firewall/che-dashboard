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

import { Icon, IconComponentProps, Tooltip } from '@patternfly/react-core';
import React from 'react';

import styles from '@/components/AgentStatusIndicator/index.module.css';
import { PHASE_ICON } from '@/components/AgentStatusLabel';
import { AgentPhase } from '@/services/types';

const STATUS: Record<AgentPhase, IconComponentProps['status']> = {
  [AgentPhase.STARTING]: 'info',
  [AgentPhase.RUNNING]: 'success',
  // Plain, like the resting label the list shows: stopped on request is not
  // a warning.
  [AgentPhase.STOPPED]: undefined,
};

export type Props = {
  phase: AgentPhase;
  agentName: string;
};

/**
 * Phase of one agent as a single glyph, for the navigation sidebar.
 *
 * The same role the dashboard's `WorkspaceStatusIndicator` plays next to a
 * recent workspace: the list is read at a glance, and a full status label
 * would push the agent names out of the sidebar.
 */
export function AgentStatusIndicator({ phase, agentName }: Props): React.ReactElement {
  return (
    <Tooltip content={phase} position="right">
      <span
        role="img"
        className={styles.statusIndicator}
        data-testid="agent-status-indicator"
        aria-label={`Agent ${agentName} status is ${phase}`}
      >
        <Icon isInline status={STATUS[phase]}>
          {PHASE_ICON[phase]}
        </Icon>
      </span>
    </Tooltip>
  );
}
