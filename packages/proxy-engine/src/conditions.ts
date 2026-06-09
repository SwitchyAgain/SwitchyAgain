import type {Condition, PacRequest} from './types';
import type {AttachedCache as AttachedCacheType} from './utils';
import * as Ast from './pac_ast';
import {Address4, Address6} from 'ip-address';
import {escapeSlash, shExp2RegExp} from './shexp_utils';
import {parseUrlCompat} from './url_utils';
import {AttachedCache} from './utils';

const hasProp = Object.prototype.hasOwnProperty;

type ConditionCache = {
  analyzed?: any;
  compiled?: any;
  [key: string]: any;
};

type ParsedUrl = {
  hostname: string;
  port?: string;
  protocol: string;
  href?: string;
  [key: string]: unknown;
};

type PacAstNode = Ast.Node;

type IpAddress = Address4 | Address6;

function isIpv4Address(addr: IpAddress): addr is Address4 {
  return addr instanceof Address4;
}

type ParsedBypassHostPort = {
  host: string;
  port: string | null;
  valid: boolean;
};

type ParsedBypassPattern = {
  host: string;
  port: string | null;
  scheme: string | null;
  valid: boolean;
};

type NormalizedDomainPattern = {
  pattern: string;
  valid: boolean;
};

type ConditionHandler = {
  abbrs: string[];
  analyze(this: ConditionsApiType, condition: Condition): any;
  compile?(this: ConditionsApiType, condition: Condition, cache: ConditionCache): PacAstNode;
  fromStr?(this: ConditionsApiType, str: string, condition: Condition): Condition;
  match?(this: ConditionsApiType, condition: Condition, request: PacRequest, cache: ConditionCache): boolean;
  str?(this: ConditionsApiType, condition: Condition): string;
  tag?(this: ConditionsApiType, condition: Condition): string;
};

type ConditionsApiType = {
  _abbrs: Record<string, string> | null;
  _condCache: AttachedCacheType;
  _conditionTypes: Record<string, ConditionHandler>;
  _handler(conditionType: string | Condition): ConditionHandler;
  _hostIsLocalAst(): PacAstNode;
  _hostPortMatches(pattern: ParsedBypassPattern, request: PacRequest): boolean;
  _hostRegex(pattern: string): RegExp;
  _normalizeDomainHost(host: string): string | null;
  _normalizeDomainPattern(pattern: string): NormalizedDomainPattern;
  _normalizeIpWildcardPattern(pattern: string): string | null;
  _parseBypassHostPort(server: string): ParsedBypassHostPort;
  _parseBypassPattern(pattern: string): ParsedBypassPattern;
  _portIsValid(port: string | null): boolean;
  _portEqualsAst(port: string): PacAstNode;
  _setProp(obj: Record<string, any>, prop: string, value: unknown): unknown;
  analyze(condition: Condition): ConditionCache;
  between(val: PacAstNode, min: any, max: any, comment?: string): PacAstNode;
  colonCharCode: number;
  comment(comment: string | null | undefined, node: PacAstNode): PacAstNode;
  compile(condition: Condition): PacAstNode;
  fromStr(str: string): Condition | null;
  getWeekdayList(condition: Condition): boolean[];
  ipv6Max: string;
  isInt(num: unknown): num is number;
  localHosts: string[];
  match(condition: Condition, request: PacRequest): boolean;
  normalizeIp(addr: IpAddress): string;
  parseIp(ip: string): IpAddress | null;
  parseIpHost(host: string): IpAddress | null;
  regTest(expr: string | PacAstNode, regexp: string | RegExp): PacAstNode;
  requestFromUrl(url: string | ParsedUrl): PacRequest;
  safeRegex(expr: string): RegExp;
  str(condition: Condition, arg?: {abbr?: number}): string;
  tag(condition: Condition): unknown;
  typeFromAbbr(abbr: string): string | undefined;
  urlWildcard2HostWildcard(pattern: string): string | undefined;
};

