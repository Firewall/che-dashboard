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

import { Alert, Label, PageSection, Title } from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React from 'react';
import { Link } from 'react-router-dom';

import { ROUTE } from '@/Routes';
import { formatAge } from '@/services/format';

/** One row of the mock, shaped like the columns the Che dashboard shows. */
interface MockWorkspace {
  name: string;
  status: 'Running' | 'Starting' | 'Stopped';
  project: string;
  lastModified: string;
}

const HOUR_MS = 36e5;

/** The workspaces the mock dashboard opens on. */
const WORKSPACES: MockWorkspace[] = [
  {
    name: 'spring-petclinic-x2f9',
    status: 'Running',
    project: 'https://github.com/spring-projects/spring-petclinic',
    lastModified: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
  },
  {
    name: 'quarkus-quickstarts-8k1d',
    status: 'Stopped',
    project: 'https://github.com/quarkusio/quarkus-quickstarts',
    lastModified: new Date(Date.now() - 26 * HOUR_MS).toISOString(),
  },
  {
    name: 'devfile-registry-p4m7',
    status: 'Running',
    project: 'https://github.com/devfile/api',
    lastModified: new Date(Date.now() - 5 * 24 * HOUR_MS).toISOString(),
  },
];

const STATUS_COLORS: Record<MockWorkspace['status'], 'green' | 'blue' | 'grey'> = {
  Running: 'green',
  Starting: 'blue',
  Stopped: 'grey',
};

/**
 * The Workspaces area of the prototype: a stand-in for the Che dashboard's
 * workspaces list, served by this bundle so the toggle in the masthead has
 * somewhere real-looking to land.
 *
 * Nothing here talks to a cluster - the rows are seeded and the actions only
 * say that they were not performed.
 */
export function Workspaces(): React.ReactElement {
  const [toast, setToast] = React.useState<{ action: string; name: string } | undefined>(undefined);

  const buildActions = React.useCallback(
    (workspace: MockWorkspace): IAction[] =>
      (['Open', 'Stop', 'Delete'] as const).map(action => ({
        title: action,
        onClick: () => setToast({ action, name: workspace.name }),
      })),
    [],
  );

  return (
    <PageSection>
      <Title headingLevel="h1" size="2xl">
        Workspaces
      </Title>

      <Alert
        variant="info"
        isInline
        title="Mock of the Che dashboard Workspaces page"
        data-testid="workspaces-mock-alert"
      >
        The Agent Space prototype serves this page itself. The real dashboard keeps its own
        Workspaces list next to Agent Space.
      </Alert>

      <Table
        aria-label="Workspaces"
        variant="compact"
        data-testid="workspaces-table"
        style={{ marginTop: '1rem' }}
      >
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Project</Th>
            <Th>Last Modified</Th>
            <Th screenReaderText="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {WORKSPACES.map(workspace => (
            <Tr key={workspace.name} data-testid={`workspace-row-${workspace.name}`}>
              <Td dataLabel="Name">
                <Link
                  to={ROUTE.WORKSPACES}
                  onClick={() => setToast({ action: 'Open', name: workspace.name })}
                >
                  {workspace.name}
                </Link>
              </Td>
              <Td dataLabel="Status">
                <Label color={STATUS_COLORS[workspace.status]}>{workspace.status}</Label>
              </Td>
              <Td dataLabel="Project">{workspace.project}</Td>
              <Td dataLabel="Last Modified">{formatAge(workspace.lastModified)}</Td>
              <Td dataLabel="Actions" isActionCell>
                <ActionsColumn items={buildActions(workspace)} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {toast !== undefined && (
        <Alert
          variant="info"
          isInline
          title={`'${toast.action}' on '${toast.name}' was not performed - the Workspaces page is a mock.`}
          data-testid="workspaces-action-toast"
        />
      )}
    </PageSection>
  );
}
