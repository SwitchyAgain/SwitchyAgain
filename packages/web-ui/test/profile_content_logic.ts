import {
  FIXED_PROFILE_DEFAULT_PORT,
  FIXED_PROFILE_KNOWN_PROTOCOLS,
  FIXED_PROFILE_PROTOCOLS,
  FIXED_PROFILE_PROXY_FIELDS,
  cloneSourceState,
  cloneProxyEditors,
  conditionTypeFromSelectValue,
  conditionTypesForMode,
  fixedProfileAuthActive,
  fixedProfileAuthSupported,
  fixedProfileBypassList,
  fixedProfileBypassListEquals,
  fixedProfileBypassText,
  fixedProfileEditors,
  fixedProfileHasAdvancedProxy,
  formatMediumDate,
  getRuleListFormats,
  groupedConditionTypes,
  isFileUrl,
  isFixedProfileProxyProtocol,
  moveIndex,
  normalizeColor,
  pacProfileUrlState
} from '../src/react/profile_content_logic';
import type {ConditionTypeOption} from '../src/react/switch_profile_runtime';
import type {FixedProfileModel, FixedProfileProxyEditors} from '../src/react/profile_types';

beforeEach(() => {
  delete (globalThis as any).browser;
  delete (globalThis as any).ProxyEngine;
});

