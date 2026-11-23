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

import '@xterm/xterm/css/xterm.css';

import { Button, ButtonVariant } from '@patternfly/react-core';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import React from 'react';

import styles from '@/components/PtyTerminal/index.module.css';
import { useDashboardTheme } from '@/hooks/useDashboardTheme';
import { DARK_TERMINAL_THEME, LIGHT_TERMINAL_THEME } from '@/services/terminalTheme';

/** The sessions the prototype server can start; see its `MODES` allowlist. */
export type PtyMode = 'shell' | 'claude' | 'codex' | 'gemini' | 'opencode' | 'kiro';

export type PtyStatus = 'connecting' | 'connected' | 'closed';

export type Props = {
  /** The agent the session belongs to; keys the server's clone cache. */
  agentName: string;
  /** The repository the sandbox cloned on launch; the server clones it shallowly. */
  repositoryUrl: string;
  /** What to run: a login shell or one of the agent harness CLIs. */
  mode: PtyMode;
  /** What the session is called, in labels and the terminal's aria label. */
  sessionName: string;
  /** Called once the WebSocket has opened. */
  onConnected?: () => void;
  /**
   * Called when the WebSocket could not be opened at all - nothing is
   * listening, as when the bundle is served by a plain static server.
   */
  onUnreachable?: () => void;
  dataTestId?: string;
};

const STATUS_LABELS: Record<PtyStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  closed: 'Disconnected',
};

/**
 * The token the prototype server prints at startup when it is exposed beyond
 * loopback. It reaches the page as `?token=` - in the query string or inside
 * the hash route - and every terminal WebSocket this page opens must carry it.
 */
function readPrototypeToken(): string | undefined {
  const queries = [window.location.search];
  const hash = window.location.hash;
  const hashQueryAt = hash.indexOf('?');
  if (hashQueryAt >= 0) {
    queries.push(hash.slice(hashQueryAt));
  }
  for (const query of queries) {
    const token = new URLSearchParams(query).get('token');
    if (token !== null && token !== '') {
      return token;
    }
  }
  return undefined;
}

/**
 * A terminal panel backed by a live pseudo-terminal.
 *
 * In production the dashboard backend would relay an OpenShell interactive
 * exec session from the sandbox over a WebSocket; the prototype server
 * (agent-space/prototype-server) answers the same protocol with a real PTY on
 * the host it runs on. Frames are terminal data in both directions, plus one
 * JSON control message - `{"type":"resize","cols":N,"rows":N}` - whenever the
 * panel is fitted to a new size.
 */
export function PtyTerminal({
  agentName,
  repositoryUrl,
  mode,
  sessionName,
  onConnected,
  onUnreachable,
  dataTestId,
}: Props): React.ReactElement {
  const { isDarkTheme } = useDashboardTheme();
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<PtyStatus>('connecting');
  // Bumped by the Reconnect button; rebuilding the session is the reconnect.
  const [attempt, setAttempt] = React.useState(0);

  // The callbacks are read through refs so a parent passing an inline
  // function cannot restart the session on each of its renders.
  const onConnectedRef = React.useRef<Props['onConnected']>(undefined);
  const onUnreachableRef = React.useRef<Props['onUnreachable']>(undefined);
  React.useEffect(() => {
    onConnectedRef.current = onConnected;
    onUnreachableRef.current = onUnreachable;
  });

  React.useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--pf-t--global--font--family--mono), monospace',
      scrollback: 2000,
      theme: isDarkTheme ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);

    function fit(): void {
      try {
        fitAddon.fit();
      } catch {
        // The panel can be measured while it is hidden, where there is no
        // area to fit into. The next resize settles it.
      }
    }

    fit();

    const url = new URL('/terminal', window.location.origin);
    url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('agent', agentName);
    url.searchParams.set('repo', repositoryUrl);
    url.searchParams.set('mode', mode);
    url.searchParams.set('cols', String(terminal.cols));
    url.searchParams.set('rows', String(terminal.rows));
    const token = readPrototypeToken();
    if (token !== undefined) {
      url.searchParams.set('token', token);
    }

    let hasOpened = false;
    let isDisposed = false;
    // A failed socket reports both an error and a close; the parent only
    // needs to hear once that nothing was listening.
    let hasReportedGone = false;

    const socket = new WebSocket(url);
    socket.onopen = () => {
      hasOpened = true;
      setStatus('connected');
      onConnectedRef.current?.();
      // The size went out with the URL; send it again in case a fit happened
      // in between, so the two sides agree from the first frame on.
      sendResize(true);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      terminal.write(event.data);
    };
    const handleGone = () => {
      if (isDisposed) {
        return;
      }
      setStatus('closed');
      if (!hasOpened && !hasReportedGone) {
        hasReportedGone = true;
        onUnreachableRef.current?.();
      }
    };
    socket.onclose = handleGone;
    socket.onerror = handleGone;

    const onInput = terminal.onData(data => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    let lastSentSize = `${terminal.cols}x${terminal.rows}`;
    function sendResize(force = false): void {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      const size = `${terminal.cols}x${terminal.rows}`;
      if (!force && size === lastSentSize) {
        return;
      }
      lastSentSize = size;
      socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
    }

    const observer = new ResizeObserver(() => {
      fit();
      sendResize();
    });
    observer.observe(host);

    return () => {
      isDisposed = true;
      observer.disconnect();
      onInput.dispose();
      socket.close();
      terminal.dispose();
    };
  }, [agentName, attempt, isDarkTheme, mode, repositoryUrl]);

  return (
    <div className={styles.terminalArea} data-testid={dataTestId ?? 'pty-terminal'}>
      <div className={styles.statusbar} data-testid="pty-status">
        <span
          className={`${styles.status} ${
            status === 'connected'
              ? styles.statusConnected
              : status === 'connecting'
                ? styles.statusConnecting
                : styles.statusClosed
          }`}
          data-testid="pty-status-label"
        >
          {STATUS_LABELS[status]}
        </span>
        {status === 'closed' && (
          <Button
            variant={ButtonVariant.secondary}
            size="sm"
            onClick={() => setAttempt(attempt + 1)}
            data-testid="pty-reconnect"
          >
            Reconnect
          </Button>
        )}
      </div>
      <div
        aria-label={sessionName}
        className={styles.terminalHost}
        ref={hostRef}
        role="img"
        data-testid="pty-terminal-host"
      />
    </div>
  );
}
