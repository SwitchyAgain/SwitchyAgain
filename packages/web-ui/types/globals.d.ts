type ProxyEngineOptions = Record<string, unknown>;

type ProxyEngineProfile = {
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

type ProxyEngineConditionFieldValue = boolean | number | string | null | undefined;

type ProxyEngineSwitchRuleCondition = {
  conditionType?: string;
  days?: string;
  endHour?: number | string | null;
  maxValue?: number | string | null;
  minValue?: number | string | null;
  pattern?: string;
  startHour?: number | string | null;
  [key: string]: ProxyEngineConditionFieldValue;
};

type ProxyEngineSwitchRule = {
  condition: ProxyEngineSwitchRuleCondition;
  note?: string;
  profileName?: string;
};

type ProxyEnginePrintedScript = {
  print_to_string: (options?: {
    beautify?: boolean;
    comments?: boolean;
  }) => string;
};

type ProxyEngineGlobal = {
  Conditions: {
    fromStr: (value: string) => ProxyEngineSwitchRuleCondition;
    getWeekdayList: (condition: ProxyEngineSwitchRuleCondition) => boolean[];
    str: (condition: ProxyEngineSwitchRuleCondition) => string;
  };
  PacGenerator: {
    ascii: (script: string) => string;
    script: (
      options: ProxyEngineOptions,
      profileName: string,
      hooks?: {
        profileNotFound?: (name: string) => string;
      }
    ) => ProxyEnginePrintedScript;
  };
  Profiles: {
    byKey?: (key: string, options: ProxyEngineOptions) => ProxyEngineProfile | null | undefined;
    create: <TProfile extends Partial<ProxyEngineProfile>>(profile: TProfile) => ProxyEngineProfile & TProfile;
    each: (options: ProxyEngineOptions, callback: (key: string, profile: ProxyEngineProfile) => void) => void;
    nameAsKey?: (profileOrName: Pick<ProxyEngineProfile, 'name'> | string) => string;
    referencedBySet?: (profileName: string, options: ProxyEngineOptions) => Record<string, string>;
    ruleListFormats?: string[];
    updateRevision: (profile: ProxyEngineProfile) => void;
    validResultProfilesFor: (profile: ProxyEngineProfile | string, options: ProxyEngineOptions) => ProxyEngineProfile[];
  };
  RuleList: {
    Switchy: {
      compose: (
        profile: {
          defaultProfileName?: string;
          rules: ProxyEngineSwitchRule[];
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
      ) => ProxyEngineSwitchRule[];
    };
  };
};

declare var ProxyEngine: ProxyEngineGlobal;
