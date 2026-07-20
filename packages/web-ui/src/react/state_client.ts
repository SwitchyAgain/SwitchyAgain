import {getJsonLocalStorage, setJsonLocalStorage} from './browser_env';
import {callBackground} from './background_client';

function stateKey(name: string) {
  return `state.${name}`;
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
  return callBackground('getState', name).then((result) => {
    const typedResult = result as Record<string, T>;
    if (Array.isArray(name)) {
      return name.map((key) => typedResult?.[key]);
    }
    return typedResult?.[name];
  });
}

export function setState<T = unknown>(name: string, value: T) {
  return callBackground('setState', {[name]: value}).then(() => value);
}

export function lastUrl(url?: string) {
  const name = 'web.last_url';
  if (url) {
    setLocalState(name, url);
    setState(name, url);
    return url;
  }
  return getLocalState<string>(name);
}

export function lastUrlAsync() {
  const cached = lastUrl();
  if (cached) {
    return Promise.resolve(cached);
  }
  return getState<string>('web.last_url')
    .then((storedUrl) => {
      if (storedUrl) {
        setLocalState('web.last_url', storedUrl);
      }
      return storedUrl || '';
    })
    .catch(() => '');
}
