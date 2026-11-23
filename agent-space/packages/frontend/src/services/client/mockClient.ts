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

import { buildAgent, deriveAgentName, deriveSandboxName } from '@/services/agentFactory';
import {
  Agent,
  AgentClientError,
  AgentEvent,
  AgentPhase,
  AgentWatchEvent,
  AgentWatchListener,
  CreateAgentRequest,
  OpenshellProvider,
  StopWatching,
} from '@/services/types';

const DEFAULT_NAMESPACE = 'user-devspaces';

/**
 * The credential sets the prototype's fictional OpenShell administrator has
 * published. The real list comes from the gateway; here it is fixed.
 */
const PROVIDERS: OpenshellProvider[] = [
  {
    id: 'anthropic',
    name: 'Claude Code',
    description: 'Anthropic Claude models. Keys from the OpenShell anthropic provider.',
  },
  {
    id: 'openai',
    name: 'Codex',
    description: 'OpenAI GPT models. Keys from the OpenShell openai provider.',
  },
  {
    id: 'vertex',
    name: 'Gemini CLI',
    description: 'Google Gemini models on Vertex AI. Keys from the OpenShell vertex provider.',
  },
];

/**
 * When the mock moves an agent through its lifecycle, in milliseconds after
 * the create or start. Zero makes every step happen at once, which is what
 * the unit tests ask for.
 */
export interface MockTiming {
  /** When the sandbox is requested from the OpenShell gateway. */
  gatewayMs: number;
  /** When the gateway reports the sandbox ready. */
  readyMs: number;
  /** When the repository is cloned and the agent becomes Running. */
  clonedMs: number;
}

const DEFAULT_TIMING: MockTiming = { gatewayMs: 1500, readyMs: 3000, clonedMs: 4500 };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function key(namespace: string, name: string): string {
  return `${namespace}/${name}`;
}

function hex4(): string {
  return Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
}

/**
 * In-memory stand-in for the DevWorkspace API and the OpenShell gateway.
 *
 * It is the only backend the prototype has, so the whole UI runs without a
 * cluster: agents are created, started, stopped and deleted here, and a newly
 * created one walks through Starting to Running over a few seconds with the
 * events appended as it goes.
 */
export class MockAgentClient {
  public readonly mode = 'mock' as const;

  private readonly agents = new Map<string, Agent>();
  private readonly events = new Map<string, AgentEvent[]>();
  private readonly namespace: string;
  private readonly timing: MockTiming;
  private readonly watchers = new Map<string, Set<AgentWatchListener>>();
  /** Bumped on every mutation; serves as the agents' resource version. */
  private version = 1;

  constructor(namespace = DEFAULT_NAMESPACE, timing: MockTiming = DEFAULT_TIMING) {
    this.namespace = namespace;
    this.timing = timing;
    this.seed(namespace);
  }

  public async listProviders(): Promise<OpenshellProvider[]> {
    return clone(PROVIDERS);
  }

  public async listAgents(namespace: string): Promise<Agent[]> {
    return [...this.agents.values()]
      .filter(agent => agent.metadata.namespace === namespace)
      .map(agent => clone(agent));
  }

  /**
   * The demo client is its own watch: every mutation it performs - including
   * the delayed transition to Running - is reported to the listeners, so the
   * UI is as live against the in-memory data as it would be against a cluster.
   */
  public watchAgents(namespace: string, listener: AgentWatchListener): StopWatching {
    const listeners = this.watchers.get(namespace) ?? new Set<AgentWatchListener>();
    listeners.add(listener);
    this.watchers.set(namespace, listeners);

    return () => {
      listeners.delete(listener);
    };
  }

  public async getAgent(namespace: string, name: string): Promise<Agent> {
    const agent = this.agents.get(key(namespace, name));
    if (!agent) {
      throw new AgentClientError(404, `Agent '${name}' not found.`, 'NotFound');
    }
    return clone(agent);
  }

  public async createAgent(namespace: string, request: CreateAgentRequest): Promise<Agent> {
    // The random suffix keeps two agents of one repository apart; a collision
    // is rolled again rather than failed, the way a server-side generator
    // would.
    let name = deriveAgentName(request.repositoryUrl, request.providerId);
    while (this.agents.has(key(namespace, name))) {
      name = deriveAgentName(request.repositoryUrl, request.providerId);
    }

    const now = new Date().toISOString();
    const created = buildAgent(namespace, request, name);
    created.metadata.uid = `uid-${name}`;
    created.metadata.creationTimestamp = now;
    created.metadata.resourceVersion = String(++this.version);
    created.status = {
      phase: AgentPhase.STARTING,
      openshell: { sandbox: deriveSandboxName(name) },
    };

    this.agents.set(key(namespace, name), created);
    this.notify(namespace, { type: 'ADDED', agent: clone(created) });
    this.recordEvent(namespace, name, {
      uid: `${name}-created`,
      reason: 'Created',
      message: `DevWorkspace ${name} created.`,
      lastTimestamp: now,
      reportingComponent: 'devworkspace-controller',
    });

    this.runStartSequence(namespace, name);

    return clone(created);
  }

