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
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { FileIcon } from '@patternfly/react-icons';
import React from 'react';

import styles from '@/components/EventsTimeline/index.module.css';
import { EventsTimelineItem } from '@/components/EventsTimeline/Item';
import { compareEventTime } from '@/services/format';
import { AgentEvent } from '@/services/types';

export type Props = {
  events: AgentEvent[];
  /** The last listing failed, so an empty list says nothing about the agent. */
  hasFailed?: boolean;
};

/**
 * The lifecycle events of an agent, on the same vertical timeline the
 * dashboard uses for workspace events.
 */
export function EventsTimeline({ events, hasFailed = false }: Props): React.ReactElement {
  const items = React.useMemo(
    () => events.filter(event => event.message).sort(compareEventTime),
    [events],
  );

  if (items.length === 0) {
    return (
      <EmptyState icon={FileIcon} titleText="No events to show." data-testid="no-events">
        <EmptyStateBody>
          {hasFailed
            ? 'The events could not be listed, so this is not a statement about the agent.'
            : `An agent that is still starting will fill this in within a few seconds.`}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div role="log" aria-label="Agent events" data-testid="events-timeline">
      <Stack>
        <StackItem>
          <Flex>
            <FlexItem>
              <Content component={ContentVariants.small}>Most recent events first.</Content>
            </FlexItem>
            <FlexItem align={{ default: 'alignRight' }}>
              <Content component={ContentVariants.small}>
                Showing {items.length} {items.length === 1 ? 'event' : 'events'}
              </Content>
            </FlexItem>
          </Flex>
        </StackItem>
        <StackItem>
          <div className={styles.eventsTimeline}>
            <Stack hasGutter>
              {items.map(event => (
                <StackItem key={event.uid}>
                  <div className={styles.fadeIn}>
                    <EventsTimelineItem event={event} />
                  </div>
                </StackItem>
              ))}
            </Stack>
          </div>
        </StackItem>
        <StackItem>
          <Content component={ContentVariants.small} className={styles.footer}>
            Older events are not stored.
          </Content>
        </StackItem>
      </Stack>
    </div>
  );
}
