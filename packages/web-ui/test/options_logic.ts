import {
  cloneOptions,
  cloneAuth,
  composeLegacyRuleList,
  composeOmegaRuleList,
  createPacExport,
  deleteAttachedProfileOption,
  deleteProfileOption,
  exportRuleListOptions,
  getParentName,
  hasProxyScriptApi,
  isErrorResult,
  isPatchEmpty,
  isProfileNameHidden,
  isProfileNameReserved,
  numberOption,
  optionsPatch,
  profileDraft,
  profileDownloadErrorMessage,
  profileOption,
  profileUpdating,
  proxyAuthSupported,
  safeProfileFileName,
  setProfileOption,
  updateProfileError,
  updateProfileRevision
} from '../src/react/options_logic';
import type {Options} from '../src/react/options_client';
import type {Profile} from '../src/react/profile_types';
import type {SwitchRule} from '../src/react/switch_profile_runtime';

beforeEach(() => {
  delete (globalThis as any).OmegaPac;
  delete (globalThis as any).browser;
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => ''
    }
  };
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

  it('formats profile download error messages with status codes', () => {
    (globalThis as any).chrome = {
      i18n: {
        getMessage(key: string, substitutions?: string | string[]) {
          if (key === 'options_profileDownloadError_HttpError') {
            return `HTTP ${substitutions}`;
          }
          return '';
        }
      }
    };

    expect(profileDownloadErrorMessage({
      name: 'HttpError',
      original: {
        statusCode: 502
      }
    })).toBe('HTTP 502');

    expect(profileDownloadErrorMessage({
      name: 'UnknownError',
      statusCode: 404
    })).toBe('Profile download failed.');
  });

  it('creates PAC export blobs and sanitized filenames', async () => {
    const printSettings: unknown[] = [];
    (globalThis as any).OmegaPac = {
      PacGenerator: {
        ascii(value: string) {
          return `ascii:${value}`;
        },
        script(_options: Options, profileName: string, hooks: {profileNotFound: (name: string) => string}) {
          expect(profileName).toBe('work/proxy 1');
          expect(hooks.profileNotFound('missing')).toBe('dumb');
          return {
            print_to_string(settings: unknown) {
              printSettings.push(settings);
              return 'function FindProxyForURL() {}';
            }
          };
        }
      }
    };

    const exported = createPacExport({}, 'work/proxy 1');

    expect(exported.fileName).toBe('OmegaProfile_work_proxy_1.pac');
    expect(exported.missingProfile).toBe('missing');
    expect(exported.blob.type).toBe('text/plain;charset=utf-8');
    expect(await exported.blob.text()).toBe('ascii:function FindProxyForURL() {}');
    expect(printSettings).toEqual([
      {
        beautify: true,
        comments: true
      }
    ]);
  });

  it('composes Omega rule lists with metadata headers', () => {
    const rules = [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'proxy'
      }
    ] as SwitchRule[];
    (globalThis as any).OmegaPac = {
      RuleList: {
        Switchy: {
          compose(args: {defaultProfileName: string; rules: SwitchRule[]}) {
            expect(args).toEqual({
              defaultProfileName: 'direct',
              rules
            });
            return '[SwitchyOmega Conditions]\nbody';
          }
        }
      }
    };

    const text = composeOmegaRuleList(rules, 'direct');

    expect(text).toContain('[SwitchyOmega Conditions]\r\n; Require: SwitchyOmega >= 2.3.2');
    expect(text).toContain('; Usage: https://github.com/FelisCatus/SwitchyOmega/wiki/RuleListUsage');
    expect(text).toContain('body');
  });

  it('composes legacy rule lists from supported switch conditions', () => {
    const rules = [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'proxy'
      },
      {
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://internal/*'
        },
        profileName: 'direct'
      },
      {
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^https://secure'
        },
        profileName: 'direct'
      },
      {
        condition: {
          conditionType: 'KeywordCondition',
          pattern: 'ignored'
        },
        profileName: 'proxy'
      }
    ] as SwitchRule[];

    const text = composeLegacyRuleList(rules, 'direct');

    expect(text).toContain('; Summary: Proxy Switchy! Exported Rule List');
    expect(text).toContain('; Website: https://github.com/FelisCatus/SwitchyOmega/wiki/RuleListUsage');
    expect(text).toContain('@*://*.example.com/*\r\n');
    expect(text).toContain('!@http://internal/*\r\n');
    expect(text).toContain('!^https://secure\r\n');
    expect(text).not.toContain('ignored');
  });

  it('detects proxy authentication and proxy script API support', () => {
    expect(proxyAuthSupported('http')).toBe(true);
    expect(proxyAuthSupported('https')).toBe(true);
    expect(proxyAuthSupported('socks4')).toBe(false);
    expect(proxyAuthSupported('socks5')).toBe(false);
    expect(hasProxyScriptApi()).toBe(false);

    (globalThis as any).browser = {
      proxy: {
        register() {}
      }
    };
    expect(proxyAuthSupported('socks5')).toBe(true);
    expect(hasProxyScriptApi()).toBe(true);

    (globalThis as any).browser = {
      proxy: {
        registerProxyScript() {}
      }
    };
    expect(proxyAuthSupported('socks5')).toBe(false);
    expect(hasProxyScriptApi()).toBe(true);
  });

  it('clones proxy auth records when present', () => {
    const auth = {
      password: 'pass',
      username: 'user'
    };

    const cloned = cloneAuth(auth);

    expect(cloned).toEqual(auth);
    expect(cloned).not.toBe(auth);
    expect(cloneAuth()).toBeUndefined();
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
