import type {BackgroundError, Options} from './options_client_types';
import type {NamedProfile, Profile, ProfileKey, RuleListProfileModel} from './profile_types';

export type {RuleListProfileModel} from './profile_types';

export type ConditionFieldValue = boolean | number | string | null | undefined;

export type SwitchRuleKnownConditionType =
  | 'BypassCondition'
  | 'FalseCondition'
  | 'HostLevelsCondition'
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'IpCondition'
  | 'KeywordCondition'
  | 'TimeCondition'
  | 'TrueCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition'
  | 'WeekdayCondition';

export type SwitchRuleConditionType = SwitchRuleKnownConditionType | (string & {});

export type SwitchRuleEditableConditionType =
  | 'FalseCondition'
  | 'HostLevelsCondition'
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'IpCondition'
  | 'KeywordCondition'
  | 'TimeCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition'
  | 'WeekdayCondition';

export type SwitchRuleNumericConditionField = 'endHour' | 'maxValue' | 'minValue' | 'startHour';

export type SwitchRuleEditableConditionField = SwitchRuleNumericConditionField | 'pattern';

export type SwitchRuleEditableConditionValue = string | null | undefined;

export type SwitchRuleConditionGroup = 'default' | 'host' | 'special' | 'url';

export type SwitchRuleCondition = {
  conditionType?: SwitchRuleConditionType;
  days?: string;
  endDay?: number | string | null;
  endHour?: number | string | null;
  ip?: string;
  maxValue?: number | string | null;
  minValue?: number | string | null;
  pattern?: string;
  prefixLength?: number | string | null;
  startDay?: number | string | null;
  startHour?: number | string | null;
  [key: string]: ConditionFieldValue;
};

export type SwitchRule = {
  condition: SwitchRuleCondition;
  note?: string;
  profileName?: string;
};

export type SwitchProfileModel = Profile & {
  color?: string;
  defaultProfileName?: string;
  name?: string;
  profileType?: 'SwitchProfile';
  rules?: SwitchRule[];
};

export type NamedSwitchProfileModel = SwitchProfileModel &
  NamedProfile & {
    profileType: 'SwitchProfile';
  };

export type AttachedOptions = {
  defaultProfileName?: string;
  enabled?: boolean;
};

export type SwitchRuleSourceState = {
  code?: string;
  error?:
    | BackgroundError
    | Error
    | {
        args?: unknown[];
        message?: string;
        profile?: string;
        reason?: string;
        source?: string;
        sourceLineNo?: number;
      };
  touched?: boolean;
};

export type ConditionTypeOption = {
  group: `condition_group_${SwitchRuleConditionGroup}`;
  type: SwitchRuleEditableConditionType;
};

export type ConditionGroupDefinition = {
  group: SwitchRuleConditionGroup;
  types: SwitchRuleEditableConditionType[];
};

const BASIC_CONDITION_GROUPS: ConditionGroupDefinition[] = [
  {
    group: 'default',
    types: ['HostWildcardCondition', 'UrlWildcardCondition', 'UrlRegexCondition', 'FalseCondition']
  }
];

const ADVANCED_CONDITION_GROUPS: ConditionGroupDefinition[] = [
  {
    group: 'host',
    types: ['HostWildcardCondition', 'HostRegexCondition', 'HostLevelsCondition', 'IpCondition']
  },
  {
    group: 'url',
    types: ['UrlWildcardCondition', 'UrlRegexCondition', 'KeywordCondition']
  },
  {
    group: 'special',
    types: ['WeekdayCondition', 'TimeCondition', 'FalseCondition']
  }
];

const URL_CONDITION_TYPE_MAP: Record<string, boolean> = {
  UrlRegexCondition: true,
  UrlWildcardCondition: true
};

const NUMERIC_CONDITION_FIELDS: Record<SwitchRuleNumericConditionField, true> = {
  endHour: true,
  maxValue: true,
  minValue: true,
  startHour: true
};

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function getBasicConditionGroups() {
  return cloneValue(BASIC_CONDITION_GROUPS);
}

export function getAdvancedConditionGroups() {
  return cloneValue(ADVANCED_CONDITION_GROUPS);
}

export function expandConditionGroups(groups: ConditionGroupDefinition[]) {
  const result: ConditionTypeOption[] = [];
  for (const group of groups) {
    for (const type of group.types) {
      result.push({
        group: `condition_group_${group.group}`,
        type
      });
    }
  }
  return result;
}

export function conditionTypesForMode(showConditionTypes = 0) {
  return expandConditionGroups(showConditionTypes > 0 ? getAdvancedConditionGroups() : getBasicConditionGroups());
}

