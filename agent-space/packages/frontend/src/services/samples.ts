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

/** A ready-made repository the create page offers in one click. */
export interface AgentSample {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
}

export const AGENT_SAMPLES: AgentSample[] = [
  {
    id: 'universal-developer-agent-image',
    name: 'Universal Developer Agent Image',
    description:
      'An agent on the Universal Developer Image with an empty /sandbox. No repository is cloned.',
    repositoryUrl: '',
  },
];
