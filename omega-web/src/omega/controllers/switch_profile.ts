(function() {
  angular.module('omega').controller('SwitchProfileCtrl', function($scope, $rootScope, $location, $timeout, $q, $modal, profileIcons, getAttachedName, omegaTarget, trFilter, downloadFile, reactModalTemplates) {
    var attachedSourceCache, exportLegacyRuleList, exportRuleList, readyState, stateEditorKey, stopWatchingForRules, unwatchRules, unwatchRulesShowNote;
    exportRuleList = OmegaSwitchProfileExport.createExportRuleListAction($scope, trFilter, downloadFile);
    exportLegacyRuleList = OmegaSwitchProfileExport.createExportLegacyRuleListAction($scope, trFilter, downloadFile);
    $scope.conditionHelp = {
      show: $location.search().help === 'condition'
    };
    unwatchRules = OmegaSwitchProfileOptions.watchConditionMode($scope, exportRuleList, exportLegacyRuleList);
    readyState = OmegaSwitchProfileSession.createReadyState($q);
    stopWatchingForRules = OmegaSwitchProfileSession.watchRulesReady($scope, readyState);
    $scope.addRule = function() {
      return OmegaSwitchProfileActions.addRule($scope.profile, $scope.attachedOptions);
    };
    $scope.removeRule = function(index) {
      var removeForReal, scope;
      removeForReal = function() {
        return OmegaSwitchProfileActions.removeRule($scope.profile, index);
      };
      if ($scope.options['-confirmDeletion']) {
        scope = OmegaSwitchProfileActions.createRuleRemoveScope($scope, $scope.profile.rules[index]);
        return $modal.open({
          template: reactModalTemplates.ruleRemoveConfirm,
          scope: scope
        }).result.then(removeForReal);
      } else {
        return removeForReal();
      }
    };
    $scope.cloneRule = function(index) {
      OmegaSwitchProfileActions.cloneRule($scope.profile, index);
      return $timeout(function() {
        var input, ref, ref1;
        input = angular.element(OmegaSwitchProfileActions.cloneRuleInputSelector(index));
        if ((ref = input[0]) != null) {
          ref.focus();
        }
        return (ref1 = input[0]) != null ? ref1.select() : void 0;
      });
    };
    $scope.showNotes = false;
    $scope.addNote = function(index) {
      return OmegaSwitchProfileActions.addNote($scope, unwatchRulesShowNote);
    };
    unwatchRulesShowNote = $scope.$watch('profile.rules', (function(rules) {
      return OmegaSwitchProfileActions.syncShowNotes($scope, rules, unwatchRulesShowNote);
    }), true);
    $scope.resetRules = function() {
      var scope;
      scope = OmegaSwitchProfileActions.createRuleResetScope($scope);
      return $modal.open({
        template: reactModalTemplates.ruleResetConfirm,
        scope: scope
      }).result.then(function() {
        return OmegaSwitchProfileActions.resetRuleProfiles($scope.profile, $scope.attachedOptions);
      });
    };
    OmegaSwitchProfileAttached.watchAttachedIdentity($scope, getAttachedName);
    OmegaSwitchProfileAttached.watchAttachedProfile($scope);
    $scope.watchAndUpdateRevision('options[attachedKey]');
    attachedSourceCache = {};
    OmegaSwitchProfileAttached.watchAttachedSourceChanges($scope, attachedSourceCache);
    $scope.attachedOptions = OmegaSwitchProfileAttached.createAttachedOptions();
    OmegaSwitchProfileAttached.watchAttachedOptionSync($scope, readyState);
    $scope.attachNew = function() {
      return OmegaSwitchProfileAttached.attachNew($scope);
    };
    $scope.removeAttached = function() {
      var scope;
      if (!$scope.attached) {
        return;
      }
      scope = OmegaSwitchProfileAttached.createDeleteAttachedScope($scope);
      return $modal.open({
        template: reactModalTemplates.deleteAttached,
        scope: scope
      }).result.then(function() {
        return OmegaSwitchProfileAttached.removeAttached($scope);
      });
    };
    stateEditorKey = 'web._profileEditor.' + $scope.profile.name;
    $scope.loadRules = false;
    $scope.editSource = false;
    $scope.toggleSource = function() {
      return OmegaSwitchProfileSession.toggleSourceWhenReady($scope, $q, readyState, stateEditorKey, omegaTarget, trFilter);
    };
    $rootScope.$on('$stateChangeStart', function(event, _, __, fromState) {
      if (OmegaSwitchProfileSession.shouldBlockStateChange($scope, trFilter)) {
        return event.preventDefault();
      }
    });
    $scope.$on('omegaApplyOptions', function(event) {
      var validation;
      validation = OmegaSwitchProfileSession.validateBeforeApply($scope, trFilter);
      if (!validation.attachedValid) {
        event.preventDefault();
        angular.element('#attached-rulelist')[0].focus();
      }
      if (validation.sourceTouched) {
        event.preventDefault();
        if (validation.sourceValid) {
          return $timeout(function() {
            return $rootScope.applyOptions();
          });
        }
      }
    });
    return omegaTarget.state(stateEditorKey).then(function(opts) {
      var restored;
      restored = OmegaSwitchProfileSession.restoreInitialState($scope, opts);
      if (restored.editSource) {
        return $scope.toggleSource();
      } else {
        return OmegaSwitchProfileSession.getSwitchGuideState($q, readyState, omegaTarget).then(function(arg) {
          var _, firstRun, ref, switchGuide;
          _ = arg[0], (ref = arg[1], switchGuide = ref[0], firstRun = ref[1]);
          if (!OmegaSwitchProfileSession.shouldShowSwitchGuide($scope, firstRun, switchGuide)) {
            return;
          }
          omegaTarget.state('web.switchGuide', 'shown');
          return $script('js/switch_profile_guide.js');
        });
      }
    });
  });

}).call(this);
