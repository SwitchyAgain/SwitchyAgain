namespace OmegaSwitchProfileActions {
  export function addRule(profile: OmegaSwitchProfileState.SwitchProfile, attachedOptions: OmegaSwitchProfileState.AttachedOptions) {
    return OmegaSwitchProfileState.addRule(profile, attachedOptions.defaultProfileName);
  }

  export function removeRule(profile: OmegaSwitchProfileState.SwitchProfile, index: number) {
    return OmegaSwitchProfileState.removeRule(profile, index);
  }

  export function cloneRule(profile: OmegaSwitchProfileState.SwitchProfile, index: number) {
    return OmegaSwitchProfileState.cloneRule(profile, index);
  }

  export function cloneRuleInputSelector(index: number) {
    return ".switch-rule-row:nth-child(" + (index + 2) + ") input";
  }

  export function addNote(scope: any, unwatchRulesShowNote: () => void) {
    scope.showNotes = true;
    return unwatchRulesShowNote();
  }

  export function syncShowNotes(scope: any, rules: any[], unwatchRulesShowNote: () => void) {
    if (OmegaSwitchProfileRules.hasNotes(rules)) {
      scope.showNotes = true;
      return unwatchRulesShowNote();
    }
  }

  export function resetRuleProfiles(profile: OmegaSwitchProfileState.SwitchProfile, attachedOptions: OmegaSwitchProfileState.AttachedOptions) {
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
