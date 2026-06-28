import {
  addRule,
  applyParsedSource,
  cloneRule,
  inspectRules,
  moveRule,
  parseSource,
  parsedSourceChangesProfile,
  removeRule,
  resetRuleProfiles,
  setAttachedEnabled,
  setDefaultProfile,
  updateConditionField,
  updateRuleWeekday
} from '../src/react/switch_profile_runtime';
import type {AttachedOptions, SwitchProfileModel, SwitchRule} from '../src/react/switch_profile_runtime';
import type {RuleListProfileModel} from '../src/react/profile_types';

function installOmegaPacMock() {
  (globalThis as any).OmegaPac = {
    Profiles: {
      byKey(key: string, options: Record<string, unknown>) {
        const builtinProfiles: Record<string, unknown> = {
          '+direct': {
            builtin: true,
            name: 'direct',
            profileType: 'DirectProfile'
          },
          '+system': {
            builtin: true,
            name: 'system',
            profileType: 'SystemProfile'
          }
        };
        return builtinProfiles[key] || options[key] || null;
      },
      updateRevision(profile: {revision?: number}) {
        profile.revision = (profile.revision || 0) + 1;
      }
    },
    RuleList: {
      Switchy: {
        directReferenceSet({ruleList}: {ruleList: string}) {
          if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(ruleList)) {
            return undefined;
          }
          const refs: Record<string, string> = {};
          for (let line of ruleList.split(/\n|\r/)) {
            line = line.trim();
            if (!line || '[;#@!'.indexOf(line[0]) >= 0) {
              continue;
            }
            const iSpace = line.lastIndexOf(' +');
            const profile = iSpace < 0 ? 'direct' : line.slice(iSpace + 2).trim();
            refs[`+${profile}`] = profile;
          }
          return refs;
        },
        parseOmega() {
          return [
            {
              condition: {
                conditionType: 'HostWildcardCondition',
                pattern: '*'
              },
              profileName: 'direct'
            }
          ];
        }
      }
    }
  };
}

beforeEach(() => {
  installOmegaPacMock();
});

