import {conditionTypesForMode as switchConditionTypesForMode} from './switch_profile_runtime';
import type {ConditionTypeOption, SwitchRuleSourceState} from './switch_profile_runtime';
import type {
  FixedProfileBypassCondition,
  FixedProfileModel,
  FixedProfileProxyEditors,
  FixedProfileProxyField,
  FixedProfileProxyProtocol,
  FixedProfileServerProtocol,
  FixedProfileScheme,
  ProxyAuthCapabilities
} from './profile_types';

export const FIXED_PROFILE_SCHEMES: FixedProfileScheme[] = ['', 'http', 'https', 'ws', 'wss'];
export const FIXED_PROFILE_PROXY_FIELDS: Record<FixedProfileScheme, FixedProfileProxyField> = {
  '': 'fallbackProxy',
  http: 'proxyForHttp',
  https: 'proxyForHttps',
  ws: 'proxyForWs',
  wss: 'proxyForWss'
};
export const FIXED_PROFILE_SCHEME_DISP: Record<FixedProfileScheme, string | null> = {
  '': null,
  http: 'http://',
  https: 'https://',
  ws: 'ws://',
  wss: 'wss://'
};
export const FIXED_PROFILE_DEFAULT_PORT: Record<FixedProfileServerProtocol, number> = {
  http: 80,
  https: 443,
  socks4: 1080,
  socks5: 1080,
  'socks5-local': 1080
};
export const FIXED_PROFILE_DIRECT_PROTOCOL: FixedProfileProxyProtocol = 'direct';
export const FIXED_PROFILE_PROTOCOLS: FixedProfileProxyProtocol[] = ['http', 'https', 'socks4', 'socks5'];
export const FIXED_PROFILE_SOCKS5_LOCAL_DNS_PROTOCOL: FixedProfileProxyProtocol = 'socks5-local';
export const FIXED_PROFILE_KNOWN_PROTOCOLS: FixedProfileProxyProtocol[] = [
  ...FIXED_PROFILE_PROTOCOLS,
  FIXED_PROFILE_SOCKS5_LOCAL_DNS_PROTOCOL
];

const PAC_URL_REGEX = /^(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;
const PAC_URL_WITH_FILE_REGEX = /^(http|https|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;

export function normalizeColor(color?: string) {
  if (!color) {
    return '#000000';
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return '#' + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2) + color.charAt(3) + color.charAt(3);
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }
  return '#000000';
}

export function groupedConditionTypes(conditionTypes: ConditionTypeOption[] = []) {
  const groups: Record<string, ConditionTypeOption[]> = {};
  const order: string[] = [];
  for (const conditionType of conditionTypes) {
    if (!groups[conditionType.group]) {
      groups[conditionType.group] = [];
      order.push(conditionType.group);
    }
    groups[conditionType.group].push(conditionType);
  }
  return order.map((group) => ({group, types: groups[group]}));
}

export function conditionTypesForMode(showConditionTypes = 0): ConditionTypeOption[] {
  return switchConditionTypesForMode(showConditionTypes);
}

export function conditionTypeFromSelectValue(conditionTypes: ConditionTypeOption[], value: string) {
  return conditionTypes.find((conditionType) => conditionType.type === value)?.type;
}

export function moveIndex(indices: number[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return indices;
  }
  const next = indices.slice();
  const [item] = next.splice(fromIndex, 1);
  if (item == null) {
    return indices;
  }
  next.splice(toIndex, 0, item);
  return next;
}

export function isFileUrl(url: string) {
  return /^file:\/\//i.test(url || '');
}

export function pacProfileUrlState(url: string, referenced = false) {
  const isFile = isFileUrl(url);
  const pattern = referenced ? PAC_URL_REGEX : PAC_URL_WITH_FILE_REGEX;
  return {
    invalid: !!url && !pattern.test(url),
    isFile
  };
}

export function formatMediumDate(value?: string | number | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    second: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function getRuleListFormats(): string[] {
  return ProxyEngine.Profiles.ruleListFormats || [];
}

export function isFixedProfileProxyProtocol(value?: string): value is FixedProfileServerProtocol {
  return FIXED_PROFILE_KNOWN_PROTOCOLS.includes(value as FixedProfileServerProtocol);
}

export function cloneProxyEditors(proxyEditors?: Partial<FixedProfileProxyEditors>): FixedProfileProxyEditors {
  const cloned: FixedProfileProxyEditors = {
    '': {},
    http: {},
    https: {},
    ws: {},
    wss: {}
  };
  for (const scheme of FIXED_PROFILE_SCHEMES) {
    cloned[scheme] = {...(proxyEditors?.[scheme] || {})};
  }
  return cloned;
}

export function fixedProfileEditors(profile: FixedProfileModel) {
  const editors = cloneProxyEditors();
  for (const scheme of FIXED_PROFILE_SCHEMES) {
    const field = FIXED_PROFILE_PROXY_FIELDS[scheme];
    editors[scheme] = {...(profile[field] || {})};
  }
  return editors;
}

export function fixedProfileBypassText(profile: FixedProfileModel) {
  return (profile.bypassList || []).map((item) => item.pattern).join('\n');
}

export function fixedProfileBypassList(value: string): FixedProfileBypassCondition[] {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .map((pattern) => ({
      conditionType: 'BypassCondition',
      pattern
    }));
}

export function fixedProfileBypassListEquals(left: FixedProfileBypassCondition[] = [], right: FixedProfileBypassCondition[] = []) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.conditionType === right[index]?.conditionType && item.pattern === right[index]?.pattern)
  );
}

export function fixedProfileHasAdvancedProxy(editors: FixedProfileProxyEditors) {
  return FIXED_PROFILE_SCHEMES.some((scheme) => !!scheme && !!editors[scheme]?.scheme);
}

export function fixedProfileAuthActive(profile: FixedProfileModel, scheme: FixedProfileScheme) {
  return !!profile.auth?.[FIXED_PROFILE_PROXY_FIELDS[scheme]];
}

export const DEFAULT_FIXED_PROFILE_AUTH_CAPABILITIES: ProxyAuthCapabilities = {
  http: true,
  https: true,
  socks4: false,
  socks5: false
};

export function fixedProfileAuthSupported(
  protocol?: string,
  capabilities: ProxyAuthCapabilities = DEFAULT_FIXED_PROFILE_AUTH_CAPABILITIES
) {
  if (protocol === FIXED_PROFILE_DIRECT_PROTOCOL) {
    return false;
  }
  if (protocol === FIXED_PROFILE_SOCKS5_LOCAL_DNS_PROTOCOL) {
    return capabilities.socks5 === true;
  }
  return !!protocol && capabilities[protocol as keyof ProxyAuthCapabilities] === true;
}

export function cloneSourceState(source?: SwitchRuleSourceState | null): SwitchRuleSourceState | undefined {
  if (!source) {
    return undefined;
  }
  return {
    ...source,
    error: source.error ? {...source.error} : source.error
  };
}
