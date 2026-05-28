"use strict";
var Url = require('url');
var tld = require('tldjs');
var Revision = {
    fromTime: function (time) {
        time = time ? new Date(time) : new Date();
        return time.getTime().toString(16);
    },
    compare: function (a, b) {
        if (!a && !b)
            return 0;
        if (!a)
            return -1;
        if (!b)
            return 1;
        if (a.length > b.length)
            return 1;
        if (a.length < b.length)
            return -1;
        if (a > b)
            return 1;
        if (a < b)
            return -1;
        return 0;
    }
};
exports.Revision = Revision;
var AttachedCache = /** @class */ (function () {
    function AttachedCache(opt_prop, tag) {
        this.tag = tag;
        this.prop = opt_prop;
        if (typeof this.tag === 'undefined') {
            this.tag = opt_prop;
            this.prop = '_cache';
        }
    }
    AttachedCache.prototype.get = function (obj, otherwise) {
        var tag = this.tag(obj);
        var cache = this._getCache(obj);
        if (cache != null && cache.tag === tag) {
            return cache.value;
        }
        var value = typeof otherwise === 'function' ? otherwise() : otherwise;
        this._setCache(obj, { tag: tag, value: value });
        return value;
    };
    AttachedCache.prototype.drop = function (obj) {
        if (obj[this.prop] != null) {
            obj[this.prop] = undefined;
        }
    };
    AttachedCache.prototype._getCache = function (obj) {
        return obj[this.prop];
    };
    AttachedCache.prototype._setCache = function (obj, value) {
        if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
            Object.defineProperty(obj, this.prop, { writable: true });
        }
        obj[this.prop] = value;
    };
    return AttachedCache;
}());
exports.AttachedCache = AttachedCache;
exports.isIp = function (domain) {
    if (domain.indexOf(':') > 0)
        return true;
    var lastCharCode = domain.charCodeAt(domain.length - 1);
    if (48 <= lastCharCode && lastCharCode <= 57)
        return true;
    return false;
};
exports.getBaseDomain = function (domain) {
    if (exports.isIp(domain))
        return domain;
    return tld.getDomain(domain) || domain;
};
exports.wildcardForDomain = function (domain) {
    if (exports.isIp(domain))
        return domain;
    return '*.' + exports.getBaseDomain(domain);
};
exports.wildcardForUrl = function (url) {
    var domain = Url.parse(url).hostname;
    return exports.wildcardForDomain(domain);
};
