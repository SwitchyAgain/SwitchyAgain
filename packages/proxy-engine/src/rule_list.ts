import type {Profile, ReferenceSet, RuleListComposeOptions, RuleListParseOptions, SwitchRule} from './types';
import {Buffer} from 'buffer';
import Conditions from './conditions';

const hasProp = Object.prototype.hasOwnProperty;

type StrictRuleErrorFields = {
  message: string;
  [key: string]: unknown;
};

type RuleListError = Error & Record<string, unknown>;

const LEGACY_SWITCHY_RULE_LIST_LINE = /^[ \t]*#BEGIN[ \t]*$/im;

function rejectLegacySwitchyRuleList(text: string) {
  if (!LEGACY_SWITCHY_RULE_LIST_LINE.test(text)) {
    return;
  }
  const error = new Error('Legacy Proxy Switchy! rule list format is no longer supported.') as RuleListError;
  error.reason = 'legacyFormatUnsupported';
  throw error;
}

const strStartsWith = (str: string, prefix: string): boolean => {
  return str.startsWith(prefix);
};

export const AutoProxy = {
  magicPrefix: 'W0F1dG9Qcm94',
  detect(text: string) {
    if (strStartsWith(text, AutoProxy.magicPrefix)) {
      return true;
    } else if (strStartsWith(text, '[AutoProxy')) {
      return true;
    }
  },
  preprocess(text: string): string {
    if (strStartsWith(text, AutoProxy.magicPrefix)) {
      text = Buffer.from(text, 'base64').toString('utf8');
    }
    return text;
  },
  parse(text: string, matchProfileName: string, defaultProfileName: string): SwitchRule[] {
    const normal_rules: SwitchRule[] = [];
    const exclusive_rules: SwitchRule[] = [];
    for (let line of text.split(/\n|\r/)) {
      line = line.trim();
      if (line.length === 0 || line[0] === '!' || line[0] === '[') {
        continue;
      }
      const source = line;
      let profile = matchProfileName;
      let list = normal_rules;
      if (line[0] === '@' && line[1] === '@') {
        profile = defaultProfileName;
        list = exclusive_rules;
        line = line.substring(2);
      }
      const cond =
        line[0] === '/'
          ? {
              conditionType: 'UrlRegexCondition',
              pattern: line.substring(1, line.length - 1)
            }
          : line[0] === '|'
            ? line[1] === '|'
              ? {
                  conditionType: 'HostWildcardCondition',
                  pattern: '*.' + line.substring(2)
                }
              : {
                  conditionType: 'UrlWildcardCondition',
                  pattern: line.substring(1) + '*'
                }
            : line.indexOf('*') < 0
              ? {
                  conditionType: 'KeywordCondition',
                  pattern: line
                }
              : {
                  conditionType: 'UrlWildcardCondition',
                  pattern: 'http://*' + line + '*'
                };
      list.push({
        condition: cond,
        profileName: profile,
        source: source
      });
    }
    return exclusive_rules.concat(normal_rules);
  }
};

