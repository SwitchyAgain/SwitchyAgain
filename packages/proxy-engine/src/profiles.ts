import type {
  Condition,
  OptionsMap,
  PacRequest,
  Profile,
  ProfileMatchResult,
  ProxyServer,
  ReferenceSet,
  ReferenceSetOptions,
  SwitchRule
} from './types';
import type {AttachedCache as AttachedCacheType} from './utils';
import Conditions from './conditions';
import * as RuleList from './rule_list';
import * as ShexpUtils from './shexp_utils';
import U2 from './uglifyjs_shim';
import {AttachedCache, Revision} from './utils';

const hasProp = Object.prototype.hasOwnProperty;

type UglifyNode = any;

type ProfileRecord = Profile & Record<string, any>;

type RuleListFormat = {
  detect?: (text: string) => boolean | undefined;
  directReferenceSet?: (profile: ProfileRecord) => ReferenceSet | undefined;
  parse: (
    text: string,
    matchProfileName: string,
    defaultProfileName: string,
    args?: unknown
  ) => SwitchRule[];
  preprocess?: (text: string) => string;
};

const RuleListFormats = RuleList as Record<string, RuleListFormat>;

type ProfileCache = {
  analyzed?: any;
  compiled?: any;
  directReferenceSet?: ReferenceSet;
  [key: string]: any;
};

type ProfileHandlerObject = {
  analyze?(this: ProfilesApiType, profile: ProfileRecord): any;
  compile?(this: ProfilesApiType, profile: ProfileRecord, cache: ProfileCache): UglifyNode;
  create?(this: ProfilesApiType, profile: ProfileRecord): unknown;
  directReferenceSet?(this: ProfilesApiType, profile: ProfileRecord): ReferenceSet;
  includable?: boolean | ((this: ProfilesApiType, profile: ProfileRecord) => boolean);
  inclusive?: boolean;
  match?(this: ProfilesApiType, profile: ProfileRecord, request: PacRequest, cache: ProfileCache): ProfileMatchResult;
  replaceRef?(this: ProfilesApiType, profile: ProfileRecord, fromName: string, toName: string): boolean;
  update?(this: ProfilesApiType, profile: ProfileRecord, data: any): boolean;
  updateContentTypeHints?(this: ProfilesApiType, profile: ProfileRecord): string[] | undefined;
  updateUrl?(this: ProfilesApiType, profile: ProfileRecord): string | undefined;
};

type ProfileHandler = string | ProfileHandlerObject;

type ProfileScheme = {
  prop: string;
  scheme: string;
};

type ProfilesApiType = {
  _handler(profileType: string | ProfileRecord): ProfileHandlerObject;
  _profileCache: AttachedCacheType;
  _profileTypes: Record<string, ProfileHandler>;
  allReferenceSet(profile: string | ProfileRecord, options: OptionsMap, opt_args?: ReferenceSetOptions): ReferenceSet;
  analyze(profile: ProfileRecord): ProfileCache;
  builtinProfiles: Record<string, ProfileRecord>;
  byKey(key: string | ProfileRecord, options?: OptionsMap): Profile | undefined;
  byName(profileName: string | ProfileRecord, options?: OptionsMap): Profile | undefined;
  compile(profile: ProfileRecord, opt_profileType?: string): UglifyNode;
  create(profile: string | ProfileRecord, opt_profileType?: string): Profile;
  directReferenceSet(profile: ProfileRecord): ReferenceSet;
  dropCache(profile: ProfileRecord): void;
  each(options: OptionsMap, callback: (key: string, profile: ProfileRecord) => unknown): unknown[];
  formatByType: Record<string, string>;
  isFileUrl(url?: string | null): boolean;
  isIncludable(profile: ProfileRecord): boolean;
  isInclusive(profile: ProfileRecord): boolean;
  match(profile: ProfileRecord, request: PacRequest, opt_profileType?: string): ProfileMatchResult;
  nameAsKey(profileName: string | ProfileRecord): string;
  pacProtocols: Record<string, string>;
  pacResult(proxy?: ProxyServer | null): string;
  parseHostPort(str: string, scheme: string): ProxyServer | undefined;
  profileNotFound(name: string | ProfileRecord, action?: any): Profile | null;
  profileResult(profileName: string | ProfileRecord): UglifyNode;
  referencedBySet(profile: string | ProfileRecord, options: OptionsMap, opt_args?: ReferenceSetOptions): ReferenceSet;
  replaceRef(profile: ProfileRecord, fromName: string, toName: string): boolean;
  ruleListFormats: string[];
  schemes: ProfileScheme[];
  tag(profile: ProfileRecord): unknown;
  update(profile: ProfileRecord, data: any): boolean;
  updateContentTypeHints(profile: ProfileRecord): string[] | undefined;
  updateRevision(profile: ProfileRecord, revision?: string): string;
  updateUrl(profile: ProfileRecord): string | undefined;
  validResultProfilesFor(profile: string | ProfileRecord, options: OptionsMap): Profile[];
};

