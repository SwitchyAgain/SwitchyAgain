import React, {useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {
  allProfilesFromOptions,
  isVisibleProfile,
  profileOrder,
  profilesFromOptions
} from './profile_model_utils';
import type {Profile} from './profile_model_utils';
import type {Profile as ProfileModel} from './profile_types';

export {
  allProfilesFromOptions,
  isBuiltinProfile,
  isDirectProfile,
  isFixedProfile,
  isNamedProfile,
  isNamedProfileType,
  isPacProfile,
  isProfileKey,
  isRuleListProfile,
  isSystemProfile,
  isVirtualProfile,
  isVisibleProfile,
  profileByName,
  profileOrder,
  profilesFromOptions,
  scopeAssignableProfilesForOptions
} from './profile_model_utils';
export type {Profile} from './profile_model_utils';

export const PROFILE_ICONS: Record<string, string> = {
  AutoDetectProfile: 'glyphicon-file',
  DirectProfile: 'glyphicon-transfer',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  SystemProfile: 'glyphicon-off',
  VirtualProfile: 'glyphicon-question-sign'
};

export function profileName(profile?: Profile | null, dispName?: (profile: Profile) => string) {
  if (!profile) {
    return '';
  }
  return dispName ? dispName(profile) : displayProfileName(profile);
}

export function displayProfileName(profile?: Profile | null) {
  if (!profile) {
    return '';
  }
  if (profile.role === 'attachedRuleList') {
    return message('options_switchAttachedProfileInCondition', 'Rule list rules');
  }
  if (profile.builtin) {
    return message(`profile_${profile.name}`, profile.name);
  }
  return profile.name;
}

export function ProfileIcon({profile}: {profile?: ProfileModel | null}) {
  const icon = PROFILE_ICONS[profile?.profileType || ''] || 'glyphicon-question-sign';
  return <span className={`glyphicon ${icon}`} style={{color: profile?.color}} />;
}

export function ProfileInline({profile, dispName}: {profile?: Profile | null; dispName?: (profile: Profile) => string}) {
  return (
    <>
      <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
    </>
  );
}

export function profilesForFilter(options: Options | null | undefined, filter?: ProfileModel | string | null) {
  if (!options) {
    return [];
  }
  if (filter && (typeof filter === 'object' || (typeof filter === 'string' && filter.charAt(0) === '+'))) {
    return ProxyEngine.Profiles.validResultProfilesFor(typeof filter === 'string' ? filter.slice(1) : filter, options).filter(
      isVisibleProfile
    );
  }
  if (filter === 'all') {
    return allProfilesFromOptions(options);
  }
  const profiles = profilesFromOptions(options);
  if (filter === 'sorted') {
    return profiles.slice().sort(profileOrder);
  }
  return profiles;
}

export function resultProfilesFor(options: Options | null | undefined, filter?: ProfileModel | string | null) {
  return profilesForFilter(options, filter);
}

export function ProfileSelect({
  ariaLabel,
  defaultIcon = 'glyphicon-time',
  defaultText,
  disabled = false,
  dispName,
  inline = false,
  name,
  onChange,
  options,
  profiles
}: {
  ariaLabel?: string;
  defaultIcon?: string;
  defaultText?: string;
  disabled?: boolean;
  dispName?: (profile: Profile) => string;
  inline?: boolean;
  name: string;
  onChange: (name: string) => void;
  options?: Options | null;
  profiles?: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const profileList = useMemo(() => profiles || profilesFromOptions(options), [options, profiles]);
  const selectedProfile = profileList.find((profile) => profile.name === name) || null;
  const buttonLabel = selectedProfile ? profileName(selectedProfile, dispName) : defaultText || '';
  const selectStyle: React.CSSProperties = inline ? {display: 'inline-block', width: 'auto'} : {display: 'inline-block'};

  useOutsidePointer(rootRef, () => setOpen(false), open);

  return (
    <div ref={rootRef} className={`btn-group omega-profile-select ${open ? 'open' : ''}`} style={selectStyle}>
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        aria-label={ariaLabel}
        disabled={disabled}
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        {selectedProfile ? <ProfileIcon profile={selectedProfile} /> : <span className={`glyphicon ${defaultIcon}`} />}{' '}
        <span>{buttonLabel}</span> <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {defaultText != null && (
            <li role="option" className={name ? '' : 'active'}>
              <a
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <span className={`glyphicon ${defaultIcon}`} /> {defaultText}
              </a>
            </li>
          )}
          {profileList.map((profile) => (
            <li key={profile.name} role="option" className={name === profile.name ? 'active' : ''}>
              <a
                onClick={() => {
                  onChange(profile.name);
                  setOpen(false);
                }}
              >
                <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
