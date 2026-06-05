export type Options = Record<string, any>;

declare const chrome: {
  i18n?: {
    getMessage?: (key: string, substitutions?: string | string[]) => string;
  };
  runtime?: {
    getManifest?: () => {version?: string};
    lastError?: {message?: string};
    sendMessage?: (
      message: {method: string; args: any[]},
      callback: (response?: {result?: any; error?: any}) => void
    ) => void;
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

function decodeBackgroundError(error: any) {
  if (error?._error !== 'error') {
    return error;
  }
  const decoded = new Error(error.message || error.name || 'Background error');
  decoded.name = error.name || decoded.name;
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

export function resetOptions(options?: any) {
  return callBackground<Options>('reset', options);
}

export function setOptionsSync(enabled: boolean, args?: any) {
  return callBackground<void>('setOptionsSync', enabled, args);
}

export function resetOptionsSync() {
  return callBackground<void>('resetOptionsSync');
}

export function getLocalState<T = any>(name: string) {
  try {
    const value = window.localStorage.getItem(`omega.local.${name}`);
    return value == null ? undefined : JSON.parse(value) as T;
  } catch (err) {
    return undefined;
  }
}

export function setLocalState(name: string, value: any) {
  window.localStorage.setItem(`omega.local.${name}`, JSON.stringify(value));
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
