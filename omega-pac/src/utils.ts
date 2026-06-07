import Url from 'url';
import tldModule from 'tldjs';

const tld = tldModule as {
  getDomain: (domain: string) => string | null;
};

export type CacheHost = Record<string, unknown>;

type CacheEntry<T> = {
  tag: unknown;
  value: T;
};

export const Revision = {
  fromTime(time?: Date | number | string): string {
    time = time ? new Date(time) : new Date();
    return time.getTime().toString(16);
  },

  compare(a?: string | null, b?: string | null): number {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.length > b.length) return 1;
    if (a.length < b.length) return -1;
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  }
};

export class AttachedCache {
  prop: string;
  tag: (obj: CacheHost) => unknown;

  constructor(opt_prop: string | ((obj: CacheHost) => unknown), tag?: (obj: CacheHost) => unknown) {
    if (typeof tag === 'undefined') {
      this.tag = opt_prop as (obj: CacheHost) => unknown;
      this.prop = '_cache';
    } else {
      this.tag = tag;
      this.prop = opt_prop as string;
    }
  }

  get<T>(obj: CacheHost, otherwise: T | (() => T)): T {
    const tag = this.tag(obj);
    const cache = this._getCache<T>(obj);
    if (cache != null && cache.tag === tag) {
      return cache.value;
    }
    const value = typeof otherwise === 'function' ? (otherwise as () => T)() : otherwise;
    this._setCache(obj, {tag: tag, value: value});
    return value;
  }

  drop(obj: CacheHost): void {
    if (obj[this.prop] != null) {
      obj[this.prop] = undefined;
    }
  }

  _getCache<T>(obj: CacheHost): CacheEntry<T> | undefined {
    return obj[this.prop] as CacheEntry<T> | undefined;
  }

  _setCache<T>(obj: CacheHost, value: CacheEntry<T>): void {
    if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
      Object.defineProperty(obj, this.prop, {writable: true});
    }
    obj[this.prop] = value;
  }
}

export function isIp(domain: string): boolean {
  if (domain.indexOf(':') > 0) return true;
  const lastCharCode = domain.charCodeAt(domain.length - 1);
  if (48 <= lastCharCode && lastCharCode <= 57) return true;
  return false;
}

export function getBaseDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return tld.getDomain(domain) || domain;
}

export function wildcardForDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return '*.' + getBaseDomain(domain);
}

export function wildcardForUrl(url: string): string {
  const domain = Url.parse(url).hostname;
  return wildcardForDomain(domain as string);
}