  public async deleteAgent(namespace: string, name: string): Promise<void> {
    const agent = this.agents.get(key(namespace, name));
    if (!agent) {
      throw new AgentClientError(404, `Agent '${name}' not found.`, 'NotFound');
    }
    this.agents.delete(key(namespace, name));
    this.events.delete(key(namespace, name));
    this.notify(namespace, { type: 'DELETED', agent: clone(agent) });
  }

  /** Stop keeps the data: the repository stays cloned, only the sandbox goes. */
  public async stopAgent(namespace: string, name: string): Promise<Agent> {
    const agent = this.expectAgent(namespace, name);

    agent.spec.started = false;
    agent.status = { ...agent.status, phase: AgentPhase.STOPPED };
    this.touch(agent);
    this.notify(namespace, { type: 'MODIFIED', agent: clone(agent) });
    this.recordEvent(namespace, name, {
      uid: `${name}-stopped-${hex4()}`,
      reason: 'Stopped',
      message: 'DevWorkspace stopped. The repository and the provider are kept.',
      lastTimestamp: new Date().toISOString(),
      reportingComponent: 'devworkspace-controller',
    });

    return clone(agent);
  }

  public async startAgent(namespace: string, name: string): Promise<Agent> {
    const agent = this.expectAgent(namespace, name);

    agent.spec.started = true;
    agent.status = { ...agent.status, phase: AgentPhase.STARTING };
    this.touch(agent);
    this.notify(namespace, { type: 'MODIFIED', agent: clone(agent) });

    this.runStartSequence(namespace, name);

    return clone(agent);
  }

  public async listEvents(namespace: string, name: string): Promise<AgentEvent[]> {
    if (!this.agents.has(key(namespace, name))) {
      throw new AgentClientError(404, `Agent '${name}' not found.`, 'NotFound');
    }
    return clone(this.events.get(key(namespace, name)) ?? []);
  }

  public async listNamespaces(): Promise<string[]> {
    return [this.namespace];
  }

  /**
   * Appends the gateway conversation to the events and moves the agent to
   * Running at the end of it: the sandbox is requested, becomes ready, and
   * the repository is cloned inside it.
   */
  private runStartSequence(namespace: string, name: string): void {
    const step = (delayMs: number, run: () => void) => {
      if (delayMs <= 0) {
        run();
      } else {
        setTimeout(run, delayMs);
      }
    };

    step(this.timing.gatewayMs, () => {
      this.recordEvent(namespace, name, {
        uid: `${name}-gateway-${hex4()}`,
        reason: 'SandboxRequested',
        message: `Sandbox ${this.sandboxOf(namespace, name)} requested from the OpenShell gateway.`,
        lastTimestamp: new Date().toISOString(),
        reportingComponent: 'openshell-controller',
      });
    });

    step(this.timing.readyMs, () => {
      this.recordEvent(namespace, name, {
        uid: `${name}-ready-${hex4()}`,
        reason: 'SandboxReady',
        message: 'Sandbox ready. Provider injected by the OpenShell gateway.',
        lastTimestamp: new Date().toISOString(),
        reportingComponent: 'openshell-controller',
      });
    });

    step(this.timing.clonedMs, () => {
      const agent = this.agents.get(key(namespace, name));
      // The agent may have been stopped or deleted meanwhile; the sequence
      // then has nothing left to do.
      if (!agent || agent.spec.started !== true) {
        return;
      }
      this.recordEvent(namespace, name, {
        uid: `${name}-cloned-${hex4()}`,
        reason: 'RepositoryCloned',
        message: 'Repository cloned into the sandbox.',
        lastTimestamp: new Date().toISOString(),
        reportingComponent: 'openshell-controller',
      });
      agent.status = { ...agent.status, phase: AgentPhase.RUNNING };
      this.touch(agent);
      this.notify(namespace, { type: 'MODIFIED', agent: clone(agent) });
    });
  }

  private expectAgent(namespace: string, name: string): Agent {
    const agent = this.agents.get(key(namespace, name));
    if (!agent) {
      throw new AgentClientError(404, `Agent '${name}' not found.`, 'NotFound');
    }
    return agent;
  }

