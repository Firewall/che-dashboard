#!/usr/bin/env node
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
 * The Agent Space prototype server.
 *
 * It stands in for the two production pieces the prototype has no access to:
 *
 *  - the dashboard backend, by serving the built Agent Space bundle statically
 *    (the SPA uses hash routes, so no rewrite rules are needed), and
 *  - the OpenShell sandbox exec relay, by exposing `/terminal` - a WebSocket
 *    that pipes a real pseudo-terminal on this host into the page's xterm.js.
 *
 * ⚠️  THERE IS NO SANDBOX. Everything typed into a session runs as the user
 * that started this server, on this very machine. That is why the server
 * binds to 127.0.0.1 by default, checks the WebSocket origin, and demands a
 * startup-printed token before it accepts anything but loopback traffic.
 *
 * WebSocket protocol (see the frontend's `components/PtyTerminal`):
 *  - text frames carry terminal data in both directions,
 *  - one JSON control message from the client resizes the terminal:
 *    `{"type":"resize","cols":N,"rows":N}`. (Anything else that parses as
 *    JSON with another shape is forwarded to the terminal as plain input.)
 *
 * Query parameters: `agent` (DevWorkspace-style name), `repo` (https URL,
 * cloned shallowly on first connect and used as the working directory),
 * `mode` (shell | claude | codex | gemini), `cols`, `rows`, and `token`
 * (required in LAN mode only).
 */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { accessSync, constants, createReadStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

// --- configuration -----------------------------------------------------------

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
/** Where the shallow launch clones live; mirrors `/sandbox/<repo>` in production. */
const CLONE_ROOT =
  process.env.CLONE_ROOT ?? path.join(os.homedir(), '.cache', 'agent-space-prototype');
/** The bundle `yarn build:dev` writes, served as the site root. */
const BUNDLE_DIR =
  process.env.BUNDLE_DIR ??
  path.resolve(
    moduleRoot,
    '..',
    '..',
    'packages',
    'dashboard-frontend',
    'lib',
    'public',
    'dashboard',
    'agent-space',
  );

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const isLoopback = LOOPBACK_HOSTS.has(HOST);
/** Any bind address that is not loopback is treated as LAN mode: token required. */
const TOKEN = isLoopback ? undefined : randomBytes(24).toString('base64url');

// --- validation ---------------------------------------------------------------

const MODES = ['shell', 'claude', 'codex', 'gemini'];
const MODE_COMMANDS = { claude: 'claude', codex: 'codex', gemini: 'gemini' };
const AGENT_NAME = /^[a-z0-9-]{1,63}$/;
const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;

/** Parses and strictly validates the repository URL; returns its clone name. */
function repoNameFromUrl(repo) {
  let url;
  try {
    url = new URL(repo);
  } catch {
    throw new Error(`repo '${repo}' is not a valid URL`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`repo '${repo}' must be an https:// URL`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(`repo '${repo}' must not carry credentials`);
  }
  const last = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? '';
  const name = last.endsWith('.git') ? last.slice(0, -'.git'.length) : last;
  if (!REPO_NAME.test(name) || name === '.' || name === '..') {
    throw new Error(`cannot derive a safe directory name from '${repo}'`);
  }
  return name;
}

/** Terminal sizes are clamped, so a bogus query cannot wedge the pty. */
function clampSize(value, fallback) {
  const size = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(size)) {
    return fallback;
  }
  return Math.min(500, Math.max(2, size));
}

/** The resize control message, or undefined when the frame is plain input. */
function parseResize(text) {
  if (!text.startsWith('{')) {
    return undefined;
  }
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }
    if (value.type !== 'resize') {
      return undefined;
    }
    if (!Number.isInteger(value.cols) || !Number.isInteger(value.rows)) {
      return undefined;
    }
    if (value.cols < 2 || value.cols > 500 || value.rows < 2 || value.rows > 500) {
      return undefined;
    }
    return { cols: value.cols, rows: value.rows };
  } catch {
    return undefined;
  }
}

/** Digest-then-compare, so the token check takes constant time. */
function tokenMatches(presented) {
  if (TOKEN === undefined) {
    return true;
  }
  const digest = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(presented), digest(TOKEN));
}

// --- the PTY backend -----------------------------------------------------------
//
// Preferred: node-pty. If it cannot load (not installed, prebuild missing for
// this platform, ...), the @homebridge multiarch fork is tried. If neither
// loads, sessions run through `python3 -c "pty.spawn(...)"`: that still gives
// the program a real controlling terminal, but there is no way to resize it -
// the frontend keeps sending resize controls and they are ignored.