export function getUrlConditionTypeMap() {
  return URL_CONDITION_TYPE_MAP;
}

export function isSwitchRuleNumericConditionField(field: SwitchRuleEditableConditionField): field is SwitchRuleNumericConditionField {
  return !!NUMERIC_CONDITION_FIELDS[field as SwitchRuleNumericConditionField];
}

export function createConditionTypeSet(conditionTypes: ConditionTypeOption[]) {
  const result: Record<string, string> = {};
  for (const conditionType of conditionTypes) {
    result[conditionType.type] = conditionType.type;
  }
  return result;
}

export function inspectRules(
  rules: SwitchRule[] | undefined,
  isUrlConditionType = URL_CONDITION_TYPE_MAP,
  basicConditionTypeSet = createConditionTypeSet(expandConditionGroups(BASIC_CONDITION_GROUPS)),
  updateAdvancedState = true
) {
  let hasConditionTypes = false;
  let hasUrlConditions = false;
  for (const rule of rules || []) {
    if (isUrlConditionType[rule.condition.conditionType || '']) {
      hasUrlConditions = true;
    }
    if (updateAdvancedState) {
      if (rule.condition.conditionType === 'TrueCondition') {
        rule.condition = {
          conditionType: 'HostWildcardCondition',
          pattern: '*'
        };
      }
      if (!basicConditionTypeSet[rule.condition.conditionType || '']) {
        hasConditionTypes = true;
      }
    }
  }
  return {
    hasConditionTypes,
    hasUrlConditions
  };
}

export function detectAdvancedConditionTypes(profile?: SwitchProfileModel | null) {
  return inspectRules(profile?.rules).hasConditionTypes ? 1 : 0;
}

export function conditionHasWarning(condition: SwitchRuleCondition) {
  if (condition.conditionType !== 'HostWildcardCondition') {
    return false;
  }
  const pattern = condition.pattern || '';
  return pattern.indexOf(':') >= 0 || pattern.indexOf('/') >= 0;
}

export function createAttachedName(profileName: string) {
  return `__ruleListOf_${profileName}`;
}

export function profileKey(profileOrName: Pick<Profile, 'name'> | string): ProfileKey {
  if (typeof OmegaPac !== 'undefined' && OmegaPac?.Profiles?.nameAsKey) {
    return OmegaPac.Profiles.nameAsKey(profileOrName) as ProfileKey;
  }
  const name = typeof profileOrName === 'string' ? profileOrName : profileOrName.name || '';
  return `+${name}`;
}

export function attachedIdentity(profileName: string) {
  const attachedName = createAttachedName(profileName);
  return {
    attachedKey: profileKey(attachedName),
    attachedName
  };
}

export function createAttachedOptions(profile: NamedSwitchProfileModel, attached?: RuleListProfileModel | null): AttachedOptions {
  const identity = attachedIdentity(profile.name);
  const enabled = profile.defaultProfileName === identity.attachedName;
  return {
    defaultProfileName: attached && enabled ? attached.defaultProfileName : profile.defaultProfileName,
    enabled
  };
}

export function syncAttachedOptionsFromProfile(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedName: string,
  attachedOptions: AttachedOptions
) {
  attachedOptions.enabled = profile.defaultProfileName === attachedName;
  if (!attached || !attachedOptions.enabled) {
    attachedOptions.defaultProfileName = profile.defaultProfileName;
  }
}

export function setAttachedEnabled(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedName: string,
  attachedOptions: AttachedOptions,
  enabled: boolean,
  oldValue?: boolean
) {
  if (enabled === oldValue) {
    return false;
  }
  attachedOptions.enabled = enabled;
  if (enabled) {
    if (profile.defaultProfileName !== attachedName) {
      profile.defaultProfileName = attachedName;
      return true;
    }
    return false;
  }
  if (profile.defaultProfileName !== attachedName) {
    return false;
  }
  const defaultProfileName = attached?.defaultProfileName || 'direct';
  profile.defaultProfileName = defaultProfileName;
  attachedOptions.defaultProfileName = defaultProfileName;
  return true;
}

export function syncDefaultFromAttached(attachedOptions: AttachedOptions, enabled: boolean | undefined, name?: string) {
  if (name && enabled) {
    attachedOptions.defaultProfileName = name;
    return true;
  }
  return false;
}

export function setDefaultProfile(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedOptions: AttachedOptions,
  name: string
) {
  if (attached && attachedOptions.enabled) {
    if (attached.defaultProfileName === name) {
      return false;
    }
    attached.defaultProfileName = name;
    return true;
  }
  if (profile.defaultProfileName === name) {
    return false;
  }
  profile.defaultProfileName = name;
  return true;
}

