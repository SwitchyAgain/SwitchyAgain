import React from 'react';
import {Options, message} from './options_client';
import {Profile, ProfileInline, profilesForFilter} from './profile_widgets';

export type OptionsShellProps = {
  currentProfileName?: string;
  currentState?: string;
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
  routeTraceHref?: string;
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

function navClick(event: React.MouseEvent, action?: () => void) {
  event.preventDefault();
  action?.();
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

export function OptionsShell({
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
  profileHref,
  routeTraceHref = '#',
  uiHref = '#'
}: OptionsShellProps) {
  const profiles = profilesForFilter(options, 'sorted');

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
          active={currentState === 'routeTrace'}
          href={routeTraceHref}
          icon="glyphicon-sort"
          label={message('options_tab_routeTrace', 'Route Trace')}
          onClick={() => onNavigate?.('routeTrace')}
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
              onClick={(event) => navClick(event, () => onNavigate?.('profile', {name: profile.name}))}
            >
              <ProfileInline profile={profile} />
            </a>
          </li>
        ))}
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
