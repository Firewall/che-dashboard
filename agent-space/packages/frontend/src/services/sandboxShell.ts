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
 * The mock shell of an OpenShell sandbox.
 *
 * A tiny command interpreter over a fixed fake checkout of the repository the
 * agent clones on launch. It is a pure function of the line and the state, so
 * the terminal component only has to render what it answers - and the whole
 * thing can be tested without an emulator.
 */

export interface ShellState {
  sandboxName: string;
  repoName: string;
  /** OpenShell providers attached to the agent, as provider ids. */
  providerIds: string[];
  cwd: string;
  history: string[];
}

export interface CommandResult {
  /** What the shell answers, newline-terminated. Empty for `clear`. */
  output: string;
  state: ShellState;
  /** True when the screen should be cleared instead of printed to. */
  clear: boolean;
}

/** The env var the OpenShell supervisor fills with a provider placeholder. */
const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  vertex: 'GOOGLE_API_KEY',
  'github-readonly': 'GITHUB_TOKEN',
};

/** Hosts the org-default OpenShell policy lets the sandbox talk to. */
export const ALLOWED_HOSTS = [
  'github.com',
  'api.anthropic.com',
  'api.openai.com',
  'generativelanguage.googleapis.com',
];

/** The env value the sandbox sees: a placeholder, never the real key. */
export function providerPlaceholder(providerId: string): string {
  return `openshell:provider/${providerId}`;
}

/** Command per AI provider, as the Terminal tab offers them. */
const HARNESS_COMMANDS: Record<string, { command: string; reply: string }> = {
  anthropic: {
    command: 'claude',
    reply: 'Ready when you are - the Agent tab streams the full session.',
  },
  openai: {
    command: 'codex',
    reply: 'Session ready. The Agent tab has the interactive session.',
  },
  vertex: {
    command: 'gemini',
    reply: 'Hello from the Gemini CLI mock inside the sandbox.',
  },
};

/** `runCommand` accepts any command of the attached providers. */
export function getHarnessCommands(providerIds: string[]): string[] {
  return providerIds
    .map(id => HARNESS_COMMANDS[id]?.command)
    .filter((command): command is string => command !== undefined);
}

/** Where the shell starts: the repository the sandbox cloned on launch. */
export function createShellState(init: {
  sandboxName: string;
  repoName: string;
  providerIds: string[];
}): ShellState {
  return {
    ...init,
    cwd: `/sandbox/${init.repoName}`,
    history: [],
  };
}

/** `user@<sandbox>:<cwd>$ ` - the working directory moves with `cd`. */
export function shellPrompt(state: ShellState): string {
  return `user@${state.sandboxName}:${state.cwd}$ `;
}

interface Tree {
  dirs: Set<string>;
  files: Map<string, string>;
}

/** The fake checkout: a small file tree rooted at `/sandbox/<repo>`. */
function fileSystem(repoName: string): Tree {
  const repo = `/sandbox/${repoName}`;
  return {
    dirs: new Set(['/', '/sandbox', repo, `${repo}/src`, `${repo}/src/pages`, `${repo}/tests`]),
    files: new Map([
      [
        `${repo}/README.md`,
        `# ${repoName}

One of the repositories an OpenShell agent can clone on launch.

## Development

- yarn install
- yarn test`,
      ],
      [
        `${repo}/package.json`,
        `{
  "name": "${repoName}",
  "private": true,
  "scripts": {
    "test": "jest"
  }
}`,
      ],
      [
        `${repo}/src/index.ts`,
        `import { App } from '@/App';

const root = createRoot(document.getElementById('root'));
root.render(<App />);`,
      ],
      [
        `${repo}/src/pages/Home.tsx`,
        `export function Home(): React.ReactElement {
  return <h1>Welcome to Eclipse Che</h1>;
}`,
      ],
      [
        `${repo}/tests/app.spec.ts`,
        `it('renders the app', () => {
  expect(true).toBe(true);
});`,
      ],
      [
        `${repo}/tests/home.spec.ts`,
        `it('welcomes the user', () => {
  expect(screen.getByText('Welcome to Eclipse Che')).toBeInTheDocument();
});`,
      ],
    ]),
  };
}

/** Resolves a path against the working directory, `..` and `.` included. */
function resolvePath(state: ShellState, arg: string): string {
  const base = arg.startsWith('/') ? [] : state.cwd.split('/').filter(part => part !== '');
  const parts = [...base, ...arg.split('/')].filter(part => part !== '' && part !== '.');

  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return `/${resolved.join('/')}`;
}

/** Names directly under a directory: directories get a trailing slash. */
function listDir(tree: Tree, path: string): string[] | undefined {
  if (!tree.dirs.has(path)) {
    return undefined;
  }
  const prefix = path === '/' ? '' : path;
  const names = new Set<string>();
  for (const dir of tree.dirs) {
    if (dir.startsWith(`${prefix}/`)) {
      const rest = dir.slice(prefix.length + 1);
      if (!rest.includes('/')) {
        names.add(`${rest}/`);
      }
    }
  }
  for (const file of tree.files.keys()) {
    if (file.startsWith(`${prefix}/`)) {
      const rest = file.slice(prefix.length + 1);
      if (!rest.includes('/')) {
        names.add(rest);
      }
    }
  }
  return [...names].sort();
}

