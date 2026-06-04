(function() {
  angular.module('omega').controller('SwitchProfileCtrl', function($scope, $rootScope, $location, $timeout, $q, $modal, profileIcons, getAttachedName, omegaTarget, trFilter, downloadFile, reactModalTemplates) {
    var attachedReady, attachedReadyDefer, attachedSourceCache, basicConditionTypeSet, basicConditionTypesExpanded, exportLegacyRuleList, exportRuleList, isUrlConditionType, onAttachedChange, parseSource, rulesReady, rulesReadyDefer, stateEditorKey, stopWatchingForRules, unwatchRules, unwatchRulesShowNote, updateHasConditionTypes;
    $scope.ruleListFormats = OmegaPac.Profiles.ruleListFormats;
    exportRuleList = function() {
      var blob, fileName, text;
      text = OmegaSwitchProfileRules.composeOmegaRuleList($scope.profile.rules, $scope.attachedOptions.defaultProfileName, trFilter('ruleList_usageUrl'), new Date().toLocaleDateString());
      blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
      });
      fileName = $scope.profile.name.replace(/\W+/g, '_');
      return downloadFile(blob, "OmegaRules_" + fileName + ".sorl");
    };
    exportLegacyRuleList = function() {
      var blob, fileName, text;
      text = OmegaSwitchProfileRules.composeLegacyRuleList($scope.profile.rules, $scope.attachedOptions.defaultProfileName, trFilter('ruleList_usageUrl'), new Date().toLocaleDateString());
      blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
      });
      fileName = $scope.profile.name.replace(/\W+/g, '_');
      return downloadFile(blob, "SwitchyRules_" + fileName + ".ssrl");
    };
    $scope.conditionHelp = {
      show: $location.search().help === 'condition'
    };
    basicConditionTypesExpanded = OmegaSwitchProfileRules.expandConditionGroups(OmegaSwitchProfileRules.getBasicConditionGroups());
    basicConditionTypeSet = OmegaSwitchProfileRules.createConditionTypeSet(basicConditionTypesExpanded);
    $scope.showConditionTypes = 0;
    $scope.hasConditionTypes = 0;
    isUrlConditionType = OmegaSwitchProfileRules.getUrlConditionTypeMap();
    updateHasConditionTypes = function() {
      var flags, ref;
      if (((ref = $scope.profile) != null ? ref.rules : void 0) == null) {
        return;
      }
      flags = OmegaSwitchProfileRules.inspectRules($scope.profile.rules, isUrlConditionType, basicConditionTypeSet, $scope.hasConditionTypes === 0);
      if ($scope.hasConditionTypes !== 0 || !flags.hasConditionTypes) {
        return;
      }
      $scope.hasConditionTypes = 1;
      return $scope.showConditionTypes = 1;
    };
    $scope.$watch('options["-showConditionTypes"]', function(show) {
      show || (show = 0);
      if (show > 0) {
        $scope.showConditionTypes = show;
      } else {
        updateHasConditionTypes();
        $scope.showConditionTypes = $scope.hasConditionTypes;
      }
      if ($scope.options['-exportLegacyRuleList']) {
        if ($scope.showConditionTypes > 0) {
          $scope.setExportRuleListHandler(exportRuleList, {
            warning: true
          });
        } else {
          $scope.setExportRuleListHandler(exportLegacyRuleList);
        }
      } else {
        $scope.setExportRuleListHandler(exportRuleList);
      }
      if ($scope.showConditionTypes === 0 && $scope.options['-exportLegacyRuleList']) {
        return $scope.setExportRuleListHandler(exportLegacyRuleList);
      }
      if ($scope.showConditionTypes !== 0) {
        if ($scope.options["-showConditionTypes"] == null) {
          $scope.options["-showConditionTypes"] = $scope.showConditionTypes;
        }
        return typeof unwatchRules === "function" ? unwatchRules() : void 0;
      }
    });
    if ($scope.hasConditionTypes === 0) {
      unwatchRules = $scope.$watch('profile.rules', updateHasConditionTypes, true);
    }
    rulesReadyDefer = $q.defer();
    rulesReady = rulesReadyDefer.promise;
    stopWatchingForRules = $scope.$watch('profile.rules', function(rules) {
      if (!rules) {
        return;
      }
      stopWatchingForRules();
      return rulesReadyDefer.resolve(rules);
    });
    $scope.addRule = function() {
      return OmegaSwitchProfileState.addRule($scope.profile, $scope.attachedOptions.defaultProfileName);
    };
    $scope.validateCondition = function(condition, pattern) {
      return OmegaSwitchProfileRules.validateCondition(condition, pattern);
    };
    $scope.validateIpCondition = function(condition, input) {
      var ip;
      if (!input) {
        return false;
      }
      ip = OmegaPac.Conditions.parseIp(input);
      return ip != null;
    };
    $scope.updateDay = function(condition, i, selected) {
      return OmegaSwitchProfileRules.updateDay(condition, i, selected);
    };
    $scope.removeRule = function(index) {
      var removeForReal, scope;
      removeForReal = function() {
        return OmegaSwitchProfileState.removeRule($scope.profile, index);
      };
      if ($scope.options['-confirmDeletion']) {
        scope = $scope.$new('isolate');
        scope.rule = $scope.profile.rules[index];
        scope.ruleProfile = $scope.profileByName(scope.rule.profileName);
        scope.dispNameFilter = $scope.dispNameFilter;
        scope.options = $scope.options;
        return $modal.open({
          template: reactModalTemplates.ruleRemoveConfirm,
          scope: scope
        }).result.then(removeForReal);
      } else {
        return removeForReal();
      }
    };
    $scope.cloneRule = function(index) {
      OmegaSwitchProfileState.cloneRule($scope.profile, index);
      return $timeout(function() {
        var input, ref, ref1;
        input = angular.element(".switch-rule-row:nth-child(" + (index + 2) + ") input");
        if ((ref = input[0]) != null) {
          ref.focus();
        }
        return (ref1 = input[0]) != null ? ref1.select() : void 0;
      });
    };
    $scope.showNotes = false;
    $scope.addNote = function(index) {
      $scope.showNotes = true;
      return unwatchRulesShowNote();
    };
    unwatchRulesShowNote = $scope.$watch('profile.rules', (function(rules) {
      if (OmegaSwitchProfileRules.hasNotes(rules)) {
        $scope.showNotes = true;
        return unwatchRulesShowNote();
      }
    }), true);
    $scope.resetRules = function() {
      var scope;
      scope = $scope.$new('isolate');
      scope.ruleProfile = $scope.profileByName($scope.attachedOptions.defaultProfileName);
      scope.dispNameFilter = $scope.dispNameFilter;
      scope.options = $scope.options;
      return $modal.open({
        template: reactModalTemplates.ruleResetConfirm,
        scope: scope
      }).result.then(function() {
        return OmegaSwitchProfileRules.resetRuleProfiles($scope.profile.rules, $scope.attachedOptions.defaultProfileName);
      });
    };
    $scope.sortableOptions = {
      handle: '.sort-bar',
      tolerance: 'pointer',
      axis: 'y',
      forceHelperSize: true,
      forcePlaceholderSize: true,
      containment: 'parent'
    };
    attachedReadyDefer = $q.defer();
    attachedReady = attachedReadyDefer.promise;
    $scope.$watch('profile.name', function(name) {
      var identity;
      identity = OmegaSwitchProfileState.createAttachedIdentity(name, getAttachedName);
      $scope.attachedName = identity.attachedName;
      return $scope.attachedKey = identity.attachedKey;
    });
    $scope.$watch('options[attachedKey]', function(attached) {
      return $scope.attached = attached;
    });
    $scope.watchAndUpdateRevision('options[attachedKey]');
    attachedSourceCache = {};
    onAttachedChange = function(attached, oldAttached) {
      return attachedSourceCache = OmegaSwitchProfileState.preserveAttachedUpdateOnSourceChange(attached, oldAttached, attachedSourceCache);
    };
    $scope.$watch('options[attachedKey]', onAttachedChange, true);
    $scope.attachedOptions = {
      enabled: false
    };
    $scope.$watch('profile.defaultProfileName', function(name) {
      return OmegaSwitchProfileState.syncOptionsFromProfileDefault(name, $scope.attachedName, $scope.attached, $scope.attachedOptions);
    });
    $scope.$watch('attachedOptions.enabled', function(enabled, oldValue) {
      return OmegaSwitchProfileState.setAttachedEnabled($scope.profile, $scope.attached, $scope.attachedName, $scope.attachedOptions, enabled, oldValue);
    });
    $scope.$watch('attached.defaultProfileName', function(name) {
      return OmegaSwitchProfileState.syncDefaultFromAttached($scope.attachedOptions, $scope.attachedOptions.enabled, name);
    });
    $scope.$watch('attachedOptions.defaultProfileName', function(name) {
      attachedReadyDefer.resolve();
      return OmegaSwitchProfileState.setDefaultProfile($scope.profile, $scope.attached, $scope.attachedOptions, name);
    });
    $scope.attachNew = function() {
      return $scope.attached = OmegaSwitchProfileState.attachNew($scope.options, $scope.attachedKey, $scope.profile, $scope.attachedName, $scope.attachedOptions);
    };
    $scope.removeAttached = function() {
      var scope;
      if (!$scope.attached) {
        return;
      }
      scope = $scope.$new('isolate');
      scope.attached = $scope.attached;
      scope.dispNameFilter = $scope.dispNameFilter;
      scope.options = $scope.options;
      return $modal.open({
        template: reactModalTemplates.deleteAttached,
        scope: scope
      }).result.then(function() {
        return OmegaSwitchProfileState.removeAttached($scope.options, $scope.attachedKey, $scope.profile, $scope.attached);
      });
    };
    stateEditorKey = 'web._profileEditor.' + $scope.profile.name;
    $scope.loadRules = false;
    $scope.editSource = false;
    parseSource = function() {
      var valid;
      valid = OmegaSwitchProfileSource.parseSource($scope.profile, $scope.attachedOptions, $scope.source, $scope.options, trFilter);
      if (!valid) {
        $scope.editSource = true;
        return false;
      }
      return true;
    };
    $scope.toggleSource = function() {
      return $q.all([attachedReady, rulesReady]).then(function() {
        $scope.editSource = !$scope.editSource;
        if ($scope.editSource) {
          $scope.source = OmegaSwitchProfileSource.createSource($scope.profile, $scope.attachedOptions);
        } else {
          if (!parseSource()) {
            return;
          }
          $scope.source = null;
          OmegaSwitchProfileStartup.markRulesLoaded($scope);
        }
        return omegaTarget.state(stateEditorKey, {
          editSource: $scope.editSource
        });
      });
    };
    $rootScope.$on('$stateChangeStart', function(event, _, __, fromState) {
      var sourceValid;
      if ($scope.editSource && $scope.source.touched) {
        sourceValid = parseSource();
        if (!sourceValid) {
          return event.preventDefault();
        }
      }
    });
    $scope.$on('omegaApplyOptions', function(event) {
      var attachedValidation;
      attachedValidation = OmegaSwitchProfileSource.validateAttachedRuleList($scope.attached, $scope.options, trFilter);
      $scope.attachedRuleListError = attachedValidation.error;
      if (!attachedValidation.valid) {
        event.preventDefault();
        angular.element('#attached-rulelist')[0].focus();
      } else if (attachedValidation.format) {
        $scope.attached.format = attachedValidation.format;
      }
      if (OmegaSwitchProfileSource.shouldApplyTouchedSource($scope.editSource, $scope.source)) {
        event.preventDefault();
        if (parseSource()) {
          $scope.source.touched = false;
          return $timeout(function() {
            return $rootScope.applyOptions();
          });
        }
      }
    });
    return omegaTarget.state(stateEditorKey).then(function(opts) {
      var getState;
      if (opts != null ? opts.editSource : void 0) {
        return $scope.toggleSource();
      } else {
        OmegaSwitchProfileStartup.markRulesLoaded($scope);
        getState = omegaTarget.state(['web.switchGuide', 'firstRun']);
        return $q.all([rulesReady, getState]).then(function(arg) {
          var _, firstRun, ref, switchGuide;
          _ = arg[0], (ref = arg[1], switchGuide = ref[0], firstRun = ref[1]);
          if (!OmegaSwitchProfileStartup.shouldShowSwitchGuide($scope.profile, firstRun, switchGuide)) {
            return;
          }
          omegaTarget.state('web.switchGuide', 'shown');
          return $script('js/switch_profile_guide.js');
        });
      }
    });
  });

}).call(this);
