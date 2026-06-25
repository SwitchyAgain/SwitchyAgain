import type {RequestExplanation, RequestExplainProfile} from './options_client_types';
import type {PageInfo, PopupConditionType, PopupMode, PopupState, Profile, ProfileKey, ProfileMap} from './popup_target';

export const defaultConditionType: PopupConditionType = 'HostWildcardCondition';

export const conditionTypes: readonly PopupConditionType[] = [
  'HostWildcardCondition',
  'HostRegexCondition',
  'UrlWildcardCondition',
  'UrlRegexCondition',
  'KeywordCondition'
];

export function isPopupConditionType(value: string): value is PopupConditionType {
  return conditionTypes.includes(value as PopupConditionType);
}

export const iconForProfileType: Record<string, string> = {
  AutoDetectProfile: 'glyphicon-file',
  DirectProfile: 'glyphicon-transfer',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  SystemProfile: 'glyphicon-off',
  VirtualProfile: 'glyphicon-question-sign'
};

const orderForType: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000
};

export function compareProfile(a: Profile, b: Profile) {
  const diff = (orderForType[a.profileType || ''] || 0) - (orderForType[b.profileType || ''] || 0);
  if (diff !== 0) {
    return diff;
  }
  return a.name === b.name ? 0 : a.name < b.name ? -1 : 1;
}

export function popupErrorMessage(error: unknown) {
  const candidate = error as {message?: unknown} | null | undefined;
  return String(candidate?.message || error);
}

export function modeFromHash(hash = location.hash): PopupMode {
  if (hash === '#!routeInfo') {
    return 'routeInfo';
  }
  if (hash === '#!external') {
    return 'external';
  }
  if (hash === '#!addRule') {
    return 'condition';
  }
  return 'menu';
}

export function profileKey(profileName?: string): ProfileKey | undefined {
  return profileName ? (`+${profileName}` as ProfileKey) : undefined;
}

export function profileFromMap(availableProfiles?: ProfileMap, profileName?: string) {
  const key = profileKey(profileName);
  return key ? availableProfiles?.[key] : undefined;
}

export function profileTarget(profile?: Profile, availableProfiles?: ProfileMap) {
  if (profile?.profileType === 'VirtualProfile') {
    return profileFromMap(availableProfiles, profile.defaultProfileName) || profile;
  }
  return profile;
}

export function visibleMenuProfiles(state?: PopupState) {
  return Object.values(state?.availableProfiles || {})
    .filter((profile): profile is Profile => {
      if (!profile || profile.builtin || profile.name.charAt(0) === '_') {
        return false;
      }
      return !profile.hiddenInPopup || profile.name === state?.currentProfileName;
    })
    .sort(compareProfile);
}

export function hiddenMenuProfiles(state?: PopupState) {
  return Object.values(state?.availableProfiles || {})
    .filter((profile): profile is Profile => {
      if (!profile || profile.builtin || profile.name.charAt(0) === '_') {
        return false;
      }
      return !!profile.hiddenInPopup && profile.name !== state?.currentProfileName;
    })
    .sort(compareProfile);
}

export function isVisibleResultProfileName(name: string) {
  return name.charAt(0) !== '_' || name.charAt(1) !== '_';
}

export function visibleResultProfiles(state?: PopupState) {
  return (state?.validResultProfiles || [])
    .filter(isVisibleResultProfileName)
    .map((name) => profileFromMap(state?.availableProfiles, name))
    .filter((profile): profile is Profile => !!profile)
    .sort(compareProfile);
}

export function visibleScopeAssignableProfiles(state?: PopupState) {
  return (state?.scopeAssignableProfiles || [])
    .map((name) => profileFromMap(state?.availableProfiles, name))
    .filter((profile): profile is Profile => !!profile)
    .sort(compareProfile);
}

export function requestDomains(info?: PageInfo) {
  return Object.keys(info?.summary || {})
    .map((domain) => ({
      domain,
      errorCount: info?.summary?.[domain]?.errorCount || 0
    }))
    .sort((a, b) => b.errorCount - a.errorCount);
}

export function popupProfileFromExplanation(state: PopupState, profile?: RequestExplainProfile): Profile | undefined {
  const profileName = typeof profile?.name === 'string' ? profile.name : '';
  if (!profileName) {
    return undefined;
  }
  return (
    profileFromMap(state.availableProfiles, profileName) || {
      attachedToProfileName: profile?.attachedToProfileName,
      builtin: !!profile?.builtin,
      color: typeof profile?.color === 'string' ? profile.color : undefined,
      name: profileName,
      profileType: typeof profile?.profileType === 'string' ? profile.profileType : 'VirtualProfile',
      role: profile?.role
    }
  );
}

export function requestHostname(url: unknown) {
  const rawUrl = String(url || '');
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || parsed.host || rawUrl;
  } catch (_error) {
    return rawUrl;
  }
}

