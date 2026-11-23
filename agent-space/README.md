# Agent Space — OpenShell prototype

> **Throwaway prototype.** This branch exists to show the UI to the team. It is not meant
> to be merged, and the upstream Agent Space tests were removed. Quick start, from the
> repository root:
>
> ```bash
> yarn install
> cd agent-space/packages/frontend
> yarn build:dev && yarn prototype:install && yarn prototype:serve   # http://127.0.0.1:8080
> ```
>
> The Agent tab runs the real `claude` / `codex` / `gemini` CLI **on your machine, as you**,
> if it is installed and logged in. See "There is no sandbox" below.

A standalone, client-side UI prototype for **OpenShell agents**, shipped alongside the
Eclipse Che Dashboard.

The real feature (not built here): the user creates a DevWorkspace whose devfile carries
`controller.devfile.io/workload-kind: openshell`; the DevWorkspace Operator asks an NVIDIA
OpenShell gateway for a sandbox; the gateway clones nothing itself, so the repository is
cloned inside the sandbox on launch; credentials come from OpenShell **Providers** (named
credential sets managed by the OpenShell administrator) and the agent never sees the real
keys. Policy is admin-owned and read-only.

This branch is the UI half only: an in-memory client stands in for the cluster
API (it seeds a couple of agents, simulates the `Starting → Running`
progression over a few seconds, with events appended as it goes, and answers
Stop/Start/Delete), so the masthead shows a **Demo data** label. The *sessions*
are real, though: a small prototype server serves the bundle and relays actual
pseudo-terminals — a shell and the Claude Code / Codex / Gemini CLI TUIs —
into the page over WebSocket (see [Prototype server](#prototype-server)).

## What the user chooses

Creating an agent asks for exactly two things:

1. the **Git repository URL** that will be cloned on launch (required; must look like an
   `http(s)` or `git@` URL), and
2. the **harness** the agent runs (required): Claude Code, Codex or the Gemini CLI. Each
   harness reads its model keys from an OpenShell provider (anthropic, openai, vertex)
   that the administrator manages.

Everything else is derived or fixed: the name is `<harness>-<repository>-<4 hex>` (for
example `claude-spring-petclinic-7f3a`), the image is
`quay.io/devfile/universal-developer-image@sha256:<digest>`, and the policy reads
`org-default (set by your OpenShell administrator)`.

## Layout

```text
agent-space/
├── prototype-server/                  # npm package, NOT a yarn workspace: the stand-in backend
│   ├── server.mjs                     # static bundle + /terminal WebSocket → real PTYs
│   └── fix-pty-permissions.mjs        # postinstall: restore node-pty's spawn-helper exec bit
└── packages/
    └── frontend/                      # React 18 + PatternFly 6 SPA (yarn workspace)
        ├── src/
        │   ├── components/            # Presentational components, incl. the PtyTerminal panel
        │   ├── hooks/                 # usePolling-style hooks, useAgentWatch
        │   ├── Layout/                # Masthead, sidebar, 'Workspaces' back link
        │   ├── pages/                 # CreateAgent, AgentList, AgentDetails (Agent + Terminal tabs), Workspaces (mock)
        │   ├── Routes/                # Hash routes
        │   ├── services/              # Config, agent model helpers
        │   │   └── client/            # MockAgentClient (the mock half of the prototype)
        │   ├── store/                 # Redux store: Bootstrap, Providers, Agents, AgentDetails
        │   └── testUtils/             # Shared render helpers (excluded from coverage)
        ├── static/config.json         # Runtime configuration, overridable per deployment
        ├── index.html
        ├── jest.config.js
        └── webpack.config.{common,dev,prod}.js
```

## Getting started

```bash
yarn install                      # from the repository root, installs every workspace
cd agent-space/packages/frontend
yarn build:dev                    # development bundle into the dashboard's output tree
yarn prototype:install            # installs the prototype server (npm, outside the yarn workspaces)
yarn prototype:serve              # serve the bundle + real terminal sessions on http://localhost:8080
```

`yarn prototype:serve` starts the [prototype server](#prototype-server), which
serves the built bundle and backs the session tabs with real pseudo-terminals
on this machine. The bundle uses relative asset URLs, reads `./config.json` at
startup, and the branding/theme calls into the dashboard backend fail
gracefully: served standalone, the masthead falls back to the product title
instead of the logo.

Without the prototype server, the dashboard itself (`yarn start` from the
repository root) also serves the bundle at `/dashboard/agent-space` — it then
runs on demo data, and the Terminal tab falls back to its offline mock
interpreter, because nothing answers the terminal WebSocket there.

## Scripts

Run from `agent-space/packages/frontend`, or from the repository root with
`yarn workspace @eclipse-che/agent-space-frontend <script>`:

| Script                                  | Purpose                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `yarn build`                            | Production bundle into `packages/dashboard-frontend/lib/public/dashboard/agent-space/` |
| `yarn build:dev`                        | Development bundle                                                                     |
| `yarn build:watch`                      | Development bundle, rebuilt on change                                                  |
| `yarn prototype:install`                | `npm install` the prototype server (own package, own lockfile, not a yarn workspace)   |
| `yarn prototype:serve`                  | Serve the built bundle and real terminal sessions on http://localhost:8080            |
| `yarn lint:check` / `yarn lint:fix`     | `tsc --noEmit` + ESLint (+ stylelint)                                                  |
| `yarn format:check` / `yarn format:fix` | Prettier                                                                               |

The root `yarn build`, `yarn test`, `yarn lint:fix` and `yarn format:fix` fan out over
every workspace, this one included.

## Prototype server

`agent-space/prototype-server` is a plain npm package (deliberately outside the
repository's yarn workspaces, with its own lockfile) that stands in for the two
production pieces the prototype has no access to:

- it serves the built bundle statically — the SPA uses hash routes, so no
  rewrite rules are needed — and
- it answers `ws://…/terminal?agent=…&repo=…&mode=…&cols=…&rows=…` with a real
  pseudo-terminal on the host it runs on: `mode=shell` is the user's login
  shell, and `mode=claude` / `codex` / `gemini` run the actual harness CLIs,
  from a shallow clone of the agent's repository
  (`~/.cache/agent-space-prototype/<agent>/<repo>`, cloned on first connect,
  progress streamed into the terminal). Frames carry terminal data both ways;
  a `{"type":"resize","cols":N,"rows":N}` control message resizes the session.

The frontend side is `components/PtyTerminal`: an xterm.js panel that connects
on mount, sends resizes as the panel is fitted, shows the connection status
and offers to reconnect when a session drops. The Agent tab embeds one per
harness of the agent's AI provider, the Terminal tab embeds one
for the shell — and falls back to the offline mock interpreter
(`services/sandboxShell.ts`), with an inline note saying so, whenever the
WebSocket cannot be opened at all, as when the page is served by the dashboard
itself or any plain static server.

### ⚠️ There is no sandbox

Everything typed into a session runs **as your user, on your machine** — the
harness CLIs use the host user's existing login, not OpenShell Providers. The
server therefore:

- binds to `127.0.0.1` only, by default;
- checks that the WebSocket's `Origin` matches its own `Host`, blocking
  cross-site terminal hijacking;
- exposes the LAN only when started with `HOST=0.0.0.0`, and then requires a
  random token it prints at startup — every page load and terminal WebSocket
  must carry it as `?token=` (the frontend reads it from the page URL and
  forwards it automatically).

### Running it

```bash
yarn prototype:install                              # once, and after dependency changes
yarn prototype:serve                                # http://127.0.0.1:8080
PORT=9000 yarn prototype:serve                      # another port
HOST=0.0.0.0 yarn prototype:serve                   # LAN mode: opens http://<lan-ip>:8080/?token=<printed>
CLONE_ROOT=… BUNDLE_DIR=… yarn prototype:serve      # override the clone cache / bundle directory
```

The PTY backend is `node-pty`; if it cannot load, the
`@homebridge/node-pty-prebuilt-multiarch` fork is tried, and if neither works
the server falls back to `python3 -c "import pty,sys; pty.spawn(sys.argv[1:])"`
— a real controlling terminal, but **no resize** (resize controls are then
ignored; the initial `cols`/`rows` still apply). On npm ≥ 11.5 the server's
own `postinstall` restores the executable bit of node-pty's `spawn-helper`
binaries, which npm's blocked dependency scripts would otherwise leave
unusable.

### How this maps to production

In production there is no prototype server and nothing runs on the user's
machine: the dashboard backend relays an **interactive OpenShell exec session**
(Go SDK `Exec()`) from inside the sandbox over a WebSocket into the page —
the same relaying pattern PR #1698's dashboard backend already uses for pod
terminals. The pieces line up like this:

| Prototype                                     | Production                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `prototype-server` on the developer's machine | Dashboard backend WS relay → OpenShell gateway                          |
| real PTY on the host (`node-pty`)             | OpenShell SDK interactive `Exec()` inside the sandbox                    |
| shallow clone in `~/.cache/agent-space-…`     | launch clone into `/sandbox/<repo>` inside the sandbox                   |
| harness CLI with the host user's login        | harness CLI with API keys from **OpenShell Providers** (never the user's) |
| `?token=` when bound beyond loopback          | the dashboard's own authentication and CSRF protection                  |

## State

All application state lives in a Redux Toolkit store (`src/store`) built the same way as
the dashboard's, with one directory per slice holding `actions.ts`, `reducer.ts` and
`selectors.ts`:

| Slice           | Holds                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `Bootstrap`     | The runtime config, the resolved namespace and the client mode; everything else waits on it     |
| `Providers`     | The OpenShell provider list the create form offers                                             |
| `Agents`        | The agent list plus the pending lifecycle action and its error                                 |
| `AgentDetails`  | One agent with its events, reset whenever another name is requested                            |

The store is checked with `serializableCheck`, so the API client is not kept in it: the
bootstrap thunk installs it in a module-level singleton (`services/client/instance.ts`)
that the other thunks read, and errors are stored as plain `AgentError` objects rather
than `Error` instances.

## Runtime configuration

`static/config.json` is copied verbatim into the bundle and read at startup, so a
deployment can change it without a rebuild (for example by mounting a ConfigMap over it).

| Key            | Default             | Meaning                                    |
| -------------- | ------------------- | ------------------------------------------ |
| `namespace`    | `""`                | Pins the namespace. Empty means resolve it |
| `dashboardUrl` | `../#/workspaces`   | Base URL of the dashboard the user-preferences link points into |

The prototype always uses the in-memory client; there is no cluster mode to configure.

## Relationship to the dashboard

The dashboard shows an **Agent Space** navigation item only when the CheCluster CR has
`spec.agentSandbox.enabled: true` (see
[che-operator#2184](https://github.com/eclipse-che/che-operator/pull/2184)). The item is
an ordinary in-SPA link to `#/agent-space`; that route performs a full-page navigation to
`<dashboard-root>/agent-space/`, where this bundle is served. If the bundle is not
deployed, the route shows an explanatory page with a manual link rather than failing
silently.

The Agent Space masthead carries an **Agent Space | Workspaces** toggle. The Workspaces side is a
small in-app mock of the Che dashboard Workspaces page (`#/workspaces`, served by this bundle), so
the prototype does not link out to a route it does not serve; the sidebar follows the selected
area. The details page of a running agent opens on its session tabs - the agent harness TUIs
(`Agent`, one of Claude Code, Codex or the Gemini CLI, in a real terminal) and a real shell
(`Terminal`) - with the read-only Overview/Events/Manifest tabs kept. Both session tabs need the
prototype server; without it, the Terminal tab falls back to its offline mock interpreter and the
Agent tab shows the connection status of its terminal panel.

## Licensing note

Dependencies of this workspace are resolved through the repository-root `yarn.lock` and
are therefore covered by the root `.deps/` license tooling. Run `yarn license:generate`
from the repository root after changing `agent-space/packages/frontend/package.json`.
