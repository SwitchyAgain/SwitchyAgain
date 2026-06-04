import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Options} from './options_client';

export type Profile = {
  builtin?: boolean;
  color?: string;
  name?: string;
  profileType?: string;
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
    <>
      <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
    </>
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

export function allProfilesFromOptions(options?: Options | null) {
  return profilesFromOptions(options).filter((profile) => {
    const name = profile.name || '';
    return name.charAt(0) !== '_';
  }).concat(BUILTIN_PROFILES);
}

export function profileByName(options: Options | null | undefined, name: string) {
  return profilesFromOptions(options).concat(BUILTIN_PROFILES).find((profile) => profile.name === name) || null;
}

export function ProfileSelect({
  defaultIcon = 'glyphicon-time',
  defaultText,
  dispName,
  inline = false,
  name,
  onChange,
  options,
  profiles
}: {
  defaultIcon?: string;
  defaultText?: string;
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

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOnOutsidePointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('touchstart', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('touchstart', closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`btn-group omega-profile-select ${open ? 'open' : ''}`} style={selectStyle}>
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        {selectedProfile ? <ProfileIcon profile={selectedProfile} /> : <span className={`glyphicon ${defaultIcon}`} />}{' '}
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
                <span className={`glyphicon ${defaultIcon}`} /> {defaultText}
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

type ProfileSelectMountProps = React.ComponentProps<typeof ProfileSelect>;

function mountProfileSelect(element: Element, props: ProfileSelectMountProps) {
  const root = createRoot(element);
  root.render(<ProfileSelect {...props} />);
  return {
    render(nextProps: ProfileSelectMountProps) {
      root.render(<ProfileSelect {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactProfileWidgets = {
  ...(globalWindow.OmegaReactProfileWidgets || {}),
  mountProfileSelect
};
