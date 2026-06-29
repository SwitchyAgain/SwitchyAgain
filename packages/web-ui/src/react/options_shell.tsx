import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {Profile, ProfileInline, profileName, profilesForFilter} from './profile_widgets';

export type OptionsShellProps = {
  appliedOptions?: Options | null;
  currentProfileName?: string;
  currentState?: string;
  generalHref?: string;
  importExportHref?: string;
  isExperimental?: boolean;
  newProfileHref?: string;
  onApply?: () => void | Promise<unknown>;
  onDiscard?: () => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  onNewProfile?: () => void;
  options?: Options | null;
  optionsDirty?: boolean;
  profileScopeHref?: string;
  profileHref?: (profile: Profile) => string;
  routeTraceHref?: string;
  showProfileScope?: boolean;
  showRouteTrace?: boolean;
  uiHref?: string;
};

export type OptionsAlertProps = {
  alert?: {
    i18n?: string;
    message?: string;
    type?: string;
  } | null;
  onClose?: () => void;
  shown?: boolean;
};

const ALERT_ICONS: Record<string, string> = {
  danger: 'glyphicon-danger',
  error: 'glyphicon-remove',
  success: 'glyphicon-ok',
  warning: 'glyphicon-warning-sign'
};

function alertClassForType(type?: string) {
  if (!type) {
    return '';
  }
  return `alert-${type === 'error' ? 'danger' : type}`;
}

function navClick(event: React.MouseEvent, action?: () => void | Promise<unknown>) {
  event.preventDefault();
  Promise.resolve(action?.()).catch(() => undefined);
}

function actionClick(event: React.MouseEvent<HTMLElement>, action?: () => void) {
  event.currentTarget.blur();
  navClick(event, action);
}

function SettingsLink({
  active,
  href = '#',
  icon,
  label,
  onClick
}: {
  active?: boolean;
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void | Promise<unknown>;
}) {
  return (
    <li className={active ? 'active' : ''}>
      <a href={href} onClick={(event) => navClick(event, onClick)}>
        <span className={`glyphicon ${icon}`} /> {label}
      </a>
    </li>
  );
}

function ProfileNavItem({
  currentProfileName,
  currentState,
  onNavigate,
  profile,
  profileHref
}: {
  currentProfileName: string;
  currentState: string;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  profile: Profile;
  profileHref?: (profile: Profile) => string;
}) {
  return (
    <li
      className={`nav-profile ${currentState === 'profile' && profile.name === currentProfileName ? 'active' : ''}`}
      data-profile-type={profile.profileType}
    >
      <a href={profileHref?.(profile) || '#'} onClick={(event) => navClick(event, () => onNavigate?.('profile', {name: profile.name}))}>
        <ProfileInline profile={profile} />
      </a>
    </li>
  );
}

