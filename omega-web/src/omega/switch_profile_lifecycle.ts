namespace OmegaSwitchProfileLifecycle {
  export function registerStateChangeGuard(scope: any, rootScope: any, trFilter: (key: string, args?: any[]) => string) {
    return rootScope.$on('$stateChangeStart', function(event) {
      if (OmegaSwitchProfileSession.shouldBlockStateChange(scope, trFilter)) {
        return event.preventDefault();
      }
    });
  }

  export function registerApplyOptionsGuard(scope: any, rootScope: any, timeout: any, trFilter: (key: string, args?: any[]) => string) {
    return scope.$on('omegaApplyOptions', function(event) {
      var validation;
      validation = OmegaSwitchProfileSession.validateBeforeApply(scope, trFilter);
      if (!validation.attachedValid) {
        event.preventDefault();
        angular.element('#attached-rulelist')[0].focus();
      }
      if (validation.sourceTouched) {
        event.preventDefault();
        if (validation.sourceValid) {
          return timeout(function() {
            return rootScope.applyOptions();
          });
        }
      }
    });
  }

  export function restoreEditorState(scope: any, deps: any) {
    return deps.omegaTarget.state(deps.stateEditorKey).then(function(opts) {
      var restored;
      restored = OmegaSwitchProfileSession.restoreInitialState(scope, opts);
      if (restored.editSource) {
        return scope.toggleSource();
      }
      return maybeShowSwitchGuide(scope, deps);
    });
  }

  export function maybeShowSwitchGuide(scope: any, deps: any) {
    return OmegaSwitchProfileSession.getSwitchGuideState(deps.$q, deps.readyState, deps.omegaTarget).then(function(arg) {
      var _, firstRun, ref, switchGuide;
      _ = arg[0], (ref = arg[1], switchGuide = ref[0], firstRun = ref[1]);
      if (!OmegaSwitchProfileSession.shouldShowSwitchGuide(scope, firstRun, switchGuide)) {
        return;
      }
      deps.omegaTarget.state('web.switchGuide', 'shown');
      return $script('js/switch_profile_guide.js');
    });
  }
}
