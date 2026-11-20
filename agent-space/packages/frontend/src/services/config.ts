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

/**
 * Runtime configuration, read from `config.json` next to the bundle so a
 * deployment can be re-pointed without rebuilding the application.
 *
 * The prototype always runs on the in-memory mock backend, so there is no
 * cluster to point at - only where the agents live and where the "Workspaces"
 * button sends the user back to.
 */
export interface AgentSpaceConfig {
  /** Namespace to work in. Empty means "resolve at startup". */
  namespace: string;
  /** Where the "Workspaces" button sends the user back to. */
  dashboardUrl: string;
}

export const DEFAULT_CONFIG: AgentSpaceConfig = {
  namespace: '',
  dashboardUrl: '../#/workspaces',
};

const CONFIG_URL = './config.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickString(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : fallback;
}

export function normalizeConfig(raw: unknown): AgentSpaceConfig {
  if (!isRecord(raw)) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    namespace: pickString(raw, 'namespace', DEFAULT_CONFIG.namespace),
    dashboardUrl: pickString(raw, 'dashboardUrl', DEFAULT_CONFIG.dashboardUrl),
  };
}

/** `?namespace=` wins over config.json. */
export function applyUrlOverrides(
  config: AgentSpaceConfig,
  search = window.location.search,
): AgentSpaceConfig {
  const params = new URLSearchParams(search);
  const namespace = params.get('namespace');

  return {
    ...config,
    namespace: namespace || config.namespace,
  };
}

/**
 * Points at another route of the dashboard's own SPA, reusing whatever entry
 * point `dashboardUrl` was configured with so a relocated dashboard is still
 * reached correctly.
 */
export function dashboardRoute(dashboardUrl: string, route: string): string {
  const [base] = dashboardUrl.split('#');
  return `${base}#${route}`;
}

export async function loadConfig(): Promise<AgentSpaceConfig> {
  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-cache' });
    if (!response.ok) {
      return applyUrlOverrides({ ...DEFAULT_CONFIG });
    }
    return applyUrlOverrides(normalizeConfig(await response.json()));
  } catch {
    // Missing config.json is expected in tests and in some dev setups.
    return applyUrlOverrides({ ...DEFAULT_CONFIG });
  }
}
