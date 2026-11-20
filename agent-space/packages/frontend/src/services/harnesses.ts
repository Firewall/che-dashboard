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
 * The CLI agent harnesses an OpenShell sandbox can run, one per AI provider.
 *
 * A harness is only offered for the providers the agent was created with: it
 * reads the provider's model through the env the OpenShell supervisor injects,
 * so a harness whose provider is not attached has nothing to talk to.
 */
export interface AgentHarness {
  /** Stable id, used to key the session of a harness. */
  id: string;
  /** Display name, as the harness brands itself. */
  name: string;
  /** The OpenShell provider the harness reads. */
  providerId: string;
  /** The CLI a terminal session with this harness runs. */
  command: 'claude' | 'codex' | 'gemini';
}

/** Harness per AI provider. */
const HARNESS_BY_PROVIDER: Record<
  string,
  { id: string; name: string; command: AgentHarness['command'] }
> = {
  anthropic: { id: 'claude-code', name: 'Claude Code', command: 'claude' },
  openai: { id: 'codex', name: 'Codex', command: 'codex' },
  vertex: { id: 'gemini-cli', name: 'Gemini CLI', command: 'gemini' },
};

/** The harness of the agent's AI provider, if the provider has one. */
export function getAgentHarness(providerId: string | undefined): AgentHarness | undefined {
  if (providerId === undefined || HARNESS_BY_PROVIDER[providerId] === undefined) {
    return undefined;
  }
  return { providerId, ...HARNESS_BY_PROVIDER[providerId] };
}
