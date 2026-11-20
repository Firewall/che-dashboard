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

import { PageSection } from '@patternfly/react-core';
import { dump } from 'js-yaml';
import React from 'react';

import { ManifestTools } from '@/components/ManifestTools';
import { ManifestViewer } from '@/components/ManifestViewer';
import { useToggleBars } from '@/contexts/ToggleBars';
import styles from '@/pages/AgentDetails/ManifestTab/index.module.css';
import { Agent } from '@/services/types';

export type Props = {
  agent: Agent;
};

/**
 * The DevWorkspace behind the agent, as YAML: the `workload-kind: openshell`
 * attribute, the git remote, the container image, the provider annotation,
 * and the status the controller reports for it.
 *
 * Same pattern as the Devfile tab of a workspace. Read-only: an agent is
 * changed through the lifecycle actions, not by editing YAML here.
 */
export function ManifestTab({ agent }: Props): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { hideAll, showAll } = useToggleBars();

  const manifest = React.useMemo(() => dump(agent, { lineWidth: 100 }), [agent]);

  // Expanding gives the manifest the masthead and the sidebar as well. The
  // cleanup covers both collapsing and leaving the tab while it is expanded.
  React.useEffect(() => {
    if (!isExpanded) {
      return;
    }
    hideAll();
    return () => showAll();
  }, [isExpanded, hideAll, showAll]);

  return (
    <PageSection
      data-testid="manifest-tab"
      className={isExpanded ? styles.manifestTabExpanded : undefined}
    >
      <ManifestTools
        contentText={manifest}
        fileName={`${agent.metadata.name}.devworkspace.yaml`}
        isExpanded={isExpanded}
        onExpand={setIsExpanded}
      />
      <ManifestViewer id="agent-manifest-viewer" value={manifest} isExpanded={isExpanded} />
    </PageSection>
  );
}
