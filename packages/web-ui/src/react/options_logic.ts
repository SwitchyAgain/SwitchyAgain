import {message, type BackgroundError, type Options, type ProfileUpdateResults} from './options_client';
import type {
  NamedFixedProfileModel,
  NamedProfile,
  NamedRuleListProfileModel,
  Profile as ProfileModel,
  ProfileAuth,
  RuleListProfileModel
} from './profile_types';
import {createAttachedName, profileKey, type NamedSwitchProfileModel, type SwitchRule} from './switch_profile_runtime';

const CHAR_CODE_UNDERSCORE = '_'.charCodeAt(0);
const RULE_LIST_USAGE_URL = 'https://github.com/FelisCatus/SwitchyOmega/wiki/RuleListUsage';
const BUILTIN_PROFILES: NamedProfile[] = [
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

type GlobalWithBrowserProxy = typeof globalThis & {
  browser?: {
    proxy?: {
      register?: unknown;
      registerProxyScript?: unknown;
    };
  };
};

type AttachedProfileIdentity = {
  attachedKey: string;
  attachedName: string;
};

function isProfileKey(key: string) {
  return key.charAt(0) === '+';
}

function isNamedProfile(value: unknown): value is NamedProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as ProfileModel;
  return typeof profile.name === 'string' && profile.name.length > 0;
}

function isVisibleProfile(value: unknown): value is NamedProfile {
  if (!isNamedProfile(value)) {
    return false;
  }
  const name = value.name;
  return !(name.charAt(0) === '_' && name.charAt(1) === '_');
}

function profilesFromOptions(options?: Options | null) {
  if (!options) {
    return [];
  }
  return Object.keys(options)
    .filter(isProfileKey)
    .map((key) => options[key])
    .filter(isVisibleProfile);
}

function profileByName(options: Options | null | undefined, name: string) {
  return profilesFromOptions(options)
    .concat(BUILTIN_PROFILES)
    .find((candidate) => candidate.name === name);
}

export function cloneOptions<T>(options: T): T {
  return JSON.parse(JSON.stringify(options));
}

export function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function optionsPatch(before: Options, after: Options) {
  const patch: Options = {};
  const keys = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
  keys.forEach((key) => {
    const oldValue = before?.[key];
    const nextValue = after?.[key];
    if (sameValue(oldValue, nextValue)) {
      return;
    }
    if (typeof nextValue === 'undefined') {
      patch[key] = [oldValue, 0, 0];
      return;
    }
    if (typeof oldValue === 'undefined') {
      patch[key] = [nextValue];
      return;
    }
    patch[key] = [oldValue, nextValue];
  });
  return patch;
}

export function isPatchEmpty(patch: Options) {
  return Object.keys(patch).length === 0;
}

export function isErrorResult(result: unknown): result is BackgroundError {
  const candidate = result as {message?: unknown; name?: unknown} | null | undefined;
  return result instanceof Error || Boolean(candidate?.name && candidate?.message);
}

export function updateProfileError(results: ProfileUpdateResults | undefined, name: string) {
  const primaryResult = results?.[profileKey(name)];
  if (isErrorResult(primaryResult)) {
    return primaryResult;
  }
  return Object.values(results || {}).find(isErrorResult);
}

export function createPacExport(options: Options, profileName: string) {
  let missingProfile = '';
  const ast = OmegaPac.PacGenerator.script(options, profileName, {
    profileNotFound(name: string) {
      missingProfile = name;
      return 'dumb';
    }
  });
  let pac = ast.print_to_string({
    beautify: true,
    comments: true
  });
  pac = OmegaPac.PacGenerator.ascii(pac);
  const fileName = safeProfileFileName(profileName);
  return {
    blob: new Blob([pac], {
      type: 'text/plain;charset=utf-8'
    }),
    fileName: `OmegaProfile_${fileName}.pac`,
    missingProfile
  };
}

export function composeOmegaRuleList(rules: SwitchRule[], defaultProfileName: string) {
  const text = OmegaPac.RuleList.Switchy.compose({
    defaultProfileName,
    rules
  });
  const eol = '\r\n';
  const info =
    [
      '',
      '; Require: SwitchyOmega >= 2.3.2',
      `; Date: ${new Date().toLocaleDateString()}`,
      `; Usage: ${message('ruleList_usageUrl', RULE_LIST_USAGE_URL)}`
    ].join(eol) + eol;
  return text.replace('\n', info);
}

export function composeLegacyRuleList(rules: SwitchRule[], defaultProfileName: string) {
  let wildcardRules = '';
  let regexpRules = '';
  for (const rule of rules || []) {
    const inverse = rule.profileName === defaultProfileName ? '!' : '';
    switch (rule.condition?.conditionType) {
      case 'HostWildcardCondition':
        wildcardRules += `${inverse}@*://${rule.condition.pattern}/*\r\n`;
        break;
      case 'UrlWildcardCondition':
        wildcardRules += `${inverse}@${rule.condition.pattern}\r\n`;
        break;
      case 'UrlRegexCondition':
        regexpRules += `${inverse}${rule.condition.pattern}\r\n`;
        break;
    }
  }
  return [
    '; Summary: Proxy Switchy! Exported Rule List',
    `; Date: ${new Date().toLocaleDateString()}`,
    `; Website: ${message('ruleList_usageUrl', RULE_LIST_USAGE_URL)}`,
    '',
    '#BEGIN',
    '',
    '[wildcard]',
    wildcardRules,
    '[regexp]',
    regexpRules,
    '#END'
  ].join('\n');
}

