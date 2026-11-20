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

import { Label, LabelProps, Tooltip } from '@patternfly/react-core';
import { InProgressIcon, MoonIcon, ResourcesFullIcon } from '@patternfly/react-icons';
import React from 'react';

import styles from '@/components/AgentStatusLabel/index.module.css';
import { Agent, AgentPhase } from '@/services/types';

type PhaseAppearance = {
  color: LabelProps['color'];
  icon: React.ReactElement;
};

/**
 * Phases that are still moving get a turning glyph rather than a static one:
 * the rotation is what tells the user the page is live and nothing is stuck.
 *
 * It is a rotated icon and not a `Spinner` because a spinner takes its colour
 * from a variable of its own rather than from the label around it - see the
 * stylesheet.
 */
const inProgressIcon = <InProgressIcon className={styles.rotate} />;

/** The glyph of each phase, shared with the sidebar's status indicator. */
export const PHASE_ICON: Record<AgentPhase, React.ReactElement> = {
  [AgentPhase.STARTING]: inProgressIcon,
  [AgentPhase.RUNNING]: <ResourcesFullIcon />,
  [AgentPhase.STOPPED]: <MoonIcon />,
};

/**
 * Colour of each phase, following the dashboard's workspace status label:
 * green while up, blue while coming up, and a resting colour while stopped -
 * stopping is something the user asked for, not a fault.
 */
const APPEARANCE: Record<AgentPhase, PhaseAppearance> = {
  [AgentPhase.STARTING]: { color: 'blue', icon: PHASE_ICON[AgentPhase.STARTING] },
  [AgentPhase.RUNNING]: { color: 'green', icon: PHASE_ICON[AgentPhase.RUNNING] },
  [AgentPhase.STOPPED]: { color: 'purple', icon: PHASE_ICON[AgentPhase.STOPPED] },
};

export type Props = {
  phase: AgentPhase;
  /**
   * When given, the step the agent is on is shown as a tooltip, so a Starting
   * label says what it is waiting for without opening the details page.
   */
  agent?: Agent;
};

/** What each phase is waiting on, in the words the events tab uses. */
const TOOLTIP: Record<AgentPhase, string> = {
  [AgentPhase.STARTING]: 'The OpenShell sandbox is being requested and the repository cloned.',
  [AgentPhase.RUNNING]: 'The sandbox is up and the repository is cloned.',
  [AgentPhase.STOPPED]: 'Stopped. The repository and the provider are kept.',
};

/** Renders the lifecycle phase of an agent. */
export function AgentStatusLabel({ phase, agent }: Props): React.ReactElement {
  const { color, icon } = APPEARANCE[phase];

  const label = (
    <Label className={styles.statusLabel} color={color} icon={icon} data-testid="agent-status">
      {phase}
    </Label>
  );

  if (agent === undefined) {
    return label;
  }

  const tooltip = TOOLTIP[phase];
  if (!tooltip) {
    return label;
  }

  return (
    <Tooltip content={tooltip} position="right">
      {label}
    </Tooltip>
  );
}
