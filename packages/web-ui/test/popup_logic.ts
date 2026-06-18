import {
  aggregateRouteInfo,
  compareProfile,
  conditionTypes,
  defaultConditionType,
  finalRouteKey,
  hiddenMenuProfiles,
  iconForProfileType,
  isPopupConditionType,
  isVisibleResultProfileName,
  lastResultProfile,
  modeFromHash,
  popupErrorMessage,
  popupProfileFromExplanation,
  profileFromMap,
  profileKey,
  profileTarget,
  profileTitle,
  requestDomains,
  requestHasError,
  requestHostname,
  suggestCondition,
  visibleMenuProfiles,
  visibleResultProfiles
} from '../src/react/popup_logic';
import type {RequestExplanation} from '../src/react/options_client_types';
import type {PageInfo, PopupState, Profile, ProfileMap} from '../src/react/popup_target';

function profile(name: string, profileType = 'FixedProfile', extra: Partial<Profile> = {}): Profile {
  return {
    name,
    profileType,
    ...extra
  };
}

function explanation(url: string, profileName: string, extra: Partial<RequestExplanation> = {}): RequestExplanation {
  return {
    final: {
      kind: 'profile',
      profile: {
        name: profileName,
        profileType: 'FixedProfile'
      }
    },
    request: {
      url
    },
    steps: [],
    tempRulesActive: false,
    warnings: [],
    ...extra
  };
}

