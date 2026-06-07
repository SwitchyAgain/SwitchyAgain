type ChromeApiCallback<T> = (...callbackArgs: T[]) => void;
type ChromeApiMethod<T = unknown> = (...args: Array<unknown | ChromeApiCallback<T>>) => void;
type ChromeApiTarget = Record<string, ChromeApiMethod | unknown>;

type OmegaPromiseConstructor = new <T>(
  executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ) => void
) => Promise<T>;

import OmegaTarget from 'omega-target';

const OmegaPromise = OmegaTarget.Promise as OmegaPromiseConstructor;

function chromeRuntimeError() {
  const error = new Error(chrome.runtime.lastError?.message || 'Unknown Chrome API error.');
  (error as Error & {original?: ChromeLastError}).original = chrome.runtime.lastError;
  return error;
}

export function chromeApiPromisify<T = unknown>(target: ChromeApiTarget, method: string) {
  return (...args: unknown[]) => {
    return new OmegaPromise<T | T[]>((resolve, reject) => {
      const callback = (...callbackArgs: T[]) => {
        if (chrome.runtime.lastError != null) {
          reject(chromeRuntimeError());
          return;
        }
        if (callbackArgs.length <= 1) {
          resolve(callbackArgs[0]);
        } else {
          resolve(callbackArgs);
        }
      };
      const apiMethod = target[method];
      if (typeof apiMethod !== 'function') {
        reject(new Error(`Chrome API method not found: ${method}`));
        return;
      }
      apiMethod.apply(target, args.concat(callback));
    });
  };
}
