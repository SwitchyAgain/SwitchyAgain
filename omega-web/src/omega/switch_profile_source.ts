namespace OmegaSwitchProfileSource {
  export type SourceState = {
    code?: string;
    error?: any;
    touched?: boolean;
  };

  function translateRuleListError(error: any, trFilter: (key: string, args?: any[]) => string) {
    var args, message, ref;
    args = (ref = error.args) != null ? ref : [error.sourceLineNo, error.source];
    message = trFilter('ruleList_error_' + error.reason, args);
    return message;
  }

  export function parseOmegaRules(code: string, options: any, arg: any, trFilter: (key: string, args?: any[]) => string) {
    return OmegaSwitchProfileRules.parseOmegaRules(code, options, arg, function(error) {
      return translateRuleListError(error, trFilter);
    });
  }

  export function createSource(profile: OmegaSwitchProfileState.SwitchProfile, attachedOptions: OmegaSwitchProfileState.AttachedOptions) {
    var runtime = (window as any).OmegaReactSwitchProfileRuntime;
    if (runtime && runtime.createSource) {
      return runtime.createSource(profile, attachedOptions);
    }
    return {
      code: OmegaSwitchProfileState.composeSource(profile, attachedOptions.defaultProfileName)
    };
  }

  export function parseSource(
    profile: OmegaSwitchProfileState.SwitchProfile,
    attached: OmegaSwitchProfileState.RuleListProfile,
    attachedName: string,
    attachedOptions: OmegaSwitchProfileState.AttachedOptions,
    source: SourceState,
    options: any,
    trFilter: (key: string, args?: any[]) => string
  ) {
    var error, ref, rules;
    var runtime = (window as any).OmegaReactSwitchProfileRuntime;
    if (!source) {
      return true;
    }
    ref = parseOmegaRules((source.code || '').trim(), options, {
      requireResult: true
    }, trFilter), rules = ref.rules, error = ref.error;
    if (error) {
      source.error = error;
      return false;
    }
    source.error = void 0;
    if (runtime && runtime.applyParsedSource) {
      return runtime.applyParsedSource(profile, attached, attachedOptions, attachedName, rules);
    }
    OmegaSwitchProfileState.applyParsedSource(profile, attachedOptions, rules);
    return true;
  }

  export function validateAttachedRuleList(
    attached: OmegaSwitchProfileState.RuleListProfile,
    options: any,
    trFilter: (key: string, args?: any[]) => string
  ) {
    var error, ref;
    if (!(((ref = attached) != null ? ref.ruleList : void 0) && !attached.sourceUrl)) {
      return {
        valid: true
      };
    }
    error = parseOmegaRules(attached.ruleList.trim(), options, {
      detect: true
    }, trFilter).error;
    if (error) {
      if (error.reason !== 'resultNotEnabled' && error.reason !== 'notSwitchy') {
        return {
          error: error,
          valid: false
        };
      }
      return {
        valid: true
      };
    }
    return {
      format: 'Switchy',
      valid: true
    };
  }

  export function shouldApplyTouchedSource(editSource: boolean, source: SourceState) {
    return !!(editSource && source && source.touched);
  }
}
