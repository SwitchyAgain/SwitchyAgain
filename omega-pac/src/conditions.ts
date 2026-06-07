import type {Condition, PacRequest} from './types';
import type {AttachedCache as AttachedCacheType} from './utils';
import U2 from './uglifyjs_shim';
import IP from 'ip-address';
import Url from 'url';
import {escapeSlash, shExp2RegExp} from './shexp_utils';
import {AttachedCache} from './utils';

const hasProp = Object.prototype.hasOwnProperty;

type ConditionCache = {
  analyzed?: any;
  compiled?: any;
  [key: string]: any;
};

type ParsedUrl = {
  hostname: string;
  protocol: string;
  [key: string]: unknown;
};

type UglifyNode = any;

type IpAddress = any;

type ConditionHandler = {
  abbrs: string[];
  analyze(this: ConditionsApiType, condition: Condition): any;
  compile?(this: ConditionsApiType, condition: Condition, cache: ConditionCache): UglifyNode;
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
  _setProp(obj: Record<string, any>, prop: string, value: unknown): unknown;
  analyze(condition: Condition): ConditionCache;
  between(val: UglifyNode, min: any, max: any, comment?: string): UglifyNode;
  colonCharCode: number;
  comment(comment: string | null | undefined, node: UglifyNode): UglifyNode;
  compile(condition: Condition): UglifyNode;
  fromStr(str: string): Condition | null;
  getWeekdayList(condition: Condition): boolean[];
  ipv6Max: string;
  isInt(num: unknown): num is number;
  localHosts: string[];
  match(condition: Condition, request: PacRequest): boolean;
  normalizeIp(addr: IpAddress): string;
  parseIp(ip: string): IpAddress | null;
  regTest(expr: string | UglifyNode, regexp: string | RegExp): UglifyNode;
  requestFromUrl(url: string | ParsedUrl): PacRequest;
  safeRegex(expr: string): RegExp;
  str(condition: Condition, arg?: {abbr?: number}): string;
  tag(condition: Condition): unknown;
  typeFromAbbr(abbr: string): string | undefined;
  urlWildcard2HostWildcard(pattern: string): string | undefined;
};

