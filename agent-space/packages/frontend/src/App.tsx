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
  Bullseye,
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Spinner,
} from '@patternfly/react-core';
import React from 'react';
import { HashRouter } from 'react-router-dom';

import { useAgentWatch } from '@/hooks/useAgentWatch';
import { useDashboardTheme } from '@/hooks/useDashboardTheme';
import { Layout } from '@/Layout';
import { AppRoutes } from '@/Routes';
import { DEFAULT_CONFIG } from '@/services/config';
import {
  bootstrapActionCreators,
  selectBootstrapError,
  selectBootstrapIsReady,
} from '@/store/Bootstrap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { providersActionCreators } from '@/store/Providers';

/**
 * Resolves the runtime configuration, the API client and the namespace before
 * rendering anything, so no page has to deal with a half-initialised store.
 */
export function App(): React.ReactElement {
  const dispatch = useAppDispatch();
  const isReady = useAppSelector(selectBootstrapIsReady);
  const error = useAppSelector(selectBootstrapError);

  const { isDarkTheme } = useDashboardTheme();

  const bootstrap = React.useCallback(() => {
    void dispatch(bootstrapActionCreators.requestBootstrap());
  }, [dispatch]);

  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // The provider list comes from the OpenShell administrator's configuration
  // and only changes with it, so once per session is enough. The create form
  // reads it.
  React.useEffect(() => {
    if (isReady) {
      void dispatch(providersActionCreators.requestProviders());
    }
  }, [dispatch, isReady]);

  useAgentWatch(isReady);

  if (error !== undefined) {
    return (
      <Bullseye>
        <EmptyState titleText="Agent Space could not start" status="danger">
          <EmptyStateBody>{error.message}</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant={ButtonVariant.primary} onClick={bootstrap}>
                Try again
              </Button>
              <Button component="a" href={DEFAULT_CONFIG.dashboardUrl} variant={ButtonVariant.link}>
                Back to Workspaces
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </Bullseye>
    );
  }

  if (!isReady) {
    return (
      <Bullseye>
        <EmptyState icon={Spinner} titleText="Starting Agent Space" />
      </Bullseye>
    );
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout isDarkTheme={isDarkTheme}>
        <AppRoutes />
      </Layout>
    </HashRouter>
  );
}