const ConditionsApi: ConditionsApiType = {
  requestFromUrl(url: string | ParsedUrl): PacRequest {
    const parsedUrl = typeof url === 'string' ? parseUrlCompat(url) : url;
    const addr = ConditionsApi.parseIpHost(parsedUrl.hostname);
    const host = addr != null
      ? ConditionsApi.normalizeIp(addr)
      : ConditionsApi._normalizeDomainHost(parsedUrl.hostname) || parsedUrl.hostname.toLowerCase();
    return {
      url: parsedUrl.href || String(url),
      host,
      port: parsedUrl.port || '',
      scheme: parsedUrl.protocol.replace(':', '')
    };
  },
  urlWildcard2HostWildcard(pattern: string): string | undefined {
    const result = pattern.match(/^\*:\/\/((?:\w|[?*._\-])+)\/\*$/);
    return result != null ? result[1] : void 0;
  },
  tag(condition: Condition): unknown {
    return ConditionsApi._condCache.tag(condition);
  },
  analyze(condition: Condition): ConditionCache {
    return ConditionsApi._condCache.get(condition, () => {
      return {
        analyzed: ConditionsApi._handler(condition.conditionType).analyze.call(ConditionsApi, condition)
      };
    });
  },
  match(condition: Condition, request: PacRequest): boolean {
    const cache = ConditionsApi.analyze(condition);
    const match = ConditionsApi._handler(condition.conditionType).match;
    return match != null ? match.call(ConditionsApi, condition, request, cache) : false;
  },
  compile(condition: Condition): PacAstNode {
    const cache = ConditionsApi.analyze(condition) as ConditionCache;
    if (cache.compiled) {
      return cache.compiled;
    }
    const handler = ConditionsApi._handler(condition.conditionType);
    if (handler.compile == null) {
      return void 0;
    }
    return cache.compiled = handler.compile.call(ConditionsApi, condition, cache);
  },
  str(condition: Condition, arg?: {abbr?: number}): string {
    const abbr = (arg != null ? arg : {
      abbr: -1
    }).abbr;
    const handler = ConditionsApi._handler(condition.conditionType);
    const str = handler.str;
    const part = str ? str.call(ConditionsApi, condition) : condition.pattern;
    if (handler.abbrs[0].length === 0) {
      const endCode = part.charCodeAt(part.length - 1);
      if (endCode !== ConditionsApi.colonCharCode && part.indexOf(' ') < 0) {
        return part;
      }
    }
    const typeStr = typeof abbr === 'number' ? handler.abbrs[(handler.abbrs.length + abbr) % handler.abbrs.length] : condition.conditionType;
    let result = typeStr + ':';
    if (part) {
      result += ' ' + part;
    }
    return result;
  },
  colonCharCode: ':'.charCodeAt(0),
  fromStr(str: string): Condition | null {
    str = str.trim();
    let i = str.indexOf(' ');
    if (i < 0) {
      i = str.length;
    }
    let conditionType;
    if (str.charCodeAt(i - 1) === ConditionsApi.colonCharCode) {
      conditionType = str.slice(0, i - 1);
      str = str.slice(i + 1).trim();
    } else {
      conditionType = '';
    }
    conditionType = ConditionsApi.typeFromAbbr(conditionType);
    if (!conditionType) {
      return null;
    }
    const condition: Condition = {
      conditionType: conditionType
    };
    const fromStr = ConditionsApi._handler(condition.conditionType).fromStr;
    if (fromStr) {
      return fromStr.call(ConditionsApi, str, condition);
    } else {
      condition.pattern = str;
      return condition;
    }
  },
  _abbrs: null,
  typeFromAbbr(abbr: string): string | undefined {
    if (!ConditionsApi._abbrs) {
      ConditionsApi._abbrs = {};
      const ref1 = ConditionsApi._conditionTypes;
      for (const type in ref1) {
        if (!hasProp.call(ref1, type)) continue;
        const abbrs = ref1[type].abbrs;
        ConditionsApi._abbrs[type.toUpperCase()] = type;
        for (const ab of abbrs) {
          ConditionsApi._abbrs[ab.toUpperCase()] = type;
        }
      }
    }
    return ConditionsApi._abbrs[abbr.toUpperCase()];
  },
  comment(comment: string | null | undefined, node: PacAstNode): PacAstNode {
    if (!comment) {
      return node;
    }
    return Ast.addComment(node, comment);
  },
  safeRegex(expr: string): RegExp {
    try {
      return new RegExp(expr);
    } catch (error) {
      return /(?!)/;
    }
  },
  regTest(expr: string | PacAstNode, regexp: string | RegExp): PacAstNode {
    if (typeof regexp === 'string') {
      regexp = ConditionsApi.safeRegex(escapeSlash(regexp));
    }
    if (typeof expr === 'string') {
      expr = Ast.symbol(expr);
    }
    return Ast.call(Ast.dot(Ast.regexp(regexp), 'test'), [expr]);
  },
  isInt(num: unknown): num is number {
    return typeof num === 'number' && !isNaN(num) && parseFloat(String(num)) === parseInt(String(num), 10);
  },
  between(val: PacAstNode, min: any, max: any, comment?: string): PacAstNode {
    if (min === max) {
      if (typeof min === 'number') {
        min = Ast.num(min);
      }
      return ConditionsApi.comment(comment, Ast.binary(val, '===', min));
    }
    if (min > max) {
      return ConditionsApi.comment(comment, Ast.falseNode());
    }
    if (ConditionsApi.isInt(min) && ConditionsApi.isInt(max) && max - min < 32) {
      comment || (comment = min + " <= value && value <= " + max);
      const tmpl = "0123456789abcdefghijklmnopqrstuvwxyz";
      const str = max < tmpl.length ? tmpl.slice(min, max + 1) : tmpl.slice(0, max - min + 1);
      const pos = min === 0 ? val : Ast.binary(val, '-', Ast.num(min));
      return ConditionsApi.comment(comment, Ast.binary(
        Ast.call(Ast.dot(Ast.str(str), 'charCodeAt'), [pos]),
        '>',
        Ast.num(0)
      ));
    }
    if (typeof min === 'number') {
      min = Ast.num(min);
    }
    if (typeof max === 'number') {
      max = Ast.num(max);
    }
    return ConditionsApi.comment(comment, Ast.call(Ast.fn(['value', 'min', 'max'], [
      Ast.returnStmt(Ast.binary(
        Ast.binary(Ast.symbol('min'), '<=', Ast.symbol('value')),
        '&&',
        Ast.binary(Ast.symbol('value'), '<=', Ast.symbol('max'))
      ))
    ]), [val, min, max]));
  },
  parseIp(ip: string): IpAddress | null {
    if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
      if (ip.charCodeAt(ip.length - 1) !== ']'.charCodeAt(0)) {
        return null;
      }
      ip = ip.slice(1, -1);
    }
    if (Address4.isValid(ip)) {
      return new Address4(ip);
    }
    if (Address6.isValid(ip)) {
      return new Address6(ip);
    }
    return null;
  },
  parseIpHost(host: string): IpAddress | null {
    if (host.charCodeAt(0) === '['.charCodeAt(0)) {
      const end = host.indexOf(']');
      if (end !== host.length - 1) {
        return null;
      }
    }
    return ConditionsApi.parseIp(host);
  },
  normalizeIp(addr: IpAddress): string {
    return addr.correctForm();
  },
  _parseBypassHostPort(server: string): ParsedBypassHostPort {
    if (server.charCodeAt(0) === '['.charCodeAt(0)) {
      const end = server.indexOf(']');
      if (end >= 0) {
        const host = server.slice(0, end + 1);
        const rest = server.slice(end + 1);
        if (rest.charCodeAt(0) === ConditionsApi.colonCharCode && rest.length > 1) {
          return {
            host,
            port: rest.slice(1),
            valid: true
          };
        }
        if (rest.charCodeAt(0) === '/'.charCodeAt(0)) {
          return {
            host: host + rest,
            port: null,
            valid: true
          };
        }
        return {
          host,
          port: null,
          valid: rest.length === 0
        };
      }
      return {
        host: server,
        port: null,
        valid: false
      };
    }
    const addr = ConditionsApi.parseIp(server);
    if (addr != null && !isIpv4Address(addr)) {
      return {
        host: server,
        port: null,
        valid: true
      };
    }
    const pos = server.lastIndexOf(':');
    if (pos >= 0 && server.indexOf(':') === pos) {
      if (pos === server.length - 1) {
        return {
          host: server.substring(0, pos),
          port: null,
          valid: false
        };
      }
      return {
        host: server.substring(0, pos),
        port: server.substring(pos + 1),
        valid: true
      };
    }
    return {
      host: server,
      port: null,
      valid: true
    };
  },
  _parseBypassPattern(pattern: string): ParsedBypassPattern {
    const result: ParsedBypassPattern = {
      host: pattern,
      port: null,
      scheme: null,
      valid: true
    };
    const schemeIndex = pattern.indexOf('://');
    if (schemeIndex >= 0) {
      result.scheme = pattern.slice(0, schemeIndex).toLowerCase();
      result.valid = /^[a-z][a-z0-9+.-]*$/i.test(result.scheme);
      pattern = pattern.slice(schemeIndex + 3);
    }
    const hostPort = ConditionsApi._parseBypassHostPort(pattern);
    result.host = hostPort.host;
    result.port = hostPort.port;
    result.valid = result.valid && hostPort.valid && ConditionsApi._portIsValid(hostPort.port);
    return result;
  },
  _normalizeDomainHost(host: string): string | null {
    if (!host || /[\s:/?#@\[\]]/.test(host)) {
      return null;
    }
    try {
      return new URL('http://' + host + '/').hostname.toLowerCase();
    } catch (error) {
      return null;
    }
  },
  _normalizeDomainPattern(pattern: string): NormalizedDomainPattern {
    if (!pattern || /\s/.test(pattern)) {
      return {
        pattern,
        valid: false
      };
    }
    let prefix = '';
    if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
      prefix = '*';
      pattern = prefix + pattern;
    }
    const wildcardMatch = /[?*]/.exec(pattern);
    if (wildcardMatch == null) {
      const host = ConditionsApi._normalizeDomainHost(pattern);
      return {
        pattern: host || pattern,
        valid: host != null
      };
    }
    if (pattern.indexOf('?') < 0) {
      const leadingAsterisk = /^\*+/.exec(pattern);
      const trailingAsterisk = /\*+$/.exec(pattern);
      const leading = leadingAsterisk != null ? leadingAsterisk[0] : '';
      const trailing = trailingAsterisk != null ? trailingAsterisk[0] : '';
      const core = pattern.slice(leading.length, pattern.length - trailing.length);
      if ((leading || trailing) && core.indexOf('*') < 0) {
        if (!core) {
          return {
            pattern,
            valid: true
          };
        }
        if (core.charCodeAt(0) !== '.'.charCodeAt(0)) {
          const host = ConditionsApi._normalizeDomainHost(core);
          return {
            pattern: host != null ? leading + host + trailing : pattern,
            valid: host != null
          };
        }
      }
    }
    const wildcardIndex = wildcardMatch.index;
    const hostStart = pattern.slice(0, wildcardIndex).lastIndexOf('.') + 1;
    const labelEndRelative = pattern.slice(wildcardIndex).indexOf('.');
    const hostEnd = labelEndRelative < 0 ? pattern.length : wildcardIndex + labelEndRelative;
    const wildcardLabel = pattern.slice(hostStart, hostEnd);
    if (/[^\x00-\x7f]/.test(wildcardLabel)) {
      return {
        pattern,
        valid: false
      };
    }
    let normalized = pattern;
    if (hostStart > 0) {
      const host = ConditionsApi._normalizeDomainHost(pattern.slice(0, hostStart - 1));
      if (host == null) {
        return {
          pattern,
          valid: false
        };
      }
      normalized = host + pattern.slice(hostStart - 1);
    }
    if (hostEnd < pattern.length - 1) {
      const suffix = ConditionsApi._normalizeDomainHost(pattern.slice(hostEnd + 1));
      if (suffix == null) {
        return {
          pattern,
          valid: false
        };
      }
      normalized = normalized.slice(0, hostEnd + 1) + suffix;
    }
    if (hostStart === 0 && hostEnd === pattern.length) {
      return {
        pattern,
        valid: true
      };
    }
    try {
      new URL('http://' + normalized.replace(/[?*]+/g, 'a') + '/');
    } catch (error) {
      return {
        pattern,
        valid: false
      };
    }
    return {
      pattern: normalized.toLowerCase(),
      valid: true
    };
  },
  _normalizeIpWildcardPattern(pattern: string): string | null {
    if (pattern.charCodeAt(0) === '['.charCodeAt(0) && pattern.charCodeAt(pattern.length - 1) === ']'.charCodeAt(0)) {
      pattern = pattern.slice(1, -1);
    }
    if (pattern.indexOf(':') < 0 || !/[?*]/.test(pattern)) {
      return null;
    }
    if (!/^[0-9a-f:.?*]+$/i.test(pattern)) {
      return null;
    }
    return pattern.toLowerCase();
  },
  _hostRegex(pattern: string): RegExp {
    if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
      pattern = '*' + pattern;
    }
    return ConditionsApi.safeRegex(shExp2RegExp(pattern, {
      trimAsterisk: true
    }));
  },
  _hostPortMatches(pattern: ParsedBypassPattern, request: PacRequest): boolean {
    if (pattern.scheme != null && pattern.scheme !== request.scheme) {
      return false;
    }
    return pattern.port == null || pattern.port === (request.port || '');
  },
  _portIsValid(port: string | null): boolean {
    if (port == null) {
      return true;
    }
    if (!/^\d+$/.test(port)) {
      return false;
    }
    const value = Number(port);
    return value > 0 && value <= 65535;
  },
  _portEqualsAst(port: string): PacAstNode {
    return Ast.binary(Ast.symbol('port'), '===', Ast.str(port));
  },
  _hostIsLocalAst(): PacAstNode {
    return Ast.binary(
      Ast.binary(Ast.call(Ast.dot(Ast.symbol('host'), 'indexOf'), [Ast.str('.')]), '<', Ast.num(0)),
      '&&',
      Ast.binary(Ast.call(Ast.dot(Ast.symbol('host'), 'indexOf'), [Ast.str(':')]), '<', Ast.num(0))
    );
  },
  ipv6Max: new Address6('::/0').endAddress().correctForm(),
  localHosts: ["127.0.0.1", "[::1]", "localhost"],
  getWeekdayList(condition: Condition): boolean[] {
    if (condition.days) {
      const results = [];
      for (let i = 0; i < 7; i++) {
        results.push(condition.days.charCodeAt(i) > 64);
      }
      return results;
    } else {
      const results1 = [];
      for (let i = 0; i < 7; i++) {
        results1.push((condition.startDay <= i && i <= condition.endDay));
      }
      return results1;
    }
  },
  _condCache: new AttachedCache((condition) => {
    const typedCondition = condition as Condition;
    const tag = ConditionsApi._handler(typedCondition.conditionType).tag;
    const result = tag ? tag.call(ConditionsApi, typedCondition) : ConditionsApi.str(typedCondition);
    return typedCondition.conditionType + '$' + result;
  }),
  _setProp(obj: Record<string, any>, prop: string, value: unknown): unknown {
    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
      Object.defineProperty(obj, prop, {
        writable: true
      });
    }
    return obj[prop] = value;
  },
  _handler(conditionType: string | Condition): ConditionHandler {
    if (typeof conditionType !== 'string') {
      conditionType = conditionType.conditionType;
    }
    const handler = ConditionsApi._conditionTypes[conditionType];
    if (handler == null) {
      throw new Error("Unknown condition type: " + conditionType);
    }
    return handler;
  },
  _conditionTypes: {
    'TrueCondition': {
      abbrs: ['True'],
      analyze(condition) {
        return null;
      },
      match() {
        return true;
      },
      compile(condition) {
        return Ast.trueNode();
      },
      str(condition) {
        return '';
      },
      fromStr(str, condition) {
        return condition;
      }
    },
    'FalseCondition': {
      abbrs: ['False', 'Disabled'],
      analyze(condition) {
        return null;
      },
      match() {
        return false;
      },
      compile(condition) {
        return Ast.falseNode();
      },
      fromStr(str, condition) {
        if (str.length > 0) {
          condition.pattern = str;
        }
        return condition;
      }
    },
    'UrlRegexCondition': {
      abbrs: ['UR', 'URegex', 'UrlR', 'UrlRegex'],
      analyze(condition) {
        return this.safeRegex(escapeSlash(condition.pattern));
      },
      match(condition, request, cache) {
        return cache.analyzed.test(request.url);
      },
      compile(condition, cache) {
        return this.regTest('url', cache.analyzed);
      }
    },
    'UrlWildcardCondition': {
      abbrs: ['U', 'UW', 'Url', 'UrlW', 'UWild', 'UWildcard', 'UrlWild', 'UrlWildcard'],
      analyze(condition) {
        const parts = [];
        for (const pattern of condition.pattern.split('|')) {
          if (pattern) {
            parts.push(shExp2RegExp(pattern, {
              trimAsterisk: true
            }));
          }
        }
        return this.safeRegex(parts.join('|'));
      },
      match(condition, request, cache) {
        return cache.analyzed.test(request.url);
      },
      compile(condition, cache) {
        return this.regTest('url', cache.analyzed);
      }
    },
    'HostRegexCondition': {
      abbrs: ['R', 'HR', 'Regex', 'HostR', 'HRegex', 'HostRegex'],
      analyze(condition) {
        return this.safeRegex(escapeSlash(condition.pattern));
      },
      match(condition, request, cache) {
        return cache.analyzed.test(request.host);
      },
      compile(condition, cache) {
        return this.regTest('host', cache.analyzed);
      }
    },
    'HostWildcardCondition': {
      abbrs: ['', 'H', 'W', 'HW', 'Wild', 'Wildcard', 'Host', 'HostW', 'HWild', 'HWildcard', 'HostWild', 'HostWildcard'],
      analyze(condition) {
        const parts = [];
        for (let pattern of condition.pattern.split('|')) {
          if (!(pattern)) {
            continue;
          }
          const addr = this.parseIpHost(pattern);
          if (addr != null) {
            pattern = this.normalizeIp(addr);
          } else {
            const ipWildcard = this._normalizeIpWildcardPattern(pattern);
            if (ipWildcard != null) {
              pattern = ipWildcard;
            } else {
              const normalized = this._normalizeDomainPattern(pattern);
              if (!normalized.valid) {
                continue;
              }
              pattern = normalized.pattern;
            }
          }
          if (pattern.indexOf('**.') === 0) {
            parts.push(shExp2RegExp(pattern.substring(1), {
              trimAsterisk: true
            }));
          } else if (pattern.indexOf('*.') === 0) {
            parts.push(shExp2RegExp(pattern.substring(2), {
              trimAsterisk: false
            }).replace(/./, '(?:^|\\.)').replace(/\.\*\$$/, ''));
          } else {
            parts.push(shExp2RegExp(pattern, {
              trimAsterisk: true
            }));
          }
        }
        return this.safeRegex(parts.length > 0 ? parts.join('|') : '(?!)');
      },
      match(condition, request, cache) {
        return cache.analyzed.test(request.host);
      },
      compile(condition, cache) {
        return this.regTest('host', cache.analyzed);
      },
      str(condition) {
        const patterns = [];
        for (const pattern of condition.pattern.split('|')) {
          if (!pattern) {
            continue;
          }
          const addr = this.parseIpHost(pattern);
          if (addr != null) {
            patterns.push(this.normalizeIp(addr));
          } else {
            const ipWildcard = this._normalizeIpWildcardPattern(pattern);
            if (ipWildcard != null) {
              patterns.push(ipWildcard);
            } else {
              const normalized = this._normalizeDomainPattern(pattern);
              patterns.push(normalized.valid ? normalized.pattern : pattern);
            }
          }
        }
        return patterns.join('|');
      }
    },
    'BypassCondition': {
      abbrs: ['B', 'Bypass'],
      analyze(condition) {
        const cache: ConditionCache = {
          hostRegex: null,
          ip: null,
          kind: null,
          pattern: null,
          normalizedPattern: ''
        };
        const originalPattern = (condition.pattern || '').trim();
        if (originalPattern === '<local>') {
          cache.kind = 'local';
          cache.pattern = {
            host: originalPattern,
            port: null,
            scheme: null,
            valid: true
          };
          return cache;
        }
        const pattern = this._parseBypassPattern(originalPattern);
        cache.pattern = pattern;
        if (!pattern.valid) {
          cache.kind = 'invalid';
          return cache;
        }
        const normalizedPrefix = pattern.scheme != null ? pattern.scheme + '://' : '';
        cache.normalizedPattern = normalizedPrefix;
        const slashIndex = pattern.host.lastIndexOf('/');
        if (slashIndex >= 0 && pattern.port == null) {
          const host = pattern.host.slice(0, slashIndex);
          const prefixText = pattern.host.slice(slashIndex + 1);
          const prefixLen = parseInt(prefixText, 10);
          const addr = /^\d+$/.test(prefixText) ? this.parseIpHost(host) : null;
          if (addr && prefixLen >= 0 && prefixLen <= (isIpv4Address(addr) ? 32 : 128)) {
            cache.ip = {
              conditionType: 'IpCondition',
              ip: this.normalizeIp(addr),
              prefixLength: prefixLen
            };
            const normalizedHost = isIpv4Address(addr) ? cache.ip.ip : '[' + cache.ip.ip + ']';
            cache.normalizedPattern += normalizedHost + '/' + cache.ip.prefixLength;
            cache.kind = isIpv4Address(addr) ? 'ipv4Cidr' : 'ipv6Cidr';
            return cache;
          }
          cache.kind = 'invalid';
          cache.normalizedPattern = '';
          return cache;
        }

        const addr = this.parseIpHost(pattern.host);
        if (addr != null) {
          const normalizedIp = this.normalizeIp(addr);
          const bracketed = isIpv4Address(addr) ? normalizedIp : '[' + normalizedIp + ']';
          cache.ip = {
            conditionType: 'IpCondition',
            ip: normalizedIp,
            prefixLength: isIpv4Address(addr) ? 32 : 128
          };
          cache.kind = isIpv4Address(addr) ? 'ipv4Literal' : 'ipv6Literal';
          cache.normalizedPattern += bracketed;
          if (pattern.port) {
            cache.normalizedPattern += ':' + pattern.port;
          }
        } else {
          const ipWildcard = this._normalizeIpWildcardPattern(pattern.host);
          const normalized = ipWildcard == null ? this._normalizeDomainPattern(pattern.host) : null;
          if (ipWildcard == null && !normalized.valid) {
            cache.kind = 'invalid';
            cache.normalizedPattern = '';
            return cache;
          }
          const host = ipWildcard != null ? ipWildcard : normalized.pattern;
          cache.kind = host.indexOf('*') >= 0 || host.indexOf('?') >= 0 ? 'domainWildcard' : 'domainExact';
          cache.hostRegex = this._hostRegex(host);
          cache.normalizedPattern += host;
          if (pattern.port) {
            cache.normalizedPattern += ':' + pattern.port;
          }
        }
        return cache;
      },
      match(condition, request, cache) {
        cache = cache.analyzed;
        const pattern = cache.pattern;
        if (cache.kind === 'invalid' || pattern == null || !pattern.valid) {
          return false;
        }
        if (!this._hostPortMatches(pattern, request)) {
          return false;
        }
        switch (cache.kind) {
          case 'local':
            return request.host.indexOf('.') < 0 && request.host.indexOf(':') < 0;
          case 'ipv4Literal':
          case 'ipv6Literal':
          case 'ipv4Cidr':
          case 'ipv6Cidr':
            return this.match(cache.ip, request);
          case 'domainExact':
          case 'domainWildcard':
            return cache.hostRegex.test(request.host);
          default:
            return false;
        }
      },
      str(condition) {
        const analyze = this._handler(condition).analyze;
        const cache = analyze.call(ConditionsApi, condition);
        if (cache.normalizedPattern) {
          return cache.normalizedPattern;
        } else {
          return condition.pattern;
        }
      },
      compile(condition, cache) {
        cache = cache.analyzed;
        const pattern = cache.pattern;
        if (cache.kind === 'invalid' || pattern == null || !pattern.valid) {
          return Ast.falseNode();
        }
        const conditions = [];
        if (pattern.scheme != null) {
          conditions.push(Ast.binary(Ast.symbol('scheme'), '===', Ast.str(pattern.scheme)));
        }
        if (pattern.port != null) {
          conditions.push(this._portEqualsAst(pattern.port));
        }
        switch (cache.kind) {
          case 'local':
            conditions.push(this._hostIsLocalAst());
            break;
          case 'ipv4Literal':
          case 'ipv6Literal':
            conditions.push(Ast.binary(Ast.symbol('host'), '===', Ast.str(cache.ip.ip)));
            break;
          case 'ipv4Cidr':
          case 'ipv6Cidr':
            conditions.push(this.compile(cache.ip));
            break;
          case 'domainExact':
          case 'domainWildcard':
            conditions.push(this.regTest('host', cache.hostRegex));
            break;
        }
        if (conditions.length === 0) {
          return Ast.trueNode();
        }
        let result = conditions[0];
        for (let i = 1; i < conditions.length; i++) {
          result = Ast.binary(result, '&&', conditions[i]);
        }
        return result;
      }
    },
    'KeywordCondition': {
      abbrs: ['K', 'KW', 'Keyword'],
      analyze(condition) {
        return null;
      },
      match(condition, request) {
        return request.scheme === 'http' && request.url.indexOf(condition.pattern) >= 0;
      },
      compile(condition) {
        return Ast.binary(
          Ast.binary(Ast.symbol('scheme'), '===', Ast.str('http')),
          '&&',
          Ast.binary(
            Ast.call(Ast.dot(Ast.symbol('url'), 'indexOf'), [Ast.str(condition.pattern)]),
            '>=',
            Ast.num(0)
          )
        );
      }
    },
    'IpCondition': {
      abbrs: ['Ip'],
      analyze(condition) {
        const cache: ConditionCache = {
          addr: null,
          invalid: false,
          mask: null,
          normalized: null
        };
        let ip = condition.ip;
        if (typeof ip !== 'string') {
          cache.invalid = true;
          return cache;
        }
        if (ip.charCodeAt(0) === '['.charCodeAt(0) && ip.charCodeAt(ip.length - 1) === ']'.charCodeAt(0)) {
          ip = ip.slice(1, -1);
        }
        const addr = ip + '/' + condition.prefixLength;
        cache.addr = this.parseIp(addr);
        if (cache.addr == null) {
          cache.invalid = true;
          return cache;
        }
        cache.normalized = this.normalizeIp(cache.addr);
        cache.mask = this.normalizeIp(cache.addr.subnetMaskAddress());
        return cache;
      },
      match(condition, request, cache) {
        const addr = this.parseIp(request.host);
        if (addr == null) {
          return false;
        }
        cache = cache.analyzed;
        if (cache.invalid) {
          return false;
        }
        if (isIpv4Address(addr) !== isIpv4Address(cache.addr)) {
          return false;
        }
        return addr.isInSubnet(cache.addr);
      },
      compile(condition, cache) {
        cache = cache.analyzed;
        if (cache.invalid) {
          return Ast.falseNode();
        }
        const hostLooksLikeIp = isIpv4Address(cache.addr)
          ? Ast.binary(
            Ast.sub(
              Ast.symbol('host'),
              Ast.binary(Ast.dot(Ast.symbol('host'), 'length'), '-', Ast.num(1))
            ),
            '>=',
            Ast.num(0)
          )
          : Ast.binary(
            Ast.call(Ast.dot(Ast.symbol('host'), 'indexOf'), [Ast.str(':')]),
            '>=',
            Ast.num(0)
          );
        if (cache.addr.subnetMask === 0) {
          return hostLooksLikeIp;
        }
        let hostIsInNet = Ast.call(Ast.symbol('isInNet'), [
          Ast.symbol('host'),
          Ast.str(cache.normalized),
          Ast.str(cache.mask)
        ]);
        if (!isIpv4Address(cache.addr)) {
          const hostIsInNetEx = Ast.call(Ast.symbol('isInNetEx'), [
            Ast.symbol('host'),
            Ast.str(cache.normalized + cache.addr.subnet)
          ]);
          hostIsInNet = Ast.conditional(
            Ast.binary(Ast.unaryPrefix('typeof', Ast.symbol('isInNetEx')), '===', Ast.str('function')),
            hostIsInNetEx,
            hostIsInNet
          );
        }
        return Ast.binary(hostLooksLikeIp, '&&', hostIsInNet);
      },
      str(condition) {
        const addr = this.parseIp(condition.ip + '/' + condition.prefixLength);
        if (addr != null) {
          return this.normalizeIp(addr) + '/' + addr.subnetMask;
        }
        if (condition.prefixLength === 128 && typeof condition.ip === 'string') {
          return condition.ip;
        }
        return condition.ip + '/' + condition.prefixLength;
      },
      fromStr(str, condition) {
        const addr = this.parseIp(str);
        if (addr != null) {
          condition.ip = this.normalizeIp(addr);
          condition.prefixLength = addr.subnetMask;
        } else {
          condition.ip = str;
          condition.prefixLength = 128;
        }
        return condition;
      }
    },
    'HostLevelsCondition': {
      abbrs: ['Lv', 'Level', 'Levels', 'HL', 'HLv', 'HLevel', 'HLevels', 'HostL', 'HostLv', 'HostLevel', 'HostLevels'],
      analyze(condition) {
        return '.'.charCodeAt(0);
      },
      match(condition, request, cache) {
        const dotCharCode = cache.analyzed;
        let dotCount = 0;
        for (let i = 0; i < request.host.length; i++) {
          if (request.host.charCodeAt(i) === dotCharCode) {
            dotCount++;
            if (dotCount > condition.maxValue) {
              return false;
            }
          }
        }
        return dotCount >= condition.minValue;
      },
      compile(condition) {
        const val = Ast.dot(
          Ast.call(Ast.dot(Ast.symbol('host'), 'split'), [Ast.str('.')]),
          'length'
        );
        return this.between(val, condition.minValue + 1, condition.maxValue + 1, condition.minValue + " <= hostLevels <= " + condition.maxValue);
      },
      str(condition) {
        return condition.minValue + '~' + condition.maxValue;
      },
      fromStr(str, condition) {
        const [minValue, maxValue] = str.split('~');
        condition.minValue = parseInt(minValue, 10);
        condition.maxValue = parseInt(maxValue, 10);
        if (!(condition.minValue > 0)) {
          condition.minValue = 1;
        }
        if (!(condition.maxValue > 0)) {
          condition.maxValue = 1;
        }
        return condition;
      }
    },
    'WeekdayCondition': {
      abbrs: ['WD', 'Week', 'Day', 'Weekday'],
      analyze(condition) {
        return null;
      },
      match(condition, request) {
        const day = new Date().getDay();
        if (condition.days) {
          return condition.days.charCodeAt(day) > 64;
        }
        return condition.startDay <= day && day <= condition.endDay;
      },
      compile(condition) {
        const getDay = Ast.call(Ast.dot(Ast.newExpr(Ast.symbol('Date')), 'getDay'));
        if (condition.days) {
          return Ast.binary(
            Ast.call(Ast.dot(Ast.str(condition.days), 'charCodeAt'), [getDay]),
            '>',
            Ast.num(64)
          );
        } else {
          return this.between(getDay, condition.startDay, condition.endDay);
        }
      },
      str(condition) {
        if (condition.days) {
          return condition.days;
        } else {
          return condition.startDay + '~' + condition.endDay;
        }
      },
      fromStr(str, condition) {
        if (str.indexOf('~') < 0 && str.length === 7) {
          condition.days = str;
        } else {
          const [startDay, endDay] = str.split('~');
          condition.startDay = parseInt(startDay, 10);
          condition.endDay = parseInt(endDay, 10);
          if (!((0 <= condition.startDay && condition.startDay <= 6))) {
            condition.startDay = 0;
          }
          if (!((0 <= condition.endDay && condition.endDay <= 6))) {
            condition.endDay = 0;
          }
        }
        return condition;
      }
    },
    'TimeCondition': {
      abbrs: ['T', 'Time', 'Hour'],
      analyze(condition) {
        return null;
      },
      match(condition, request) {
        const hour = new Date().getHours();
        return condition.startHour <= hour && hour <= condition.endHour;
      },
      compile(condition) {
        const val = Ast.call(Ast.dot(Ast.newExpr(Ast.symbol('Date')), 'getHours'));
        return this.between(val, condition.startHour, condition.endHour);
      },
      str(condition) {
        return condition.startHour + '~' + condition.endHour;
      },
      fromStr(str, condition) {
        const [startHour, endHour] = str.split('~');
        condition.startHour = parseInt(startHour, 10);
        condition.endHour = parseInt(endHour, 10);
        if (!((0 <= condition.startHour && condition.startHour < 24))) {
          condition.startHour = 0;
        }
        if (!((0 <= condition.endHour && condition.endHour < 24))) {
          condition.endHour = 0;
        }
        return condition;
      }
    }
  }
};

export default ConditionsApi;
