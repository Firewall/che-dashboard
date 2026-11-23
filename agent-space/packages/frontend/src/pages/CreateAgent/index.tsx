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
  Content,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  PageSection,
  Select,
  SelectOption,
  Spinner,
  TextInput,
  Title,
} from '@patternfly/react-core';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/ErrorAlert';
import { AGENT_TAB, buildAgentDetailsRoute, ROUTE } from '@/Routes';
import { validateRepositoryUrl } from '@/services/agentFactory';
import { pageTitle, SECTION } from '@/services/pageTitle';
import {
  agentsActionCreators,
  selectAgentActionError,
  selectAgentActionPendingName,
} from '@/store/Agents';
import { selectNamespace } from '@/store/Bootstrap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProviders, selectProvidersIsLoading } from '@/store/Providers';

/**
 * The whole create flow: the repository to clone and the one AI provider the
 * agent runs with.
 *
 * Everything else is derived or fixed on purpose - the name comes from the
 * repository, the image is the one the prototype runs everywhere, and the
 * policy belongs to the administrator - so there is nothing here the user can
 * get wrong that the cluster would have to reject later.
 */
export function CreateAgent(): React.ReactElement {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const namespace = useAppSelector(selectNamespace);
  const error = useAppSelector(selectAgentActionError);
  const isSubmitting = useAppSelector(selectAgentActionPendingName) !== undefined;
  const providers = useAppSelector(selectProviders);
  const areProvidersLoading = useAppSelector(selectProvidersIsLoading);

  const [repositoryUrl, setRepositoryUrl] = React.useState('');
  const [providerId, setProviderId] = React.useState<string | undefined>(undefined);
  const [isTouched, setIsTouched] = React.useState(false);
  const [isProvidersOpen, setIsProvidersOpen] = React.useState(false);

  // Validity follows the value, so an untouched empty field is not submittable
  // either; the explanation is what waits for the touch.
  const repositoryError = validateRepositoryUrl(repositoryUrl);
  const shownRepositoryError = isTouched ? repositoryError : undefined;
  const isValid = repositoryError === undefined && providerId !== undefined;

  const selectedProvider = providers.find(provider => provider.id === providerId);

  const handleSubmit = React.useCallback(async () => {
    const created = await dispatch(
      agentsActionCreators.createAgent({
        repositoryUrl: repositoryUrl.trim(),
        providerId: providerId ?? '',
      }),
    );
    if (created !== undefined) {
      // A freshly asked-for agent is worth watching, and the Events tab is
      // where the sandbox request and the clone show up as they happen.
      navigate(buildAgentDetailsRoute(created.metadata.name, AGENT_TAB.EVENTS));
    }
  }, [dispatch, navigate, providerId, repositoryUrl]);

  return (
    <PageSection>
      <Title headingLevel="h1" size="2xl">
        {pageTitle(SECTION.CREATE)}
      </Title>
      <Content component="p">
        The agent is created in <strong>{namespace}</strong>. The repository is cloned inside its
        OpenShell sandbox on launch.
      </Content>

      <ErrorAlert
        title="Could not create the agent"
        error={error}
        onClose={() => dispatch(agentsActionCreators.clearActionError())}
      />

      <Form
        onSubmit={event => {
          event.preventDefault();
          if (isValid && !isSubmitting) {
            void handleSubmit();
          }
        }}
        style={{ maxWidth: '42rem', marginTop: '1rem' }}
      >
        <FormGroup label="Repository URL" isRequired fieldId="agent-repository-url">
          <TextInput
            id="agent-repository-url"
            data-testid="agent-repository-url"
            isRequired
            value={repositoryUrl}
            validated={shownRepositoryError ? 'error' : 'default'}
            isDisabled={isSubmitting}
            onChange={(_event, value) => {
              setRepositoryUrl(value);
              setIsTouched(true);
            }}
            onBlur={() => setIsTouched(true)}
            placeholder="https://github.com/spring-projects/spring-petclinic"
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant={shownRepositoryError ? 'error' : 'default'}>
                {shownRepositoryError ??
                  'The git repository the sandbox clones on launch. http(s) or git@ URLs.'}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup label="Harness" isRequired fieldId="agent-provider">
          {areProvidersLoading ? (
            <Spinner size="lg" data-testid="providers-loading" />
          ) : (
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
                  isFullWidth
                  isExpanded={isProvidersOpen}
                  isDisabled={isSubmitting}
                  onClick={() => setIsProvidersOpen(!isProvidersOpen)}
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
          )}
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                The agent CLI that runs in the sandbox. Its model keys come from an OpenShell
                provider your administrator manages; the agent never sees them.
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <div>
          <Button
            type="submit"
            variant={ButtonVariant.primary}
            isDisabled={!isValid || isSubmitting}
            isLoading={isSubmitting}
            data-testid="submit-button"
          >
            Create
          </Button>{' '}
          <Button
            variant={ButtonVariant.link}
            onClick={() => navigate(ROUTE.AGENTS)}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
        </div>
      </Form>
    </PageSection>
  );
}