const ConditionsApi: ConditionsApiType = {
  requestFromUrl(url: string | ParsedUrl): PacRequest {
    const parsedUrl = typeof url === 'string' ? Url.parse(url) as ParsedUrl : url;
    return {
      url: Url.format(parsedUrl),
      host: parsedUrl.hostname,
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
  compile(condition: Condition): UglifyNode {
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
    if (handler.abbrs[0].length === 0) {
      const endCode = condition.pattern.charCodeAt(condition.pattern.length - 1);
      if (endCode !== ConditionsApi.colonCharCode && condition.pattern.indexOf(' ') < 0) {
        return condition.pattern;
      }
    }
    const str = handler.str;
    const typeStr = typeof abbr === 'number' ? handler.abbrs[(handler.abbrs.length + abbr) % handler.abbrs.length] : condition.conditionType;
    let result = typeStr + ':';
    const part = str ? str.call(ConditionsApi, condition) : condition.pattern;
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
  comment(comment: string | null | undefined, node: UglifyNode): UglifyNode {
    if (!comment) {
      return node;
    }
    if (node.start == null) {
      node.start = {};
    }
    Object.defineProperty(node.start, '_comments_dumped', {
      get() {
        return false;
      },
      set() {
        return false;
      }
    });
    if (node.start.comments_before == null) {
      node.start.comments_before = [];
    }
    node.start.comments_before.push({
      type: 'comment2',
      value: comment
    });
    return node;
  },
  safeRegex(expr: string): RegExp {
    try {
      return new RegExp(expr);
    } catch (error) {
      return /(?!)/;
    }
  },
  regTest(expr: string | UglifyNode, regexp: string | RegExp): UglifyNode {
    if (typeof regexp === 'string') {
      regexp = ConditionsApi.safeRegex(escapeSlash(regexp));
    }
    if (typeof expr === 'string') {
      expr = new U2.AST_SymbolRef({
        name: expr
      });
    }
    return new U2.AST_Call({
      args: [expr],
      expression: new U2.AST_Dot({
        property: 'test',
        expression: new U2.AST_RegExp({
          value: regexp
        })
      })
    });
  },
  isInt(num: unknown): num is number {
    return typeof num === 'number' && !isNaN(num) && parseFloat(String(num)) === parseInt(String(num), 10);
  },
  between(val: UglifyNode, min: any, max: any, comment?: string): UglifyNode {
    if (min === max) {
      if (typeof min === 'number') {
        min = new U2.AST_Number({
          value: min
        });
      }
      return ConditionsApi.comment(comment, new U2.AST_Binary({
        left: val,
        operator: '===',
        right: min
      }));
    }
    if (min > max) {
      return ConditionsApi.comment(comment, new U2.AST_False);
    }
    if (ConditionsApi.isInt(min) && ConditionsApi.isInt(max) && max - min < 32) {
      comment || (comment = min + " <= value && value <= " + max);
      const tmpl = "0123456789abcdefghijklmnopqrstuvwxyz";
      const str = max < tmpl.length ? tmpl.slice(min, max + 1) : tmpl.slice(0, max - min + 1);
      const pos = min === 0 ? val : new U2.AST_Binary({
        left: val,
        operator: '-',
        right: new U2.AST_Number({
          value: min
        })
      });
      return ConditionsApi.comment(comment, new U2.AST_Binary({
        left: new U2.AST_Call({
          expression: new U2.AST_Dot({
            expression: new U2.AST_String({
              value: str
            }),
            property: 'charCodeAt'
          }),
          args: [pos]
        }),
        operator: '>',
        right: new U2.AST_Number({
          value: 0
        })
      }));
    }
    if (typeof min === 'number') {
      min = new U2.AST_Number({
        value: min
      });
    }
    if (typeof max === 'number') {
      max = new U2.AST_Number({
        value: max
      });
    }
    return ConditionsApi.comment(comment, new U2.AST_Call({
      args: [val, min, max],
      expression: new U2.AST_Function({
        argnames: [
          new U2.AST_SymbolFunarg({
            name: 'value'
          }), new U2.AST_SymbolFunarg({
            name: 'min'
          }), new U2.AST_SymbolFunarg({
            name: 'max'
          })
        ],
        body: [
          new U2.AST_Return({
            value: new U2.AST_Binary({
              left: new U2.AST_Binary({
                left: new U2.AST_SymbolRef({
                  name: 'min'
                }),
                operator: '<=',
                right: new U2.AST_SymbolRef({
                  name: 'value'
                })
              }),
              operator: '&&',
              right: new U2.AST_Binary({
                left: new U2.AST_SymbolRef({
                  name: 'value'
                }),
                operator: '<=',
                right: new U2.AST_SymbolRef({
                  name: 'max'
                })
              })
            })
          })
        ]
      })
    }));
  },
  parseIp(ip: string): IpAddress | null {
    if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
      ip = ip.slice(1, -1);
    }
    let addr = new IP.v4.Address(ip);
    if (!addr.isValid()) {
      addr = new IP.v6.Address(ip);
      if (!addr.isValid()) {
        return null;
      }
    }
    return addr;
  },
  normalizeIp(addr: IpAddress): string {
    return (addr.correctForm != null ? addr.correctForm : addr.canonicalForm).call(addr);
  },
  ipv6Max: new IP.v6.Address('::/0').endAddress().canonicalForm(),
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
        return new U2.AST_True;
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
        return new U2.AST_False;
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
          if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
            pattern = '*' + pattern;
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
        return this.safeRegex(parts.join('|'));
      },
      match(condition, request, cache) {
        return cache.analyzed.test(request.host);
      },
      compile(condition, cache) {
        return this.regTest('host', cache.analyzed);
      }
    },
    'BypassCondition': {
      abbrs: ['B', 'Bypass'],
      analyze(condition) {
        const cache: ConditionCache = {
          host: null,
          ip: null,
          port: null,
          scheme: null,
          url: null,
          normalizedPattern: ''
        };
        let server = condition.pattern;
        if (server === '<local>') {
          cache.host = server;
          return cache;
        }
        let parts = server.split('://');
        if (parts.length > 1) {
          cache.scheme = parts[0];
          cache.normalizedPattern = cache.scheme + '://';
          server = parts[1];
        }
        parts = server.split('/');
        if (parts.length > 1) {
          const addr = this.parseIp(parts[0]);
          const prefixLen = parseInt(parts[1]);
          if (addr && !isNaN(prefixLen)) {
            cache.ip = {
              conditionType: 'IpCondition',
              ip: this.normalizeIp(addr),
              prefixLength: prefixLen
            };
            cache.normalizedPattern += cache.ip.ip + '/' + cache.ip.prefixLength;
            return cache;
          }
        }
        let serverIp = this.parseIp(server);
        let matchPort;
        if (serverIp == null) {
          const pos = server.lastIndexOf(':');
          if (pos >= 0) {
            matchPort = server.substring(pos + 1);
            server = server.substring(0, pos);
          }
          serverIp = this.parseIp(server);
        }
        if (serverIp != null) {
          server = this.normalizeIp(serverIp);
          if (serverIp.v4) {
            cache.normalizedPattern += server;
          } else {
            cache.normalizedPattern += '[' + server + ']';
          }
        } else {
          if (server.charCodeAt(0) === '.'.charCodeAt(0)) {
            server = '*' + server;
          }
          cache.normalizedPattern = server;
        }
        if (matchPort) {
          cache.port = matchPort;
          cache.normalizedPattern += ':' + cache.port;
          if ((serverIp != null) && !serverIp.v4) {
            server = '[' + server + ']';
          }
          let serverRegex = shExp2RegExp(server);
          serverRegex = serverRegex.substring(1, serverRegex.length - 1);
          const scheme = cache.scheme != null ? cache.scheme : '[^:]+';
          cache.url = this.safeRegex('^' + scheme + ':\\/\\/' + serverRegex + ':' + matchPort + '\\/');
        } else if (server !== '*') {
          const serverRegex = shExp2RegExp(server, {
            trimAsterisk: true
          });
          cache.host = this.safeRegex(serverRegex);
        }
        return cache;
      },
      match(condition, request, cache) {
        cache = cache.analyzed;
        if ((cache.scheme != null) && cache.scheme !== request.scheme) {
          return false;
        }
        if ((cache.ip != null) && !this.match(cache.ip, request)) {
          return false;
        }
        if (cache.host != null) {
          if (cache.host === '<local>') {
            return request.host === '127.0.0.1' || request.host === '::1' || request.host.indexOf('.') < 0;
          } else {
            if (!cache.host.test(request.host)) {
              return false;
            }
          }
        }
        if ((cache.url != null) && !cache.url.test(request.url)) {
          return false;
        }
        return true;
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
        if (cache.url != null) {
          return this.regTest('url', cache.url);
        }
        const conditions = [];
        if (cache.host === '<local>') {
          const hostEquals = (host: string) => {
            return new U2.AST_Binary({
              left: new U2.AST_SymbolRef({
                name: 'host'
              }),
              operator: '===',
              right: new U2.AST_String({
                value: host
              })
            });
          };
          return new U2.AST_Binary({
            left: new U2.AST_Binary({
              left: hostEquals('127.0.0.1'),
              operator: '||',
              right: hostEquals('::1')
            }),
            operator: '||',
            right: new U2.AST_Binary({
              left: new U2.AST_Call({
                expression: new U2.AST_Dot({
                  expression: new U2.AST_SymbolRef({
                    name: 'host'
                  }),
                  property: 'indexOf'
                }),
                args: [
                  new U2.AST_String({
                    value: '.'
                  })
                ]
              }),
              operator: '<',
              right: new U2.AST_Number({
                value: 0
              })
            })
          });
        }
        if (cache.scheme != null) {
          conditions.push(new U2.AST_Binary({
            left: new U2.AST_SymbolRef({
              name: 'scheme'
            }),
            operator: '===',
            right: new U2.AST_String({
              value: cache.scheme
            })
          }));
        }
        if (cache.host != null) {
          conditions.push(this.regTest('host', cache.host));
        } else if (cache.ip != null) {
          conditions.push(this.compile(cache.ip));
        }
        switch (conditions.length) {
          case 0:
            return new U2.AST_True;
          case 1:
            return conditions[0];
          case 2:
            return new U2.AST_Binary({
              left: conditions[0],
              operator: '&&',
              right: conditions[1]
            });
        }
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
        return new U2.AST_Binary({
          left: new U2.AST_Binary({
            left: new U2.AST_SymbolRef({
              name: 'scheme'
            }),
            operator: '===',
            right: new U2.AST_String({
              value: 'http'
            })
          }),
          operator: '&&',
          right: new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_SymbolRef({
                  name: 'url'
                }),
                property: 'indexOf'
              }),
              args: [
                new U2.AST_String({
                  value: condition.pattern
                })
              ]
            }),
            operator: '>=',
            right: new U2.AST_Number({
              value: 0
            })
          })
        });
      }
    },
    'IpCondition': {
      abbrs: ['Ip'],
      analyze(condition) {
        const cache: ConditionCache = {
          addr: null,
          mask: null,
          normalized: null
        };
        let ip = condition.ip;
        if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
          ip = ip.slice(1, -1);
        }
        const addr = ip + '/' + condition.prefixLength;
        cache.addr = this.parseIp(addr);
        if (cache.addr == null) {
          throw new Error("Invalid IP address " + addr);
        }
        cache.normalized = this.normalizeIp(cache.addr);
        const mask = cache.addr.v4 ? new IP.v4.Address('255.255.255.255/' + cache.addr.subnetMask) : new IP.v6.Address(this.ipv6Max + '/' + cache.addr.subnetMask);
        cache.mask = this.normalizeIp(mask.startAddress());
        return cache;
      },
      match(condition, request, cache) {
        const addr = this.parseIp(request.host);
        if (addr == null) {
          return false;
        }
        cache = cache.analyzed;
        if (addr.v4 !== cache.addr.v4) {
          return false;
        }
        return addr.isInSubnet(cache.addr);
      },
      compile(condition, cache) {
        cache = cache.analyzed;
        const hostLooksLikeIp = cache.addr.v4 ? new U2.AST_Binary({
          left: new U2.AST_Sub({
            expression: new U2.AST_SymbolRef({
              name: 'host'
            }),
            property: new U2.AST_Binary({
              left: new U2.AST_Dot({
                expression: new U2.AST_SymbolRef({
                  name: 'host'
                }),
                property: 'length'
              }),
              operator: '-',
              right: new U2.AST_Number({
                value: 1
              })
            })
          }),
          operator: '>=',
          right: new U2.AST_Number({
            value: 0
          })
        }) : new U2.AST_Binary({
          left: new U2.AST_Call({
            expression: new U2.AST_Dot({
              expression: new U2.AST_SymbolRef({
                name: 'host'
              }),
              property: 'indexOf'
            }),
            args: [
              new U2.AST_String({
                value: ':'
              })
            ]
          }),
          operator: '>=',
          right: new U2.AST_Number({
            value: 0
          })
        });
        if (cache.addr.subnetMask === 0) {
          return hostLooksLikeIp;
        }
        let hostIsInNet = new U2.AST_Call({
          expression: new U2.AST_SymbolRef({
            name: 'isInNet'
          }),
          args: [
            new U2.AST_SymbolRef({
              name: 'host'
            }), new U2.AST_String({
              value: cache.normalized
            }), new U2.AST_String({
              value: cache.mask
            })
          ]
        });
        if (!cache.addr.v4) {
          const hostIsInNetEx = new U2.AST_Call({
            expression: new U2.AST_SymbolRef({
              name: 'isInNetEx'
            }),
            args: [
              new U2.AST_SymbolRef({
                name: 'host'
              }), new U2.AST_String({
                value: cache.normalized + cache.addr.subnet
              })
            ]
          });
          hostIsInNet = new U2.AST_Conditional({
            condition: new U2.AST_Binary({
              left: new U2.AST_UnaryPrefix({
                operator: 'typeof',
                expression: new U2.AST_SymbolRef({
                  name: 'isInNetEx'
                })
              }),
              operator: '===',
              right: new U2.AST_String({
                value: 'function'
              })
            }),
            consequent: hostIsInNetEx,
            alternative: hostIsInNet
          });
        }
        return new U2.AST_Binary({
          left: hostLooksLikeIp,
          operator: '&&',
          right: hostIsInNet
        });
      },
      str(condition) {
        return condition.ip + '/' + condition.prefixLength;
      },
      fromStr(str, condition) {
        const addr = this.parseIp(str);
        if (addr != null) {
          condition.ip = addr.addressMinusSuffix;
          condition.prefixLength = addr.subnetMask;
        } else {
          condition.ip = '0.0.0.0';
          condition.prefixLength = 0;
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
        const val = new U2.AST_Dot({
          property: 'length',
          expression: new U2.AST_Call({
            args: [
              new U2.AST_String({
                value: '.'
              })
            ],
            expression: new U2.AST_Dot({
              expression: new U2.AST_SymbolRef({
                name: 'host'
              }),
              property: 'split'
            })
          })
        });
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
        const getDay = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getDay',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({
                name: 'Date'
              })
            })
          })
        });
        if (condition.days) {
          return new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_String({
                  value: condition.days
                }),
                property: 'charCodeAt'
              }),
              args: [getDay]
            }),
            operator: '>',
            right: new U2.AST_Number({
              value: 64
            })
          });
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
        const val = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getHours',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({
                name: 'Date'
              })
            })
          })
        });
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
