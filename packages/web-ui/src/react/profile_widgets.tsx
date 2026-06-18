import React, {useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import type {
  KnownProfileType,
  NamedBuiltinProfileModel,
  NamedDirectProfileModel,
  NamedFixedProfileModel,
  NamedPacProfileModel,
  NamedProfile,
  NamedProfileOfType,
  NamedRuleListProfileModel,
  NamedSystemProfileModel,
  NamedVirtualProfileModel,
  Profile as ProfileModel,
  ProfileKey
} from './profile_types';

export type Profile = NamedProfile & {
  attachedToProfileName?: string;
  role?: string;
};

const BUILTIN_PROFILES: Profile[] = [
  {
    name: 'direct',
    profileType: 'DirectProfile',
    color: '#aaaaaa',
    builtin: true
  },
  {
    name: 'system',
    profileType: 'SystemProfile',
    color: '#000000',
    builtin: true
  }
];

const PROFILE_ORDER_FOR_TYPE: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000
};

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

function isProfileKey(key: string): key is ProfileKey {
  return key.charAt(0) === '+';
}

export function isNamedProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as ProfileModel;
  return typeof profile.name === 'string' && profile.name.length > 0;
}

export function isNamedProfileType<TProfile extends NamedProfileOfType<KnownProfileType>>(
  value: unknown,
  profileType: TProfile['profileType']
): value is TProfile {
  return isNamedProfile(value) && value.profileType === profileType;
}

export function isFixedProfile(value: unknown): value is NamedFixedProfileModel {
  return isNamedProfileType<NamedFixedProfileModel>(value, 'FixedProfile');
}

export function isDirectProfile(value: unknown): value is NamedDirectProfileModel {
  return isNamedProfileType<NamedDirectProfileModel>(value, 'DirectProfile');
}

export function isSystemProfile(value: unknown): value is NamedSystemProfileModel {
  return isNamedProfileType<NamedSystemProfileModel>(value, 'SystemProfile');
}

export function isBuiltinProfile(value: unknown): value is NamedBuiltinProfileModel {
  return isDirectProfile(value) || isSystemProfile(value);
}

export function isPacProfile(value: unknown): value is NamedPacProfileModel {
  return isNamedProfileType<NamedPacProfileModel>(value, 'PacProfile');
}

export function isRuleListProfile(value: unknown): value is NamedRuleListProfileModel {
  return isNamedProfileType<NamedRuleListProfileModel>(value, 'RuleListProfile');
}

export function isVirtualProfile(value: unknown): value is NamedVirtualProfileModel {
  return isNamedProfileType<NamedVirtualProfileModel>(value, 'VirtualProfile');
}

export function isVisibleProfile(value: unknown): value is Profile {
  if (!isNamedProfile(value)) {
    return false;
  }
  const name = value.name;
  return !(name.charAt(0) === '_' && name.charAt(1) === '_');
}

export function profilesFromOptions(options?: Options | null) {
  if (!options) {
    return [];
  }
  return Object.keys(options)
    .filter(isProfileKey)
    .map((key) => options[key])
    .filter(isVisibleProfile);
}

export function profileOrder(a: Profile, b: Profile) {
  const diff = (PROFILE_ORDER_FOR_TYPE[a.profileType || ''] || 0) - (PROFILE_ORDER_FOR_TYPE[b.profileType || ''] || 0);
  if (diff !== 0) {
    return diff;
  }
  return a.name.localeCompare(b.name);
}

export function allProfilesFromOptions(options?: Options | null) {
  return profilesFromOptions(options)
    .filter((profile) => {
      return profile.name.charAt(0) !== '_';
    })
    .concat(BUILTIN_PROFILES);
}

export function profilesForFilter(options: Options | null | undefined, filter?: ProfileModel | string | null) {
  if (!options) {
    return [];
  }
  if (filter && (typeof filter === 'object' || (typeof filter === 'string' && filter.charAt(0) === '+'))) {
    return OmegaPac.Profiles.validResultProfilesFor(typeof filter === 'string' ? filter.slice(1) : filter, options).filter(
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

export function profileByName<TProfile extends Profile = Profile>(
  options: Options | null | undefined,
  name: string,
  guard?: (profile: Profile) => profile is TProfile
) {
  const profile =
    profilesFromOptions(options)
      .concat(BUILTIN_PROFILES)
      .find((candidate) => candidate.name === name) || null;
  if (!profile) {
    return null;
  }
  return !guard || guard(profile) ? profile : null;
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
