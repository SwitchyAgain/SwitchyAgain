import React, {useMemo, useState} from 'react';
import {Options} from './options_client';

export type Profile = {
  builtin?: boolean;
  color?: string;
  name?: string;
  profileType?: string;
};

const PROFILE_TYPE_ORDER: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000
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
  return dispName ? dispName(profile) : profile.name;
}

export function ProfileIcon({profile}: {profile?: Profile | null}) {
  const icon = PROFILE_ICONS[profile?.profileType || ''] || 'glyphicon-question-sign';
  return (
    <span className={`glyphicon ${icon}`} style={{color: profile?.color}} />
  );
}

export function ProfileInline({profile, dispName}: {profile?: Profile | null; dispName?: (profile: Profile) => string}) {
  return (
    <span className="profile-inline">
      <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
    </span>
  );
}

export function profilesFromOptions(options?: Options | null) {
  if (!options) {
    return [];
  }
  return Object.keys(options).filter((key) => key.charAt(0) === '+').map((key) => options[key]).filter((profile) => {
    const name = profile?.name || '';
    return !(name.charAt(0) === '_' && name.charAt(1) === '_');
  }) as Profile[];
}

function profileOrder(a: Profile, b: Profile) {
  const diff = (PROFILE_TYPE_ORDER[a.profileType || ''] || 0) - (PROFILE_TYPE_ORDER[b.profileType || ''] || 0);
  if (diff !== 0) {
    return diff;
  }
  return (a.name || '').localeCompare(b.name || '');
}

export function allProfilesFromOptions(options?: Options | null) {
  return profilesFromOptions(options).filter((profile) => {
    const name = profile.name || '';
    return name.charAt(0) !== '_';
  }).concat(BUILTIN_PROFILES).sort(profileOrder);
}

export function profileByName(options: Options | null | undefined, name: string) {
  return profilesFromOptions(options).concat(BUILTIN_PROFILES).find((profile) => profile.name === name) || null;
}

export function ProfileSelect({
  defaultText,
  dispName,
  name,
  onChange,
  options,
  profiles
}: {
  defaultText?: string;
  dispName?: (profile: Profile) => string;
  name: string;
  onChange: (name: string) => void;
  options?: Options | null;
  profiles?: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const profileList = useMemo(() => profiles || profilesFromOptions(options), [options, profiles]);
  const selectedProfile = profileList.find((profile) => profile.name === name) || null;
  const buttonLabel = selectedProfile ? profileName(selectedProfile, dispName) : defaultText || '';
  return (
    <div className={`btn-group omega-profile-select ${open ? 'open' : ''}`} style={{display: 'inline-block'}}>
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        <ProfileIcon profile={selectedProfile} />{' '}
        <span>{buttonLabel}</span>{' '}
        <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {defaultText != null && (
            <li role="option" className={name ? '' : 'active'}>
              <a onClick={() => {
                onChange('');
                setOpen(false);
              }}>
                {defaultText}
              </a>
            </li>
          )}
          {profileList.map((profile) => (
            <li key={profile.name} role="option" className={name === profile.name ? 'active' : ''}>
              <a onClick={() => {
                onChange(profile.name || '');
                setOpen(false);
              }}>
                <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
