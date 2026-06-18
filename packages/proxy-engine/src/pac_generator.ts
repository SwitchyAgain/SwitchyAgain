import type {OptionsMap, PacGeneratorOptions, Profile, ReferenceSet} from './types';
import * as Ast from './pac_ast';
import Profiles from './profiles';

type PacAst = Ast.Node;

const ProfilesApi = Profiles as {
  allReferenceSet(profile: string | Profile, options: OptionsMap, args?: PacGeneratorOptions): ReferenceSet;
  byName(profileName: string, options: OptionsMap): Profile | undefined;
  compile(profile: Profile): Ast.Node;
  profileNotFound(name: string | Profile, action?: unknown): Profile | null;
  profileResult(profileName: string | Profile): Ast.Node;
};

export function ascii(str: string): string {
  return str.replace(/[\u0080-\uffff]/g, (char) => {
    const hex = char.charCodeAt(0).toString(16);
    let result = '\\u';
    for (let i = hex.length; i < 4; i++) {
      result += '0';
    }
    result += hex;
    return result;
  });
}

export function compress(ast: PacAst): PacAst {
  return Ast.compact(ast) as PacAst;
}

export function script(options: OptionsMap, profile: string | Profile, args?: PacGeneratorOptions) {
  let targetProfile: Profile | undefined;
  if (typeof profile === 'string') {
    targetProfile = ProfilesApi.byName(profile, options);
  } else {
    targetProfile = profile;
  }
  if (targetProfile == null) {
    const missing = ProfilesApi.profileNotFound(profile, args != null ? args.profileNotFound : void 0);
    if (missing == null) {
      throw new Error("Profile " + profile + " does not exist!");
    }
    targetProfile = missing;
  }
  if (!targetProfile.name) {
    throw new Error("Cannot generate PAC script for unnamed profile.");
  }
  const refs = ProfilesApi.allReferenceSet(targetProfile, options, {
    profileNotFound: args != null ? args.profileNotFound : void 0
  });
  const properties = [];
  for (const key in refs) {
    const name = refs[key];
    if (typeof name !== 'string') {
      continue;
    }
    if (!(key !== '+direct')) {
      continue;
    }
    let p = typeof targetProfile === 'object' && targetProfile.name === name ? targetProfile : ProfilesApi.byName(name, options);
    if (p == null) {
      p = ProfilesApi.profileNotFound(name, args != null ? args.profileNotFound : void 0) || undefined;
    }
    if (p == null) {
      continue;
    }
    properties.push(Ast.objectKeyVal(key, ProfilesApi.compile(p)));
  }
  const profiles = Ast.object(properties);
  const portParser = Ast.call(Ast.fn(['url'], [
    Ast.varStmt([
      Ast.varDef('match', Ast.call(Ast.dot(Ast.symbol('url'), 'match'), [
        Ast.regexp(/^[-+.a-z0-9]+:\/\/(?:[^/?#@]*@)?(?:\[[^\]]+\]|[^/?#:]+):(\d+)(?:[/?#]|$)/i)
      ]))
    ]),
    Ast.returnStmt(Ast.conditional(
      Ast.symbol('match'),
      Ast.sub(Ast.symbol('match'), Ast.num(1)),
      Ast.str('')
    ))
  ]), [Ast.symbol('url')]);
  const factory = Ast.fn(['init', 'profiles'], [
    Ast.returnStmt(Ast.fn(['url', 'host'], [
      Ast.directive('use strict'),
      Ast.varStmt([
        Ast.varDef('result', Ast.symbol('init')),
        Ast.varDef('scheme', Ast.call(Ast.dot(Ast.symbol('url'), 'substr'), [
          Ast.num(0),
          Ast.call(Ast.dot(Ast.symbol('url'), 'indexOf'), [Ast.str(':')])
        ])),
        Ast.varDef('port', portParser)
      ]),
      Ast.doWhile(
        Ast.block([
          Ast.simple(Ast.assign(
            Ast.symbol('result'),
            Ast.sub(Ast.symbol('profiles'), Ast.symbol('result'))
          )),
          Ast.ifStmt(
            Ast.binary(Ast.unaryPrefix('typeof', Ast.symbol('result')), '===', Ast.str('function')),
            Ast.simple(Ast.assign(
              Ast.symbol('result'),
              Ast.call(Ast.symbol('result'), [
                Ast.symbol('url'),
                Ast.symbol('host'),
                Ast.symbol('port'),
                Ast.symbol('scheme')
              ])
            ))
          )
        ]),
        Ast.binary(
          Ast.binary(Ast.unaryPrefix('typeof', Ast.symbol('result')), '!==', Ast.str('string')),
          '||',
          Ast.binary(
            Ast.call(Ast.dot(Ast.symbol('result'), 'charCodeAt'), [Ast.num(0)]),
            '===',
            Ast.num('+'.charCodeAt(0))
          )
        )
      ),
      Ast.returnStmt(Ast.symbol('result'))
    ]))
  ]);
  return Ast.toplevel([
    Ast.varStmt([
      Ast.varDef('FindProxyForURL', Ast.call(factory, [
        ProfilesApi.profileResult(targetProfile.name),
        profiles
      ]))
    ])
  ]);
}