/** Splits a command line into words, keeping double-quoted strings together. */
function parseArgs(line: string): string[] {
  const words = line.match(/"[^"]*"|\S+/g) ?? [];
  return words.map(word => (word.length >= 2 && word.startsWith('"') ? word.slice(1, -1) : word));
}

const HELP = `A mock shell inside an OpenShell sandbox.

Commands:
  help                  this list
  pwd                   print the working directory
  ls [path]             list a directory
  cd [path]             change directory (default: the repository root)
  cat <file>            print a file
  git status            summary of the checkout
  git log --oneline     recent commits
  env                   environment, provider placeholders included
  whoami                current user
  curl <url>            fetch a URL (allowed hosts only)
  claude | codex | gemini [-p "<prompt>"]   one-shot harness call
  clear                 clear the screen`;

const GIT_LOG = `e4f2a1c (HEAD -> main) fix: align the home title with its test
b7c3d92 feat: add the agent harness panel
a1b2c3d chore: initial import`;

/**
 * Runs one line and returns what the shell answers, together with the state
 * the next line starts from. The state is never mutated in place.
 */
export function runCommand(state: ShellState, line: string): CommandResult {
  const trimmed = line.trim();

  // An empty line only moves the prompt along.
  if (trimmed === '') {
    return { output: '', state, clear: false };
  }

  const history =
    state.history[state.history.length - 1] === trimmed
      ? state.history
      : [...state.history, trimmed];

  const next: ShellState = { ...state, history };
  const words = parseArgs(trimmed);
  const [command, ...args] = words;
  const tree = fileSystem(state.repoName);

  const done = (output: string): CommandResult => ({ output, state: next, clear: false });

  switch (command) {
    case 'help':
      return done(`${HELP}\n`);

    case 'pwd':
      return done(`${state.cwd}\n`);

    case 'ls': {
      const path = resolvePath(state, args[0] ?? '.');
      if (tree.files.has(path)) {
        return done(`${path.slice(path.lastIndexOf('/') + 1)}\n`);
      }
      const entries = listDir(tree, path);
      if (entries === undefined) {
        return done(`ls: cannot access '${args[0] ?? path}': No such file or directory\n`);
      }
      return done(entries.length === 0 ? '\n' : `${entries.join('\n')}\n`);
    }

    case 'cd': {
      const target =
        args[0] === undefined ? `/sandbox/${state.repoName}` : resolvePath(state, args[0]);
      if (tree.files.has(target)) {
        return done(`cd: not a directory: ${args[0]}\n`);
      }
      if (!tree.dirs.has(target)) {
        return done(`cd: no such file or directory: ${args[0]}\n`);
      }
      return { output: '', state: { ...next, cwd: target }, clear: false };
    }

    case 'cat': {
      if (args[0] === undefined) {
        return done('cat: missing file operand\n');
      }
      const path = resolvePath(state, args[0]);
      const content = tree.files.get(path);
      if (content !== undefined) {
        return done(`${content}\n`);
      }
      if (tree.dirs.has(path)) {
        return done(`cat: ${args[0]}: Is a directory\n`);
      }
      return done(`cat: ${args[0]}: No such file or directory\n`);
    }

    case 'git':
      if (args[0] === 'status') {
        return done(
          `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   src/pages/Home.tsx

no changes added to commit\n`,
        );
      }
      if (args[0] === 'log') {
        return done(`${GIT_LOG}\n`);
      }
      return done(`git: '${args[0] ?? ''}' is not supported in the mock shell\n`);

    case 'env': {
      const providers = state.providerIds
        .filter(id => PROVIDER_ENV_VARS[id] !== undefined)
        .map(id => `${PROVIDER_ENV_VARS[id]}=${providerPlaceholder(id)}`);
      return done(
        [
          'USER=user',
          'HOME=/home/user',
          'SHELL=/bin/bash',
          `SANDBOX=${state.sandboxName}`,
          ...providers,
        ].join('\n') + '\n',
      );
    }

    case 'whoami':
      return done('user\n');

    case 'clear':
      return { output: '', state: next, clear: true };

    case 'curl': {
      if (args[0] === undefined) {
        return done('curl: no URL given\n');
      }
      let host: string | undefined;
      try {
        host = new URL(args[0]).host;
      } catch {
        return done(`curl: (6) Could not resolve host: ${args[0]}\n`);
      }
      if (!ALLOWED_HOSTS.includes(host)) {
        return done(`curl: (${args[0]}) blocked by OpenShell policy org-default\n`);
      }
      return done(`HTTP/2 200
content-type: text/plain

(mock) response from ${host}\n`);
    }

    case 'claude':
    case 'codex':
    case 'gemini': {
      const entry = Object.entries(HARNESS_COMMANDS).find(([, value]) => value.command === command);
      if (entry === undefined) {
        return done(`${command}: command not found\n`);
      }
      const [providerId, harness] = entry;
      if (!state.providerIds.includes(providerId)) {
        return done(`${command}: provider not attached (${providerId})\n`);
      }
      const banner = `✻ Welcome to ${command} (mock)
  provider ${providerId}, injected by the OpenShell supervisor\n`;
      const promptIndex = args.indexOf('-p');
      if (promptIndex === -1 || args[promptIndex + 1] === undefined) {
        return done(
          `${banner}\n${command}: interactive mode is not available in the mock - use -p "<prompt>"\n`,
        );
      }
      return done(`${banner}\n> ${args[promptIndex + 1]}\n\n${harness.reply}\n`);
    }

    default:
      return done(`${command}: command not found\n`);
  }
}
