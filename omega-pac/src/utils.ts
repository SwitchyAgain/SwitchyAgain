const Url = require('url');
const tld = require('tldjs');

const Revision = {
  fromTime(time?: any): string {
    time = time ? new Date(time) : new Date();
    return time.getTime().toString(16);
  },

  compare(a: any, b: any): number {
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

exports.Revision = Revision;

class AttachedCache {
  prop: string;
  tag: (obj: any) => any;

  constructor(opt_prop: any, tag?: (obj: any) => any) {
    this.tag = tag as (obj: any) => any;
    this.prop = opt_prop;
    if (typeof this.tag === 'undefined') {
      this.tag = opt_prop;
      this.prop = '_cache';
    }
  }

  get(obj: any, otherwise: any): any {
    const tag = this.tag(obj);
    const cache = this._getCache(obj);
    if (cache != null && cache.tag === tag) {
      return cache.value;
    }
    const value = typeof otherwise === 'function' ? otherwise() : otherwise;
    this._setCache(obj, {tag: tag, value: value});
    return value;
  }

  drop(obj: any): void {
    if (obj[this.prop] != null) {
      obj[this.prop] = undefined;
    }
  }

  _getCache(obj: any): any {
    return obj[this.prop];
  }

  _setCache(obj: any, value: any): void {
    if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
      Object.defineProperty(obj, this.prop, {writable: true});
    }
    obj[this.prop] = value;
  }
}

exports.AttachedCache = AttachedCache;

exports.isIp = function(domain: string): boolean {
  if (domain.indexOf(':') > 0) return true;
  const lastCharCode = domain.charCodeAt(domain.length - 1);
  if (48 <= lastCharCode && lastCharCode <= 57) return true;
  return false;
};

exports.getBaseDomain = function(domain: string): string {
  if (exports.isIp(domain)) return domain;
  return tld.getDomain(domain) || domain;
};

exports.wildcardForDomain = function(domain: string): string {
  if (exports.isIp(domain)) return domain;
  return '*.' + exports.getBaseDomain(domain);
};

exports.wildcardForUrl = function(url: string): string {
  const domain = Url.parse(url).hostname;
  return exports.wildcardForDomain(domain);
};

export {};
