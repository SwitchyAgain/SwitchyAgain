import {message, type BackgroundError, type Options, type ProfileUpdateResults} from './options_client';
import type {Profile as ProfileModel, ProfileAuth} from './profile_types';
import {createAttachedName, profileKey} from './switch_profile_runtime';

const CHAR_CODE_UNDERSCORE = '_'.charCodeAt(0);

type GlobalWithBrowserProxy = typeof globalThis & {
  browser?: {
    proxy?: {
      register?: unknown;
      registerProxyScript?: unknown;
    };
  };
};

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

export function profileDownloadErrorMessage(err: unknown) {
  const error = err as Partial<BackgroundError> | null | undefined;
  const statusCode = error?.statusCode ?? error?.original?.statusCode ?? '';
  return message(`options_profileDownloadError_${error?.name || ''}`, '', String(statusCode))
    || message('options_profileDownloadError', 'Profile download failed.');
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
  return value && typeof value === 'object' ? value as Partial<T> : {};
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
