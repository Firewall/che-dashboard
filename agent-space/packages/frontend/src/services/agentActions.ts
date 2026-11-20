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

import { ACTION_LABELS, getAgentPhase, getAvailableActions } from '@/services/agent';
import { Agent, AgentAction, AgentPhase } from '@/services/types';

/**
 * One entry of an agent action menu, as a plain descriptor.
 *
 * The table renders these through `ActionsColumn` and the sidebar through a
 * `Dropdown`; describing them once here is what keeps the two menus offering
 * the same actions for the same phase.
 */
export type AgentActionItem =
  | { kind: 'separator'; key: string }
  | {
      kind: 'item';
      key: string;
      title: string;
      isDisabled: boolean;
      isDanger: boolean;
      onSelect: () => void;
    };

export interface AgentActionOptions {
  agent: Agent;
  /** True while another action is already running against the namespace. */
  isDisabled: boolean;
  onOpen: (name: string) => void;
  onRunAction: (name: string, action: AgentAction) => void;
  onDelete: (name: string) => void;
}

/**
 * The actions offered for one agent: Open while the sandbox is running, then
 * the lifecycle one its current phase allows, then Delete on its own.
 */
export function buildAgentActionItems({
  agent,
  isDisabled,
  onOpen,
  onRunAction,
  onDelete,
}: AgentActionOptions): AgentActionItem[] {
  const name = agent.metadata.name;
  const phase = getAgentPhase(agent);

  const items: AgentActionItem[] = [
    {
      kind: 'item',
      key: 'open',
      title: 'Open',
      // There is no session to open into until the sandbox is Running.
      isDisabled: isDisabled || phase !== AgentPhase.RUNNING,
      isDanger: false,
      onSelect: () => onOpen(name),
    },
  ];

  items.push(
    ...getAvailableActions(phase).map(action => ({
      kind: 'item' as const,
      key: action,
      title: ACTION_LABELS[action],
      isDisabled,
      isDanger: false,
      onSelect: () => onRunAction(name, action),
    })),
  );

  items.push({ kind: 'separator', key: 'delete-separator' });
  items.push({
    kind: 'item',
    key: 'delete',
    title: 'Delete',
    isDisabled,
    isDanger: true,
    onSelect: () => onDelete(name),
  });

  return items;
}
