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
 * npm >= 11.5 blocks dependency lifecycle scripts unless they are approved,
 * so node-pty's own `post-install.js` - which restores the executable bit of
 * the `spawn-helper` binaries shipped in its prebuilds - never runs, and
 * `pty.spawn()` fails with `posix_spawnp failed`. This script does the same
 * chmod for every PTY package that made it into node_modules, and is a no-op
 * when npm did run their scripts (or when neither package is installed; the
 * server then falls back to its python3 PTY).
 */
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = ['node-pty', '@homebridge/node-pty-prebuilt-multiarch'];

const moduleRoot = dirname(fileURLToPath(import.meta.url));

let fixed = 0;
for (const name of PACKAGES) {
  const prebuilds = join(moduleRoot, 'node_modules', name, 'prebuilds');
  if (!existsSync(prebuilds)) {
    continue;
  }
  for (const platform of readdirSync(prebuilds, { withFileTypes: true })) {
    if (!platform.isDirectory()) {
      continue;
    }
    const helper = join(prebuilds, platform.name, 'spawn-helper');
    if (existsSync(helper)) {
      chmodSync(helper, 0o755);
      fixed += 1;
    }
  }
}

if (fixed > 0) {
  console.log(`prototype-server: restored the executable bit of ${fixed} pty spawn-helper binaries`);
}
