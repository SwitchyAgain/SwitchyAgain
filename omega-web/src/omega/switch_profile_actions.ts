namespace OmegaSwitchProfileActions {
  function runtime() {
    return (window as any).OmegaReactSwitchProfileRuntime;
  }

  export function addRule(profile: OmegaSwitchProfileState.SwitchProfile, attachedOptions: OmegaSwitchProfileState.AttachedOptions) {
    if (runtime() && runtime().addRule) {
      return runtime().addRule(profile, attachedOptions.defaultProfileName);
    }
    return OmegaSwitchProfileState.addRule(profile, attachedOptions.defaultProfileName);
  }

  export function removeRule(profile: OmegaSwitchProfileState.SwitchProfile, index: number) {
    if (runtime() && runtime().removeRule) {
      return runtime().removeRule(profile, index);
    }
    return OmegaSwitchProfileState.removeRule(profile, index);
  }

  export function cloneRule(profile: OmegaSwitchProfileState.SwitchProfile, index: number) {
    if (runtime() && runtime().cloneRule) {
      return runtime().cloneRule(profile, index);
    }
    return OmegaSwitchProfileState.cloneRule(profile, index);
  }

  export function cloneRuleInputSelector(index: number) {
    return ".switch-rule-row:nth-child(" + (index + 2) + ") input";
  }

  export function resetRuleProfiles(profile: OmegaSwitchProfileState.SwitchProfile, attachedOptions: OmegaSwitchProfileState.AttachedOptions) {
    if (runtime() && runtime().resetRuleProfiles) {
      return runtime().resetRuleProfiles(profile, attachedOptions.defaultProfileName);
    }
    return OmegaSwitchProfileRules.resetRuleProfiles(profile.rules, attachedOptions.defaultProfileName);
  }

  export function createRuleRemoveScope(parentScope: any, rule: any) {
    var scope = parentScope.$new('isolate');
    scope.rule = rule;
    scope.ruleProfile = parentScope.profileByName(rule.profileName);
    scope.dispNameFilter = parentScope.dispNameFilter;
    scope.options = parentScope.options;
    return scope;
  }

  export function createRuleResetScope(parentScope: any) {
    var scope = parentScope.$new('isolate');
    scope.ruleProfile = parentScope.profileByName(parentScope.attachedOptions.defaultProfileName);
    scope.dispNameFilter = parentScope.dispNameFilter;
    scope.options = parentScope.options;
    return scope;
  }
}
