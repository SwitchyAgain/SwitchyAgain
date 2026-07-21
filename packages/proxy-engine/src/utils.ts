import {getDomain} from 'tldts';
import {parseUrlCompat} from './url_utils';

const DOMAIN_LOOKUP_OPTIONS = {
  allowPrivateDomains: true,
  extractHostname: false,
  mixedInputs: false,
  validateHostname: false
};

const DOMAIN_URL_PREFIX = /^(([a-z][a-z0-9+.-]*)?:)?\/\//;
const DOMAIN_URL_BASE = 'http://switchyagain.invalid';

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

function isValidHostnameForDomainLookup(hostname: string): boolean {
  if (hostname.length === 0 || hostname.length > 255) {
    return false;
  }

  const isLetter = (code: number) => code >= 97 && code <= 122;
  const isDigit = (code: number) => code >= 48 && code <= 57;
  const firstCharCode = hostname.charCodeAt(0);
  if (!isLetter(firstCharCode) && !isDigit(firstCharCode)) {
    return false;
  }

  let lastDotIndex = -1;
  let lastCharCode = -1;
  for (let index = 0; index < hostname.length; index++) {
    const code = hostname.charCodeAt(index);
    if (code === 46) {
      if (index - lastDotIndex > 64 || lastCharCode === 46 || lastCharCode === 45) {
        return false;
      }
      lastDotIndex = index;
    } else if (!isLetter(code) && !isDigit(code) && code !== 45) {
      return false;
    }
    lastCharCode = code;
  }

  return hostname.length - lastDotIndex - 1 <= 63 && lastCharCode !== 45;
}

function trimTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

function hostnameForDomainLookup(value: string): string | null {
  if (isValidHostnameForDomainLookup(value)) {
    return trimTrailingDot(value);
  }

  let normalized = value;
  if (normalized.length > 0 && (normalized.charCodeAt(0) <= 32 || normalized.charCodeAt(normalized.length - 1) <= 32)) {
    normalized = normalized.trim();
  }
  if (/[A-Z]/.test(normalized)) {
    normalized = normalized.toLowerCase();
  }
  if (isValidHostnameForDomainLookup(normalized)) {
    return trimTrailingDot(normalized);
  }

  if (!DOMAIN_URL_PREFIX.test(normalized)) {
    normalized = '//' + normalized;
  }
  try {
    const hostname = new URL(normalized, DOMAIN_URL_BASE).hostname;
    return hostname ? trimTrailingDot(hostname) : null;
  } catch {
    return null;
  }
}

function registrableDomain(value: string): string | null {
  const hostname = hostnameForDomainLookup(value);
  if (hostname == null || !isValidHostnameForDomainLookup(hostname)) {
    return null;
  }
  return getDomain(hostname, DOMAIN_LOOKUP_OPTIONS);
}

export function getBaseDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return registrableDomain(domain) || domain;
}

export function wildcardForDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return '*.' + getBaseDomain(domain);
}

export function wildcardForUrl(url: string): string {
  return wildcardForDomain(parseUrlCompat(url).hostname);
}
