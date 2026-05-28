const ShexpUtils = {
  regExpMetaChars: (function(): {[charCode: number]: boolean} {
    const chars = '\\[^$.|?*+(){}/';
    const set: {[charCode: number]: boolean} = {};
    for (let i = 0; i < chars.length; i++) {
      set[chars.charCodeAt(i)] = true;
    }
    return set;
  })(),

  escapeSlash(pattern: string): string {
    const charCodeSlash = 47;
    const charCodeBackSlash = 92;
    let escaped = false;
    let start = 0;
    let result = '';
    for (let i = 0; i < pattern.length; i++) {
      const code = pattern.charCodeAt(i);
      if (code === charCodeSlash && !escaped) {
        result += pattern.substring(start, i);
        result += '\\';
        start = i;
      }
      escaped = code === charCodeBackSlash && !escaped;
    }
    return result + pattern.substr(start);
  },

  shExp2RegExp(pattern: string, options?: {trimAsterisk?: boolean}): string {
    const trimAsterisk = options != null ? options.trimAsterisk || false : false;
    let start = 0;
    let end = pattern.length;
    const charCodeAsterisk = 42;
    const charCodeQuestion = 63;
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

    let regex = '';
    if (start === 0) {
      regex += '^';
    }
    for (let i = start; i < end; i++) {
      const code = pattern.charCodeAt(i);
      switch (code) {
        case charCodeAsterisk:
          regex += '.*';
          break;
        case charCodeQuestion:
          regex += '.';
          break;
        default:
          if ((ShexpUtils.regExpMetaChars[code] as any) >= 0) {
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

export {};
