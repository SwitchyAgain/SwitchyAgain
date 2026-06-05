export type Options = Record<string, any>;

declare const chrome: {
  i18n?: {
    getMessage?: (key: string, substitutions?: string | string[]) => string;
  };
  runtime?: {
    getManifest?: () => {manifest_version?: number; version?: string};
    getURL?: (path: string) => string;
    id?: string;
    lastError?: {message?: string};
    sendMessage?: (
      message: {method: string; args: any[]; noReply?: boolean; refreshActivePage?: boolean},
      callback: (response?: {result?: any; error?: any}) => void
    ) => void;
  };
  tabs?: {
    create?: (props: {url: string}, callback?: () => void) => void;
    query?: (queryInfo: {url?: string}, callback: (tabs: Array<{id?: number; url?: string}>) => void) => void;
    update?: (tabId: number | undefined, props: {active?: boolean; url?: string}, callback?: () => void) => void;
  };
};

export function message(key: string, fallback = key, substitutions?: string | string[]) {
  return chrome?.i18n?.getMessage?.(key, substitutions) || fallback;
}

export function manifestVersion() {
  return chrome?.runtime?.getManifest?.()?.version || 'unknown';
}

export function runtimeAvailable() {
  return Boolean(chrome?.runtime?.sendMessage);
}

function isManifestV3() {
  const manifest = chrome?.runtime?.getManifest?.();
  return Boolean(manifest?.manifest_version && manifest.manifest_version >= 3);
}

export function callBackground<T>(method: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('Extension runtime is unavailable.'));
      return;
    }
    chrome.runtime.sendMessage({method, args}, (response) => {
      if (chrome.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Unknown runtime error.'));
        return;
      }
      if (response?.error) {
        reject(decodeBackgroundError(response.error));
        return;
      }
      resolve(response?.result as T);
    });
  });
}

export function callBackgroundNoReply(method: string, ...args: any[]) {
  chrome?.runtime?.sendMessage?.({
    method,
    args,
    noReply: true
  }, () => {
    chrome?.runtime?.lastError;
  });
}

function decodeBackgroundError(error: any) {
  if (error?._error !== 'error') {
    return error;
  }
  const decoded = new Error(error.message || error.name || 'Background error');
  decoded.name = error.name || decoded.name;
  (decoded as any).original = error.original;
  (decoded as any).reason = error.reason;
  (decoded as any).statusCode = error.statusCode;
  if (error.stack) {
    decoded.stack = error.stack;
  }
  return decoded;
}

export function loadOptions() {
  return callBackground<Options>('getAll');
}

export function patchOptions(patch: Options) {
  return callBackground<Options>('patch', patch);
}

export function patchAndLoadOptions(patch: Options) {
  return patchOptions(patch).then(loadOptions);
}

export function resetOptions(options?: any) {
  return callBackground<Options>('reset', options);
}

export function setOptionsSync(enabled: boolean, args?: any) {
  return callBackground<void>('setOptionsSync', enabled, args);
}

export function resetOptionsSync() {
  return callBackground<void>('resetOptionsSync');
}

function stateKey(name: string) {
  return `omega.local.${name}`;
}

export function getLocalState<T = any>(name: string) {
  try {
    const value = window.localStorage.getItem(stateKey(name));
    return value == null ? undefined : JSON.parse(value) as T;
  } catch (err) {
    return undefined;
  }
}

export function setLocalState(name: string, value: any) {
  window.localStorage.setItem(stateKey(name), JSON.stringify(value));
}

export function getState<T = any>(name: string): Promise<T | undefined>;
export function getState<T = any>(name: string[]): Promise<Array<T | undefined>>;
export function getState<T = any>(name: string | string[]) {
  if (isManifestV3()) {
    return callBackground<Record<string, T>>('getState', name).then((result) => {
      if (Array.isArray(name)) {
        return name.map((key) => result?.[key]);
      }
      return result?.[name];
    });
  }
  if (Array.isArray(name)) {
    return Promise.resolve(name.map((key) => getLocalState<T>(key)));
  }
  return Promise.resolve(getLocalState<T>(name));
}

export function setState<T = any>(name: string, value: T) {
  if (isManifestV3()) {
    return callBackground<Record<string, T>>('setState', {[name]: value}).then(() => value);
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

export function renameProfile(fromName: string, toName: string) {
  return callBackground<Options>('renameProfile', fromName, toName).then(loadOptions);
}

export function replaceRef(fromName: string, toName: string) {
  return callBackground<Options>('replaceRef', fromName, toName).then(loadOptions);
}

export function updateProfile(name?: string, bypassCache = 'bypass_cache') {
  return callBackground<Record<string, any>>('updateProfile', name, bypassCache).then((results) => {
    const decoded: Record<string, any> = {};
    for (const key of Object.keys(results || {})) {
      decoded[key] = decodeBackgroundError(results[key]);
    }
    return decoded;
  }).then((results) => loadOptions().then((options) => ({
    options,
    results
  })));
}

export function openShortcutConfig() {
  chrome?.tabs?.create?.({
    url: 'chrome://extensions/configureCommands'
  });
}

export function openManage() {
  const id = chrome?.runtime?.id || '';
  chrome?.tabs?.create?.({
    url: `chrome://extensions/?id=${id}`
  });
}

export function openOptions(hash?: string) {
  const optionsUrl = chrome?.runtime?.getURL?.('options.html') || 'options.html';
  if (!chrome?.tabs?.query) {
    window.location.href = hash ? `${optionsUrl}${hash}` : optionsUrl;
    return;
  }
  chrome.tabs.query({url: optionsUrl}, (tabs) => {
    let targetUrl = optionsUrl;
    if (hash) {
      try {
        const parsed = new URL(tabs?.[0]?.url || optionsUrl);
        parsed.hash = hash;
        targetUrl = parsed.href;
      } catch (err) {
        targetUrl = `${optionsUrl}${hash}`;
      }
    }
    if (tabs?.length > 0) {
      chrome.tabs?.update?.(tabs[0].id, {
        active: true,
        ...(hash ? {url: targetUrl} : {})
      });
      return;
    }
    chrome.tabs?.create?.({
      url: targetUrl
    });
  });
}

export function optionPatch(before: Options, after: Options, keys: string[]) {
  const patch: Options = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      patch[key] = [before[key], after[key]];
    }
  }
  return patch;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