class AST_Raw extends U2.AST_SymbolRef {
  aborts: () => boolean;

  constructor(raw: string) {
    super({
      name: raw
    });
    this.aborts = () => {
      return false;
    };
  }
}

const ProfilesApi: ProfilesApiType = {
  builtinProfiles: {
    '+direct': {
      name: 'direct',
      profileType: 'DirectProfile',
      color: '#aaaaaa',
      builtin: true
    },
    '+system': {
      name: 'system',
      profileType: 'SystemProfile',
      color: '#000000',
      builtin: true
    }
  },
  schemes: [
    {
      scheme: 'http',
      prop: 'proxyForHttp'
    }, {
      scheme: 'https',
      prop: 'proxyForHttps'
    }, {
      scheme: 'ftp',
      prop: 'proxyForFtp'
    }, {
      scheme: '',
      prop: 'fallbackProxy'
    }
  ],
  pacProtocols: {
    'http': 'PROXY',
    'https': 'HTTPS',
    'socks4': 'SOCKS',
    'socks5': 'SOCKS5'
  },
  formatByType: {
    'SwitchyRuleListProfile': 'Switchy',
    'AutoProxyRuleListProfile': 'AutoProxy'
  },
  ruleListFormats: ['Switchy', 'AutoProxy'],
  parseHostPort(str: string, scheme: string): ProxyServer | undefined {
    const sep = str.lastIndexOf(':');
    if (sep < 0) {
      return;
    }
    const port = parseInt(str.slice(sep + 1)) || 80;
    const host = str.slice(0, sep);
    if (!host) {
      return;
    }
    return {
      scheme: scheme,
      host: host,
      port: port
    };
  },
  pacResult(proxy?: ProxyServer | null): string {
    if (proxy) {
      if (proxy.scheme === 'socks5') {
        return "SOCKS5 " + proxy.host + ":" + proxy.port + "; SOCKS " + proxy.host + ":" + proxy.port;
      } else {
        return ProfilesApi.pacProtocols[proxy.scheme] + " " + proxy.host + ":" + proxy.port;
      }
    } else {
      return 'DIRECT';
    }
  },
  isFileUrl(url?: string | null): boolean {
    return !!((url != null ? url.slice(0, 5).toUpperCase() : void 0) === 'FILE:');
  },
  nameAsKey(profileName: string | Profile): string {
    if (typeof profileName !== 'string') {
      profileName = profileName.name;
    }
    return '+' + profileName;
  },
  byName(profileName: string | Profile, options?: OptionsMap): Profile | undefined {
    if (typeof profileName === 'string') {
      const key = ProfilesApi.nameAsKey(profileName);
      profileName = (ProfilesApi.builtinProfiles[key] != null ? ProfilesApi.builtinProfiles[key] : options != null ? options[key] : void 0) as Profile | undefined;
    }
    return profileName as Profile | undefined;
  },
  byKey(key: string | Profile, options?: OptionsMap): Profile | undefined {
    if (typeof key === 'string') {
      key = (ProfilesApi.builtinProfiles[key] != null ? ProfilesApi.builtinProfiles[key] : options != null ? options[key] : void 0) as Profile | undefined;
    }
    return key as Profile | undefined;
  },
  each(options: OptionsMap, callback: (key: string, profile: Profile) => unknown) {
    const charCodePlus = '+'.charCodeAt(0);
    for (const key in options) {
      const profile = options[key] as Profile;
      if (key.charCodeAt(0) === charCodePlus) {
        callback(key, profile);
      }
    }
    const results = [];
    for (const key in ProfilesApi.builtinProfiles) {
      const profile = ProfilesApi.builtinProfiles[key];
      if (key.charCodeAt(0) === charCodePlus) {
        results.push(callback(key, profile));
      } else {
        results.push(void 0);
      }
    }
    return results;
  },
  profileResult(profileName: string | Profile) {
    let key = ProfilesApi.nameAsKey(profileName);
    if (key === '+direct') {
      key = ProfilesApi.pacResult();
    }
    return new U2.AST_String({
      value: key
    });
  },
  isIncludable(profile: Profile): boolean {
    let includable = ProfilesApi._handler(profile).includable;
    if (typeof includable === 'function') {
      includable = includable.call(ProfilesApi, profile);
    }
    return !!includable;
  },
  isInclusive(profile: Profile): boolean {
    return !!ProfilesApi._handler(profile).inclusive;
  },
  updateUrl(profile: Profile) {
    const updateUrl = ProfilesApi._handler(profile).updateUrl;
    return updateUrl != null ? updateUrl.call(ProfilesApi, profile) : void 0;
  },
  updateContentTypeHints(profile: Profile) {
    const updateContentTypeHints = ProfilesApi._handler(profile).updateContentTypeHints;
    return updateContentTypeHints != null ? updateContentTypeHints.call(ProfilesApi, profile) : void 0;
  },
  update(profile: Profile, data: unknown): boolean {
    return ProfilesApi._handler(profile).update.call(ProfilesApi, profile, data);
  },
  tag(profile: Profile) {
    return ProfilesApi._profileCache.tag(profile);
  },
  create(profile: string | Profile, opt_profileType?: string): Profile {
    if (typeof profile === 'string') {
      profile = {
        name: profile,
        profileType: opt_profileType
      };
    } else if (opt_profileType) {
      profile.profileType = opt_profileType;
    }
    const create = ProfilesApi._handler(profile).create;
    if (!create) {
      return profile;
    }
    create.call(ProfilesApi, profile);
    return profile as Profile;
  },
  updateRevision(profile: Profile, revision?: string): string {
    if (revision == null) {
      revision = Revision.fromTime();
    }
    return profile.revision = revision;
  },
  replaceRef(profile: Profile, fromName: string, toName: string): boolean {
    if (!ProfilesApi.isInclusive(profile)) {
      return false;
    }
    const handler = ProfilesApi._handler(profile);
    return handler.replaceRef.call(ProfilesApi, profile, fromName, toName);
  },
  analyze(profile: Profile) {
    const cache = ProfilesApi._profileCache.get(profile, {}) as ProfileCache;
    if (!Object.prototype.hasOwnProperty.call(cache, 'analyzed')) {
      const analyze = ProfilesApi._handler(profile).analyze;
      const result = analyze != null ? analyze.call(ProfilesApi, profile) : void 0;
      cache.analyzed = result;
    }
    return cache;
  },
  dropCache(profile) {
    return ProfilesApi._profileCache.drop(profile);
  },
  directReferenceSet(profile: Profile): ReferenceSet {
    if (!ProfilesApi.isInclusive(profile)) {
      return {};
    }
    const cache = ProfilesApi._profileCache.get(profile, {}) as ProfileCache;
    if (cache.directReferenceSet) {
      return cache.directReferenceSet;
    }
    const handler = ProfilesApi._handler(profile);
    return cache.directReferenceSet = handler.directReferenceSet.call(ProfilesApi, profile);
  },
  profileNotFound(name, action) {
    if (action == null) {
      throw new Error("Profile " + name + " does not exist!");
    }
    if (typeof action === 'function') {
      action = action(name);
    }
    if (typeof action === 'object' && action.profileType) {
      return action;
    }
    switch (action) {
      case 'ignore':
        return null;
      case 'dumb':
        return ProfilesApi.create({
          name: name as string,
          profileType: 'VirtualProfile',
          defaultProfileName: 'direct'
        });
    }
    throw action;
  },
  allReferenceSet(profile: string | Profile, options: OptionsMap, opt_args?: ReferenceSetOptions): ReferenceSet {
    const o_profile = profile;
    if (opt_args == null) {
      opt_args = {};
    }
    let resolvedProfile = ProfilesApi.byName(profile, options);
    if (resolvedProfile == null) {
      resolvedProfile = typeof ProfilesApi.profileNotFound === "function" ? ProfilesApi.profileNotFound(o_profile, opt_args.profileNotFound) : void 0;
    }
    const has_out = opt_args.out != null;
    const result = opt_args.out != null ? opt_args.out : opt_args.out = {};
    if (resolvedProfile) {
      result[ProfilesApi.nameAsKey(resolvedProfile.name)] = resolvedProfile.name;
      const ref2 = ProfilesApi.directReferenceSet(resolvedProfile);
      for (const key in ref2) {
        const name = ref2[key];
        ProfilesApi.allReferenceSet(name, options, opt_args);
      }
    }
    if (!has_out) {
      delete opt_args.out;
    }
    return result;
  },
  referencedBySet(profile: string | Profile, options: OptionsMap, opt_args?: ReferenceSetOptions): ReferenceSet {
    const profileKey = ProfilesApi.nameAsKey(profile);
    if (opt_args == null) {
      opt_args = {};
    }
    const has_out = opt_args.out != null;
    const result = opt_args.out != null ? opt_args.out : opt_args.out = {};
    ProfilesApi.each(options, (key, prof) => {
      if (ProfilesApi.directReferenceSet(prof)[profileKey]) {
        result[key] = prof.name;
        return ProfilesApi.referencedBySet(prof, options, opt_args);
      }
    });
    if (!has_out) {
      delete opt_args.out;
    }
    return result;
  },
  validResultProfilesFor(profile: string | Profile, options: OptionsMap): Profile[] {
    profile = ProfilesApi.byName(profile, options);
    if (!ProfilesApi.isInclusive(profile)) {
      return [];
    }
    const profileKey = ProfilesApi.nameAsKey(profile);
    const ref = ProfilesApi.referencedBySet(profile, options);
    ref[profileKey] = profileKey;
    const result: Profile[] = [];
    ProfilesApi.each(options, (key, prof) => {
      if (!ref[key] && ProfilesApi.isIncludable(prof)) {
        return result.push(prof);
      }
    });
    return result;
  },
  match(profile: Profile, request: PacRequest, opt_profileType?: string): ProfileMatchResult {
    if (opt_profileType == null) {
      opt_profileType = profile.profileType;
    }
    const cache = ProfilesApi.analyze(profile) as ProfileCache;
    const match = ProfilesApi._handler(opt_profileType).match;
    return match != null ? match.call(ProfilesApi, profile, request, cache) : void 0;
  },
  compile(profile: Profile, opt_profileType?: string) {
    if (opt_profileType == null) {
      opt_profileType = profile.profileType;
    }
    const cache = ProfilesApi.analyze(profile);
    if (cache.compiled) {
      return cache.compiled;
    }
    const handler = ProfilesApi._handler(opt_profileType);
    return cache.compiled = handler.compile.call(ProfilesApi, profile, cache);
  },
  _profileCache: new AttachedCache((profile) => {
    return profile.revision;
  }),
  _handler(profileType) {
    const profileTypeName = typeof profileType === 'string' ? profileType : profileType.profileType;
    let handler: ProfileHandler = profileTypeName;
    while (typeof handler === 'string') {
      handler = ProfilesApi._profileTypes[handler];
    }
    if (handler == null) {
      throw new Error("Unknown profile type: " + profileTypeName);
    }
    return handler;
  },
  _profileTypes: {
    'SystemProfile': {
      compile(profile) {
        throw new Error("SystemProfile cannot be used in PAC scripts");
      }
    },
    'DirectProfile': {
      includable: true,
      compile(profile) {
        return new U2.AST_String({
          value: this.pacResult()
        });
      }
    },
    'FixedProfile': {
      includable: true,
      create(profile) {
        return profile.bypassList != null ? profile.bypassList : profile.bypassList = [
          {
            conditionType: 'BypassCondition',
            pattern: '127.0.0.1'
          }, {
            conditionType: 'BypassCondition',
            pattern: '[::1]'
          }, {
            conditionType: 'BypassCondition',
            pattern: 'localhost'
          }
        ];
      },
      match(profile, request) {
        if (profile.bypassList) {
          for (const cond of profile.bypassList) {
            if (Conditions.match(cond, request)) {
              return [
                this.pacResult(), cond, {
                  scheme: 'direct'
                }, void 0
              ];
            }
          }
        }
        for (const s of this.schemes) {
          if (s.scheme === request.scheme && profile[s.prop]) {
            const auth = (profile.auth != null ? profile.auth[s.prop] : void 0) != null ? profile.auth[s.prop] : profile.auth != null ? profile.auth['all'] : void 0;
            return [this.pacResult(profile[s.prop]), s.scheme, profile[s.prop], auth];
          }
        }
        const auth = (profile.auth != null ? profile.auth.fallbackProxy : void 0) != null ? profile.auth.fallbackProxy : profile.auth != null ? profile.auth['all'] : void 0;
        return [this.pacResult(profile.fallbackProxy), '', profile.fallbackProxy, auth];
      },
      compile(profile) {
        if ((!profile.bypassList || !profile.fallbackProxy) && !profile.proxyForHttp && !profile.proxyForHttps && !profile.proxyForFtp) {
          return new U2.AST_String({
            value: this.pacResult(profile.fallbackProxy)
          });
        }
        const body = [
          new U2.AST_Directive({
            value: 'use strict'
          })
        ];
        if (profile.bypassList && profile.bypassList.length) {
          let conditions = null;
          for (const cond of profile.bypassList) {
            const condition = Conditions.compile(cond);
            if (conditions != null) {
              conditions = new U2.AST_Binary({
                left: conditions,
                operator: '||',
                right: condition
              });
            } else {
              conditions = condition;
            }
          }
          body.push(new U2.AST_If({
            condition: conditions,
            body: new U2.AST_Return({
              value: new U2.AST_String({
                value: this.pacResult()
              })
            })
          }));
        }
        if (!profile.proxyForHttp && !profile.proxyForHttps && !profile.proxyForFtp) {
          body.push(new U2.AST_Return({
            value: new U2.AST_String({
              value: this.pacResult(profile.fallbackProxy)
            })
          }));
        } else {
          body.push(new U2.AST_Switch({
            expression: new U2.AST_SymbolRef({
              name: 'scheme'
            }),
            body: (() => {
              const results = [];
              for (const s of this.schemes) {
                if (!(!s.scheme || profile[s.prop])) {
                  continue;
                }
                const ret = [
                  new U2.AST_Return({
                    value: new U2.AST_String({
                      value: this.pacResult(profile[s.prop])
                    })
                  })
                ];
                if (s.scheme) {
                  results.push(new U2.AST_Case({
                    expression: new U2.AST_String({
                      value: s.scheme
                    }),
                    body: ret
                  }));
                } else {
                  results.push(new U2.AST_Default({
                    body: ret
                  }));
                }
              }
              return results;
            })()
          }));
        }
        return new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({
              name: 'url'
            }), new U2.AST_SymbolFunarg({
              name: 'host'
            }), new U2.AST_SymbolFunarg({
              name: 'port'
            }), new U2.AST_SymbolFunarg({
              name: 'scheme'
            })
          ],
          body: body
        });
      }
    },
    'PacProfile': {
      includable(profile) {
        return !this.isFileUrl(profile.pacUrl);
      },
      create(profile) {
        return profile.pacScript != null ? profile.pacScript : profile.pacScript = 'function FindProxyForURL(url, host) {\n  return "DIRECT";\n}';
      },
      compile(profile) {
        return new U2.AST_Call({
          args: [new U2.AST_This],
          expression: new U2.AST_Dot({
            property: 'call',
            expression: new U2.AST_Function({
              argnames: [],
              body: [
                new AST_Raw(';\n' + profile.pacScript + '\n\n/* End of PAC */;'), new U2.AST_Return({
                  value: new U2.AST_SymbolRef({
                    name: 'FindProxyForURL'
                  })
                })
              ]
            })
          })
        });
      },
      updateUrl(profile) {
        if (this.isFileUrl(profile.pacUrl)) {
          return void 0;
        } else {
          return profile.pacUrl;
        }
      },
      updateContentTypeHints() {
        return ['!text/html', '!application/xhtml+xml', 'application/x-ns-proxy-autoconfig', 'application/x-javascript-config'];
      },
      update(profile, data) {
        if (profile.pacScript === data) {
          return false;
        }
        profile.pacScript = data;
        return true;
      }
    },
    'AutoDetectProfile': 'PacProfile',
    'SwitchProfile': {
      includable: true,
      inclusive: true,
      create(profile) {
        if (profile.defaultProfileName == null) {
          profile.defaultProfileName = 'direct';
        }
        return profile.rules != null ? profile.rules : profile.rules = [];
      },
      directReferenceSet(profile) {
        const refs: ReferenceSet = {};
        refs[ProfilesApi.nameAsKey(profile.defaultProfileName)] = profile.defaultProfileName;
        for (const rule of profile.rules) {
          refs[ProfilesApi.nameAsKey(rule.profileName)] = rule.profileName;
        }
        return refs;
      },
      analyze(profile) {
        return profile.rules;
      },
      replaceRef(profile, fromName, toName) {
        let changed = false;
        if (profile.defaultProfileName === fromName) {
          profile.defaultProfileName = toName;
          changed = true;
        }
        for (const rule of profile.rules) {
          if (rule.profileName === fromName) {
            rule.profileName = toName;
            changed = true;
          }
        }
        return changed;
      },
      match(profile, request, cache) {
        for (const rule of cache.analyzed) {
          if (Conditions.match(rule.condition, request)) {
            return rule;
          }
        }
        return [ProfilesApi.nameAsKey(profile.defaultProfileName), null];
      },
      compile(profile, cache) {
        const rules = cache.analyzed;
        if (rules.length === 0) {
          return this.profileResult(profile.defaultProfileName);
        }
        const body = [
          new U2.AST_Directive({
            value: 'use strict'
          })
        ];
        for (const rule of rules) {
          body.push(new U2.AST_If({
            condition: Conditions.compile(rule.condition),
            body: new U2.AST_Return({
              value: this.profileResult(rule.profileName)
            })
          }));
        }
        body.push(new U2.AST_Return({
          value: this.profileResult(profile.defaultProfileName)
        }));
        return new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({
              name: 'url'
            }), new U2.AST_SymbolFunarg({
              name: 'host'
            }), new U2.AST_SymbolFunarg({
              name: 'port'
            }), new U2.AST_SymbolFunarg({
              name: 'scheme'
            })
          ],
          body: body
        });
      }
    },
    'VirtualProfile': 'SwitchProfile',
    'RuleListProfile': {
      includable: true,
      inclusive: true,
      create(profile) {
        if (profile.profileType == null) {
          profile.profileType = 'RuleListProfile';
        }
        if (profile.format == null) {
          profile.format = ProfilesApi.formatByType[profile.profileType] != null ? ProfilesApi.formatByType[profile.profileType] : 'Switchy';
        }
        if (profile.defaultProfileName == null) {
          profile.defaultProfileName = 'direct';
        }
        if (profile.matchProfileName == null) {
          profile.matchProfileName = 'direct';
        }
        return profile.ruleList != null ? profile.ruleList : profile.ruleList = '';
      },
      directReferenceSet(profile) {
        let refs;
        if (profile.ruleList != null) {
          const formatHandler = RuleListFormats[profile.format];
          refs = formatHandler != null && typeof formatHandler.directReferenceSet === "function" ? formatHandler.directReferenceSet(profile) : void 0;
          if (refs) {
            return refs;
          }
        }
        refs = {} as ReferenceSet;
        for (const name of [profile.matchProfileName, profile.defaultProfileName]) {
          refs[ProfilesApi.nameAsKey(name)] = name;
        }
        return refs;
      },
      replaceRef(profile, fromName, toName) {
        let changed = false;
        if (profile.defaultProfileName === fromName) {
          profile.defaultProfileName = toName;
          changed = true;
        }
        if (profile.matchProfileName === fromName) {
          profile.matchProfileName = toName;
          changed = true;
        }
        return changed;
      },
      analyze(profile) {
        const format = profile.format != null ? profile.format : ProfilesApi.formatByType[profile.profileType];
        const formatHandler = RuleListFormats[format];
        if (!formatHandler) {
          throw new Error("Unsupported rule list format " + format + "!");
        }
        let ruleList = (profile.ruleList != null ? profile.ruleList.trim() : void 0) || '';
        if (formatHandler.preprocess != null) {
          ruleList = formatHandler.preprocess(ruleList);
        }
        return formatHandler.parse(ruleList, profile.matchProfileName, profile.defaultProfileName);
      },
      match(profile, request) {
        return ProfilesApi.match(profile, request, 'SwitchProfile');
      },
      compile(profile) {
        return ProfilesApi.compile(profile, 'SwitchProfile');
      },
      updateUrl(profile) {
        return profile.sourceUrl;
      },
      updateContentTypeHints() {
        return ['!text/html', '!application/xhtml+xml', 'text/plain', '*'];
      },
      update(profile, data) {
        data = data.trim();
        const original = profile.format != null ? profile.format : ProfilesApi.formatByType[profile.profileType];
        profile.profileType = 'RuleListProfile';
        let format = original;
        let formatHandler = RuleListFormats[format];
        if ((typeof formatHandler.detect === "function" ? formatHandler.detect(data) : void 0) === false) {
          format = null;
        }
        for (const formatName in RuleListFormats) {
          if (!hasProp.call(RuleListFormats, formatName)) continue;
          const candidate = RuleListFormats[formatName];
          const result = typeof candidate.detect === "function" ? candidate.detect(data) : void 0;
          if (result === true || (result !== false && (format == null))) {
            profile.format = format = formatName;
          }
        }
        if (format == null) {
          format = original;
        }
        formatHandler = RuleListFormats[format];
        if (formatHandler.preprocess != null) {
          data = formatHandler.preprocess(data);
        }
        if (profile.ruleList === data) {
          return false;
        }
        profile.ruleList = data;
        return true;
      }
    },
    'SwitchyRuleListProfile': 'RuleListProfile',
    'AutoProxyRuleListProfile': 'RuleListProfile'
  }
};

export default ProfilesApi;
