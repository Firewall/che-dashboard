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

import { Agent, AgentAction, AgentPhase, OPENSHELL_PROVIDER_ANNOTATION } from '@/services/types';

/**
 * The phase of an agent. The DevWorkspace publishes it in `status.phase`, so
 * no folding of conditions is needed - only a fallback for the moment between
 * "created" and "first reconciliation".
 */
export function getAgentPhase(agent: Agent): AgentPhase {
  return agent.status?.phase ?? AgentPhase.STARTING;
}

/** Phases the agent leaves on its own, without anyone asking it to. */
export function isTransitioning(phase: AgentPhase): boolean {
  return phase === AgentPhase.STARTING;
}

/**
 * The lifecycle actions a phase allows. An agent that is starting is already
 * on its way up, so stopping it is the only thing left to ask for.
 */
export function getAvailableActions(phase: AgentPhase): AgentAction[] {
  switch (phase) {
    case AgentPhase.RUNNING:
    case AgentPhase.STARTING:
      return ['stop'];
    case AgentPhase.STOPPED:
      return ['start'];
    default:
      return [];
  }
}

export const ACTION_LABELS: Record<AgentAction, string> = {
  start: 'Start',
  stop: 'Stop',
};

/** The git remote the sandbox clones on launch; empty for an agent with none. */
export function getAgentRepositoryUrl(agent: Agent): string {
  const [project] = agent.spec?.template?.projects ?? [];
  return project?.git?.remotes?.origin ?? '';
}

/** The repository for display. */
export function getAgentRepository(agent: Agent): string {
  return getAgentRepositoryUrl(agent) || 'None';
}

/**
 * The repository name, as the sandbox sees it after the launch clone:
 * `/sandbox/<repository>`. Falls back on the agent name, which is itself
 * derived from the repository.
 */
export function getAgentRepositoryName(agent: Agent): string {
  const [project] = agent.spec?.template?.projects ?? [];
  return project?.name ?? agent.metadata.name;
}

/** Where the agent harness and the shell start: `/sandbox/<repository>`. */
export function getAgentWorkingDir(agent: Agent): string {
  return getAgentRepositoryUrl(agent) === ''
    ? '/sandbox'
    : `/sandbox/${getAgentRepositoryName(agent)}`;
}

/** The container image the agent runs. */
export function getAgentImage(agent: Agent): string {
  const [component] = agent.spec?.template?.components ?? [];
  return component?.container?.image ?? '-';
}

/** The name of the OpenShell sandbox behind the agent. */
export function getAgentSandboxName(agent: Agent): string {
  return agent.status?.openshell?.sandbox ?? '-';
}

/** The OpenShell AI provider the agent was created with. */
export function getAgentProviderId(agent: Agent): string | undefined {
  const value = agent.metadata?.annotations?.[OPENSHELL_PROVIDER_ANNOTATION];
  return value === undefined || value === '' ? undefined : value;
}