export type RouteInfoGroup = {
  errorCount: number;
  errors: string[];
  hostname: string;
  pacLimited: boolean;
  requestCount: number;
  results: Record<string, RequestExplanation>;
};

type PageRequest = NonNullable<PageInfo['requests']>[number];

function routeInfoGroup(groups: Record<string, RouteInfoGroup>, hostname: string) {
  let group = groups[hostname];
  if (!group) {
    group = groups[hostname] = {
      errorCount: 0,
      errors: [],
      hostname,
      pacLimited: false,
      requestCount: 0,
      results: {}
    };
  }
  return group;
}

export function requestHasError(request?: PageRequest) {
  return !!request?.error || request?.status === 'error' || request?.status === 'timeout' || request?.status === 'timeoutAbort';
}

export function finalRouteKey(explanation: RequestExplanation) {
  const final = explanation.final || {kind: 'profile'};
  const profile = final.profile || explanation.finalProfile;
  const profileName = typeof profile?.name === 'string' ? profile.name : '';
  return [final.kind || '', profileName].join('\n');
}

export function aggregateRouteInfo(
  explanations: RequestExplanation[],
  requests: NonNullable<PageInfo['requests']> = [],
  unknownHost = 'Unknown host'
) {
  const groups: Record<string, RouteInfoGroup> = {};
  requests.forEach((request) => {
    const hostname = requestHostname(request?.url) || unknownHost;
    const group = routeInfoGroup(groups, hostname);
    group.requestCount++;
    if (requestHasError(request)) {
      group.errorCount++;
    }
  });
  explanations.forEach((explanation, index) => {
    const request = requests[index];
    const hostname = requestHostname(explanation.request?.url || request?.url) || unknownHost;
    const group = routeInfoGroup(groups, hostname);
    if (!request) {
      group.requestCount++;
    }
    for (const item of explanation.errors || []) {
      if (group.errors.indexOf(item) < 0) {
        group.errors.push(item);
      }
    }
    if (explanation.warnings?.includes('pacProfileLimited')) {
      group.pacLimited = true;
    }
    const resultKey = finalRouteKey(explanation);
    if (!group.results[resultKey]) {
      group.results[resultKey] = explanation;
    }
  });
  return Object.keys(groups)
    .map((hostname) => groups[hostname])
    .sort((a, b) => {
      const errorDiff = b.errorCount - a.errorCount;
      if (errorDiff !== 0) {
        return errorDiff;
      }
      const countDiff = b.requestCount - a.requestCount;
      if (countDiff !== 0) {
        return countDiff;
      }
      return a.hostname.localeCompare(b.hostname);
    });
}

export function suggestCondition(domain = ''): Record<PopupConditionType, string> {
  let currentDomain = domain;
  let currentDomainEscaped = currentDomain.replace(/\./g, '\\.');
  let domainLooksLikeIp = false;
  if (currentDomain.indexOf(':') >= 0) {
    domainLooksLikeIp = true;
    if (currentDomain[0] !== '[') {
      currentDomain = `[${currentDomain}]`;
      currentDomainEscaped = currentDomain.replace(/\./g, '\\.').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    }
  } else if (currentDomain[currentDomain.length - 1] >= '0' && currentDomain[currentDomain.length - 1] <= '9') {
    domainLooksLikeIp = true;
  }
  if (domainLooksLikeIp) {
    return {
      HostWildcardCondition: currentDomain,
      HostRegexCondition: `^${currentDomainEscaped}$`,
      UrlWildcardCondition: `*://${currentDomain}/*`,
      UrlRegexCondition: `://${currentDomainEscaped}(:\\d+)?/`,
      KeywordCondition: currentDomain
    };
  }
  return {
    HostWildcardCondition: `*.${currentDomain}`,
    HostRegexCondition: `(^|\\.)${currentDomainEscaped}$`,
    UrlWildcardCondition: `*://*.${currentDomain}/*`,
    UrlRegexCondition: `://([^/.]+\\.)*${currentDomainEscaped}(:\\d+)?/`,
    KeywordCondition: currentDomain
  };
}

export function lastResultProfile(state?: PopupState, pageInfo?: PageInfo) {
  const profiles = visibleResultProfiles(state);
  const names = new Set(profiles.map((profile) => profile.name));
  if (pageInfo?.tempRuleProfileName && names.has(pageInfo.tempRuleProfileName)) {
    return pageInfo.tempRuleProfileName;
  }
  if (state?.lastProfileNameForCondition && names.has(state.lastProfileNameForCondition)) {
    return state.lastProfileNameForCondition;
  }
  return profiles[0]?.name || 'direct';
}

export function profileTitle(profile?: Profile, availableProfiles?: ProfileMap) {
  let current = profile;
  let desc = '';
  while (current) {
    desc = current.desc || desc;
    const next = profileTarget(current, availableProfiles);
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  return desc || profile?.name || '';
}
