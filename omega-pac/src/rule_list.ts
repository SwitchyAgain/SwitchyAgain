import type {
  Condition,
  Profile,
  ReferenceSet,
  RuleListComposeOptions,
  RuleListParseOptions,
  SwitchRule
} from './types';

const Buffer = require('buffer').Buffer;
const hasProp = Object.prototype.hasOwnProperty;

const strStartsWith = (str: string, prefix: string): boolean => {
  return str.startsWith(prefix);
};

const Conditions = require('./conditions') as {
  fromStr(value: string): Condition | null;
  str(condition: Condition): string;
  urlWildcard2HostWildcard(pattern: string): string | undefined;
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
        text = new Buffer(text, 'base64').toString('utf8');
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
        const cond = line[0] === '/' ? {
          conditionType: 'UrlRegexCondition',
          pattern: line.substring(1, line.length - 1)
        } : line[0] === '|' ? line[1] === '|' ? {
          conditionType: 'HostWildcardCondition',
          pattern: "*." + line.substring(2)
        } : {
          conditionType: 'UrlWildcardCondition',
          pattern: line.substring(1) + "*"
        } : line.indexOf('*') < 0 ? {
          conditionType: 'KeywordCondition',
          pattern: line
        } : {
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
    specialLineStart: "[;#@!",
    detect(text: string) {
      if (strStartsWith(text, Switchy.omegaPrefix)) {
        return true;
      }
    },
    parse(text: string, matchProfileName: string, defaultProfileName: string): SwitchRule[] {
      const switchy = Switchy;
      const parser = switchy.getParser(text);
      return switchy[parser](text, matchProfileName, defaultProfileName);
    },
    directReferenceSet(arg: Profile): ReferenceSet | undefined {
      const {ruleList, matchProfileName, defaultProfileName} = arg;
      const text = ruleList.trim();
      const switchy = Switchy;
      const parser = switchy.getParser(text);
      if (parser !== 'parseOmega') {
        return;
      }
      if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(text)) {
        return;
      }
      const refs: ReferenceSet = {};
      for (let line of text.split(/\n|\r/)) {
        line = line.trim();
        if (switchy.specialLineStart.indexOf(line[0]) < 0) {
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
    getParser(text: string): 'parseOmega' | 'parseLegacy' {
      const switchy = Switchy;
      let parser = 'parseOmega' as 'parseOmega' | 'parseLegacy';
      if (!strStartsWith(text, switchy.omegaPrefix)) {
        if (text[0] === '#' || text.indexOf('\n#') >= 0) {
          parser = 'parseLegacy';
        }
      }
      return parser;
    },
    conditionFromLegacyWildcard(pattern: string): Condition {
      if (pattern[0] === '@') {
        pattern = pattern.substring(1);
      } else {
        if (pattern.indexOf('://') <= 0 && pattern[0] !== '*') {
          pattern = '*' + pattern;
        }
        if (pattern[pattern.length - 1] !== '*') {
          pattern += '*';
        }
      }
      const host = Conditions.urlWildcard2HostWildcard(pattern);
      if (host) {
        return {
          conditionType: 'HostWildcardCondition',
          pattern: host
        };
      } else {
        return {
          conditionType: 'UrlWildcardCondition',
          pattern: pattern
        };
      }
    },
    parseLegacy(text: string, matchProfileName: string, defaultProfileName: string): SwitchRule[] {
      const normal_rules: SwitchRule[] = [];
      const exclusive_rules: SwitchRule[] = [];
      let begin = false;
      let section = 'WILDCARD';
      for (let line of text.split(/\n|\r/)) {
        line = line.trim();
        if (line.length === 0 || line[0] === ';') {
          continue;
        }
        if (!begin) {
          if (line.toUpperCase() === '#BEGIN') {
            begin = true;
          }
          continue;
        }
        if (line.toUpperCase() === '#END') {
          break;
        }
        if (line[0] === '[' && line[line.length - 1] === ']') {
          section = line.substring(1, line.length - 1).toUpperCase();
          continue;
        }
        const source = line;
        let profile = matchProfileName;
        let list = normal_rules;
        if (line[0] === '!') {
          profile = defaultProfileName;
          list = exclusive_rules;
          line = line.substring(1);
        }
        let cond = null;
        switch (section) {
          case 'WILDCARD':
            cond = Switchy.conditionFromLegacyWildcard(line);
            break;
          case 'REGEXP':
            cond = {
              conditionType: 'UrlRegexCondition',
              pattern: line
            };
            break;
        }
        if (cond != null) {
          list.push({
            condition: cond,
            profileName: profile,
            source: source
          });
        }
      }
      return exclusive_rules.concat(normal_rules);
    },
    parseOmega(text: string, matchProfileName: string | null, defaultProfileName: string | null, args?: RuleListParseOptions): SwitchRule[] {
      if (args == null) {
        args = {};
      }
      const strict = args.strict;
      let error;
      if (strict) {
        error = (fields) => {
          const err = new Error(fields.message);
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
            if (typeof error === "function") {
              error({
                message: "Missing result profile name: " + line,
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
          if (typeof error === "function") {
            error({
              message: "Invalid rule: " + line,
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
          source: includeSource ? source != null ? source : line : void 0
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
            if (typeof error === "function") {
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