  private sandboxOf(namespace: string, name: string): string {
    return this.agents.get(key(namespace, name))?.status?.openshell?.sandbox ?? name;
  }

  private touch(agent: Agent): void {
    agent.metadata.resourceVersion = String(++this.version);
  }

  private recordEvent(namespace: string, name: string, event: Omit<AgentEvent, 'type'>): void {
    const entry: AgentEvent = { type: 'Normal', ...event };
    const list = this.events.get(key(namespace, name)) ?? [];
    list.push(entry);
    this.events.set(key(namespace, name), list);
  }

  private notify(namespace: string, event: AgentWatchEvent): void {
    this.watchers.get(namespace)?.forEach(listener => listener(event));
  }

  /**
   * Two agents so the list opens on something: one Running with the full
   * event history behind it, one Stopped to show what stopping keeps.
   */
  private seed(namespace: string): void {
    const running = this.buildSeed(namespace, {
      name: 'claude-spring-petclinic-7f3a',
      repositoryUrl: 'https://github.com/spring-projects/spring-petclinic',
      providerId: 'anthropic',
      sandbox: 'dw-claude-spring-petclinic-7f3a-b19c',
      startedAt: new Date(Date.now() - 3 * 36e5),
      phase: AgentPhase.RUNNING,
    });
    this.seedEvents(namespace, running.metadata.name, [
      ['Created', 'DevWorkspace claude-spring-petclinic-7f3a created.'],
      [
        'SandboxRequested',
        'Sandbox dw-claude-spring-petclinic-7f3a-b19c requested from the OpenShell gateway.',
      ],
      ['SandboxReady', 'Sandbox ready. Provider injected by the OpenShell gateway.'],
      ['RepositoryCloned', 'Repository cloned into the sandbox.'],
    ]);

    const stopped = this.buildSeed(namespace, {
      name: 'codex-quarkus-quickstarts-c2e8',
      repositoryUrl: 'https://github.com/quarkusio/quarkus-quickstarts',
      providerId: 'openai',
      sandbox: 'dw-codex-quarkus-quickstarts-c2e8-4d07',
      startedAt: new Date(Date.now() - 26 * 36e5),
      phase: AgentPhase.STOPPED,
    });
    this.seedEvents(namespace, stopped.metadata.name, [
      ['Created', 'DevWorkspace codex-quarkus-quickstarts-c2e8 created.'],
      [
        'SandboxRequested',
        'Sandbox dw-codex-quarkus-quickstarts-c2e8-4d07 requested from the OpenShell gateway.',
      ],
      ['SandboxReady', 'Sandbox ready. Provider injected by the OpenShell gateway.'],
      ['RepositoryCloned', 'Repository cloned into the sandbox.'],
      ['Stopped', 'DevWorkspace stopped. The repository and the provider are kept.'],
    ]);
  }

  private buildSeed(
    namespace: string,
    seedling: {
      name: string;
      repositoryUrl: string;
      providerId: string;
      sandbox: string;
      startedAt: Date;
      phase: AgentPhase;
    },
  ): Agent {
    const agent = buildAgent(
      namespace,
      {
        repositoryUrl: seedling.repositoryUrl,
        providerId: seedling.providerId,
      },
      seedling.name,
    );
    agent.metadata.uid = `uid-${seedling.name}`;
    agent.metadata.creationTimestamp = seedling.startedAt.toISOString();
    agent.metadata.resourceVersion = String(++this.version);
    agent.spec.started = seedling.phase !== AgentPhase.STOPPED;
    agent.status = {
      phase: seedling.phase,
      openshell: { sandbox: seedling.sandbox },
    };
    this.agents.set(key(namespace, seedling.name), agent);
    return agent;
  }

  private seedEvents(
    namespace: string,
    name: string,
    entries: [reason: string, message: string][],
  ): void {
    const base = Date.now() - 3 * 36e5;
    this.events.set(
      key(namespace, name),
      entries.map(([reason, message], index) => ({
        uid: `${name}-${reason}`,
        type: 'Normal',
        reason,
        message,
        lastTimestamp: new Date(base + index * 60_000).toISOString(),
        reportingComponent:
          reason === 'Created' ? 'devworkspace-controller' : 'openshell-controller',
      })),
    );
  }
}

/**
 * Timing with every delay switched off, so tests settle immediately.
 * Build it with `{ gatewayMs: 0, readyMs: 0, clonedMs: 0 }`.
 */
export const IMMEDIATE_TIMING: MockTiming = { gatewayMs: 0, readyMs: 0, clonedMs: 0 };
