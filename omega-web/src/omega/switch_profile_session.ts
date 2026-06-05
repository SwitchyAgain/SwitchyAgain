namespace OmegaSwitchProfileSession {
  export function createReadyState($q: any) {
    var attachedReadyDefer, rulesReadyDefer;
    attachedReadyDefer = $q.defer();
    rulesReadyDefer = $q.defer();
    return {
      attachedReady: attachedReadyDefer.promise,
      attachedReadyDefer: attachedReadyDefer,
      rulesReady: rulesReadyDefer.promise,
      rulesReadyDefer: rulesReadyDefer
    };
  }

  export function watchRulesReady(scope: any, readyState: any) {
    var stopWatchingForRules;
    stopWatchingForRules = scope.$watch('profile.rules', function(rules) {
      if (!rules) {
        return;
      }
      stopWatchingForRules();
      return readyState.rulesReadyDefer.resolve(rules);
    });
    return stopWatchingForRules;
  }

  export function whenReady($q: any, readyState: any) {
    return $q.all([readyState.attachedReady, readyState.rulesReady]);
  }

  export function parseSource(scope: any, trFilter: (key: string, args?: any[]) => string) {
    var valid;
    valid = OmegaSwitchProfileSource.parseSource(scope.profile, scope.attached, scope.attachedName, scope.attachedOptions, scope.source, scope.options, trFilter);
    if (!valid) {
      scope.editSource = true;
      return false;
    }
    return true;
  }

  export function toggleSource(scope: any, stateEditorKey: string, omegaTarget: any, trFilter: (key: string, args?: any[]) => string) {
    scope.editSource = !scope.editSource;
    if (scope.editSource) {
      scope.source = OmegaSwitchProfileSource.createSource(scope.profile, scope.attachedOptions);
    } else {
      if (!parseSource(scope, trFilter)) {
        return false;
      }
      scope.source = null;
      OmegaSwitchProfileStartup.markRulesLoaded(scope);
    }
    omegaTarget.state(stateEditorKey, {
      editSource: scope.editSource
    });
    return true;
  }

  export function toggleSourceWhenReady(scope: any, $q: any, readyState: any, stateEditorKey: string, omegaTarget: any, trFilter: (key: string, args?: any[]) => string) {
    return whenReady($q, readyState).then(function() {
      return toggleSource(scope, stateEditorKey, omegaTarget, trFilter);
    });
  }

  export function validateBeforeApply(scope: any, trFilter: (key: string, args?: any[]) => string) {
    var attachedValidation, sourceTouched, sourceValid;
    attachedValidation = OmegaSwitchProfileSource.validateAttachedRuleList(scope.attached, scope.options, trFilter);
    scope.attachedRuleListError = attachedValidation.error;
    if (attachedValidation.format) {
      scope.attached.format = attachedValidation.format;
    }
    sourceValid = true;
    sourceTouched = OmegaSwitchProfileSource.shouldApplyTouchedSource(scope.editSource, scope.source);
    if (sourceTouched) {
      sourceValid = parseSource(scope, trFilter);
      if (sourceValid) {
        scope.source.touched = false;
      }
    }
    return {
      attachedValid: attachedValidation.valid,
      sourceTouched: sourceTouched,
      sourceValid: sourceValid
    };
  }

  export function shouldBlockStateChange(scope: any, trFilter: (key: string, args?: any[]) => string) {
    if (!OmegaSwitchProfileSource.shouldApplyTouchedSource(scope.editSource, scope.source)) {
      return false;
    }
    return !parseSource(scope, trFilter);
  }

  export function restoreInitialState(scope: any, opts: any) {
    if (opts != null ? opts.editSource : void 0) {
      return {
        editSource: true
      };
    }
    OmegaSwitchProfileStartup.markRulesLoaded(scope);
    return {
      editSource: false
    };
  }

  export function shouldShowSwitchGuide(scope: any, firstRun: any, switchGuide: any) {
    return OmegaSwitchProfileStartup.shouldShowSwitchGuide(scope.profile, firstRun, switchGuide);
  }

  export function getSwitchGuideState($q: any, readyState: any, omegaTarget: any) {
    return $q.all([readyState.rulesReady, omegaTarget.state(['web.switchGuide', 'firstRun'])]);
  }
}
