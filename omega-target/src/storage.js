"use strict";
/* @module omega-target/storage */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require('bluebird');
var Log = require('./log');
var RateLimitExceededError = /** @class */ (function (_super) {
    __extends(RateLimitExceededError, _super);
    function RateLimitExceededError() {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, RateLimitExceededError.prototype);
        return _this;
    }
    return RateLimitExceededError;
}(Error));
var QuotaExceededError = /** @class */ (function (_super) {
    __extends(QuotaExceededError, _super);
    function QuotaExceededError() {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, QuotaExceededError.prototype);
        return _this;
    }
    return QuotaExceededError;
}(Error));
var StorageUnavailableError = /** @class */ (function (_super) {
    __extends(StorageUnavailableError, _super);
    function StorageUnavailableError() {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, StorageUnavailableError.prototype);
        return _this;
    }
    return StorageUnavailableError;
}(Error));
var Storage = /** @class */ (function () {
    function Storage() {
    }
    /**
     * Calculate the actual operations against storage that should be performed to
     * replay the changes on a storage.
     * @param {Object.<string, {}>} changes The changes to apply
     * @param {?{}} args Extra arguments
     * @param {Object.<string, {}>?} args.base The original items in the storage.
     * @param {function(key, newVal, oldVal)} args.merge A function that merges
     * the newVal and oldVal. oldVal is provided only if args.base is present.
     * Otherwise it will be equal to newVal (i.e. merge(key, newVal, newVal)).
     * @returns {WriteOperations} The operations that should be performed.
     */
    Storage.operationsForChanges = function (changes, arg) {
        var _a = arg != null ? arg : {}, base = _a.base, merge = _a.merge;
        var set = {};
        var remove = [];
        for (var key in changes) {
            var newVal = changes[key];
            var oldVal = base != null ? base[key] : newVal;
            if (merge) {
                newVal = merge(key, newVal, oldVal);
            }
            if (base != null && newVal === oldVal) {
                continue;
            }
            if (typeof newVal === 'undefined') {
                if (typeof oldVal !== 'undefined' || base == null) {
                    remove.push(key);
                }
            }
            else {
                set[key] = newVal;
            }
        }
        return { set: set, remove: remove };
    };
    /**
     * Get the requested values by keys from the storage.
     * @param {(string|string[]|null|Object.<string,{}>)} keys The keys to retrive,
     * or null for all.
     * @returns {Promise<(Object.<string, {}>)>} A map from keys to values
     */
    Storage.prototype.get = function (keys) {
        Log.method('Storage#get', this, arguments);
        if (!this._items) {
            return Promise.resolve({});
        }
        if (keys == null) {
            keys = this._items;
        }
        var map = {};
        if (typeof keys === 'string') {
            map[keys] = this._items[keys];
        }
        else if (Array.isArray(keys)) {
            for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                var key = keys_1[_i];
                map[key] = this._items[key];
            }
        }
        else if (typeof keys === 'object') {
            for (var key in keys) {
                var value = keys[key];
                map[key] = this._items[key] != null ? this._items[key] : value;
            }
        }
        return Promise.resolve(map);
    };
    /**
     * Set multiple values by keys in the storage.
     * @param {(string|Object.<string,{}>)} items A map from key to value to set.
     * @returns {Promise<(Object.<string, {}>)>} A map of key-value pairs just set.
     */
    Storage.prototype.set = function (items) {
        Log.method('Storage#set', this, arguments);
        if (this._items == null) {
            this._items = {};
        }
        for (var key in items) {
            var value = items[key];
            this._items[key] = value;
        }
        return Promise.resolve(items);
    };
    /**
     * Remove items by keys from the storage.
     * @param {(string|string[]|null)} keys The keys to remove, or null for all.
     * @returns {Promise} A promise that fulfills on successful removal.
     */
    Storage.prototype.remove = function (keys) {
        Log.method('Storage#remove', this, arguments);
        if (this._items != null) {
            if (keys == null) {
                this._items = {};
            }
            else if (Array.isArray(keys)) {
                for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
                    var key = keys_2[_i];
                    delete this._items[key];
                }
            }
            else {
                delete this._items[keys];
            }
        }
        return Promise.resolve();
    };
    /**
     * Watch for any changes to the storage.
     * @param {(string|string[]|null)} keys The keys to watch, or null for all.
     * @param {watchCallback} callback Called everytime something changes.
     * @returns {function} Calling the returned function will stop watching.
     */
    Storage.prototype.watch = function (keys, callback) {
        Log.method('Storage#watch', this, arguments);
        return function () {
            return null;
        };
    };
    /**
     * Apply WriteOperations to the storage.
     * @param {WriteOperations|{changes: Object.<string,{}>}} operations The
     * operations to apply, or the changes to be applied. If changes is provided,
     * the operations are calculated by Storage.operationsForChanges, with extra
     * fields passed through as the second argument.
     * @returns {Promise} A promise that fulfills on operation success.
     */
    Storage.prototype.apply = function (operations) {
        var _this = this;
        if ('changes' in operations) {
            operations = Storage.operationsForChanges(operations.changes, operations);
        }
        return this.set(operations.set).then(function () {
            return _this.remove(operations.remove);
        }).return(operations);
    };
    Storage.RateLimitExceededError = RateLimitExceededError;
    Storage.QuotaExceededError = QuotaExceededError;
    Storage.StorageUnavailableError = StorageUnavailableError;
    return Storage;
}());
module.exports = Storage;
