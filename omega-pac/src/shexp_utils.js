"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ShexpUtils = {
    regExpMetaChars: (function () {
        var chars = '\\[^$.|?*+(){}/';
        var set = {};
        for (var i = 0; i < chars.length; i++) {
            set[chars.charCodeAt(i)] = true;
        }
        return set;
    })(),
    escapeSlash: function (pattern) {
        var charCodeSlash = 47;
        var charCodeBackSlash = 92;
        var escaped = false;
        var start = 0;
        var result = '';
        for (var i = 0; i < pattern.length; i++) {
            var code = pattern.charCodeAt(i);
            if (code === charCodeSlash && !escaped) {
                result += pattern.substring(start, i);
                result += '\\';
                start = i;
            }
            escaped = code === charCodeBackSlash && !escaped;
        }
        return result + pattern.substr(start);
    },
    shExp2RegExp: function (pattern, options) {
        var trimAsterisk = options != null ? options.trimAsterisk || false : false;
        var start = 0;
        var end = pattern.length;
        var charCodeAsterisk = 42;
        var charCodeQuestion = 63;
        if (trimAsterisk) {
            while (start < end && pattern.charCodeAt(start) === charCodeAsterisk) {
                start++;
            }
            while (start < end && pattern.charCodeAt(end - 1) === charCodeAsterisk) {
                end--;
            }
            if (end - start === 1 && pattern.charCodeAt(start) === charCodeAsterisk) {
                return '';
            }
        }
        var regex = '';
        if (start === 0) {
            regex += '^';
        }
        for (var i = start; i < end; i++) {
            var code = pattern.charCodeAt(i);
            switch (code) {
                case charCodeAsterisk:
                    regex += '.*';
                    break;
                case charCodeQuestion:
                    regex += '.';
                    break;
                default:
                    if (ShexpUtils.regExpMetaChars[code] >= 0) {
                        regex += '\\';
                    }
                    regex += pattern[i];
            }
        }
        if (end === pattern.length) {
            regex += '$';
        }
        return regex;
    }
};
module.exports = ShexpUtils;
