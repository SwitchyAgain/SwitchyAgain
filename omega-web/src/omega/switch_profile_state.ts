namespace OmegaSwitchProfileState {
  export type AttachedOptions = {
    defaultProfileName?: string;
    enabled?: boolean;
  };

  export type RuleListProfile = {
    color?: string;
    defaultProfileName?: string;
    lastUpdate?: any;
    matchProfileName?: string;
    name?: string;
    profileType?: string;
    ruleList?: string;
    sourceUrl?: string;
  };

  export type SwitchProfile = {
    color?: string;
    defaultProfileName?: string;
    name?: string;
    rules?: any[];
  };

  export type AttachedSourceCache = {
    lastUpdate?: any;
    ruleList?: string;
    sourceUrl?: string;
  };

  export function createAttachedIdentity(profileName: string, getAttachedName: (name: string) => string) {
    var attachedName = getAttachedName(profileName);
    return {
      attachedName: attachedName,
      attachedKey: OmegaPac.Profiles.nameAsKey(attachedName)
    };
  }

  export function syncOptionsFromProfileDefault(
    defaultProfileName: string,
    attachedName: string,
    attached: RuleListProfile,
    attachedOptions: AttachedOptions
  ) {
    attachedOptions.enabled = defaultProfileName === attachedName;
    if (!attached || !attachedOptions.enabled) {
      attachedOptions.defaultProfileName = defaultProfileName;
    }
  }

  export function setAttachedEnabled(
    profile: SwitchProfile,
    attached: RuleListProfile,
    attachedName: string,
    attachedOptions: AttachedOptions,
    enabled: boolean,
    oldValue: boolean
  ) {
    if (enabled === oldValue) {
      return;
    }
    if (enabled) {
      if (profile.defaultProfileName !== attachedName) {
        profile.defaultProfileName = attachedName;
      }
      return;
    }
    if (profile.defaultProfileName !== attachedName) {
      return;
    }
    if (attached) {
      profile.defaultProfileName = attached.defaultProfileName;
      attachedOptions.defaultProfileName = attached.defaultProfileName;
    } else {
      profile.defaultProfileName = 'direct';
      attachedOptions.defaultProfileName = 'direct';
    }
  }

  export function syncDefaultFromAttached(attachedOptions: AttachedOptions, enabled: boolean, name: string) {
    if (name && enabled) {
      attachedOptions.defaultProfileName = name;
    }
  }

  export function setDefaultProfile(
    profile: SwitchProfile,
    attached: RuleListProfile,
    attachedOptions: AttachedOptions,
    name: string
  ) {
    if (attached && attachedOptions.enabled) {
      attached.defaultProfileName = name;
    } else {
      profile.defaultProfileName = name;
    }
  }

  export function createAttachedProfile(profile: SwitchProfile, attachedName: string) {
    var attached = OmegaPac.Profiles.create({
      name: attachedName,
      defaultProfileName: profile.defaultProfileName,
      profileType: 'RuleListProfile',
      color: profile.color
    });
    OmegaPac.Profiles.updateRevision(attached);
    return attached;
  }

  export function attachNew(
    options: any,
    attachedKey: string,
    profile: SwitchProfile,
    attachedName: string,
    attachedOptions: AttachedOptions
  ) {
    var attached = createAttachedProfile(profile, attachedName);
    options[attachedKey] = attached;
    attachedOptions.enabled = true;
    profile.defaultProfileName = attachedName;
    return attached;
  }

  export function removeAttached(options: any, attachedKey: string, profile: SwitchProfile, attached: RuleListProfile) {
    profile.defaultProfileName = attached.defaultProfileName;
    delete options[attachedKey];
  }

  export function preserveAttachedUpdateOnSourceChange(
    attached: RuleListProfile,
    oldAttached: RuleListProfile,
    cache: AttachedSourceCache
  ) {
    if (!(attached && oldAttached)) {
      return cache;
    }
    if (attached.sourceUrl !== oldAttached.sourceUrl) {
      if (attached.lastUpdate) {
        cache.sourceUrl = oldAttached.sourceUrl;
        cache.lastUpdate = attached.lastUpdate;
        cache.ruleList = oldAttached.ruleList;
        attached.lastUpdate = null;
      } else if (cache.sourceUrl && attached.sourceUrl === cache.sourceUrl) {
        attached.lastUpdate = cache.lastUpdate;
        attached.ruleList = cache.ruleList;
      }
    }
    return cache;
  }

  export function addRule(profile: SwitchProfile, defaultProfileName: string) {
    OmegaSwitchProfileRules.addRule(profile.rules, defaultProfileName);
    return profile.rules.length;
  }

  export function removeRule(profile: SwitchProfile, index: number) {
    OmegaSwitchProfileRules.removeRule(profile.rules, index);
    return profile.rules.length;
  }

  export function cloneRule(profile: SwitchProfile, index: number) {
    OmegaSwitchProfileRules.cloneRule(profile.rules, index);
    return profile.rules.length;
  }

  export function moveRule(rules: any[], fromIndex: number, toIndex: number) {
    var rule;
    if (fromIndex === toIndex) {
      return false;
    }
    rule = rules.splice(fromIndex, 1)[0];
    rules.splice(toIndex, 0, rule);
    return true;
  }

  export function updateConditionField(rule: any, field: string, value: any) {
    var numberValue;
    if (!rule) {
      return false;
    }
    if (field === 'minValue' || field === 'maxValue' || field === 'startHour' || field === 'endHour') {
      numberValue = value === '' ? null : Number(value);
      rule.condition[field] = numberValue;
    } else {
      rule.condition[field] = value;
    }
    return true;
  }

  export function updateConditionType(rule: any, type: string) {
    if (!rule) {
      return false;
    }
    rule.condition.conditionType = type;
    return true;
  }

  export function updateIpCondition(rule: any, value: string) {
    if (!rule) {
      return false;
    }
    rule.condition = value ? OmegaPac.Conditions.fromStr('Ip: ' + value) : {
      conditionType: 'IpCondition',
      ip: '0.0.0.0',
      prefixLength: 0
    };
    return true;
  }

  export function updateRuleNote(rule: any, note: string) {
    if (!rule) {
      return false;
    }
    rule.note = note;
    return true;
  }

  export function updateRuleProfile(rule: any, name: string) {
    if (!rule) {
      return false;
    }
    rule.profileName = name;
    return true;
  }

  export function updateRuleWeekday(rule: any, dayIndex: number, selected: boolean) {
    if (!rule) {
      return false;
    }
    OmegaSwitchProfileRules.updateDay(rule.condition, dayIndex, selected);
    return true;
  }

  export function composeSource(profile: SwitchProfile, defaultProfileName: string) {
    return OmegaPac.RuleList.Switchy.compose({
      rules: profile.rules,
      defaultProfileName: defaultProfileName
    }, {
      withResult: true
    });
  }

  export function applyParsedSource(profile: SwitchProfile, attachedOptions: AttachedOptions, rules: any[]) {
    var diff, oldRules, patch;
    attachedOptions.defaultProfileName = rules.pop().profileName;
    diff = jsondiffpatch.create({
      objectHash: function(obj) {
        return JSON.stringify(obj);
      },
      textDiff: {
        minLength: 1 / 0
      }
    });
    oldRules = angular.fromJson(angular.toJson(profile.rules));
    patch = diff.diff(oldRules, rules);
    jsondiffpatch.patch(profile.rules, patch);
  }
}