function ProfileSectionMenuButton({
  activeProfileName,
  ariaLabel,
  browseAllLabel,
  currentState,
  label,
  onBrowseAll,
  onNavigate,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  ariaLabel: string;
  browseAllLabel?: string;
  currentState: string;
  label: string;
  onBrowseAll?: () => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  const viewportGap = 12;
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuAnchorTop, setSubmenuAnchorTop] = useState(0);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties | undefined>();
  const rootRef = useRef<HTMLSpanElement>(null);
  const submenuRef = useRef<HTMLSpanElement>(null);
  useOutsidePointer(
    rootRef,
    () => {
      setOpen(false);
      setSubmenuOpen(false);
    },
    open
  );

  useLayoutEffect(() => {
    if (!submenuOpen || !submenuRef.current) {
      return;
    }
    const maxHeight = Math.floor(window.innerHeight * 0.9);
    const height = Math.min(submenuRef.current.scrollHeight, maxHeight);
    const top = Math.max(viewportGap, Math.min(submenuAnchorTop, window.innerHeight - viewportGap - height));
    setSubmenuStyle((current) => ({
      ...current,
      maxHeight,
      top
    }));
  }, [submenuAnchorTop, submenuOpen]);

  if (profiles.length === 0) {
    return null;
  }

  function toggleMenu() {
    if (!open) {
      setSubmenuOpen(false);
    }
    setOpen(!open);
  }

  function closeMenu() {
    setOpen(false);
    setSubmenuOpen(false);
  }

  function openSubmenu(event: React.FocusEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(viewportGap, Math.round(rect.right + 2));
    const top = Math.max(viewportGap, Math.round(rect.top));
    setSubmenuAnchorTop(top);
    setSubmenuStyle({
      left,
      maxHeight: Math.floor(window.innerHeight * 0.9),
      maxWidth: `calc(100vw - ${left}px - ${viewportGap}px)`,
      top
    });
    setSubmenuOpen(true);
  }

  function closeSubmenu() {
    setSubmenuOpen(false);
  }

  return (
    <span ref={rootRef} className={`options-shell-profile-menu ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="options-shell-profile-menu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={toggleMenu}
      >
        <span className="glyphicon glyphicon-option-vertical" />
      </button>
      {open && (
        <span className="options-shell-profile-menu-panel" role="menu" aria-label={ariaLabel}>
          <span className="options-shell-profile-menu-entry" onMouseLeave={closeSubmenu}>
            <button
              type="button"
              className="options-shell-profile-menu-item"
              aria-expanded={submenuOpen}
              aria-haspopup="menu"
              role="menuitem"
              onFocus={openSubmenu}
              onMouseEnter={openSubmenu}
            >
              <span>{ariaLabel}</span>
              <span className="glyphicon glyphicon-chevron-right" />
            </button>
            {submenuOpen && (
              <span ref={submenuRef} className="options-shell-profile-submenu" role="menu" aria-label={label} style={submenuStyle}>
                {profiles.map((profile) => (
                  <a
                    key={profile.name}
                    className={currentState === 'profile' && profile.name === activeProfileName ? 'active' : ''}
                    href={profileHref?.(profile) || '#'}
                    role="menuitem"
                    onClick={(event) => {
                      navClick(event, () => onNavigate?.('profile', {name: profile.name}));
                      closeMenu();
                    }}
                  >
                    <ProfileInline profile={profile} />
                  </a>
                ))}
              </span>
            )}
          </span>
          {onBrowseAll && (
            <span className="options-shell-profile-menu-entry">
              <button
                type="button"
                className="options-shell-profile-menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onBrowseAll();
                }}
              >
                <span>{browseAllLabel || message('options_browseAllProfiles', 'Browse all')}</span>
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function ProfileBrowserModal({
  activeProfileName,
  currentState,
  hiddenProfiles,
  onClose,
  onNavigate,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  currentState: string;
  hiddenProfiles: Profile[];
  onClose: () => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const profilesLabel = message('options_navHeader_profiles', 'Profiles');
  const hiddenProfilesLabel = message('options_navHeader_hiddenProfiles', 'Hidden');
  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesQuery(profile, normalizedQuery)),
    [normalizedQuery, profiles]
  );
  const filteredHiddenProfiles = useMemo(
    () => hiddenProfiles.filter((profile) => profileMatchesQuery(profile, normalizedQuery)),
    [hiddenProfiles, normalizedQuery]
  );
  const hasResults = filteredProfiles.length > 0 || filteredHiddenProfiles.length > 0;

  function navigateToProfile(profile: Profile) {
    onClose();
    onNavigate?.('profile', {name: profile.name});
  }

  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in options-shell-profile-browser-modal"
        role="dialog"
        style={{display: 'block'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" onClick={onClose}>
                <span aria-hidden="true">{'\u00d7'}</span>
                <span className="sr-only">{message('dialog_close', 'Close')}</span>
              </button>
              <h4 className="modal-title">{message('options_browseAllProfilesTitle', 'Browse all profiles')}</h4>
            </div>
            <div className="modal-body">
              <input
                autoFocus
                className="form-control options-shell-profile-browser-search"
                placeholder={message('options_searchProfilesPlaceholder', 'Search profiles')}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {hasResults ? (
                <>
                  {filteredProfiles.length > 0 && (
                    <ProfileBrowserSection
                      activeProfileName={activeProfileName}
                      currentState={currentState}
                      label={profilesLabel}
                      onNavigate={navigateToProfile}
                      profileHref={profileHref}
                      profiles={filteredProfiles}
                    />
                  )}
                  {hiddenProfiles.length > 0 && filteredHiddenProfiles.length > 0 && (
                    <ProfileBrowserSection
                      activeProfileName={activeProfileName}
                      currentState={currentState}
                      label={hiddenProfilesLabel}
                      onNavigate={navigateToProfile}
                      profileHref={profileHref}
                      profiles={filteredHiddenProfiles}
                    />
                  )}
                </>
              ) : (
                <p className="text-muted options-shell-profile-browser-empty">
                  {message('options_noProfilesMatchSearch', 'No profiles match your search.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileBrowserSection({
  activeProfileName,
  currentState,
  label,
  onNavigate,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  currentState: string;
  label: string;
  onNavigate: (profile: Profile) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  return (
    <section className="options-shell-profile-browser-section">
      <h5>{label}</h5>
      <div className="options-shell-profile-browser-grid">
        {profiles.map((profile) => (
          <a
            key={profile.name}
            className={`options-shell-profile-browser-item ${
              currentState === 'profile' && profile.name === activeProfileName ? 'active' : ''
            }`}
            href={profileHref?.(profile) || '#'}
            onClick={(event) => navClick(event, () => onNavigate(profile))}
          >
            <ProfileInline profile={profile} />
          </a>
        ))}
      </div>
    </section>
  );
}

function profileMatchesQuery(profile: Profile, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }
  return `${profile.name} ${profileName(profile)}`.toLocaleLowerCase().includes(normalizedQuery);
}

export function OptionsShell({
  appliedOptions,
  currentProfileName = '',
  currentState = '',
  generalHref = '#',
  importExportHref = '#',
  isExperimental = false,
  newProfileHref = '#',
  onApply,
  onDiscard,
  onNavigate,
  onNewProfile,
  options,
  optionsDirty = false,
  profileScopeHref = '#',
  profileHref,
  routeTraceHref = '#',
  showProfileScope = false,
  showRouteTrace = true,
  uiHref = '#'
}: OptionsShellProps) {
  const [hiddenProfilesOpen, setHiddenProfilesOpen] = useState(false);
  const [profileBrowserOpen, setProfileBrowserOpen] = useState(false);
  const profiles = profilesForFilter(options, 'sorted');
  const appliedProfiles = profilesForFilter(appliedOptions || options, 'sorted');
  const hiddenProfileNames = new Set(appliedProfiles.filter((profile) => !!profile.hiddenInOptions).map((profile) => profile.name));
  const visibleProfiles = profiles.filter((profile) => !hiddenProfileNames.has(profile.name));
  const hiddenProfiles = profiles.filter((profile) => hiddenProfileNames.has(profile.name));
  const profilesLabel = message('options_navHeader_profiles', 'Profiles');
  const hiddenProfilesLabel = message('options_navHeader_hiddenProfiles', 'Hidden');

  return (
    <>
      <h1>
        <a href="#/about" title={message('about_title', 'About')} onClick={(event) => navClick(event, () => onNavigate?.('about'))}>
          {message('appNameShort', 'SwitchyAgain')}
        </a>
        {isExperimental && <sup className="om-experimental text-danger">{message('options_experimental_badge', 'Experimental')}</sup>}
      </h1>
      <nav className="options-shell-nav">
        <ul className="nav nav-pills nav-stacked options-shell-settings">
          <li className="nav-header">{message('options_navHeader_setting', 'Settings')}</li>
          <SettingsLink
            active={currentState === 'ui'}
            href={uiHref}
            icon="glyphicon-wrench"
            label={message('options_tab_ui', 'Interface')}
            onClick={() => onNavigate?.('ui')}
          />
          <SettingsLink
            active={currentState === 'general'}
            href={generalHref}
            icon="glyphicon-cog"
            label={message('options_tab_general', 'General')}
            onClick={() => onNavigate?.('general')}
          />
          {showProfileScope && (
            <SettingsLink
              active={currentState === 'profileScope'}
              href={profileScopeHref}
              icon="glyphicon-file"
              label={message('options_tab_profileScope', 'Profile Scope')}
              onClick={() => onNavigate?.('profileScope')}
            />
          )}
          {showRouteTrace && (
            <SettingsLink
              active={currentState === 'routeTrace'}
              href={routeTraceHref}
              icon="glyphicon-sort"
              label={message('options_tab_routeTrace', 'Route Trace')}
              onClick={() => onNavigate?.('routeTrace')}
            />
          )}
          <SettingsLink
            active={currentState === 'io'}
            href={importExportHref}
            icon="glyphicon-floppy-save"
            label={message('options_tab_importExport', 'Import/Export')}
            onClick={() => onNavigate?.('io')}
          />
          <li className="divider" />
        </ul>
        <ul className="nav nav-pills nav-stacked options-shell-profile-header">
          <li className="nav-header options-shell-section-header">
            <span>{profilesLabel}</span>
            <ProfileSectionMenuButton
              activeProfileName={currentProfileName}
              ariaLabel={message('options_showProfilesFlyout', 'Show all')}
              browseAllLabel={message('options_browseAllProfiles', 'Browse all')}
              currentState={currentState}
              label={profilesLabel}
              onBrowseAll={() => setProfileBrowserOpen(true)}
              onNavigate={onNavigate}
              profileHref={profileHref}
              profiles={visibleProfiles}
            />
          </li>
        </ul>
        <div className="options-shell-profile-list">
          <ul className="nav nav-pills nav-stacked">
            {visibleProfiles.map((profile) => (
              <ProfileNavItem
                key={profile.name}
                currentProfileName={currentProfileName}
                currentState={currentState}
                onNavigate={onNavigate}
                profile={profile}
                profileHref={profileHref}
              />
            ))}
          </ul>
        </div>
        {hiddenProfiles.length > 0 && (
          <>
            <ul className="nav nav-pills nav-stacked options-shell-hidden-profile-header">
              <li className="nav-header options-shell-section-header">
                <button
                  type="button"
                  className="options-shell-hidden-profile-toggle"
                  aria-expanded={hiddenProfilesOpen}
                  onClick={() => setHiddenProfilesOpen(!hiddenProfilesOpen)}
                >
                  <span className={`glyphicon ${hiddenProfilesOpen ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} />{' '}
                  <span>{hiddenProfilesLabel}</span>
                </button>
                <ProfileSectionMenuButton
                  activeProfileName={currentProfileName}
                  ariaLabel={message('options_showHiddenProfilesFlyout', 'Show all')}
                  currentState={currentState}
                  label={hiddenProfilesLabel}
                  onNavigate={onNavigate}
                  profileHref={profileHref}
                  profiles={hiddenProfiles}
                />
              </li>
            </ul>
            {hiddenProfilesOpen && (
              <div className="options-shell-hidden-profile-list">
                <ul className="nav nav-pills nav-stacked">
                  {hiddenProfiles.map((profile) => (
                    <ProfileNavItem
                      key={profile.name}
                      currentProfileName={currentProfileName}
                      currentState={currentState}
                      onNavigate={onNavigate}
                      profile={profile}
                      profileHref={profileHref}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <ul className="nav nav-pills nav-stacked options-shell-actions">
          <li className="nav-new-profile">
            <a href={newProfileHref} role="button" onClick={(event) => navClick(event, onNewProfile)}>
              <span className="glyphicon glyphicon-plus" /> <span>{message('options_newProfile', 'New profile')}</span>
            </a>
          </li>
          <li className="divider" />
          <li className="nav-header">{message('options_navHeader_actions', 'Actions')}</li>
          <li>
            <a
              className={`btn-default btn align-initial ${optionsDirty ? 'btn-success' : ''}`}
              href="#"
              role="button"
              onClick={(event) => actionClick(event, onApply)}
            >
              <span className="glyphicon glyphicon-ok-circle" /> {message('options_apply', 'Apply changes')}
            </a>
          </li>
          <li className={optionsDirty ? '' : 'disabled'}>
            <a className="text-danger" href="#" role="button" onClick={(event) => navClick(event, optionsDirty ? onDiscard : undefined)}>
              <span className="glyphicon glyphicon-remove-circle" /> {message('options_discard', 'Discard changes')}
            </a>
          </li>
        </ul>
      </nav>
      {profileBrowserOpen && (
        <ProfileBrowserModal
          activeProfileName={currentProfileName}
          currentState={currentState}
          hiddenProfiles={hiddenProfiles}
          onClose={() => setProfileBrowserOpen(false)}
          onNavigate={onNavigate}
          profileHref={profileHref}
          profiles={visibleProfiles}
        />
      )}
    </>
  );
}

export function OptionsAlert({alert, onClose, shown = false}: OptionsAlertProps) {
  if (!shown || !alert) {
    return null;
  }
  const icon = ALERT_ICONS[alert.type || ''] || '';
  const content = alert.i18n ? message(alert.i18n, alert.i18n) : alert.message;

  return (
    <div className="alert-top-wrapper">
      <div className={`alert ${alertClassForType(alert.type)}`}>
        <button type="button" className="close" onClick={onClose}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        {icon && <span className={`glyphicon ${icon}`} />} {content}
      </div>
    </div>
  );
}
