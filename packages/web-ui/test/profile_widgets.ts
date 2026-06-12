import {
  allProfilesFromOptions,
  displayProfileName,
  isBuiltinProfile,
  isFixedProfile,
  isPacProfile,
  isRuleListProfile,
  isVirtualProfile,
  profileByName,
  profileOrder,
  profilesForFilter,
  profilesFromOptions,
  resultProfilesFor
} from '../src/react/profile_widgets';
import type {Options} from '../src/react/options_client';
import type {Profile} from '../src/react/profile_widgets';

function installBrowserMessageMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage(key: string) {
        return key === 'profile_direct' ? 'Direct' : '';
      }
    }
  };
}

function installOmegaPacMock(validProfiles: Profile[]) {
  (globalThis as any).OmegaPac = {
    Profiles: {
      validResultProfilesFor(_filter: unknown, _options: Options) {
        return validProfiles;
      }
    }
  };
}

function optionsFixture(): Options {
  return {
    '+auto': {
      name: 'auto',
      profileType: 'SwitchProfile'
    },
    '+fixed': {
      name: 'fixed',
      profileType: 'FixedProfile'
    },
    '+pac': {
      name: 'pac',
      profileType: 'PacProfile'
    },
    '+rules': {
      name: 'rules',
      profileType: 'RuleListProfile'
    },
    '+virtual': {
      name: 'virtual',
      profileType: 'VirtualProfile'
    },
    '+__attached': {
      name: '__attached',
      profileType: 'RuleListProfile'
    },
    '+_internal': {
      name: '_internal',
      profileType: 'FixedProfile'
    },
    '-startupProfileName': 'auto'
  };
}

beforeEach(() => {
  installBrowserMessageMock();
  installOmegaPacMock([]);
});

describe('profile widgets model helpers', () => {
  it('lists visible option profiles without builtin or attached internals', () => {
    expect(profilesFromOptions(optionsFixture()).map((profile) => profile.name)).toEqual([
      'auto',
      'fixed',
      'pac',
      'rules',
      'virtual',
      '_internal'
    ]);
  });

  it('adds builtin profiles only for all profile lists', () => {
    expect(allProfilesFromOptions(optionsFixture()).map((profile) => profile.name)).toEqual([
      'auto',
      'fixed',
      'pac',
      'rules',
      'virtual',
      'direct',
      'system'
    ]);
  });

  it('sorts profiles by type and then name', () => {
    const sorted = profilesForFilter(optionsFixture(), 'sorted').map((profile) => profile.name);

    expect(sorted).toEqual(['_internal', 'fixed', 'pac', 'virtual', 'auto', 'rules']);
  });

  it('finds profiles by name with optional type guards', () => {
    const options = optionsFixture();

    expect(profileByName(options, 'direct')?.builtin).toBe(true);
    expect(displayProfileName(profileByName(options, 'direct'))).toBe('Direct');
    expect(profileByName(options, 'fixed', isFixedProfile)?.profileType).toBe('FixedProfile');
    expect(profileByName(options, 'fixed', isPacProfile)).toBeNull();
  });

  it('checks known profile types', () => {
    const options = optionsFixture();

    expect(isFixedProfile(profileByName(options, 'fixed'))).toBe(true);
    expect(isPacProfile(profileByName(options, 'pac'))).toBe(true);
    expect(isRuleListProfile(profileByName(options, 'rules'))).toBe(true);
    expect(isVirtualProfile(profileByName(options, 'virtual'))).toBe(true);
    expect(isBuiltinProfile(profileByName(options, 'system'))).toBe(true);
  });

  it('delegates valid result profile filtering to OmegaPac when requested', () => {
    const validProfiles: Profile[] = [
      {
        name: 'fixed',
        profileType: 'FixedProfile'
      },
      {
        name: '__attached',
        profileType: 'RuleListProfile'
      }
    ];
    installOmegaPacMock(validProfiles);

    expect(resultProfilesFor(optionsFixture(), '+auto').map((profile) => profile.name)).toEqual(['fixed']);
  });

  it('keeps profileOrder deterministic within a profile type', () => {
    expect(profileOrder({name: 'beta', profileType: 'FixedProfile'}, {name: 'alpha', profileType: 'FixedProfile'})).toBeGreaterThan(0);
  });
});