export const Switchy = {
  omegaPrefix: '[SwitchyOmega Conditions',
  specialLineStart: '[;#@!',
  detect(text: string) {
    rejectLegacySwitchyRuleList(text);
    if (strStartsWith(text, Switchy.omegaPrefix)) {
      return true;
    }
  },
  parse(text: string, matchProfileName: string, defaultProfileName: string): SwitchRule[] {
    rejectLegacySwitchyRuleList(text);
    return Switchy.parseOmega(text, matchProfileName, defaultProfileName);
  },
  directReferenceSet(arg: Profile): ReferenceSet | undefined {
    const {ruleList, defaultProfileName} = arg;
    const text = (ruleList || '').trim();
    rejectLegacySwitchyRuleList(text);
    if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(text)) {
      return;
    }
    const refs: ReferenceSet = {};
    for (let line of text.split(/\n|\r/)) {
      line = line.trim();
      if (Switchy.specialLineStart.indexOf(line[0]) < 0) {
        const iSpace = line.lastIndexOf(' +');
        let profile;
        if (iSpace < 0) {
          profile = defaultProfileName || 'direct';
        } else {
          profile = line.slice(iSpace + 2).trim();
        }
        refs['+' + profile] = profile;
      }
    }
    return refs;
  },
  compose(arg: {rules: SwitchRule[]; defaultProfileName?: string}, arg1?: RuleListComposeOptions): string {
    const {rules, defaultProfileName} = arg;
    const {withResult, useExclusive: optUseExclusive} = arg1 != null ? arg1 : {};
    const eol = '\r\n';
    let useExclusive = optUseExclusive;
    let ruleList = '[SwitchyOmega Conditions]' + eol;
    if (useExclusive == null) {
      useExclusive = !withResult;
    }
    if (withResult) {
      ruleList += '@with result' + eol + eol;
    } else {
      ruleList += eol;
    }
    const specialLineStart = Switchy.specialLineStart + '+';
    for (const rule of rules) {
      if (rule.note) {
        ruleList += '@note ' + rule.note + eol;
      }
      let line = Conditions.str(rule.condition);
      if (useExclusive && rule.profileName === defaultProfileName) {
        line = '!' + line;
      } else {
        if (specialLineStart.indexOf(line[0]) >= 0) {
          line = ': ' + line;
        }
        if (withResult) {
          line += ' +' + rule.profileName;
        }
      }
      ruleList += line + eol;
    }
    if (withResult) {
      ruleList += eol + '* +' + defaultProfileName + eol;
    }
    return ruleList;
  },
  parseOmega(text: string, matchProfileName: string | null, defaultProfileName: string | null, args?: RuleListParseOptions): SwitchRule[] {
    rejectLegacySwitchyRuleList(text);
    if (args == null) {
      args = {};
    }
    const strict = args.strict;
    let error: ((fields: StrictRuleErrorFields) => never) | undefined;
    if (strict) {
      error = (fields: StrictRuleErrorFields): never => {
        const err = new Error(fields.message) as RuleListError;
        for (const key in fields) {
          if (!hasProp.call(fields, key)) continue;
          const value = fields[key];
          err[key] = value;
        }
        throw err;
      };
    }
    const includeSource = args.source != null ? args.source : true;
    const rules: SwitchRule[] = [];
    const rulesWithDefaultProfile: SwitchRule[] = [];
    let withResult = false;
    let exclusiveProfile = null;
    let noteForNextRule = null;
    let lno = 0;
    for (let line of text.split(/\n|\r/)) {
      lno++;
      line = line.trim();
      if (line.length === 0) {
        continue;
      }
      switch (line[0]) {
        case '[':
          continue;
        case ';':
          continue;
        case '@':
          let iSpace = line.indexOf(' ');
          if (iSpace < 0) {
            iSpace = line.length;
          }
          const directive = line.slice(1, iSpace);
          line = line.slice(iSpace + 1).trim();
          switch (directive.toUpperCase()) {
            case 'WITH':
              const feature = line.toUpperCase();
              if (feature === 'RESULT' || feature === 'RESULTS') {
                withResult = true;
              }
              break;
            case 'NOTE':
              noteForNextRule = line;
          }
          continue;
      }
      let source = null;
      if (strict) {
        exclusiveProfile = null;
      }
      let profile;
      if (line[0] === '!') {
        profile = withResult ? null : defaultProfileName;
        source = line;
        line = line.slice(1);
      } else if (withResult) {
        const iSpace = line.lastIndexOf(' +');
        if (iSpace < 0) {
          if (typeof error === 'function') {
            error({
              message: 'Missing result profile name: ' + line,
              reason: 'missingResultProfile',
              source: line,
              sourceLineNo: lno
            });
          }
          continue;
        }
        profile = line.slice(iSpace + 2).trim();
        line = line.slice(0, iSpace).trim();
        if (line === '*') {
          exclusiveProfile = profile;
        }
      } else {
        profile = matchProfileName;
      }
      const cond = Conditions.fromStr(line);
      if (!cond) {
        if (typeof error === 'function') {
          error({
            message: 'Invalid rule: ' + line,
            reason: 'invalidRule',
            source: source != null ? source : line,
            sourceLineNo: lno
          });
        }
        continue;
      }
      const rule: SwitchRule = {
        condition: cond,
        profileName: profile,
        source: includeSource ? (source != null ? source : line) : void 0
      };
      if (noteForNextRule != null) {
        rule.note = noteForNextRule;
        noteForNextRule = null;
      }
      rules.push(rule);
      if (!profile) {
        rulesWithDefaultProfile.push(rule);
      }
    }
    if (withResult) {
      if (!exclusiveProfile) {
        if (strict) {
          if (typeof error === 'function') {
            error({
              message: "Missing default rule with catch-all '*' condition",
              reason: 'noDefaultRule'
            });
          }
        }
        exclusiveProfile = defaultProfileName || 'direct';
      }
      for (const rule of rulesWithDefaultProfile) {
        rule.profileName = exclusiveProfile;
      }
    }
    return rules;
  }
};
