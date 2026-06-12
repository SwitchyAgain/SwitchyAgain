import {conditionTypesForMode as switchConditionTypesForMode} from './switch_profile_runtime';
import type {ConditionTypeOption, SwitchRuleSourceState} from './switch_profile_runtime';
import type {
  FixedProfileBypassCondition,
  FixedProfileModel,
  FixedProfileProxyEditors,
  FixedProfileProxyField,
  FixedProfileProxyProtocol,
  FixedProfileScheme
} from './profile_types';

type GlobalWithBrowserProxy = typeof globalThis & {
  browser?: {
    proxy?: {
      register?: unknown;
    };
  };
};

export const FIXED_PROFILE_SCHEMES: FixedProfileScheme[] = ['', 'http', 'https'];
export const FIXED_PROFILE_PROXY_FIELDS: Record<FixedProfileScheme, FixedProfileProxyField> = {
  '': 'fallbackProxy',
  http: 'proxyForHttp',
  https: 'proxyForHttps'
};
export const FIXED_PROFILE_SCHEME_DISP: Record<FixedProfileScheme, string | null> = {
  '': null,
  http: 'http://',
  https: 'https://'
};
export const FIXED_PROFILE_DEFAULT_PORT: Record<FixedProfileProxyProtocol, number> = {
  http: 80,
  https: 443,
  socks4: 1080,
  socks5: 1080
};
export const FIXED_PROFILE_PROTOCOLS: FixedProfileProxyProtocol[] = ['http', 'https', 'socks4', 'socks5'];

const PAC_URL_REGEX = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;
const PAC_URL_WITH_FILE_REGEX = /^(ftp|http|https|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;

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
  return OmegaPac.Profiles.ruleListFormats || [];
}

export function isFixedProfileProxyProtocol(value?: string): value is FixedProfileProxyProtocol {
  return FIXED_PROFILE_PROTOCOLS.includes(value as FixedProfileProxyProtocol);
}

export function cloneProxyEditors(proxyEditors?: Partial<FixedProfileProxyEditors>): FixedProfileProxyEditors {
  const cloned: FixedProfileProxyEditors = {
    '': {},
    http: {},
    https: {}
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

export function fixedProfileHasAdvancedProxy(editors: FixedProfileProxyEditors) {
  return !!(editors.http?.scheme || editors.https?.scheme);
}

export function fixedProfileAuthActive(profile: FixedProfileModel, scheme: FixedProfileScheme) {
  return !!profile.auth?.[FIXED_PROFILE_PROXY_FIELDS[scheme]];
}

export function fixedProfileAuthSupported(protocol?: string) {
  if (protocol === 'http' || protocol === 'https') {
    return true;
  }
  if (protocol === 'socks5') {
    return Boolean((globalThis as GlobalWithBrowserProxy).browser?.proxy?.register);
  }
  return false;
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
