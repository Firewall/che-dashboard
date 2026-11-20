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

import { MockAgentClient } from '@/services/client/mockClient';
import { AgentSpaceConfig } from '@/services/config';
import { AgentClient } from '@/services/types';

export { MockAgentClient } from '@/services/client/mockClient';

/**
 * Picks the client to talk to.
 *
 * The prototype has no cluster path: the OpenShell gateway and the
 * DevWorkspace Operator conversation it would stand in for are not built yet,
 * so every request runs against the in-memory client and the masthead says
 * so with its "Demo data" label.
 */
export function createAgentClient(config: AgentSpaceConfig): AgentClient {
  return new MockAgentClient(config.namespace || undefined);
}
