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
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import React from 'react';

import styles from '@/Layout/RecentList/index.module.css';
import { buildAgentActionItems } from '@/services/agentActions';
import { Agent, AgentAction } from '@/services/types';

export type Props = {
  agent: Agent;
  /** True while another action is already running against the namespace. */
  isDisabled: boolean;
  onOpen: (name: string) => void;
  onRunAction: (name: string, action: AgentAction) => void;
  onDelete: (name: string) => void;
};

/**
 * The kebab of a recent agent, offering the same actions as the row of the
 * agent list.
 *
 * The menu is hidden until the entry is hovered or focused, as in the
 * dashboard's recent workspaces, and stays visible while it is open so it does
 * not disappear from under the pointer on the way to an item.
 */
export function RecentAgentActions({
  agent,
  isDisabled,
  onOpen,
  onRunAction,
  onDelete,
}: Props): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  const name = agent.metadata.name;
  const items = buildAgentActionItems({
    agent,
    isDisabled,
    onOpen,
    onRunAction,
    onDelete,
  });

  return (
    // The entry as a whole opens the agent, so a click meant for the menu
    // must not reach it.
    <div
      className={`${styles.actions} ${isOpen ? styles.expanded : ''}`}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      role="presentation"
    >
      <Dropdown
        isOpen={isOpen}
        onOpenChange={open => setIsOpen(open)}
        onSelect={() => setIsOpen(false)}
        popperProps={{ position: 'right' }}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            variant="plain"
            isExpanded={isOpen}
            aria-label={`Actions for agent ${name}`}
            data-testid={`recent-actions-${name}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
      >
        <DropdownList>
          {items.map(item =>
            item.kind === 'separator' ? (
              <Divider key={item.key} component="li" />
            ) : (
              <DropdownItem
                key={item.key}
                isDisabled={item.isDisabled}
                isDanger={item.isDanger}
                data-testid={`recent-action-${item.key}`}
                onClick={item.onSelect}
              >
                {item.title}
              </DropdownItem>
            ),
          )}
        </DropdownList>
      </Dropdown>
    </div>
  );
}
