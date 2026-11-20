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
  Brand,
  Button,
  ButtonVariant,
  Label,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { ToggleBarsContext } from '@/contexts/ToggleBars';
import { useBranding } from '@/hooks/useBranding';
import styles from '@/Layout/index.module.css';
import { RecentAgents } from '@/Layout/RecentList';
import { HeaderTools } from '@/Layout/Tools';
import { ROUTE } from '@/Routes';
import { dashboardRoute } from '@/services/config';
import { pageTitle, SECTION } from '@/services/pageTitle';
import { selectDashboardUrl, selectIsMockData } from '@/store/Bootstrap';
import { useAppSelector } from '@/store/hooks';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: ROUTE.CREATE, label: SECTION.CREATE },
  { to: ROUTE.AGENTS, label: SECTION.AGENTS },
];

/** What the Workspaces area shows, mirroring the Che dashboard's own nav. */
const WORKSPACES_NAV_ITEMS: { to: string; label: string }[] = [
  { to: ROUTE.CREATE_WORKSPACE, label: 'Create Workspace' },
  { to: ROUTE.WORKSPACES, label: 'Workspaces' },
];

export type Props = {
  children: React.ReactNode;
  /** Comes from the dashboard theme the app follows; only the logo needs it. */
  isDarkTheme?: boolean;
};

export function Layout({ children, isDarkTheme = false }: Props): React.ReactElement {
  const dashboardUrl = useAppSelector(selectDashboardUrl);
  const isMockData = useAppSelector(selectIsMockData);
  const branding = useBranding(isDarkTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const { logoSrc, title } = branding;

  // The two areas of the bundle: the Agent Space routes, and the mock of the
  // Che dashboard Workspaces page the masthead toggle leads to.
  const isWorkspacesArea = location.pathname.startsWith(ROUTE.WORKSPACES);
  const navItems = isWorkspacesArea ? WORKSPACES_NAV_ITEMS : NAV_ITEMS;

  // A page that needs the whole window - the expanded manifest - takes the
  // bars away through the context and puts them back when it is done.
  const [areBarsVisible, setAreBarsVisible] = React.useState(true);
  const toggleBars = React.useMemo(
    () => ({
      hideAll: () => setAreBarsVisible(false),
      showAll: () => setAreBarsVisible(true),
    }),
    [],
  );

  const masthead = (
    <Masthead className={areBarsVisible ? styles.showHeader : styles.hideHeader}>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton isHamburgerButton aria-label="Global navigation" />
        </MastheadToggle>
        <MastheadBrand>
          <MastheadLogo>
            {/* The logo is fetched from the dashboard's branding assets; when
                they are not there - the standalone prototype has none - the
                product title stands in rather than a broken image. */}
            {logoSrc ? (
              <Brand
                src={logoSrc}
                alt={title}
                heights={{ default: '36px' }}
                data-testid="branding-logo"
              />
            ) : (
              <span className={styles.brandTitle} data-testid="branding-title">
                {title}
              </span>
            )}
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar id="header-tools" isStatic>
          <ToolbarContent>
            {/* Same group the dashboard masthead uses, so the buttons line up
                the same way on both sides of the two applications. */}
            <ToolbarGroup
              variant="action-group-plain"
              align={{ default: 'alignEnd' }}
              gap={{ default: 'gapNone', md: 'gapMd' }}
            >
              {isMockData && (
                <ToolbarItem>
                  {/* The prototype runs on in-memory data only; say so
                      instead of letting a demo be mistaken for a live
                      cluster. */}
                  <Label color="orange" data-testid="mock-mode-label">
                    Demo data
                  </Label>
                </ToolbarItem>
              )}
              <ToolbarItem>
                {/* Like the dashboard's own masthead: one button that goes to
                    the other application. */}
                <Button
                  variant={ButtonVariant.secondary}
                  size="sm"
                  icon={<ExternalLinkAltIcon />}
                  iconPosition="end"
                  onClick={() => navigate(isWorkspacesArea ? ROUTE.AGENTS : ROUTE.WORKSPACES)}
                  data-testid="area-button"
                >
                  {isWorkspacesArea ? 'Agent Space' : 'Workspaces'}
                </Button>
              </ToolbarItem>
              <HeaderTools
                branding={branding}
                userPreferencesUrl={dashboardRoute(dashboardUrl, '/user-preferences')}
              />
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav
          aria-label={isWorkspacesArea ? 'Workspaces navigation' : 'Agent Space navigation'}
          data-testid={isWorkspacesArea ? 'workspaces-nav' : 'agent-space-nav'}
        >
          <NavList>
            {navItems.map(item => (
              <NavItem
                key={item.to}
                /* The agent area has detail routes under its entries, so a
                   prefix marks the current section; the workspaces area is
                   exactly two pages, so an exact match keeps both from being
                   current at once. */
                isActive={
                  isWorkspacesArea
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to)
                }
                data-testid={`nav-${item.to.slice(1)}`}
              >
                {/* The tooltip sits inside the link, not around it: NavItem
                    marks the current section by cloning its own child, and a
                    wrapper would swallow that class. */}
                <NavLink to={item.to}>
                  <Tooltip
                    content={isWorkspacesArea ? item.label : pageTitle(item.label)}
                    position="right"
                  >
                    <span>{item.label}</span>
                  </Tooltip>
                </NavLink>
              </NavItem>
            ))}
          </NavList>
          {!isWorkspacesArea && <RecentAgents />}
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <ToggleBarsContext.Provider value={toggleBars}>
      <Page
        masthead={masthead}
        sidebar={areBarsVisible ? sidebar : undefined}
        isManagedSidebar={areBarsVisible}
      >
        {children}
      </Page>
    </ToggleBarsContext.Provider>
  );
}