describe('popup logic', () => {
  it('parses popup modes and condition types', () => {
    expect(modeFromHash('#!routeInfo')).toBe('routeInfo');
    expect(modeFromHash('#!external')).toBe('external');
    expect(modeFromHash('#!addRule')).toBe('condition');
    expect(modeFromHash('#!unknown')).toBe('menu');
    expect(defaultConditionType).toBe('HostWildcardCondition');
    expect(conditionTypes).toContain('UrlRegexCondition');
    expect(isPopupConditionType('KeywordCondition')).toBe(true);
    expect(isPopupConditionType('BypassCondition')).toBe(false);
  });

  it('sorts and filters profiles for menu and result lists', () => {
    const availableProfiles: ProfileMap = {
      '+direct': profile('direct', 'DirectProfile', {builtin: true}),
      '+proxy-z': profile('proxy-z', 'FixedProfile'),
      '+pac-a': profile('pac-a', 'PacProfile'),
      '+virtual': profile('virtual', 'VirtualProfile'),
      '+hidden-popup': profile('hidden-popup', 'FixedProfile', {hiddenInPopup: true}),
      '+current-hidden-popup': profile('current-hidden-popup', 'FixedProfile', {hiddenInPopup: true}),
      '+_hidden': profile('_hidden', 'FixedProfile'),
      '+_temporary': profile('_temporary', 'FixedProfile'),
      '+__attached': profile('__attached', 'RuleListProfile')
    };
    const state: PopupState = {
      availableProfiles,
      currentProfileName: 'current-hidden-popup',
      validResultProfiles: ['__attached', '_temporary', 'virtual', 'pac-a', 'proxy-z']
    };

    expect(visibleMenuProfiles(state).map((item) => item.name)).toEqual(['current-hidden-popup', 'proxy-z', 'pac-a', 'virtual']);
    expect(hiddenMenuProfiles(state).map((item) => item.name)).toEqual(['hidden-popup']);
    expect(visibleResultProfiles(state).map((item) => item.name)).toEqual(['_temporary', 'proxy-z', 'pac-a', 'virtual']);
    expect(isVisibleResultProfileName('__attached')).toBe(false);
    expect(isVisibleResultProfileName('_temporary')).toBe(true);
    expect([profile('b'), profile('a')].sort(compareProfile).map((item) => item.name)).toEqual(['a', 'b']);
  });

  it('resolves profiles, virtual targets, and titles', () => {
    const target = profile('target', 'FixedProfile', {desc: 'Target description'});
    const virtual = profile('virtual', 'VirtualProfile', {
      defaultProfileName: 'target',
      desc: 'Virtual description'
    });
    const availableProfiles: ProfileMap = {
      '+target': target,
      '+virtual': virtual
    };

    expect(profileKey('target')).toBe('+target');
    expect(profileFromMap(availableProfiles, 'target')).toBe(target);
    expect(profileTarget(virtual, availableProfiles)).toBe(target);
    expect(profileTitle(virtual, availableProfiles)).toBe('Target description');
    expect(iconForProfileType.FixedProfile).toBe('glyphicon-globe');
  });

  it('builds popup profiles from route explanations', () => {
    const known = profile('known', 'PacProfile');
    const state: PopupState = {
      availableProfiles: {
        '+known': known
      }
    };

    expect(popupProfileFromExplanation(state, {name: 'known'})).toBe(known);
    expect(
      popupProfileFromExplanation(state, {
        color: 1,
        name: 'missing',
        profileType: 'SwitchProfile',
        role: 'attachedRuleList'
      })
    ).toEqual({
      attachedToProfileName: undefined,
      builtin: false,
      color: undefined,
      name: 'missing',
      profileType: 'SwitchProfile',
      role: 'attachedRuleList'
    });
    expect(popupProfileFromExplanation(state, {})).toBeUndefined();
  });

  it('summarizes request domains and hostnames', () => {
    const pageInfo: PageInfo = {
      summary: {
        'a.example': {
          errorCount: 1
        },
        'b.example': {
          errorCount: 3
        }
      }
    };

    expect(requestDomains(pageInfo)).toEqual([
      {
        domain: 'b.example',
        errorCount: 3
      },
      {
        domain: 'a.example',
        errorCount: 1
      }
    ]);
    expect(requestHostname('https://example.com:8443/path')).toBe('example.com');
    expect(requestHostname('not a url')).toBe('not a url');
    expect(requestHasError({id: '1', status: 'timeout', url: 'https://example.com'})).toBe(true);
    expect(requestHasError({id: '1', status: 'ok', url: 'https://example.com'})).toBe(false);
  });

  it('aggregates route info by hostname', () => {
    const requests: NonNullable<PageInfo['requests']> = [
      {
        id: '1',
        status: 'error',
        url: 'https://b.example/request'
      },
      {
        id: '2',
        status: 'ok',
        url: 'https://a.example/request'
      }
    ];
    const explanations = [
      explanation('https://b.example/request', 'proxy', {
        errors: ['network failed', 'network failed'],
        warnings: ['pacProfileLimited']
      }),
      explanation('https://a.example/request', 'direct'),
      explanation('https://c.example/request', 'proxy')
    ];

    const groups = aggregateRouteInfo(explanations, requests, 'Unknown host');

    expect(groups.map((group) => group.hostname)).toEqual(['b.example', 'a.example', 'c.example']);
    expect(groups[0].requestCount).toBe(1);
    expect(groups[0].errorCount).toBe(1);
    expect(groups[0].errors).toEqual(['network failed']);
    expect(groups[0].pacLimited).toBe(true);
    expect(Object.keys(groups[0].results)).toEqual(['profile\nproxy']);
    expect(groups[2].requestCount).toBe(1);
    expect(finalRouteKey(explanations[1])).toBe('profile\ndirect');
  });

  it('suggests conditions for domains and IP-looking hosts', () => {
    expect(suggestCondition('example.com')).toEqual({
      HostWildcardCondition: '*.example.com',
      HostRegexCondition: '(^|\\.)example\\.com$',
      UrlWildcardCondition: '*://*.example.com/*',
      UrlRegexCondition: '://([^/.]+\\.)*example\\.com(:\\d+)?/',
      KeywordCondition: 'example.com'
    });
    expect(suggestCondition('127.0.0.1')).toEqual({
      HostWildcardCondition: '127.0.0.1',
      HostRegexCondition: '^127\\.0\\.0\\.1$',
      UrlWildcardCondition: '*://127.0.0.1/*',
      UrlRegexCondition: '://127\\.0\\.0\\.1(:\\d+)?/',
      KeywordCondition: '127.0.0.1'
    });
    expect(suggestCondition('::1').HostWildcardCondition).toBe('[::1]');
  });

  it('selects the last result profile only when still valid', () => {
    const state: PopupState = {
      availableProfiles: {
        '+direct': profile('direct', 'DirectProfile'),
        '+proxy': profile('proxy', 'FixedProfile')
      },
      lastProfileNameForCondition: 'proxy',
      validResultProfiles: ['direct', 'proxy']
    };

    expect(lastResultProfile(state)).toBe('proxy');
    expect(lastResultProfile(state, {tempRuleProfileName: 'direct'})).toBe('direct');
    expect(
      lastResultProfile({
        availableProfiles: state.availableProfiles,
        lastProfileNameForCondition: 'missing',
        validResultProfiles: ['direct']
      })
    ).toBe('direct');
    expect(lastResultProfile()).toBe('direct');
  });

  it('formats popup errors without throwing on primitives', () => {
    expect(popupErrorMessage(new Error('boom'))).toBe('boom');
    expect(popupErrorMessage('plain')).toBe('plain');
  });
});
