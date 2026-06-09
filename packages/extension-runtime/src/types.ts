export type StorageValue = unknown;

export type BluebirdPromise<T> = {
  catch<TResult = never>(
    errorClass: new (...args: unknown[]) => Error,
    onRejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): BluebirdPromise<T | TResult>;
  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): BluebirdPromise<T | TResult>;
  return<TResult>(value: TResult): BluebirdPromise<TResult>;
  tap<TResult = T>(
    onFulfilled?: ((value: T) => TResult | PromiseLike<TResult>) | null
  ): BluebirdPromise<T>;
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

export type StorageConstructor = {
  new(): StorageLike;
  (): StorageLike;
  operationsForChanges: (
    changes: StorageChanges,
    arg?: {
      base?: StorageItems;
      merge?: StorageMerge;
    }
  ) => StorageOperations;
  QuotaExceededError: new () => Error;
  RateLimitExceededError: new () => Error;
  StorageUnavailableError: new () => Error;
};

export type OptionsData = Record<string, unknown>;

export type ProfileLike = Record<string, unknown> & {
  builtin?: boolean;
  color?: string;
  defaultProfileName?: string;
  name?: string;
  profileType?: string;
  revision?: string;
  rules?: Array<Record<string, unknown>>;
};

export type PacAstLike = {
  print_to_string(): string;
  [key: string]: unknown;
};

export type ProfileMatchTuple = [
  profileKey: string,
  source?: unknown,
  proxy?: unknown,
  auth?: unknown
];

export type ProfileMatchResult = ProfileMatchTuple | (Record<string, unknown> & {
  profileName?: string | null;
}) | undefined;

export type OmegaPacModule = {
  Conditions: {
    localHosts: string[];
    str(condition: Record<string, unknown>): string;
    tag(condition: Record<string, unknown>): string;
  };
  PacGenerator: {
    ascii(value: string): string;
    compress(ast: PacAstLike): PacAstLike;
    script(options: OptionsData, profile: string | ProfileLike, args?: Record<string, unknown>): PacAstLike;
  };
  Profiles: {
    allReferenceSet(profile: string | ProfileLike, options: OptionsData, args?: Record<string, unknown>): Record<string, string>;
    byKey(key: string | ProfileLike, options?: OptionsData): ProfileLike | undefined;
    byName(name: string | ProfileLike, options?: OptionsData): ProfileLike | undefined;
    create(profile: string | ProfileLike, profileType?: string): ProfileLike;
    directReferenceSet(profile: ProfileLike): Record<string, string>;
    dropCache(profile: ProfileLike): void;
    each(options: OptionsData, callback: (key: string, profile: ProfileLike) => unknown): unknown;
    isIncludable(profile: ProfileLike): boolean;
    isInclusive(profile: ProfileLike): boolean;
    match(profile: ProfileLike, request: Record<string, unknown>): ProfileMatchResult;
    nameAsKey(profileName: string | ProfileLike): string;
    replaceRef(profile: ProfileLike, fromName: string, toName: string): boolean;
    update(profile: ProfileLike, data: unknown): boolean;
    updateContentTypeHints(profile: ProfileLike): string[] | undefined;
    updateRevision(profile: ProfileLike, revision?: string): string;
    updateUrl(profile: ProfileLike): string | undefined;
    validResultProfilesFor(profile: string | ProfileLike, options: OptionsData): ProfileLike[];
  };
  Revision: {
    compare(left: unknown, right: unknown): number;
  };
};

export type OptionsSyncLike = {
  copyTo(storage: StorageLike): BluebirdPromise<unknown>;
  enabled: boolean;
  requestPush(changes: StorageChanges): unknown;
  storage: StorageLike;
  transformValue?: (value: StorageValue, key?: string) => StorageValue;
  watchAndPull(storage: StorageLike): StopWatching;
};

export type ProxyImplLike = {
  applyProfile(profile: ProfileLike, meta?: ProfileLike, options?: OptionsData): BluebirdPromise<unknown>;
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
