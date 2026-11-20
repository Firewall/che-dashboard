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

import { Alert, Button, ButtonVariant, Content, PageSection, Title } from '@patternfly/react-core';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTE } from '@/Routes';

/**
 * The "Create Workspace" item of the mock Workspaces navigation. The real
 * creation flow belongs to the Che dashboard, so the page only says that and
 * offers the way back.
 */
export function CreateWorkspace(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <PageSection>
      <Title headingLevel="h1" size="2xl">
        Create Workspace
      </Title>

      <Alert
        variant="info"
        isInline
        title="Not part of this prototype"
        data-testid="create-workspace-mock-alert"
      >
        <Content>
          Creating workspaces belongs to the Che dashboard. This page stands in so the Workspaces
          navigation reads like the real one; the Agent Space prototype only creates agents.
        </Content>
      </Alert>

      <div style={{ marginTop: '1rem' }}>
        <Button
          variant={ButtonVariant.secondary}
          onClick={() => navigate(ROUTE.WORKSPACES)}
          data-testid="back-to-workspaces"
        >
          Back to Workspaces
        </Button>
      </div>
    </PageSection>
  );
}
