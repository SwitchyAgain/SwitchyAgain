import {
  cloneOptions,
  deleteAttachedProfileOption,
  deleteProfileOption,
  exportRuleListOptions,
  getParentName,
  isErrorResult,
  isPatchEmpty,
  isProfileNameHidden,
  isProfileNameReserved,
  numberOption,
  optionsPatch,
  profileDraft,
  profileOption,
  profileUpdating,
  safeProfileFileName,
  setProfileOption,
  updateProfileError,
  updateProfileRevision
} from '../src/react/options_logic';
import type {Options} from '../src/react/options_client';
import type {Profile} from '../src/react/profile_types';

beforeEach(() => {
  delete (globalThis as any).OmegaPac;
});

describe('options logic', () => {
  it('clones options without sharing nested references', () => {
    const options = {
      '+proxy': {
        name: 'proxy',
        nested: {
          value: 1
        }
      }
    };

    const cloned = cloneOptions(options);

    expect(cloned).toEqual(options);
    expect(cloned).not.toBe(options);
    expect(cloned['+proxy']).not.toBe(options['+proxy']);
  });

  it('builds compact option patches', () => {
    const before: Options = {
      '+same': {
        name: 'same',
        values: ['a']
      },
      '+changed': {
        color: '#000000',
        name: 'changed'
      },
      '+deleted': {
        name: 'deleted'
      }
    };
    const after: Options = {
      '+same': {
        name: 'same',
        values: ['a']
      },
      '+changed': {
        color: '#ffffff',
        name: 'changed'
      },
      '+created': {
        name: 'created'
      }
    };

    expect(optionsPatch(before, after)).toEqual({
      '+changed': [
        {
          color: '#000000',
          name: 'changed'
        },
        {
          color: '#ffffff',
          name: 'changed'
        }
      ],
      '+deleted': [
        {
          name: 'deleted'
        },
        0,
        0
      ],
      '+created': [
        {
          name: 'created'
        }
      ]
    });
    expect(isPatchEmpty(optionsPatch(before, before))).toBe(true);
  });

  it('detects error results and prefers the requested profile error', () => {
    const primary = new Error('primary');
    const fallback = {
      message: 'fallback',
      name: 'UpdateError'
    };

    expect(isErrorResult(primary)).toBe(true);
    expect(isErrorResult(fallback)).toBe(true);
    expect(isErrorResult({message: 'missing name'})).toBe(false);
    expect(updateProfileError({
      '+other': fallback,
      '+proxy': primary
    }, 'proxy')).toBe(primary);
    expect(updateProfileError({
      '+other': fallback
    }, 'proxy')).toBe(fallback);
  });

  it('handles profile names and file-safe names', () => {
    expect(isProfileNameHidden('_hidden')).toBe(true);
    expect(isProfileNameHidden('normal')).toBe(false);
    expect(isProfileNameReserved('__reserved')).toBe(true);
    expect(isProfileNameReserved('_visible')).toBe(false);
    expect(getParentName('__ruleListOf_auto')).toBe('auto');
    expect(getParentName('auto')).toBeUndefined();
    expect(safeProfileFileName('work/proxy 1')).toBe('work_proxy_1');
  });

  it('derives rule-list export mode from options and condition mode', () => {
    expect(exportRuleListOptions({}, 0)).toEqual({
      legacy: false,
      warning: false
    });
    expect(exportRuleListOptions({'-exportLegacyRuleList': true}, 0)).toEqual({
      legacy: true,
      warning: false
    });
    expect(exportRuleListOptions({'-exportLegacyRuleList': true}, 1)).toEqual({
      legacy: false,
      warning: true
    });
  });

  it('normalizes simple option values and profile records', () => {
    const options: Options = {
      '+proxy': {
        color: '#ffffff',
        name: 'proxy',
        profileType: 'FixedProfile'
      },
      '+__ruleListOf_proxy': {
        name: '__ruleListOf_proxy',
        profileType: 'RuleListProfile'
      }
    };

    expect(numberOption(3, 1)).toBe(3);
    expect(numberOption('3', 1)).toBe(1);
    expect(profileOption(options, 'proxy')).toEqual({
      color: '#ffffff',
      name: 'proxy',
      profileType: 'FixedProfile'
    });
    expect(profileOption(options, 'proxy', (profile): profile is Profile => {
      return (profile as Profile).profileType === 'PacProfile';
    })).toBeUndefined();
    expect(profileDraft(options, 'missing', {
      name: 'missing',
      profileType: 'PacProfile'
    })).toEqual({
      name: 'missing',
      profileType: 'PacProfile'
    });

    setProfileOption(options, 'new', {
      name: 'new',
      profileType: 'VirtualProfile'
    });
    expect(options['+new']).toEqual({
      name: 'new',
      profileType: 'VirtualProfile'
    });

    deleteProfileOption(options, 'new');
    deleteAttachedProfileOption(options, 'proxy');
    expect(options['+new']).toBeUndefined();
    expect(options['+__ruleListOf_proxy']).toBeUndefined();
  });

  it('uses OmegaPac revision updates when available', () => {
    const profile: Profile = {
      name: 'proxy',
      profileType: 'FixedProfile'
    };
    (globalThis as any).OmegaPac = {
      Profiles: {
        updateRevision(nextProfile: Profile) {
          nextProfile.revision = 'next';
        }
      }
    };

    updateProfileRevision(profile);

    expect(profile.revision).toBe('next');
  });

  it('checks profile updating state by profile key', () => {
    expect(profileUpdating({'+proxy': true}, 'proxy')).toBe(true);
    expect(profileUpdating({}, 'proxy')).toBe(false);
  });
});