describe('profile content logic', () => {
  it('normalizes profile colors for color input controls', () => {
    expect(normalizeColor()).toBe('#000000');
    expect(normalizeColor('#abc')).toBe('#aabbcc');
    expect(normalizeColor('#A1b2C3')).toBe('#A1b2C3');
    expect(normalizeColor('red')).toBe('#000000');
  });

  it('groups condition types while preserving group order', () => {
    const conditionTypes: ConditionTypeOption[] = [
      {
        group: 'condition_group_host',
        type: 'HostWildcardCondition'
      },
      {
        group: 'condition_group_url',
        type: 'UrlRegexCondition'
      },
      {
        group: 'condition_group_host',
        type: 'HostRegexCondition'
      }
    ];

    expect(groupedConditionTypes(conditionTypes)).toEqual([
      {
        group: 'condition_group_host',
        types: [
          {
            group: 'condition_group_host',
            type: 'HostWildcardCondition'
          },
          {
            group: 'condition_group_host',
            type: 'HostRegexCondition'
          }
        ]
      },
      {
        group: 'condition_group_url',
        types: [
          {
            group: 'condition_group_url',
            type: 'UrlRegexCondition'
          }
        ]
      }
    ]);
    expect(conditionTypeFromSelectValue(conditionTypes, 'HostRegexCondition')).toBe('HostRegexCondition');
    expect(conditionTypeFromSelectValue(conditionTypes, 'UnknownCondition')).toBeUndefined();
  });

  it('returns condition type sets for basic and advanced modes', () => {
    expect(conditionTypesForMode(0).map((conditionType) => conditionType.type)).toContain('HostWildcardCondition');
    expect(conditionTypesForMode(1).map((conditionType) => conditionType.type)).toContain('IpCondition');
  });

  it('moves visual rule indices without mutating the original array', () => {
    const indices = [0, 1, 2, 3];

    expect(moveIndex(indices, 0, 2)).toEqual([1, 2, 0, 3]);
    expect(indices).toEqual([0, 1, 2, 3]);
    expect(moveIndex(indices, 1, 1)).toBe(indices);
    expect(moveIndex(indices, 10, 0)).toBe(indices);
  });

  it('detects file URLs case-insensitively', () => {
    expect(isFileUrl('file:///tmp/proxy.pac')).toBe(true);
    expect(isFileUrl('FILE:///tmp/proxy.pac')).toBe(true);
    expect(isFileUrl('https://example.com/proxy.pac')).toBe(false);
  });

  it('classifies PAC profile URLs for direct and referenced profiles', () => {
    expect(pacProfileUrlState('')).toEqual({
      invalid: false,
      isFile: false
    });
    expect(pacProfileUrlState('https://example.com/proxy.pac')).toEqual({
      invalid: false,
      isFile: false
    });
    expect(pacProfileUrlState('ftp://example.com/proxy.pac')).toEqual({
      invalid: true,
      isFile: false
    });
    expect(pacProfileUrlState('file:///tmp/proxy.pac')).toEqual({
      invalid: false,
      isFile: true
    });
    expect(pacProfileUrlState('file:///tmp/proxy.pac', true)).toEqual({
      invalid: true,
      isFile: true
    });
    expect(pacProfileUrlState('not a url')).toEqual({
      invalid: true,
      isFile: false
    });
  });

  it('formats medium dates and falls back for invalid values', () => {
    const timestamp = Date.UTC(2020, 0, 2, 3, 4, 5);

    expect(formatMediumDate()).toBe('');
    expect(formatMediumDate(null)).toBe('');
    expect(formatMediumDate('not-a-date')).toBe('not-a-date');
    expect(formatMediumDate(timestamp)).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        second: '2-digit',
        year: 'numeric'
      }).format(new Date(timestamp))
    );
  });

  it('reads available rule-list formats from ProxyEngine', () => {
    (globalThis as any).ProxyEngine = {
      Profiles: {
        ruleListFormats: ['AutoProxy', 'Switchy']
      }
    };
    expect(getRuleListFormats()).toEqual(['AutoProxy', 'Switchy']);

    (globalThis as any).ProxyEngine = {
      Profiles: {}
    };
    expect(getRuleListFormats()).toEqual([]);
  });

  it('defines fixed profile proxy schemes and defaults', () => {
    expect(FIXED_PROFILE_PROXY_FIELDS).toEqual({
      '': 'fallbackProxy',
      http: 'proxyForHttp',
      https: 'proxyForHttps',
      ws: 'proxyForWs',
      wss: 'proxyForWss'
    });
    expect(FIXED_PROFILE_PROTOCOLS).toEqual(['http', 'https', 'socks4', 'socks5']);
    expect(FIXED_PROFILE_DEFAULT_PORT).toEqual({
      http: 80,
      https: 443,
      socks4: 1080,
      socks5: 1080,
      'socks5-local': 1080
    });
    expect(FIXED_PROFILE_KNOWN_PROTOCOLS).toEqual(['http', 'https', 'socks4', 'socks5', 'socks5-local']);
    expect(isFixedProfileProxyProtocol('socks5')).toBe(true);
    expect(isFixedProfileProxyProtocol('socks5-local')).toBe(true);
    expect(isFixedProfileProxyProtocol('direct')).toBe(false);
  });

  it('clones fixed profile proxy editors by scheme', () => {
    const editors: FixedProfileProxyEditors = {
      '': {
        host: 'default.example',
        port: 8080,
        scheme: 'http'
      },
      http: {
        host: 'http.example',
        scheme: 'https'
      },
      https: {},
      ws: {},
      wss: {}
    };

    const cloned = cloneProxyEditors(editors);

    expect(cloned).toEqual(editors);
    expect(cloned).not.toBe(editors);
    expect(cloned['']).not.toBe(editors['']);
    expect(cloned.http).not.toBe(editors.http);
  });

  it('maps fixed profile fields into editors', () => {
    const profile: FixedProfileModel = {
      fallbackProxy: {
        host: 'default.example',
        port: 8080,
        scheme: 'http'
      },
      profileType: 'FixedProfile',
      proxyForHttps: {
        host: 'secure.example',
        port: 8443,
        scheme: 'https'
      }
    };

    expect(fixedProfileEditors(profile)).toEqual({
      '': {
        host: 'default.example',
        port: 8080,
        scheme: 'http'
      },
      http: {},
      https: {
        host: 'secure.example',
        port: 8443,
        scheme: 'https'
      },
      ws: {},
      wss: {}
    });
  });

  it('converts fixed profile bypass list text and records', () => {
    const profile: FixedProfileModel = {
      bypassList: [
        {
          conditionType: 'BypassCondition',
          pattern: 'localhost'
        },
        {
          conditionType: 'BypassCondition',
          pattern: '*.internal'
        }
      ],
      profileType: 'FixedProfile'
    };

    expect(fixedProfileBypassText(profile)).toBe('localhost\n*.internal');
    expect(fixedProfileBypassList('localhost\n\n*.internal\r\n')).toEqual([
      {
        conditionType: 'BypassCondition',
        pattern: 'localhost'
      },
      {
        conditionType: 'BypassCondition',
        pattern: '*.internal'
      }
    ]);
    expect(fixedProfileBypassListEquals(profile.bypassList, fixedProfileBypassList('localhost\n*.internal\n'))).toBe(true);
    expect(fixedProfileBypassListEquals(profile.bypassList, fixedProfileBypassList('*.internal\nlocalhost'))).toBe(false);
  });

  it('detects advanced proxy and active proxy auth state', () => {
    expect(
      fixedProfileHasAdvancedProxy({
        '': {
          scheme: 'http'
        },
        http: {},
        https: {},
        ws: {},
        wss: {}
      })
    ).toBe(false);
    expect(
      fixedProfileHasAdvancedProxy({
        '': {},
        http: {
          scheme: 'https'
        },
        https: {},
        ws: {},
        wss: {}
      })
    ).toBe(true);
    expect(
      fixedProfileHasAdvancedProxy({
        '': {},
        http: {},
        https: {},
        ws: {
          scheme: 'direct'
        },
        wss: {}
      })
    ).toBe(true);
    expect(
      fixedProfileAuthActive(
        {
          auth: {
            proxyForHttps: {
              username: 'user'
            }
          }
        },
        'https'
      )
    ).toBe(true);
    expect(fixedProfileAuthActive({}, 'http')).toBe(false);
  });

  it('detects fixed profile proxy authentication support', () => {
    expect(fixedProfileAuthSupported('http')).toBe(true);
    expect(fixedProfileAuthSupported('https')).toBe(true);
    expect(fixedProfileAuthSupported('socks4')).toBe(false);
    expect(fixedProfileAuthSupported('socks5')).toBe(false);
    expect(fixedProfileAuthSupported('socks5-local')).toBe(false);
    expect(fixedProfileAuthSupported('direct')).toBe(false);
    expect(fixedProfileAuthSupported()).toBe(false);

    expect(
      fixedProfileAuthSupported('socks5', {
        http: true,
        https: true,
        socks4: false,
        socks5: true
      })
    ).toBe(true);
    expect(
      fixedProfileAuthSupported('socks5-local', {
        http: true,
        https: true,
        socks4: false,
        socks5: true
      })
    ).toBe(true);
  });

  it('clones switch source state and nested errors', () => {
    const source = {
      code: 'rule list',
      error: {
        message: 'invalid source'
      },
      touched: true
    };

    const cloned = cloneSourceState(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned?.error).not.toBe(source.error);
    expect(cloneSourceState(null)).toBeUndefined();
    expect(cloneSourceState(undefined)).toBeUndefined();
  });
});
