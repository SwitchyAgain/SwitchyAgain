type ChromeApiTarget = Record<string, unknown>;

type OmegaPromiseConstructor = new <T>(
  executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ) => void
) => Promise<T>;

import OmegaTargetModule = require('omega-target');

const OmegaPromise = OmegaTargetModule.Promise as OmegaPromiseConstructor;

export function chromeApiPromisify(target: ChromeApiTarget, method: string) {
  return (...args: unknown[]) => {
    return new OmegaPromise<unknown>((resolve, reject) => {
      const callback = (...callbackArgs: unknown[]) => {
        if (chrome.runtime.lastError != null) {
          const error = new Error(chrome.runtime.lastError.message);
          (error as Error & {original?: unknown}).original = chrome.runtime.lastError;
          reject(error);
          return;
        }
        if (callbackArgs.length <= 1) {
          resolve(callbackArgs[0]);
        } else {
          resolve(callbackArgs);
        }
      };
      (target[method] as (...args: unknown[]) => void).apply(target, args.concat(callback));
    });
  };
}