export function isSwitchProfile(value: unknown): value is NamedSwitchProfileModel {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as Partial<NamedSwitchProfileModel>;
  return profile.profileType === 'SwitchProfile' && typeof profile.name === 'string' && profile.name.length > 0;
}

function isRuleListProfile(value: unknown): value is NamedRuleListProfileModel {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as Partial<NamedRuleListProfileModel>;
  return profile.profileType === 'RuleListProfile' && typeof profile.name === 'string' && profile.name.length > 0;
}

function isFixedProfile(value: unknown): value is NamedFixedProfileModel {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as Partial<NamedFixedProfileModel>;
  return profile.profileType === 'FixedProfile' && typeof profile.name === 'string' && profile.name.length > 0;
}

export function firstFixedProfileName(options: Options) {
  let profileName = '';
  OmegaPac.Profiles.each(options, (_key, profile) => {
    if (!profileName && isFixedProfile(profile)) {
      profileName = profile.name;
    }
  });
  return profileName;
}

export function referencedProfiles(profileName: string, options: Options): NamedProfile[] {
  if (typeof OmegaPac === 'undefined' || !OmegaPac?.Profiles?.referencedBySet) {
    return [];
  }
  const refs = OmegaPac.Profiles.referencedBySet(profileName, options);
  const refSet: Record<string, string> = {};
  for (const key of Object.keys(refs || {})) {
    let refName = refs[key];
    const parentName = getParentName(refName);
    let refKey = key;
    if (parentName) {
      refName = parentName;
      refKey = profileKey(parentName);
    }
    refSet[refKey] = refName;
  }
  return Object.keys(refSet)
    .map((key) => OmegaPac.Profiles.byKey?.(key, options) || profileByName(options, refSet[key]))
    .filter(isNamedProfile);
}

export function attachedProfileOption(options: Options, identity: AttachedProfileIdentity): NamedRuleListProfileModel | undefined {
  const value = options[identity.attachedKey];
  return isRuleListProfile(value) ? value : undefined;
}

export function attachedProfileDraft(options: Options, identity: AttachedProfileIdentity) {
  const draft: NamedRuleListProfileModel = {
    profileType: 'RuleListProfile',
    ...objectOption<RuleListProfileModel>(options[identity.attachedKey]),
    name: identity.attachedName
  } as NamedRuleListProfileModel;
  return draft;
}

export function profileDownloadErrorMessage(err: unknown) {
  const error = err as Partial<BackgroundError> | null | undefined;
  const statusCode = error?.statusCode ?? error?.original?.statusCode ?? '';
  return (
    message(`options_profileDownloadError_${error?.name || ''}`, '', String(statusCode)) ||
    message('options_profileDownloadError', 'Profile download failed.')
  );
}

export function proxyAuthSupported(protocol?: string) {
  if (protocol === 'http' || protocol === 'https') {
    return true;
  }
  if (protocol === 'socks5') {
    return Boolean((globalThis as GlobalWithBrowserProxy).browser?.proxy?.register);
  }
  return false;
}

export function cloneAuth(auth?: ProfileAuth) {
  return auth ? cloneOptions(auth) : undefined;
}

export function hasProxyScriptApi() {
  const proxy = (globalThis as GlobalWithBrowserProxy).browser?.proxy;
  return Boolean(proxy?.register || proxy?.registerProxyScript);
}

export function isProfileNameHidden(name: string) {
  return name.charCodeAt(0) === CHAR_CODE_UNDERSCORE;
}

export function isProfileNameReserved(name: string) {
  return name.charCodeAt(0) === CHAR_CODE_UNDERSCORE && name.charCodeAt(1) === CHAR_CODE_UNDERSCORE;
}

export function getParentName(name: string) {
  const prefix = '__ruleListOf_';
  if (name.indexOf(prefix) === 0) {
    return name.slice(prefix.length);
  }
  return undefined;
}

export function safeProfileFileName(profileName: string) {
  return profileName.replace(/\W+/g, '_');
}

export function exportRuleListOptions(options: Options, showConditionTypes: number) {
  if (!options['-exportLegacyRuleList']) {
    return {
      legacy: false,
      warning: false
    };
  }
  if (showConditionTypes > 0) {
    return {
      legacy: false,
      warning: true
    };
  }
  return {
    legacy: true,
    warning: false
  };
}

export function numberOption(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

export function objectOption<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === 'object' ? (value as Partial<T>) : {};
}

export function profileOption<TProfile extends ProfileModel>(
  options: Options,
  name: string,
  guard?: (profile: unknown) => profile is TProfile
) {
  const value = options[profileKey(name)];
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (guard && !guard(value)) {
    return undefined;
  }
  return value as TProfile;
}

export function profileDraft<TProfile extends ProfileModel>(options: Options, name: string, defaults?: Partial<TProfile>) {
  return {
    ...defaults,
    ...objectOption<TProfile>(options[profileKey(name)])
  } as TProfile;
}

export function setProfileOption<TProfile extends ProfileModel>(options: Options, name: string, profile: TProfile) {
  options[profileKey(name)] = profile;
}

export function deleteProfileOption(options: Options, name: string) {
  delete options[profileKey(name)];
}

export function deleteAttachedProfileOption(options: Options, profileName: string) {
  deleteProfileOption(options, createAttachedName(profileName));
}

export function updateProfileRevision(profile: ProfileModel) {
  if (typeof OmegaPac !== 'undefined' && OmegaPac?.Profiles?.updateRevision) {
    OmegaPac.Profiles.updateRevision(profile);
  }
}

export function profileUpdating(updatingProfiles: Record<string, boolean>, profileName: string) {
  return !!updatingProfiles[profileKey(profileName)];
}
