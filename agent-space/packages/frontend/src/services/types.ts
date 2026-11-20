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
 * Types for the OpenShell agent: a DevWorkspace whose devfile carries the
 * `controller.devfile.io/workload-kind: openshell` attribute, so the
 * DevWorkspace Operator asks an NVIDIA OpenShell gateway for a sandbox
 * instead of starting an ordinary pod.
 *
 * See https://devfile.io/docs and the OpenShell gateway documentation.
 */

export const DEVWORKSPACE_API_VERSION = 'workspace.devfile.io/v1alpha2';
export const DEVWORKSPACE_KIND = 'DevWorkspace';

/** Devfile attribute that routes the workspace to the OpenShell controller. */
export const WORKLOAD_KIND_ATTRIBUTE = 'controller.devfile.io/workload-kind';

/** Annotation the selected OpenShell providers are recorded in. */
export const OPENSHELL_PROVIDER_ANNOTATION = 'controller.devfile.io/openshell-provider';

/**
 * A named credential set managed by the OpenShell administrator, e.g.
 * `anthropic` or `openai`. The agent never sees the real keys: the
 * gateway injects them into the sandbox.
 */
export interface OpenshellProvider {
  id: string;
  /** Display name, e.g. `Google Vertex AI`. */
  name: string;
  /** One line the create form shows under the checkbox. */
  description: string;
}

/**
 * The container image every agent runs. Fixed for the prototype: the real
 * feature resolves it from the OpenShell gateway configuration.
 */
export const AGENT_IMAGE =
  'quay.io/devfile/universal-developer-image@sha256:3f9c1a7e5d2b8f4a6c0e9d3b7f1a5c8e2d6b9f4a7c1e5d8b3f6a0c9e2d5b8f41';

/** Policy every agent runs under. Read-only: the administrator owns it. */
export const AGENT_POLICY = 'org-default';

/**
 * Lifecycle phase of an agent, as `status.phase` reports it.
 *
 * `Starting` covers everything between "the DevWorkspace was asked to start"
 * and "the sandbox is ready and the repository is cloned".
 */
export enum AgentPhase {
  STARTING = 'Starting',
  RUNNING = 'Running',
  STOPPED = 'Stopped',
}

/** The two lifecycle actions the UI offers. */
export type AgentAction = 'start' | 'stop';

export interface AgentMetadata {
  name: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  annotations?: Record<string, string>;
}

/** One git project of the devfile. The repository is cloned on launch. */
export interface AgentProject {
  name: string;
  git: {
    /** Remote name to URL, as a devfile `git` project carries it. */
    remotes: Record<string, string>;
  };
}

/** The single container component every agent is made of. */
export interface AgentComponent {
  name: string;
  container: {
    image: string;
  };
}

export interface AgentSpec {
  /** Whether the DevWorkspace should be running. */
  started: boolean;
  template: {
    attributes?: Record<string, string>;
    projects?: AgentProject[];
    components?: AgentComponent[];
  };
}

export interface AgentStatus {
  phase?: AgentPhase;
  /** What the OpenShell controller reports about the sandbox. */
  openshell?: {
    /** Name of the sandbox the gateway provided, e.g. `dw-<name>-<4 hex>`. */
    sandbox?: string;
  };
}

/**
 * The agent as the API server would return it. The Manifest tab shows this
 * object verbatim, so it is kept close to a real DevWorkspace.
 */
export interface Agent {
  apiVersion?: string;
  kind?: string;
  metadata: AgentMetadata;
  spec: AgentSpec;
  status?: AgentStatus;
}

/** What the create form submits: the repository and the one AI provider. */
export interface CreateAgentRequest {
  repositoryUrl: string;
  /** The OpenShell AI provider id, e.g. `anthropic`. */
  providerId: string;
}

/**
 * Subset of a Kubernetes core/v1 Event, as rendered on the details page.
 * The mock gateway appends one per lifecycle step.
 */
export interface AgentEvent {
  uid: string;
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  lastTimestamp?: string;
  firstTimestamp?: string;
  reportingComponent?: string;
}

/**
 * Error raised by the agent client. Carries the HTTP status code so callers
 * can tell "not found" from "forbidden" without matching on message strings.
 */
export class AgentClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'AgentClientError';
  }
}

/**
 * Plain-object form of {@link AgentClientError}.
 *
 * Errors are rendered from the Redux store, and an `Error` instance is not
 * serializable, so the thunks convert on the way in and keep the status code
 * the UI needs to turn a failure into advice.
 */
export interface AgentError {
  message: string;
  statusCode?: number;
  reason?: string;
}

export function toAgentError(e: unknown): AgentError {
  if (e instanceof AgentClientError) {
    return { message: e.message, statusCode: e.statusCode, reason: e.reason };
  }
  if (e instanceof Error) {
    return { message: e.message };
  }
  return { message: String(e) };
}

/**
 * Whether a create failed because the object is already there.
 *
 * A 409 also carries `Conflict` - a stale resource version on an update - so
 * the reason decides whenever the API server sends one.
 */
export function isAlreadyExistsError(e: unknown): boolean {
  if (!(e instanceof AgentClientError)) {
    return false;
  }
  return e.reason === undefined ? e.statusCode === 409 : e.reason === 'AlreadyExists';
}

/**
 * What a watch reports. `ERROR` means the stream broke - the caller has to
 * list again to resynchronise, because events may have been missed.
 */
export type AgentChangeEvent = {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  agent: Agent;
};

export type AgentWatchEvent = AgentChangeEvent | { type: 'ERROR'; message: string };

export type AgentWatchListener = (event: AgentWatchEvent) => void;

/** Stops a watch. Calling it twice is safe. */
export type StopWatching = () => void;

/**
 * The backend the prototype talks to. The mock implementation is the only
 * one: the real feature talks to the DevWorkspace API through the dashboard
 * backend, which is out of scope for the prototype.
 */
export interface AgentClient {
  /** Always `mock`: the prototype runs on demo data. */
  readonly mode: 'mock';
  listAgents(namespace: string): Promise<Agent[]>;
  getAgent(namespace: string, name: string): Promise<Agent>;
  createAgent(namespace: string, request: CreateAgentRequest): Promise<Agent>;
  deleteAgent(namespace: string, name: string): Promise<void>;
  startAgent(namespace: string, name: string): Promise<Agent>;
  stopAgent(namespace: string, name: string): Promise<Agent>;
  /** Credential sets the OpenShell administrator has published. */
  listProviders(): Promise<OpenshellProvider[]>;
  listEvents(namespace: string, name: string): Promise<AgentEvent[]>;
  /** Namespaces the user may work in; the mock offers the one it holds. */
  listNamespaces(): Promise<string[]>;
  /**
   * Streams changes to the agents of a namespace, so a status that changes
   * on its own - Starting becoming Running - reaches the UI without a poll.
   */
  watchAgents(namespace: string, listener: AgentWatchListener): StopWatching;
}
