namespace OmegaSwitchProfileBindings {
  export function bindScopeActions(scope: any, deps: any) {
    scope.addRule = function() {
      return OmegaSwitchProfileActions.addRule(scope.profile, scope.attachedOptions);
    };
    scope.removeRuleDirect = function(index) {
      return OmegaSwitchProfileActions.removeRule(scope.profile, index);
    };
    scope.removeRule = function(index) {
      var removeForReal, modalScope;
      removeForReal = function() {
        return scope.removeRuleDirect(index);
      };
      if (scope.options['-confirmDeletion']) {
        modalScope = OmegaSwitchProfileActions.createRuleRemoveScope(scope, scope.profile.rules[index]);
        return deps.$modal.open({
          template: deps.reactModalTemplates.ruleRemoveConfirm,
          scope: modalScope
        }).result.then(removeForReal);
      }
      return removeForReal();
    };
    scope.cloneRule = function(index) {
      return OmegaSwitchProfileActions.cloneRule(scope.profile, index);
    };
    scope.resetRulesDirect = function() {
      return OmegaSwitchProfileActions.resetRuleProfiles(scope.profile, scope.attachedOptions);
    };
    scope.resetRules = function() {
      var modalScope;
      modalScope = OmegaSwitchProfileActions.createRuleResetScope(scope);
      return deps.$modal.open({
        template: deps.reactModalTemplates.ruleResetConfirm,
          scope: modalScope
        }).result.then(function() {
        return scope.resetRulesDirect();
      });
    };
    scope.attachNew = function() {
      return OmegaSwitchProfileAttached.attachNew(scope);
    };
    scope.removeAttachedDirect = function() {
      return OmegaSwitchProfileAttached.removeAttached(scope);
    };
    scope.removeAttached = function() {
      var modalScope;
      if (!scope.attached) {
        return;
      }
      modalScope = OmegaSwitchProfileAttached.createDeleteAttachedScope(scope);
      return deps.$modal.open({
          template: deps.reactModalTemplates.deleteAttached,
          scope: modalScope
        }).result.then(function() {
        return scope.removeAttachedDirect();
      });
    };
    scope.toggleSource = function() {
      return OmegaSwitchProfileSession.toggleSourceWhenReady(scope, deps.$q, deps.readyState, deps.stateEditorKey, deps.omegaTarget, deps.trFilter);
    };
  }
}