describe('switch profile runtime', () => {
  it('detects advanced and URL condition types while normalizing true conditions', () => {
    const rules: SwitchRule[] = [
      {
        condition: {
          conditionType: 'TrueCondition'
        },
        profileName: 'direct'
      },
      {
        condition: {
          conditionType: 'IpCondition',
          ip: '127.0.0.1'
        },
        profileName: 'proxy'
      },
      {
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^https://example\\.com/'
        },
        profileName: 'proxy'
      }
    ];

    const result = inspectRules(rules);

    expect(result).toEqual({
      hasConditionTypes: true,
      hasUrlConditions: true
    });
    expect(rules[0].condition).toEqual({
      conditionType: 'HostWildcardCondition',
      pattern: '*'
    });
  });

  it('toggles attached rule-list profile defaults', () => {
    const profile: SwitchProfileModel = {
      defaultProfileName: 'direct',
      profileType: 'SwitchProfile'
    };
    const attached: RuleListProfileModel = {
      defaultProfileName: 'proxy',
      profileType: 'RuleListProfile'
    };
    const attachedOptions: AttachedOptions = {
      defaultProfileName: 'direct',
      enabled: false
    };

    expect(setAttachedEnabled(profile, attached, '__ruleListOf_auto', attachedOptions, true, false)).toBe(true);
    expect(profile.defaultProfileName).toBe('__ruleListOf_auto');
    expect(attachedOptions.enabled).toBe(true);

    expect(setAttachedEnabled(profile, attached, '__ruleListOf_auto', attachedOptions, false, true)).toBe(true);
    expect(profile.defaultProfileName).toBe('proxy');
    expect(attachedOptions).toEqual({
      defaultProfileName: 'proxy',
      enabled: false
    });
  });

  it('updates profile defaults on the active destination', () => {
    const profile: SwitchProfileModel = {
      defaultProfileName: '__ruleListOf_auto',
      profileType: 'SwitchProfile'
    };
    const attached: RuleListProfileModel = {
      defaultProfileName: 'direct',
      profileType: 'RuleListProfile'
    };

    expect(setDefaultProfile(profile, attached, {enabled: true}, 'proxy')).toBe(true);
    expect(profile.defaultProfileName).toBe('__ruleListOf_auto');
    expect(attached.defaultProfileName).toBe('proxy');

    expect(setDefaultProfile(profile, attached, {enabled: false}, 'direct')).toBe(true);
    expect(profile.defaultProfileName).toBe('direct');
    expect(attached.defaultProfileName).toBe('proxy');
  });

  it('adds, clones, moves, removes, and resets rules', () => {
    const profile: SwitchProfileModel = {
      profileType: 'SwitchProfile',
      rules: []
    };

    expect(addRule(profile, 'direct')).toBe(true);
    expect(profile.rules).toEqual([
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: ''
        },
        profileName: 'direct'
      }
    ]);

    profile.rules![0].condition.pattern = '*.example.com';
    profile.rules![0].profileName = 'proxy';
    expect(addRule(profile, 'direct')).toBe(true);
    expect(profile.rules![1]).toEqual({
      condition: {
        conditionType: 'HostWildcardCondition',
        pattern: ''
      },
      profileName: 'proxy'
    });

    expect(cloneRule(profile, 0)).toBe(true);
    expect(profile.rules).toHaveLength(3);

    expect(moveRule(profile.rules!, 0, 2)).toBe(true);
    expect(profile.rules![2].condition.pattern).toBe('*.example.com');

    expect(removeRule(profile, 1)).toBe(true);
    expect(profile.rules).toHaveLength(2);

    expect(resetRuleProfiles(profile, 'direct')).toBe(true);
    expect(profile.rules!.map((rule) => rule.profileName)).toEqual(['direct', 'direct']);
  });

  it('updates condition fields with the right value shape', () => {
    const rule: SwitchRule = {
      condition: {
        conditionType: 'TimeCondition'
      },
      profileName: 'direct'
    };

    expect(updateConditionField(rule, 'startHour', '9')).toBe(true);
    expect(rule.condition.startHour).toBe(9);

    expect(updateConditionField(rule, 'endHour', '')).toBe(true);
    expect(rule.condition.endHour).toBeNull();

    expect(updateConditionField(rule, 'pattern', undefined)).toBe(true);
    expect(rule.condition.pattern).toBe('');
  });

  it('updates weekday conditions and clears day range fields', () => {
    const rule: SwitchRule = {
      condition: {
        conditionType: 'WeekdayCondition',
        days: 'SMTWtFs',
        endDay: 4,
        startDay: 2
      },
      profileName: 'direct'
    };

    expect(updateRuleWeekday(rule, 1, false)).toBe(true);
    expect(rule.condition.days).toBe('S-TWtFs');
    expect(rule.condition.startDay).toBeUndefined();
    expect(rule.condition.endDay).toBeUndefined();

    expect(updateRuleWeekday(rule, 1, true)).toBe(true);
    expect(rule.condition.days).toBe('SMTWtFs');
  });

  it('allows the built-in direct profile in source editing', () => {
    const result = parseSource('[SwitchyOmega Conditions]\n@with result\n* +direct', {
      '+proxy': {
        name: 'proxy',
        profileType: 'FixedProfile'
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.rules).toHaveLength(1);
  });

  it('rejects unknown and non-result profiles in source editing', () => {
    expect(parseSource('[SwitchyOmega Conditions]\n@with result\n* +missing', {}).error?.message).toBe('Unknown profile: missing');
    expect(parseSource('[SwitchyOmega Conditions]\n@with result\n* +system', {}).error?.message).toBe('Unknown profile: system');
  });

  it('requires result-enabled switch source editing', () => {
    const error = parseSource('[SwitchyOmega Conditions]\n*', {}).error as {message?: string; reason?: string} | undefined;
    expect(error?.reason).toBe('resultNotEnabled');
    expect(error?.message).toBe("Missing '@with result' directive!");
  });

  it('applies parsed source rules to profile and attached defaults', () => {
    const profile: SwitchProfileModel = {
      defaultProfileName: '__ruleListOf_auto',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
    };
    const attached: RuleListProfileModel = {
      defaultProfileName: 'direct',
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile'
    };
    const attachedOptions: AttachedOptions = {
      defaultProfileName: 'direct',
      enabled: true
    };
    const parsedRules: SwitchRule[] = [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'proxy'
      },
      {
        condition: {
          conditionType: 'TrueCondition'
        },
        profileName: 'direct'
      }
    ];

    expect(applyParsedSource(profile, attached, attachedOptions, '__ruleListOf_auto', parsedRules)).toBe(true);
    expect(profile.rules).toEqual([parsedRules[0]]);
    expect(profile.defaultProfileName).toBe('__ruleListOf_auto');
    expect(attached.defaultProfileName).toBe('direct');
    expect(attachedOptions.defaultProfileName).toBe('direct');
    expect(profile.revision).toBe(1);
    expect(attached.revision).toBeUndefined();
  });

  it('does not apply parsed source when rules and defaults are unchanged', () => {
    const rule: SwitchRule = {
      condition: {
        conditionType: 'HostWildcardCondition',
        pattern: '*.example.com'
      },
      profileName: 'proxy'
    };
    const profile: SwitchProfileModel = {
      defaultProfileName: '__ruleListOf_auto',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: [rule]
    };
    const attached: RuleListProfileModel = {
      defaultProfileName: 'direct',
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile'
    };
    const attachedOptions: AttachedOptions = {
      defaultProfileName: 'direct',
      enabled: true
    };
    const parsedRules: SwitchRule[] = [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'proxy'
      },
      {
        condition: {
          conditionType: 'TrueCondition'
        },
        profileName: 'direct'
      }
    ];

    expect(parsedSourceChangesProfile(profile, attached, '__ruleListOf_auto', parsedRules)).toBe(false);
    expect(applyParsedSource(profile, attached, attachedOptions, '__ruleListOf_auto', parsedRules)).toBe(false);
    expect(profile.revision).toBeUndefined();
    expect(attached.revision).toBeUndefined();
  });

  it('applies parsed source when the attached default changes', () => {
    const profile: SwitchProfileModel = {
      defaultProfileName: '__ruleListOf_auto',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
    };
    const attached: RuleListProfileModel = {
      defaultProfileName: 'direct',
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile'
    };
    const attachedOptions: AttachedOptions = {
      defaultProfileName: 'direct',
      enabled: true
    };
    const parsedRules: SwitchRule[] = [
      {
        condition: {
          conditionType: 'TrueCondition'
        },
        profileName: 'proxy'
      }
    ];

    expect(parsedSourceChangesProfile(profile, attached, '__ruleListOf_auto', parsedRules)).toBe(true);
    expect(applyParsedSource(profile, attached, attachedOptions, '__ruleListOf_auto', parsedRules)).toBe(true);
    expect(profile.defaultProfileName).toBe('__ruleListOf_auto');
    expect(attached.defaultProfileName).toBe('proxy');
    expect(attachedOptions.defaultProfileName).toBe('proxy');
    expect(profile.revision).toBe(1);
    expect(attached.revision).toBe(1);
  });
});
