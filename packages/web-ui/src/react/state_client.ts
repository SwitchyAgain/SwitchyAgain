import {
  extensionManifestVersionNumber,
  getJsonLocalStorage,
  setJsonLocalStorage
} from './browser_env';
import {callBackground} from './background_client';

function isManifestV3() {
  const manifestVersion = extensionManifestVersionNumber();
  return Boolean(manifestVersion && manifestVersion >= 3);
}

function stateKey(name: string) {
  return `omega.local.${name}`;
}

export function getLocalState<T = unknown>(name: string) {
  return getJsonLocalStorage<T>(stateKey(name));
}

export function setLocalState<T>(name: string, value: T) {
  setJsonLocalStorage(stateKey(name), value);
}

export function getState<T = unknown>(name: string): Promise<T | undefined>;
export function getState<T = unknown>(name: string[]): Promise<Array<T | undefined>>;
export function getState<T = unknown>(name: string | string[]) {
  if (isManifestV3()) {
    return callBackground('getState', name).then((result) => {
      const typedResult = result as Record<string, T>;
      if (Array.isArray(name)) {
        return name.map((key) => typedResult?.[key]);
      }
      return typedResult?.[name];
    });
  }
  if (Array.isArray(name)) {
    return Promise.resolve(name.map((key) => getLocalState<T>(key)));
  }
  return Promise.resolve(getLocalState<T>(name));
}

export function setState<T = unknown>(name: string, value: T) {
  if (isManifestV3()) {
    return callBackground('setState', {[name]: value}).then(() => value);
  }
  setLocalState(name, value);
  return Promise.resolve(value);
}

export function lastUrl(url?: string) {
  const name = 'web.last_url';
  if (url) {
    setState(name, url);
    return url;
  }
  return getLocalState<string>(name);
}

