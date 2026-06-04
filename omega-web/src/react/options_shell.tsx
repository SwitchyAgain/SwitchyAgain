import React from 'react';
import {createRoot} from 'react-dom/client';
import {Options, message} from './options_client';
import {Profile, ProfileInline} from './profile_widgets';

type OptionsShellProps = {
  currentProfileName?: string;
  currentState?: string;
  dispName?: (profile: Profile) => string;
  generalHref?: string;
  importExportHref?: string;
  isExperimental?: boolean;
  newProfileHref?: string;
  onApply?: () => void;
  onDiscard?: () => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  onNewProfile?: () => void;
  options?: Options | null;
  optionsDirty?: boolean;
  profileHref?: (profile: Profile) => string;
  profiles?: Profile[];
  uiHref?: string;
};

function navClick(event: React.MouseEvent, action?: () => void) {
  event.preventDefault();
  action?.();
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
  onClick?: () => void;
}) {
  return (
    <li className={active ? 'active' : ''}>
      <a href={href} onClick={(event) => navClick(event, onClick)}>
        <span className={`glyphicon ${icon}`} /> {label}
      </a>
    </li>
  );
}

function OptionsShell({
  currentProfileName = '',
  currentState = '',
  dispName,
  generalHref = '#',
  importExportHref = '#',
  isExperimental = false,
  newProfileHref = '#',
  onApply,
  onDiscard,
  onNavigate,
  onNewProfile,
  optionsDirty = false,
  profileHref,
  profiles = [],
  uiHref = '#'
}: OptionsShellProps) {
  return (
    <>
      <h1>
        <a href="#/about" title={message('about_title', 'About')} onClick={(event) => navClick(event, () => onNavigate?.('about'))}>
          {message('appNameShort', 'SwitchyAgain')}
        </a>
        {isExperimental && (
          <sup className="om-experimental text-danger">
            {message('options_experimental_badge', 'Experimental')}
          </sup>
        )}
      </h1>
      <nav className="nav nav-pills nav-stacked">
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
        <SettingsLink
          active={currentState === 'io'}
          href={importExportHref}
          icon="glyphicon-floppy-save"
          label={message('options_tab_importExport', 'Import/Export')}
          onClick={() => onNavigate?.('io')}
        />
        <li className="divider" />
        <li className="nav-header">{message('options_navHeader_profiles', 'Profiles')}</li>
        {profiles.map((profile) => (
          <li
            key={profile.name}
            className={`nav-profile ${currentState === 'profile' && profile.name === currentProfileName ? 'active' : ''}`}
            data-profile-type={profile.profileType}
          >
            <a
              href={profileHref?.(profile) || '#'}
              onClick={(event) => navClick(event, () => onNavigate?.('profile', {name: profile.name || ''}))}
            >
              <ProfileInline profile={profile} dispName={dispName} />
            </a>
          </li>
        ))}
        <li className="nav-new-profile">
          <a href={newProfileHref} role="button" onClick={(event) => navClick(event, onNewProfile)}>
            <span className="glyphicon glyphicon-plus" /> <span>{message('options_newProfile', 'New profile')}</span>
          </a>
        </li>
        <li className="divider" />
        <li className="nav-header">Actions</li>
        <li>
          <a
            className={`btn-default btn align-initial ${optionsDirty ? 'btn-success' : ''}`}
            href="#"
            role="button"
            onClick={(event) => navClick(event, onApply)}
          >
            <span className="glyphicon glyphicon-ok-circle" /> {message('options_apply', 'Apply changes')}
          </a>
        </li>
        <li className={optionsDirty ? '' : 'disabled'}>
          <a
            className="text-danger"
            href="#"
            role="button"
            onClick={(event) => navClick(event, optionsDirty ? onDiscard : undefined)}
          >
            <span className="glyphicon glyphicon-remove-circle" /> {message('options_discard', 'Discard changes')}
          </a>
        </li>
      </nav>
    </>
  );
}

function mountOptionsShell(element: Element, props: OptionsShellProps = {}) {
  const root = createRoot(element);
  root.render(<OptionsShell {...props} />);
  return {
    render(nextProps: OptionsShellProps = {}) {
      root.render(<OptionsShell {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactOptionsShell = {
  mountOptionsShell
};
