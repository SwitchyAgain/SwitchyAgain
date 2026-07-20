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

Promise.onPossiblyUnhandledRejection = function (callback: (reason: unknown, promise: unknown) => unknown): void {
  addUnhandledRejectionListener('unhandledrejection', 'unhandledRejection', callback);
};

Promise.onUnhandledRejectionHandled = function (callback: (promise: unknown) => unknown): void {
  addUnhandledRejectionListener('rejectionhandled', 'rejectionHandled', callback);
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

export default Promise;
