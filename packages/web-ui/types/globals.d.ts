type OmegaPacOptions = Record<string, unknown>;

type OmegaPacProfile = {
  builtin?: boolean;
  color?: string;
  name?: string;
  profileType?: string;
  syncError?: {
    reason?: string;
    [key: string]: unknown;
  };
  syncOptions?: string;
  [key: string]: unknown;
};

type OmegaPacConditionFieldValue = boolean | number | string | null | undefined;

type OmegaPacSwitchRuleCondition = {
  conditionType?: string;
  days?: string;
  endHour?: number | string | null;
  maxValue?: number | string | null;
  minValue?: number | string | null;
  pattern?: string;
  startHour?: number | string | null;
  [key: string]: OmegaPacConditionFieldValue;
};

type OmegaPacSwitchRule = {
  condition: OmegaPacSwitchRuleCondition;
  note?: string;
  profileName?: string;
};

type OmegaPacPrintedScript = {
  print_to_string: (options?: {
    beautify?: boolean;
    comments?: boolean;
  }) => string;
};

type OmegaPacGlobal = {
  Conditions: {
    fromStr: (value: string) => OmegaPacSwitchRuleCondition;
    getWeekdayList: (condition: OmegaPacSwitchRuleCondition) => boolean[];
    str: (condition: OmegaPacSwitchRuleCondition) => string;
  };
  PacGenerator: {
    ascii: (script: string) => string;
    script: (
      options: OmegaPacOptions,
      profileName: string,
      hooks?: {
        profileNotFound?: (name: string) => string;
      }
    ) => OmegaPacPrintedScript;
  };
  Profiles: {
    byKey?: (key: string, options: OmegaPacOptions) => OmegaPacProfile | null | undefined;
    create: <TProfile extends Partial<OmegaPacProfile>>(profile: TProfile) => OmegaPacProfile & TProfile;
    each: (options: OmegaPacOptions, callback: (key: string, profile: OmegaPacProfile) => void) => void;
    nameAsKey?: (profileOrName: Pick<OmegaPacProfile, 'name'> | string) => string;
    referencedBySet?: (profileName: string, options: OmegaPacOptions) => Record<string, string>;
    ruleListFormats?: string[];
    updateRevision: (profile: OmegaPacProfile) => void;
    validResultProfilesFor: (profile: OmegaPacProfile | string, options: OmegaPacOptions) => OmegaPacProfile[];
  };
  RuleList: {
    Switchy: {
      compose: (
        profile: {
          defaultProfileName?: string;
          rules: OmegaPacSwitchRule[];
        },
        options?: {
          withResult?: boolean;
        }
      ) => string;
      directReferenceSet: (profile: {ruleList: string}) => Record<string, string>;
      parseOmega: (
        code: string,
        profiles?: unknown,
        options?: unknown,
        parseOptions?: {
          source?: boolean;
          strict?: boolean;
        }
      ) => OmegaPacSwitchRule[];
    };
  };
};

declare var OmegaPac: OmegaPacGlobal;
