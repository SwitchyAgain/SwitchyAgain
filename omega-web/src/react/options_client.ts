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
        reject(response.error);
        return;
      }
      resolve(response?.result as T);
    });
  });
}

export function loadOptions() {
  return callBackground<Options>('getAll');
}

export function patchOptions(patch: Options) {
  return callBackground<Options>('patch', patch);
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

