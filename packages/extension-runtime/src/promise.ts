import type {RuntimePromise, RuntimePromiseStatic} from './types';

type PromiseExecutor<T> = (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void;

type NativePromise<T> = {
  catch<TResult = never>(onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): NativePromise<T | TResult>;
  finally?(onFinally?: (() => void) | null): NativePromise<T>;
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): NativePromise<TResult1 | TResult2>;
};

type NativePromiseStatic = {
  new <T = unknown>(executor: PromiseExecutor<T>): NativePromise<T>;
  all<T>(values: Array<T | PromiseLike<T>>): NativePromise<T[]>;
  reject<T = never>(reason?: unknown): NativePromise<T>;
  resolve<T = void>(value?: T | PromiseLike<T>): NativePromise<T>;
};

type RuntimeGlobal = typeof globalThis & {
  Promise: NativePromiseStatic;
  process?: {
    on?(event: string, callback: (...args: unknown[]) => unknown): unknown;
  };
};

const NativePromiseImpl = (globalThis as RuntimeGlobal).Promise;

class TimeoutError extends Error {
  constructor(milliseconds: number) {
    super('operation timed out after ' + milliseconds + ' ms');
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

function augment<T>(promise: NativePromise<T>): RuntimePromise<T> {
  const runtimePromise = promise as RuntimePromise<T> & {
    __extensionRuntimePromise?: boolean;
  };
  if (runtimePromise.__extensionRuntimePromise) {
    return runtimePromise;
  }
  Object.defineProperty(runtimePromise, '__extensionRuntimePromise', {
    configurable: false,
    enumerable: false,
    value: true
  });

  const then = promise.then.bind(promise);
  Object.defineProperty(runtimePromise, 'then', {
    configurable: true,
    value(onFulfilled?: unknown, onRejected?: unknown) {
      return augment(then(onFulfilled as never, onRejected as never) as NativePromise<unknown>);
    }
  });

  const catchImpl = promise.catch ? promise.catch.bind(promise) : (onRejected?: unknown) => then(null, onRejected as never);
  Object.defineProperty(runtimePromise, 'catch', {
    configurable: true,
    value(onRejected?: unknown) {
      return augment(catchImpl(onRejected as never) as NativePromise<unknown>);
    }
  });

  const finallyImpl = promise.finally
    ? promise.finally.bind(promise)
    : (onFinally?: (() => void) | null) => {
        return then(
          (value: T) => Promise.resolve(onFinally ? onFinally() : undefined).then(() => value),
          (reason: unknown) =>
            Promise.resolve(onFinally ? onFinally() : undefined).then(() => {
              throw reason;
            })
        );
      };
  Object.defineProperty(runtimePromise, 'finally', {
    configurable: true,
    value(onFinally?: (() => void) | null) {
      return augment(finallyImpl(onFinally) as NativePromise<T>);
    }
  });

  Object.defineProperty(runtimePromise, 'timeout', {
    configurable: true,
    value(milliseconds: number) {
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new TimeoutError(milliseconds));
          }
        }, milliseconds);
        runtimePromise.then(
          (value) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(value);
            }
          },
          (reason) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(reason);
            }
          }
        );
      });
    }
  });

  return runtimePromise;
}

function addUnhandledRejectionListener(browserEvent: string, nodeEvent: string, callback: (...args: unknown[]) => unknown): void {
  const root = globalThis as RuntimeGlobal & {
    addEventListener?: (name: string, callback: (event: Event) => unknown) => void;
  };
  if (typeof root.addEventListener === 'function') {
    root.addEventListener(browserEvent, (event) => {
      const rejectionEvent = event as Event & {
        promise?: unknown;
        reason?: unknown;
      };
      if (browserEvent === 'unhandledrejection') {
        callback(rejectionEvent.reason, rejectionEvent.promise);
      } else {
        callback(rejectionEvent.promise);
      }
    });
    return;
  }
  if (root.process != null && typeof root.process.on === 'function') {
    root.process.on(nodeEvent, callback);
  }
}

const Promise = function <T = unknown>(this: unknown, executor: PromiseExecutor<T>): RuntimePromise<T> {
  return augment(new NativePromiseImpl<T>(executor));
} as unknown as RuntimePromiseStatic;

Promise.all = function <T>(values: Array<T | PromiseLike<T>>): RuntimePromise<T[]> {
  return augment(NativePromiseImpl.all(values));
};

Promise.delay = function (milliseconds?: number): RuntimePromise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), milliseconds || 0);
  });
};

Promise.join = function <T1, T2, TResult>(
  first: T1 | PromiseLike<T1>,
  second: T2 | PromiseLike<T2>,
  handler: (first: T1, second: T2) => TResult | PromiseLike<TResult>
): RuntimePromise<TResult> {
  return Promise.all([first, second] as Array<T1 | T2>).then((values) => {
    return handler(values[0] as T1, values[1] as T2);
  });
};

Promise.longStackTraces = function (): void {};

Promise.onPossiblyUnhandledRejection = function (callback: (reason: unknown, promise: unknown) => unknown): void {
  addUnhandledRejectionListener('unhandledrejection', 'unhandledRejection', callback);
};

Promise.onUnhandledRejectionHandled = function (callback: (promise: unknown) => unknown): void {
  addUnhandledRejectionListener('rejectionhandled', 'rejectionHandled', callback);
};

Promise.promisify = function (fn: unknown): (...args: unknown[]) => RuntimePromise<unknown> {
  return function (this: unknown, ...args: unknown[]) {
    return new Promise<unknown>((resolve, reject) => {
      if (typeof fn !== 'function') {
        reject(new TypeError('Expected a function to promisify.'));
        return;
      }
      (fn as (...args: unknown[]) => unknown).apply(
        this,
        args.concat((error: unknown, value: unknown) => {
          if (error != null) {
            reject(error);
            return;
          }
          resolve(value);
        })
      );
    });
  };
};

Promise.props = function <T extends Record<string, unknown>>(values: T): RuntimePromise<Record<keyof T, unknown>> {
  const keys = Object.keys(values) as Array<keyof T>;
  return Promise.all(keys.map((key) => values[key])).then((resolvedValues) => {
    const result = {} as Record<keyof T, unknown>;
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = resolvedValues[i];
    }
    return result;
  });
};

Promise.reject = function <T = never>(reason?: unknown): RuntimePromise<T> {
  return augment(NativePromiseImpl.reject(reason));
};

Promise.resolve = function <T = void>(value?: T | PromiseLike<T>): RuntimePromise<T> {
  return augment(NativePromiseImpl.resolve<T>(value as T | PromiseLike<T>));
};

Promise.try = function <T = unknown>(fn: () => T | PromiseLike<T>): RuntimePromise<T> {
  return Promise.resolve().then(fn);
};

export {TimeoutError};
export default Promise;
