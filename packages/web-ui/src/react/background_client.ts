import {
  runtimeAvailable as extensionRuntimeAvailable,
  runtimeLastErrorMessage,
  sendRuntimeMessage
} from './browser_env';
import type {
  BackgroundError,
  BackgroundMethod,
  BackgroundMethodArgs,
  BackgroundMethodResult,
  BackgroundResponse
} from './options_client_types';

export function runtimeAvailable() {
  return extensionRuntimeAvailable();
}

export function callBackground<M extends BackgroundMethod>(
  method: M,
  ...args: BackgroundMethodArgs[M]
): Promise<BackgroundMethodResult[M]> {
  return new Promise((resolve, reject) => {
    const sent = sendRuntimeMessage({method, args}, (response) => {
      const typedResponse = response as BackgroundResponse<BackgroundMethodResult[M]> | undefined;
      const lastErrorMessage = runtimeLastErrorMessage();
      if (lastErrorMessage) {
        reject(new Error(lastErrorMessage));
        return;
      }
      if (typedResponse?.error) {
        reject(decodeBackgroundError(typedResponse.error));
        return;
      }
      resolve(typedResponse?.result as BackgroundMethodResult[M]);
    });
    if (!sent) {
      reject(new Error('Extension runtime is unavailable.'));
    }
  });
}

export function callBackgroundWithRefresh<M extends BackgroundMethod>(
  method: M,
  ...args: BackgroundMethodArgs[M]
): Promise<BackgroundMethodResult[M]> {
  return new Promise((resolve, reject) => {
    const sent = sendRuntimeMessage({method, args, refreshActivePage: true}, (response) => {
      const typedResponse = response as BackgroundResponse<BackgroundMethodResult[M]> | undefined;
      const lastErrorMessage = runtimeLastErrorMessage();
      if (lastErrorMessage) {
        reject(new Error(lastErrorMessage));
        return;
      }
      if (typedResponse?.error) {
        reject(decodeBackgroundError(typedResponse.error));
        return;
      }
      resolve(typedResponse?.result as BackgroundMethodResult[M]);
    });
    if (!sent) {
      reject(new Error('Extension runtime is unavailable.'));
    }
  });
}

export function callBackgroundNoReply<M extends BackgroundMethod>(method: M, ...args: BackgroundMethodArgs[M]) {
  sendRuntimeMessage(
    {
      method,
      args,
      noReply: true
    },
    () => {
      runtimeLastErrorMessage();
    }
  );
}

export function decodeBackgroundError(error: unknown): BackgroundError | unknown {
  const serialized = error as
    | {
        _error?: string;
        message?: string;
        name?: string;
        original?: BackgroundError['original'];
        reason?: string;
        stack?: string;
        statusCode?: number | string;
      }
    | null
    | undefined;
  if (serialized?._error !== 'error') {
    return error;
  }
  const decoded = new Error(serialized.message || serialized.name || 'Background error') as BackgroundError;
  decoded.name = serialized.name || decoded.name;
  decoded.original = serialized.original;
  decoded.reason = serialized.reason;
  decoded.statusCode = serialized.statusCode;
  if (serialized.stack) {
    decoded.stack = serialized.stack;
  }
  return decoded;
}

