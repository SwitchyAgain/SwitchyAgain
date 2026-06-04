namespace OmegaSwitchProfileStartup {
  export function markRulesLoaded(scope: any) {
    scope.loadRules = true;
  }

  export function shouldShowSwitchGuide(profile: OmegaSwitchProfileState.SwitchProfile, firstRun: any, switchGuide: any) {
    if (firstRun || switchGuide === 'shown') {
      return false;
    }
    return !!(profile && profile.rules && profile.rules.length > 0);
  }
}