const PYTHON_PTY = 'import pty,sys; pty.spawn(sys.argv[1:])';

function spawnNodePty(module, session) {
  const pty = module.spawn(session.file, session.args, {
    name: 'xterm-256color',
    cols: session.cols,
    rows: session.rows,
    cwd: session.cwd,
    env: session.env,
  });
  pty.onData(session.onData);
  pty.onExit(({ exitCode }) => session.onExit(exitCode));
  return {
    write: data => pty.write(data),
    resize: (cols, rows) => {
      try {
        pty.resize(cols, rows);
      } catch {
        // The process can exit between the control message and the resize.
      }
    },
    kill: () => {
      try {
        pty.kill();
      } catch {
        // Already gone.
      }
    },
  };
}

function spawnPythonPty(session) {
  const child = spawn('python3', ['-c', PYTHON_PTY, session.file, ...session.args], {
    cwd: session.cwd,
    env: session.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const forward = chunk => session.onData(chunk.toString('utf8'));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', forward);
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', forward);
  child.on('exit', code => session.onExit(code ?? 0));
  child.on('error', error => {
    session.onData(`\r\npython3 PTY failed: ${error.message}\r\n`);
    session.onExit(1);
  });
  return {
    write: data => child.stdin.write(data),
    // pty.spawn offers no handle to the master side: no resize.
    resize: () => undefined,
    kill: () => child.kill('SIGTERM'),
  };
}

function loadPtyBackend() {
  for (const id of ['node-pty', '@homebridge/node-pty-prebuilt-multiarch']) {
    try {
      const module = require(id);
      if (typeof module?.spawn === 'function') {
        return {
          id: `${id}@${module.version ?? ''}`.replace(/@$/, ''),
          supportsResize: true,
          spawn: session => spawnNodePty(module, session),
        };
      }
    } catch {
      // Not installed or not loadable: try the next candidate.
    }
  }
  return { id: 'python3 pty.spawn (no resize)', supportsResize: false, spawn: spawnPythonPty };
}

const ptyBackend = loadPtyBackend();

// --- the launch clone ----------------------------------------------------------

/** In-flight clone jobs, so parallel connections do not clone twice. */
const cloneJobs = new Map();

function ensureClone({ agent, repo, repoName, send }) {
  const dest = path.join(CLONE_ROOT, agent, repoName);
  const pending = cloneJobs.get(dest);
  if (pending !== undefined) {
    // Another connection is already bringing this checkout up; ride along
    // with it rather than cloning a second time.
    return pending.then(() => dest);
  }

  const job = (async () => {
    // Both the git working directory and the destination's parent must exist
    // before anything is spawned into them.
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    if (existsSync(path.join(dest, '.git'))) {
      send(`Using the existing checkout of ${repo} in ${dest}\r\n`);
      return;
    }
    // A previous failed clone may have left a partial directory behind.
    rmSync(dest, { recursive: true, force: true });
    send(`Cloning ${repo} (shallow) into ${dest} ...\r\n`);
    await new Promise((resolve, reject) => {
      const git = spawn(
        'git',
        ['clone', '--progress', '--depth', '1', repo, dest],
        { cwd: CLONE_ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const forward = chunk => send(chunk.toString('utf8'));
      git.stdout.setEncoding('utf8');
      git.stdout.on('data', forward);
      git.stderr.setEncoding('utf8');
      git.stderr.on('data', forward);
      git.on('error', error =>
        reject(new Error(`could not run git (${error.message}); is it installed and on PATH?`)),
      );
      git.on('exit', (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git clone exited with ${code ?? `signal ${signal}`}: is '${repo}' reachable?`));
        }
      });
    });
    send('Clone complete.\r\n');
  })();

  // Only in-flight jobs are tracked: a settled one leaves the map, so the
  // next connection re-checks the disk - and says so - instead of hitting a
  // stale cache. This side of the job observes failures (cleaning up so the
  // next connection can try again) and consumes them, so the map's copy
  // never becomes an unhandled rejection; the failure itself travels to the
  // callers through the returned promise.
  cloneJobs.set(dest, job);
  job.then(
    () => cloneJobs.delete(dest),
    error => {
      cloneJobs.delete(dest);
      rmSync(dest, { recursive: true, force: true });
    },
  );
  return job.then(() => dest);
}

// --- session environment --------------------------------------------------------

/**
 * The env of a session. `OPENSHELL_SANDBOX` and the prompt vars let the shell
 * present itself the way the sandbox shell would. No API key is ever put in:
 * the harness CLIs run with this host user's existing login, which is exactly
 * what the inline note in the Agent tab warns about.
 */
function sessionEnv({ agent, repo, repoName, cols, rows }) {
  const prompt = `[\\u@${agent} \\W]\\$ `;
  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    COLUMNS: String(cols),
    LINES: String(rows),
    OPENSHELL_SANDBOX: agent,
    OPENSHELL_REPO: repo,
    OPENSHELL_WORKDIR: repoName === undefined ? '/sandbox' : `/sandbox/${repoName}`,
    PS1: prompt,
    PROMPT: prompt,
  };
}

/** Resolves the session command, or explains why it cannot run. */
function sessionCommand(mode, send) {
  if (mode === 'shell') {
    const shell = (process.env.SHELL ?? '').trim() || '/bin/zsh';
    return { file: shell, args: ['-l'] };
  }
  const command = MODE_COMMANDS[mode];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (dir === '') {
      continue;
    }
    const candidate = path.join(dir, command);
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK);
        return { file: candidate, args: [] };
      }
    } catch {
      // Not there or not executable: keep looking.
    }
  }
  send(
    `\r\n\x1b[1m${command} is not on this host's PATH.\x1b[0m\r\n` +
      `Install it first (npm i -g @anthropic-ai/claude-code, or the codex / gemini CLI),\r\n` +
      `then reconnect. Closing the session.\r\n`,
  );
  return undefined;
}

// --- static serving -------------------------------------------------------------

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function writeText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  if (req.method !== 'GET') {
    writeText(res, 405, 'Only GET is served here.\n');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    writeText(res, 400, 'Malformed request path.\n');
    return;
  }
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  // Contain the resolved path inside the bundle directory.
  const resolved = path.normalize(path.join(BUNDLE_DIR, pathname));
  if (!resolved.startsWith(`${BUNDLE_DIR}${path.sep}`)) {
    writeText(res, 403, 'Forbidden.\n');
    return;
  }

  let stats;
  try {
    stats = statSync(resolved);
  } catch {
    writeText(
      res,
      404,
      `Not found: ${pathname}\nThe Agent Space bundle is served from:\n  ${BUNDLE_DIR}\nRun 'yarn build:dev' in agent-space/packages/frontend first.\n`,
    );
    return;
  }
  if (stats.isDirectory()) {
    writeText(res, 403, 'Directory listing is not served.\n');
    return;
  }

  // In LAN mode the page itself is behind the token, so the URL that was
  // printed is the only way in. Assets (JS, CSS, fonts) carry no data and are
  // left open; the session WebSocket enforces the token regardless.
  if (TOKEN !== undefined && pathname.endsWith('.html')) {
    const token = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token');
    if (!tokenMatches(token)) {
      writeText(res, 403, 'A valid ?token= is required in LAN mode; use the URL this server printed at startup.\n');
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stats.size,
  });
  createReadStream(resolved).pipe(res);
}

// --- the terminal WebSocket -------------------------------------------------------

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true });

/** Rejects an upgrade before the handshake completes. */
function refuseUpgrade(req, socket, status, reason) {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/terminal') {
    refuseUpgrade(req, socket, 404, 'Not Found');
    return;
  }

  // A browser always sends an Origin on a WebSocket; anything else is not the
  // page this server served. The origin host must be the host we listen on,
  // which blocks cross-site hijacking of the terminal.
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') {
    refuseUpgrade(req, socket, 403, 'Forbidden');
    return;
  }
  try {
    if (new URL(origin).host !== req.headers.host) {
      refuseUpgrade(req, socket, 403, 'Forbidden');
      return;
    }
  } catch {
    refuseUpgrade(req, socket, 403, 'Forbidden');
    return;
  }

  if (TOKEN !== undefined && !tokenMatches(url.searchParams.get('token'))) {
    refuseUpgrade(req, socket, 401, 'Unauthorized');
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = data => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  };

  // Everything user-controlled is validated here, and only ever handed to a
  // child process as an argv element or a directory name - never through a
  // shell, never interpolated into a command line.
  const problems = [];
  const agent = url.searchParams.get('agent') ?? '';
  if (!AGENT_NAME.test(agent)) {
    problems.push('agent must match ^[a-z0-9-]{1,63}$');
  }
  const mode = url.searchParams.get('mode') ?? '';
  if (!MODES.includes(mode)) {
    problems.push(`mode must be one of: ${MODES.join(', ')}`);
  }
  // An empty repo is an agent with no project: nothing is cloned and the
  // session starts in an empty /sandbox.
  const repo = url.searchParams.get('repo') ?? '';
  let repoName;
  if (repo !== '') {
    try {
      repoName = repoNameFromUrl(repo);
    } catch (error) {
      problems.push(error.message);
    }
  }

  if (problems.length > 0) {
    send(`\r\n\x1b[1mRefusing the session:\x1b[0m\r\n  - ${problems.join('\r\n  - ')}\r\n`);
    ws.close(1008, 'Invalid parameters');
    return;
  }

  const cols = clampSize(url.searchParams.get('cols'), 80);
  const rows = clampSize(url.searchParams.get('rows'), 24);
  const env = sessionEnv({ agent, repo, repoName, cols, rows });

  // Resolve the command before cloning, so a missing harness fails fast.
  const command = sessionCommand(mode, send);
  if (command === undefined) {
    ws.close(1011, 'Command not available');
    return;
  }

  send(`Agent Space prototype - ${mode} session for '${agent}'\r\n`);
  send(
    repo === ''
      ? `No repository: an empty ${env.OPENSHELL_WORKDIR} (mapped onto this host)\r\n\r\n`
      : `Repository: ${repo} -> ${env.OPENSHELL_WORKDIR} (mapped onto this host)\r\n\r\n`,
  );

  const workdir =
    repoName === undefined
      ? fsp.mkdir(path.join(CLONE_ROOT, agent, 'empty'), { recursive: true }).then(() =>
          path.join(CLONE_ROOT, agent, 'empty'),
        )
      : ensureClone({ agent, repo, repoName, send });
  workdir
    .then(cwd => {
      if (ws.readyState !== ws.OPEN) {
        // The tab went away while the clone was running.
        return;
      }

      const pty = ptyBackend.spawn({
        ...command,
        cwd,
        env,
        cols,
        rows,
        onData: send,
        onExit: exitCode => {
          send(`\r\n\x1b[2m[${path.basename(command.file)} exited with code ${exitCode}]\x1b[0m\r\n`);
          ws.close(1000, 'Session exited');
        },
      });

      ws.on('message', (data, isBinary) => {
        const text = data.toString('utf8');
        const resize = !isBinary ? parseResize(text) : undefined;
        if (resize !== undefined) {
          pty.resize(resize.cols, resize.rows);
        } else {
          pty.write(text);
        }
      });
      ws.on('close', () => pty.kill());
    })
    .catch(error => {
      send(`\r\n\x1b[1mCould not start the session:\x1b[0m ${error.message}\r\n`);
      ws.close(1011, 'Could not start the session');
    });
});

// --- startup ----------------------------------------------------------------------

function lanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const address of interfaces ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

const banner = [
  '',
  '⚠️  Agent Space PROTOTYPE SERVER - SECURITY WARNING',
  '',
  '  This is NOT an OpenShell sandbox. mode=shell runs your real login shell,',
  '  and the agent harnesses run with THIS host user\'s login. Anything typed',
  '  into a session executes on this machine, as this user.',
  '',
  `  Bundle:     ${BUNDLE_DIR}${existsSync(path.join(BUNDLE_DIR, 'index.html')) ? '' : '  (MISSING - run yarn build:dev)'}`,
  `  PTY backend: ${ptyBackend.id}${ptyBackend.supportsResize ? '' : '  (terminal resize is NOT supported)'}`,
  `  Clones:     ${CLONE_ROOT}/<agent>/<repo>`,
  '',
];

if (isLoopback) {
  banner.push(`  Listening:  http://${HOST}:${PORT}/  (loopback only)`);
  banner.push('  LAN mode:   restart with HOST=0.0.0.0 to expose it (a token is then required).');
} else {
  banner.push(`  Listening:  http://${HOST}:${PORT}/  - LAN MODE, TOKEN REQUIRED`);
  for (const address of lanAddresses()) {
    banner.push(`  Open:       http://${address}:${PORT}/?token=${TOKEN}`);
  }
  banner.push('');
  banner.push('  Every page and terminal WebSocket must carry this ?token=.');
}
banner.push('', 'Press Ctrl+C to stop.', '');

console.log(banner.join('\n'));

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use; start with PORT=<port> to pick another.`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST);