export function createAttachedProfile(profile: SwitchProfileModel, attachedName: string) {
  const attached = OmegaPac.Profiles.create({
    color: profile.color,
    defaultProfileName: profile.defaultProfileName,
    name: attachedName,
    profileType: 'RuleListProfile'
  });
  OmegaPac.Profiles.updateRevision(attached);
  return attached;
}

export function attachNew(
  options: Options,
  attachedKey: string,
  profile: SwitchProfileModel,
  attachedName: string,
  attachedOptions: AttachedOptions
) {
  const attached = createAttachedProfile(profile, attachedName);
  options[attachedKey] = attached;
  attachedOptions.enabled = true;
  profile.defaultProfileName = attachedName;
  return attached;
}

export function removeAttached(options: Options, attachedKey: string, profile: SwitchProfileModel, attached: RuleListProfileModel) {
  profile.defaultProfileName = attached.defaultProfileName;
  delete options[attachedKey];
}

export function createRule(rules: SwitchRule[], defaultProfileName?: string) {
  let rule: SwitchRule;
  if (rules.length > 0) {
    rule = cloneValue(rules[rules.length - 1]);
  } else {
    rule = {
      condition: {
        conditionType: 'HostWildcardCondition',
        pattern: ''
      },
      profileName: defaultProfileName
    };
  }
  if (rule.condition.pattern) {
    rule.condition.pattern = '';
  }
  return rule;
}

export function addRule(profile: SwitchProfileModel, defaultProfileName?: string) {
  profile.rules || (profile.rules = []);
  profile.rules.push(createRule(profile.rules, defaultProfileName));
  return true;
}

export function removeRule(profile: SwitchProfileModel, index: number) {
  profile.rules || (profile.rules = []);
  if (index < 0 || index >= profile.rules.length) {
    return false;
  }
  profile.rules.splice(index, 1);
  return true;
}

export function cloneRule(profile: SwitchProfileModel, index: number) {
  profile.rules || (profile.rules = []);
  if (index < 0 || index >= profile.rules.length) {
    return false;
  }
  const rule = cloneValue(profile.rules[index]);
  profile.rules.splice(index + 1, 0, rule);
  return true;
}

export function moveRule(rules: SwitchRule[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return false;
  }
  const rule = rules.splice(fromIndex, 1)[0];
  rules.splice(toIndex, 0, rule);
  return true;
}

export function updateConditionField(
  rule: SwitchRule | undefined,
  field: SwitchRuleEditableConditionField,
  value: SwitchRuleEditableConditionValue
) {
  if (!rule) {
    return false;
  }
  if (isSwitchRuleNumericConditionField(field)) {
    rule.condition[field] = value === '' ? null : Number(value);
    return true;
  }
  rule.condition[field] = value ?? '';
  return true;
}

export function updateConditionType(rule: SwitchRule | undefined, type: SwitchRuleEditableConditionType) {
  if (!rule) {
    return false;
  }
  rule.condition.conditionType = type;
  return true;
}

export function updateIpCondition(rule: SwitchRule | undefined, value: string) {
  if (!rule) {
    return false;
  }
  rule.condition = value
    ? OmegaPac.Conditions.fromStr(`Ip: ${value}`)
    : {
        conditionType: 'IpCondition',
        ip: '0.0.0.0',
        prefixLength: 0
      };
  return true;
}

export function updateRuleNote(rule: SwitchRule | undefined, note: string) {
  if (rule) {
    rule.note = note;
    return true;
  }
  return false;
}

export function updateRuleProfile(rule: SwitchRule | undefined, name: string) {
  if (rule) {
    rule.profileName = name;
    return true;
  }
  return false;
}

export function updateRuleWeekday(rule: SwitchRule | undefined, dayIndex: number, selected: boolean) {
  if (!rule) {
    return false;
  }
  rule.condition.days || (rule.condition.days = '-------');
  const char = selected ? 'SMTWtFs'[dayIndex] : '-';
  rule.condition.days = rule.condition.days.slice(0, dayIndex) + char + rule.condition.days.slice(dayIndex + 1);
  delete rule.condition.startDay;
  delete rule.condition.endDay;
  return true;
}

export function resetRuleProfiles(profile: SwitchProfileModel, defaultProfileName?: string) {
  let changed = false;
  for (const rule of profile.rules || []) {
    if (rule.profileName !== defaultProfileName) {
      rule.profileName = defaultProfileName;
      changed = true;
    }
  }
  return changed;
}

export function hasNotes(rules?: SwitchRule[]) {
  return Boolean(rules?.some((rule) => !!rule.note));
}

