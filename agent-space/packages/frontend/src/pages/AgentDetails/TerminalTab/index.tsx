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

import { Alert, EmptyState, EmptyStateBody, PageSection } from '@patternfly/react-core';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import React from 'react';

import { PtyTerminal } from '@/components/PtyTerminal';
import { useDashboardTheme } from '@/hooks/useDashboardTheme';
import { useFillHeight } from '@/hooks/useFillHeight';
import styles from '@/pages/AgentDetails/TerminalTab/index.module.css';
import {
  getAgentPhase,
  getAgentProviderId,
  getAgentRepository,
  getAgentRepositoryName,
  getAgentSandboxName,
} from '@/services/agent';
import { createShellState, runCommand, shellPrompt, ShellState } from '@/services/sandboxShell';
import { DARK_TERMINAL_THEME, LIGHT_TERMINAL_THEME } from '@/services/terminalTheme';
import { Agent, AgentPhase } from '@/services/types';

export type Props = {
  agent: Agent;
};

/**
 * A shell inside the sandbox, as a panel of the agent session.
 *
 * The prototype server answers the terminal WebSocket with a real shell on
 * the host it runs on. When the page is served without it - by a plain static
 * server, or by the dashboard itself - the WebSocket cannot even be opened,
 * and the tab falls back to the small offline interpreter of
 * `services/sandboxShell` so the page still demos.
 */
export function TerminalTab({ agent }: Props): React.ReactElement {
  const { isDarkTheme } = useDashboardTheme();
  const hostRef = React.useRef<HTMLDivElement>(null);
  const liveRef = useFillHeight<HTMLDivElement>();

  const isRunning = getAgentPhase(agent) === AgentPhase.RUNNING;
  const sandboxName = getAgentSandboxName(agent);
  const repoName = getAgentRepositoryName(agent);
  // A plain string, so the emulator is rebuilt only when the identity of the
  // sandbox changes - not on every watch update of the same agent.
  const providerId = getAgentProviderId(agent);

  // Stays false until the WebSocket is proven unopenable, then holds the
  // fallback for as long as the tab is mounted.
  const [isOfflineMock, setIsOfflineMock] = React.useState(false);
  const handleUnreachable = React.useCallback(() => setIsOfflineMock(true), []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!isRunning || !isOfflineMock || host === null) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontSize: 13,
      fontFamily: 'var(--pf-t--global--font--family--mono), monospace',
      theme: isDarkTheme ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);

    const providerIds = providerId === undefined ? [] : [providerId];
    let state: ShellState = createShellState({ sandboxName, repoName, providerIds });

    const printPrompt = (): void => {
      terminal.write(shellPrompt(state));
    };

    terminal.write(`OpenShell sandbox ${sandboxName} - mock shell. Type 'help'.\r\n\r\n`);
    printPrompt();

    // The line being edited, and where in the history a recall stands: the
    // length of the history is "the line is new", one past its last entry.
    let line = '';
    let historyIndex = state.history.length;

    /** Runs the line and puts the prompt back. */
    const runLine = (): void => {
      terminal.write('\r\n');
      const result = runCommand(state, line);
      state = result.state;
      if (result.clear) {
        terminal.clear();
      } else {
        terminal.write(result.output);
      }
      line = '';
      historyIndex = state.history.length;
      printPrompt();
    };

    /** Cancels the line the way ctrl+c does. */
    const cancelLine = (): void => {
      terminal.write('^C\r\n');
      line = '';
      historyIndex = state.history.length;
      printPrompt();
    };

    /** Erases the last character of the line. */
    const backspace = (): void => {
      if (line.length > 0) {
        line = line.slice(0, -1);
        terminal.write('\b \b');
      }
    };

    /** Recalls a line from the history, up or down. */
    const recall = (isUp: boolean): void => {
      const nextIndex = isUp
        ? Math.max(0, historyIndex - 1)
        : Math.min(state.history.length, historyIndex + 1);
      if (nextIndex === historyIndex) {
        return;
      }
      historyIndex = nextIndex;
      terminal.write('\b \b'.repeat(line.length));
      line = nextIndex === state.history.length ? '' : state.history[nextIndex] ?? '';
      terminal.write(line);
    };

    // A key arrives as one chunk, a paste as many characters in one; the
    // input is consumed from the front so both behave the same.
    const CONTROLS: { sequence: string; run: () => void }[] = [
      { sequence: '\r', run: runLine },
      { sequence: '\x03', run: cancelLine },
      { sequence: '\x7f', run: backspace },
      { sequence: '\x1b[A', run: () => recall(true) },
      { sequence: '\x1b[B', run: () => recall(false) },
    ];

    const handleData = (data: string): void => {
      let rest = data;
      while (rest.length > 0) {
        const control = CONTROLS.find(entry => rest.startsWith(entry.sequence));
        if (control !== undefined) {
          control.run();
          rest = rest.slice(control.sequence.length);
          continue;
        }

        const typed = rest.match(/^[\x20-\x7e]+/);
        if (typed === null) {
          // A control sequence the mock shell has no meaning for.
          rest = rest.slice(1);
          continue;
        }
        line += typed[0];
        terminal.write(typed[0]);
        rest = rest.slice(typed[0].length);
      }
    };

    const onInput = terminal.onData(handleData);

    function fit(): void {
      try {
        fitAddon.fit();
      } catch {
        // The tab can be measured while it is hidden, where there is no area
        // to fit into. The next resize settles it.
      }
    }

    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(host);

    return () => {
      observer.disconnect();
      onInput.dispose();
      terminal.dispose();
    };
  }, [isDarkTheme, isOfflineMock, isRunning, providerId, repoName, sandboxName]);

  if (!isRunning) {
    return (
      <PageSection data-testid="terminal-tab">
        <EmptyState titleText="The agent is not running" headingLevel="h2">
          <EmptyStateBody>
            The terminal is available while the sandbox is running. Start the agent first.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (!isOfflineMock) {
    return (
      <PageSection padding={{ default: 'noPadding' }} data-testid="terminal-tab">
        <div className={styles.liveTerminal} ref={liveRef}>
          <PtyTerminal
            agentName={agent.metadata.name}
            repositoryUrl={getAgentRepository(agent)}
            mode="shell"
            sessionName="Sandbox shell"
            onUnreachable={handleUnreachable}
          />
        </div>
      </PageSection>
    );
  }

  return (
    <PageSection data-testid="terminal-tab">
      <Alert
        variant="info"
        isInline
        title="Offline mock shell"
        data-testid="terminal-mock-alert"
        className={styles.mockAlert}
      >
        The prototype server is not reachable from this page, so a real shell cannot be started.
        This is the offline mock interpreter of the prototype, not the sandbox.
      </Alert>
      <div className={styles.terminal} ref={hostRef} data-testid="terminal-host" />
    </PageSection>
  );
}
