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

import { getAgentHarness } from '@/services/harnesses';
import {
  Agent,
  AGENT_IMAGE,
  CreateAgentRequest,
  DEVWORKSPACE_API_VERSION,
  DEVWORKSPACE_KIND,
  OPENSHELL_PROVIDER_ANNOTATION,
  WORKLOAD_KIND_ATTRIBUTE,
} from '@/services/types';

/** `https://github.com/spring-projects/spring-petclinic` and friends. */
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i;

/** `git@github.com:spring-projects/spring-petclinic.git` and friends. */
const GIT_SSH_URL_PATTERN = /^git@[\w.-]+[:/]\S+$/;

/** How much of the repository name is kept before the random suffix. */
const MAX_NAME_PREFIX_LENGTH = 40;

/**
 * Validates the one required field of the create form.
 *
 * The repository is cloned inside the sandbox on launch, so anything the git
 * CLI could not clone would only fail there; the form settles for "looks like
 * a URL git understands".
 */
export function validateRepositoryUrl(repositoryUrl: string): string | undefined {
  const value = repositoryUrl.trim();
  if (value === '') {
    return 'A repository URL is required.';
  }
  if (!HTTP_URL_PATTERN.test(value) && !GIT_SSH_URL_PATTERN.test(value)) {
    return 'Enter an http(s) or git@ repository URL, for example https://github.com/spring-projects/spring-petclinic.';
  }
  return undefined;
}

/**
 * The repository name out of its URL: the last path segment, `.git` removed.
 *
 * `https://github.com/spring-projects/spring-petclinic` and
 * `git@github.com:spring-projects/spring-petclinic.git` both give `spring-petclinic`.
 */
export function getRepositoryName(repositoryUrl: string): string | undefined {
  const trimmed = repositoryUrl.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return undefined;
  }
  const segment = trimmed.split(/[/:]/).pop();
  if (segment === undefined || segment === '') {
    return undefined;
  }
  const name = segment.replace(/\.git$/, '');
  return name === '' ? undefined : name;
}

/** Four hex characters, the suffix that keeps two agents of one repo apart. */
export function randomNameSuffix(): string {
  let suffix = Math.floor(Math.random() * 0x10000).toString(16);
  while (suffix.length < 4) {
    suffix = `0${suffix}`;
  }
  return suffix;
}

/**
 * Kubernetes-name-safe repository name: lowercase, digits and dashes only,
 * cut well before the 253-character limit so the suffix always fits.
 */
function toNamePrefix(repositoryName: string): string {
  const slug = repositoryName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, MAX_NAME_PREFIX_LENGTH)
    .replace(/-+$/, '');
  return slug === '' ? 'agent' : slug;
}

/**
 * The name of an agent: the harness it runs, the repository it works on and a
 * short random suffix, e.g. `claude-spring-petclinic-7f3a`.
 */
export function deriveAgentName(repositoryUrl: string, providerId: string): string {
  const repositoryName = toNamePrefix(getRepositoryName(repositoryUrl) ?? 'agent');
  const harness = getAgentHarness(providerId)?.command ?? 'agent';
  return `${harness}-${repositoryName}-${randomNameSuffix()}`;
}

/**
 * The name of the OpenShell sandbox behind an agent: `dw-<name>-<4 hex>`,
 * the shape the DevWorkspace Operator's OpenShell controller produces.
 */
export function deriveSandboxName(agentName: string): string {
  return `dw-${agentName}-${randomNameSuffix()}`;
}

/**
 * Builds the DevWorkspace the create form submits.
 *
 * The object is deliberately shaped like the real one: `workload-kind: openshell` in
 * the template attributes, the git remote in the projects, the fixed image
 * in the single container component, and the provider choices in an
 * annotation the controller reads.
 */
export function buildAgent(namespace: string, request: CreateAgentRequest, name: string): Agent {
  const repositoryName = getRepositoryName(request.repositoryUrl) ?? name;

  return {
    apiVersion: DEVWORKSPACE_API_VERSION,
    kind: DEVWORKSPACE_KIND,
    metadata: {
      name,
      namespace,
      annotations: {
        [OPENSHELL_PROVIDER_ANNOTATION]: request.providerId,
      },
    },
    spec: {
      started: true,
      template: {
        attributes: {
          [WORKLOAD_KIND_ATTRIBUTE]: 'openshell',
        },
        projects: [
          {
            name: repositoryName,
            git: {
              remotes: { origin: request.repositoryUrl.trim() },
            },
          },
        ],
        components: [
          {
            name: 'openshell-agent',
            container: { image: AGENT_IMAGE },
          },
        ],
      },
    },
  };
}
