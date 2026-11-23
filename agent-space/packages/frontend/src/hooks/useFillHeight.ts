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

import React from 'react';

/** Space left under the element so the page never scrolls by a few pixels. */
const BOTTOM_GAP_PX = 12;
/** Below this the terminal stops shrinking and the page scrolls instead. */
const MIN_HEIGHT_PX = 320;

/**
 * Sizes an element to reach from where it sits down to the bottom of the
 * window, so a terminal gets every pixel the header and tabs leave over.
 * Re-measures when the window or anything above the element changes size.
 */
export function useFillHeight<T extends HTMLElement>(): React.RefObject<T> {
  const ref = React.useRef<T>(null);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const measure = (): void => {
      // A hidden tab has no position to measure from; it is measured again
      // when it is shown, which the observer below reports.
      if (element.offsetParent === null) {
        return;
      }
      const top = element.getBoundingClientRect().top;
      const height = Math.max(MIN_HEIGHT_PX, window.innerHeight - top - BOTTOM_GAP_PX);
      element.style.height = `${height}px`;
    };
    measure();
    window.addEventListener('resize', measure);
    // Header content above the element (an error alert, a wrapped title)
    // moves it down without a window resize, and a tab being shown resizes
    // the element from nothing.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    observer.observe(element);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  return ref;
}
