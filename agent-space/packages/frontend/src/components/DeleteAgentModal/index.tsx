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

import {
  Button,
  ButtonVariant,
  Checkbox,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import React from 'react';

export type Props = {
  isOpen: boolean;
  /** One name for a row action, several for a bulk delete. */
  agentNames: string[];
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Deleting an agent destroys the DevWorkspace, its OpenShell sandbox and the
 * cloned repository, so the action is behind an explicit acknowledgement
 * rather than a plain Yes/No.
 */
export function DeleteAgentModal({
  isOpen,
  agentNames,
  isDeleting = false,
  onConfirm,
  onClose,
}: Props): React.ReactElement {
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setIsConfirmed(false);
    }
  }, [isOpen]);

  return (
    <Modal
      aria-label="Delete agent confirmation window"
      isOpen={isOpen}
      variant={ModalVariant.small}
      onClose={onClose}
      elementToFocus="[data-pf-initial-focus]"
    >
      <ModalHeader
        title={agentNames.length > 1 ? 'Delete Agents' : 'Delete Agent'}
        titleIconVariant="warning"
      />
      <ModalBody>
        <Content data-pf-initial-focus tabIndex={-1} style={{ outline: 'none' }}>
          {agentNames.length > 1 ? (
            <>
              <Content component="p">Would you like to delete {agentNames.length} agents?</Content>
              <Content component="ul" data-testid="delete-agent-names">
                {agentNames.map(name => (
                  <Content component="li" key={name}>
                    {name}
                  </Content>
                ))}
              </Content>
            </>
          ) : (
            <Content component="p">
              Would you like to delete the agent &quot;{agentNames[0]}&quot;?
            </Content>
          )}
          <Checkbox
            id="delete-agent-confirmation"
            data-testid="confirmation-checkbox"
            isChecked={isConfirmed}
            onChange={(_event, checked) => setIsConfirmed(checked)}
            label="I understand, this operation cannot be reverted."
          />
        </Content>
      </ModalBody>
      <ModalFooter>
        <Button
          variant={ButtonVariant.danger}
          isDisabled={!isConfirmed || isDeleting}
          isLoading={isDeleting}
          data-testid="delete-agent-button"
          onClick={onConfirm}
        >
          Delete
        </Button>
        <Button variant={ButtonVariant.link} data-testid="close-button" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
