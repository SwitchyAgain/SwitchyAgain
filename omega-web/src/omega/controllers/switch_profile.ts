(function() {
  angular.module('omega').controller('SwitchProfileCtrl', function($scope, $rootScope, $location, $timeout, $q, $modal, profileIcons, getAttachedName, omegaTarget, trFilter, downloadFile, reactModalTemplates) {
    var attachedSourceCache, exportLegacyRuleList, exportRuleList, readyState, stateEditorKey, stopWatchingForRules, unwatchRules;
    exportRuleList = OmegaSwitchProfileExport.createExportRuleListAction($scope, trFilter, downloadFile);
    exportLegacyRuleList = OmegaSwitchProfileExport.createExportLegacyRuleListAction($scope, trFilter, downloadFile);
    $scope.conditionHelp = {
      show: $location.search().help === 'condition'
    };
    unwatchRules = OmegaSwitchProfileOptions.watchConditionMode($scope, exportRuleList, exportLegacyRuleList);
    readyState = OmegaSwitchProfileSession.createReadyState($q);
    stopWatchingForRules = OmegaSwitchProfileSession.watchRulesReady($scope, readyState);
    OmegaSwitchProfileAttached.watchAttachedIdentity($scope, getAttachedName);
    OmegaSwitchProfileAttached.watchAttachedProfile($scope);
    $scope.watchAndUpdateRevision('options[attachedKey]');
    attachedSourceCache = {};
    OmegaSwitchProfileAttached.watchAttachedSourceChanges($scope, attachedSourceCache);
    $scope.attachedOptions = OmegaSwitchProfileAttached.createAttachedOptions();
    OmegaSwitchProfileAttached.watchAttachedOptionSync($scope, readyState);
    stateEditorKey = 'web._profileEditor.' + $scope.profile.name;
    $scope.loadRules = false;
    $scope.editSource = false;
    OmegaSwitchProfileBindings.bindScopeActions($scope, {
      $modal: $modal,
      $q: $q,
      $timeout: $timeout,
      omegaTarget: omegaTarget,
      reactModalTemplates: reactModalTemplates,
      readyState: readyState,
      stateEditorKey: stateEditorKey,
      trFilter: trFilter
    });
    OmegaSwitchProfileLifecycle.registerStateChangeGuard($scope, $rootScope, trFilter);
    OmegaSwitchProfileLifecycle.registerApplyOptionsGuard($scope, $rootScope, $timeout, trFilter);
    return OmegaSwitchProfileLifecycle.restoreEditorState($scope, {
      $q: $q,
      omegaTarget: omegaTarget,
      readyState: readyState,
      stateEditorKey: stateEditorKey
    });
  });

}).call(this);