export function composeSource(profile: SwitchProfileModel, defaultProfileName?: string) {
  return OmegaPac.RuleList.Switchy.compose(
    {
      defaultProfileName,
      rules: profile.rules || []
    },
    {
      withResult: true
    }
  );
}

export function createSource(profile: SwitchProfileModel, attachedOptions: AttachedOptions): SwitchRuleSourceState {
  return {
    code: composeSource(profile, attachedOptions.defaultProfileName)
  };
}

function optionProfileName(value: unknown) {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' ? name : '';
}

function sourceResultProfileExists(key: string, options: Options | null | undefined, profilesByKey: Record<string, string>) {
  const profile = OmegaPac.Profiles.byKey?.(key, options || {});
  if (profile) {
    return profile.profileType !== 'SystemProfile';
  }
  return key !== '+system' && !!profilesByKey[key];
}

export function parseSource(code: string, options: Options | null | undefined) {
  const profilesByKey: Record<string, string> = {};
  for (const key of Object.keys(options || {})) {
    const name = optionProfileName(options?.[key]);
    if (key.charAt(0) === '+' && name) {
      profilesByKey[key] = name;
    }
  }
  try {
    const refs = OmegaPac.RuleList.Switchy.directReferenceSet({ruleList: code});
    if (!refs) {
      return {
        error: Object.assign(new Error("Missing '@with result' directive!"), {
          reason: 'resultNotEnabled'
        })
      };
    }
    for (const key of Object.keys(refs || {})) {
      if (!sourceResultProfileExists(key, options, profilesByKey)) {
        return {
          error: Object.assign(new Error(`Unknown profile: ${refs[key]}`), {
            profile: refs[key],
            reason: 'unknownProfile'
          })
        };
      }
    }
    return {
      rules: OmegaPac.RuleList.Switchy.parseOmega(code, null, null, {
        source: false,
        strict: true
      })
    };
  } catch (error) {
    return {
      error: error as SwitchRuleSourceState['error']
    };
  }
}

function effectiveProfileName(name?: string | null) {
  return name || 'direct';
}

function switchRulesEqual(left: SwitchRule[] = [], right: SwitchRule[] = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function splitParsedSourceRules(rules: SwitchRule[]) {
  const parsedRules = rules.slice();
  const defaultRule = parsedRules.pop();
  return {
    defaultProfileName: effectiveProfileName(defaultRule?.profileName),
    parsedRules
  };
}

export function parsedSourceChangesProfile(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedName: string,
  rules: SwitchRule[]
) {
  const {defaultProfileName, parsedRules} = splitParsedSourceRules(rules);
  if (!switchRulesEqual(profile.rules || [], parsedRules)) {
    return true;
  }
  if (attached && profile.defaultProfileName === attachedName) {
    return effectiveProfileName(attached.defaultProfileName) !== defaultProfileName;
  }
  return effectiveProfileName(profile.defaultProfileName) !== defaultProfileName;
}

export function applyParsedSource(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedOptions: AttachedOptions,
  attachedName: string,
  rules: SwitchRule[]
) {
  const {defaultProfileName, parsedRules} = splitParsedSourceRules(rules);
  let profileChanged = false;
  let attachedChanged = false;

  if (!switchRulesEqual(profile.rules || [], parsedRules)) {
    profile.rules = parsedRules;
    profileChanged = true;
  }
  if (attached && profile.defaultProfileName === attachedName) {
    if (effectiveProfileName(attached.defaultProfileName) !== defaultProfileName) {
      attached.defaultProfileName = defaultProfileName;
      OmegaPac.Profiles.updateRevision(attached);
      attachedChanged = true;
    }
  } else if (effectiveProfileName(profile.defaultProfileName) !== defaultProfileName) {
    profile.defaultProfileName = defaultProfileName;
    profileChanged = true;
  }
  attachedOptions.defaultProfileName = defaultProfileName;
  if (!profileChanged && !attachedChanged) {
    return false;
  }
  if (profileChanged || attachedChanged) {
    OmegaPac.Profiles.updateRevision(profile);
  }
  return true;
}

export function applySource(
  profile: SwitchProfileModel,
  attached: RuleListProfileModel | null | undefined,
  attachedOptions: AttachedOptions,
  attachedName: string,
  source: SwitchRuleSourceState,
  options: Options | null | undefined
) {
  const result = parseSource((source.code || '').trim(), options);
  if (result.error) {
    source.error = result.error;
    return false;
  }
  source.error = undefined;
  return applyParsedSource(profile, attached, attachedOptions, attachedName, result.rules || []);
}
