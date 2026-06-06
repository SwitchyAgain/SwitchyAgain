export type StorageValue = unknown;

export type BluebirdPromise<T> = {
  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): BluebirdPromise<T | TResult>;
  return<TResult>(value: TResult): BluebirdPromise<TResult>;
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): BluebirdPromise<TResult1 | TResult2>;
};

export type BluebirdStatic = {
  all<T>(values: Array<T | PromiseLike<T>>): BluebirdPromise<T[]>;
  join<T1, T2, TResult>(
    first: T1 | PromiseLike<T1>,
    second: T2 | PromiseLike<T2>,
    handler: (first: T1, second: T2) => TResult | PromiseLike<TResult>
  ): BluebirdPromise<TResult>;
  props<T extends Record<string, unknown>>(
    values: T
  ): BluebirdPromise<Record<keyof T, unknown>>;
  reject<T = never>(reason?: unknown): BluebirdPromise<T>;
  resolve<T = void>(value?: T | PromiseLike<T>): BluebirdPromise<T>;
};

export type LogLike = {
  error: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  method: (name: string, self: unknown, args: IArguments | unknown[]) => void;
  str: (obj: unknown) => string;
};

export type StorageItems = Record<string, StorageValue>;

export type StorageChanges = Record<string, StorageValue | undefined>;

export type StorageGetKeys = string | string[] | StorageItems | null | undefined;

export type StorageRemoveKeys = string | string[] | null | undefined;

export type StorageMerge = (
  key: string,
  newValue: StorageValue,
  oldValue: StorageValue
) => StorageValue;

export type StorageOperations = {
  remove: string[];
  set: StorageItems;
};

export type StorageApplyOperations = Partial<StorageOperations> & {
  base?: StorageItems;
  changes?: StorageChanges;
  merge?: StorageMerge;
};

export type StorageWatchCallback = (changes: StorageChanges) => void;

export type StopWatching = () => unknown;

export type StorageLike = {
  apply: (operations: StorageApplyOperations) => BluebirdPromise<StorageApplyOperations>;
  get: (keys: StorageGetKeys) => BluebirdPromise<StorageItems>;
  remove: (keys?: StorageRemoveKeys) => BluebirdPromise<unknown>;
  set: (items: StorageItems) => BluebirdPromise<StorageItems>;
  watch: (keys: StorageRemoveKeys, callback: StorageWatchCallback) => StopWatching;
};

export type SyncableProfileValue = {
  revision?: unknown;
  syncError?: {
    reason?: string;
    [key: string]: unknown;
  };
  syncOptions?: string;
  [key: string]: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
