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
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Divider,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  Gallery,
  HelperText,
  HelperTextItem,
  MenuToggle,
  PageSection,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Select,
  SelectOption,
  Spinner,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/ErrorAlert';
import styles from '@/pages/CreateAgent/index.module.css';
import { AGENT_TAB, buildAgentDetailsRoute } from '@/Routes';
import { validateRepositoryUrl } from '@/services/agentFactory';
import { pageTitle, SECTION } from '@/services/pageTitle';
import { AGENT_SAMPLES, AgentSample } from '@/services/samples';
import {
  agentsActionCreators,
  selectAgentActionError,
  selectAgentActionPendingName,
} from '@/store/Agents';
import { selectNamespace } from '@/store/Bootstrap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProviders, selectProvidersIsLoading } from '@/store/Providers';

/**
 * Laid out like the dashboard's Create Workspace page: pick the harness the
 * way you pick an editor there, then either (A) import a git repository or
 * (B) click a sample. Both create the agent and open it straight away.
 */
export function CreateAgent(): React.ReactElement {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const namespace = useAppSelector(selectNamespace);
  const error = useAppSelector(selectAgentActionError);
  const isSubmitting = useAppSelector(selectAgentActionPendingName) !== undefined;
  const providers = useAppSelector(selectProviders);
  const areProvidersLoading = useAppSelector(selectProvidersIsLoading);

  // Like the default editor: the first harness is chosen up front, so a sample
  // click or "Create & Open" never waits on another decision.
  const [chosenProviderId, setProviderId] = React.useState<string | undefined>(undefined);
  const providerId = chosenProviderId ?? providers[0]?.id;
  const selectedProvider = providers.find(provider => provider.id === providerId);
  const [isProvidersOpen, setIsProvidersOpen] = React.useState(false);

  const [repositoryUrl, setRepositoryUrl] = React.useState('');
  const [isTouched, setIsTouched] = React.useState(false);
  const repositoryError = validateRepositoryUrl(repositoryUrl);
  const shownRepositoryError = isTouched && repositoryUrl !== '' ? repositoryError : undefined;

  const create = React.useCallback(
    async (url: string) => {
      if (providerId === undefined) {
        return;
      }
      const created = await dispatch(
        agentsActionCreators.createAgent({ repositoryUrl: url.trim(), providerId }),
      );
      if (created !== undefined) {
        navigate(buildAgentDetailsRoute(created.metadata.name, AGENT_TAB.AGENT));
      }
    },
    [dispatch, navigate, providerId],
  );

  const canImport = repositoryError === undefined && providerId !== undefined && !isSubmitting;

  return (
    <>
      <PageSection>
        <Title headingLevel="h1">{pageTitle(SECTION.CREATE)}</Title>
      </PageSection>

      <Divider />

      <PageSection>
        <ErrorAlert
          title="Could not create the agent"
          error={error}
          onClose={() => dispatch(agentsActionCreators.clearActionError())}
        />

        <Panel>
          <PanelHeader>
            <Title headingLevel="h3">Select a Harness</Title>
          </PanelHeader>
          <PanelMain>
            <PanelMainBody>
              {areProvidersLoading ? (
                <Spinner size="lg" data-testid="providers-loading" />
              ) : (
                <FormGroup fieldId="agent-provider" label="Harness" isRequired>
                  <Select
                    id="agent-provider"
                    isOpen={isProvidersOpen}
                    selected={providerId}
                    onSelect={(_event, value) => {
                      setProviderId(value as string);
                      setIsProvidersOpen(false);
                    }}
                    onOpenChange={setIsProvidersOpen}
                    toggle={toggleRef => (
                      <MenuToggle
                        ref={toggleRef}
                        isExpanded={isProvidersOpen}
                        isDisabled={isSubmitting}
                        onClick={() => setIsProvidersOpen(!isProvidersOpen)}
                        style={{ width: '500px', maxWidth: '100%' }}
                        data-testid="agent-provider-toggle"
                      >
                        {selectedProvider?.name ?? 'Select a harness'}
                      </MenuToggle>
                    )}
                  >
                    {providers.map(provider => (
                      <SelectOption
                        key={provider.id}
                        value={provider.id}
                        description={provider.description}
                        data-testid={`agent-provider-option-${provider.id}`}
                      >
                        {provider.name}
                      </SelectOption>
                    ))}
                  </Select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        The agent CLI that runs in the sandbox. Its model keys come from an
                        OpenShell provider your administrator manages.
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              )}
            </PanelMainBody>
          </PanelMain>
        </Panel>

        <div className={styles.spacer} />

        <Panel>
          <PanelHeader>
            <Title headingLevel="h3">Import from Git</Title>
          </PanelHeader>
          <PanelMain>
            <PanelMainBody>
              <Form
                onSubmit={event => {
                  event.preventDefault();
                  setIsTouched(true);
                  if (canImport) {
                    void create(repositoryUrl);
                  }
                }}
              >
                <FormGroup fieldId="agent-repository-url" label="Git repo URL" isRequired>
                  <Flex>
                    <FlexItem
                      grow={{ default: 'grow' }}
                      style={{ maxWidth: '500px', minWidth: '70%' }}
                    >
                      <TextInput
                        id="agent-repository-url"
                        data-testid="agent-repository-url"
                        aria-label="HTTPS or SSH URL"
                        placeholder="Enter HTTPS or SSH URL"
                        value={repositoryUrl}
                        validated={shownRepositoryError ? 'error' : 'default'}
                        isDisabled={isSubmitting}
                        onChange={(_event, value) => setRepositoryUrl(value)}
                        onBlur={() => setIsTouched(true)}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        type="submit"
                        variant={ButtonVariant.secondary}
                        isDisabled={!canImport}
                        isLoading={isSubmitting && repositoryUrl !== ''}
                        data-testid="submit-button"
                      >
                        Create & Open
                      </Button>
                    </FlexItem>
                  </Flex>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant={shownRepositoryError ? 'error' : 'default'}>
                        {shownRepositoryError ??
                          `Cloned inside the agent's OpenShell sandbox on launch, in ${namespace}.`}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              </Form>
            </PanelMainBody>
          </PanelMain>
        </Panel>

        <div className={styles.or} aria-hidden="true">
          <span>or</span>
        </div>

        <Panel>
          <PanelHeader>
            <Title headingLevel="h3">Select a Sample</Title>
          </PanelHeader>
          <PanelMain>
            <PanelMainBody>
              <Gallery hasGutter minWidths={{ default: '18rem' }}>
                {AGENT_SAMPLES.map(sample => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    isDisabled={isSubmitting || providerId === undefined}
                    onSelect={() => void create(sample.repositoryUrl)}
                  />
                ))}
              </Gallery>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </PageSection>
    </>
  );
}

type SampleCardProps = {
  sample: AgentSample;
  isDisabled: boolean;
  onSelect: () => void;
};

/** A sample tile, as on the dashboard's Create Workspace page: a click creates. */
function SampleCard({ sample, isDisabled, onSelect }: SampleCardProps): React.ReactElement {
  const id = `agent-sample-${sample.id}`;
  const handleSelect = (): void => {
    if (!isDisabled) {
      onSelect();
    }
  };
  return (
    <Card
      id={id}
      isCompact
      isClickable
      isDisabled={isDisabled}
      onClick={handleSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSelect();
        }
      }}
      tabIndex={0}
      aria-label={`Create agent from sample ${sample.name}`}
      className={styles.sampleCard}
      data-testid={id}
    >
      <CardHeader
        selectableActions={{
          selectableActionAriaLabelledby: id,
          name: 'agent-samples',
          isHidden: true,
        }}
      >
        <CubesIcon className={styles.sampleCardIcon} aria-hidden="true" />
        <CardTitle>{sample.name}</CardTitle>
      </CardHeader>
      <CardBody>{sample.description}</CardBody>
    </Card>
  );
}
