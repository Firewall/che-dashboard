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

import type { ITheme } from '@xterm/xterm';

/**
 * Colours that keep a terminal legible against either dashboard theme.
 *
 * Both themes stay dark: the panels the terminals sit in are dark in the
 * real dashboard too, and the harness TUIs assume a dark background.
 */
export const DARK_TERMINAL_THEME: ITheme = {
  background: '#0f1214',
  foreground: '#e0e0e0',
  cursor: '#e0e0e0',
};

export const LIGHT_TERMINAL_THEME: ITheme = {
  background: '#1b1d21',
  foreground: '#e0e0e0',
  cursor: '#e0e0e0',
};
