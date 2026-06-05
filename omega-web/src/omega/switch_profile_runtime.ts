namespace OmegaSwitchProfileRuntime {
  type Disposer = () => void;

  function addDisposer(disposers: Disposer[], disposer?: Disposer | Disposer[]) {
    if (!disposer) {
      return;
    }
    if (Array.isArray(disposer)) {
      for (var i = 0; i < disposer.length; i++) {
        addDisposer(disposers, disposer[i]);
      }
      return;
    }
    if (typeof disposer === 'function') {
      var active = true;
      disposers.push(function() {
        if (!active) {
          return;
        }
        active = false;
        return disposer();
      });
      return;
    }
  }

  export function initialize(scope: any, deps: any) {
    var attachedSourceCache, disposers, exportLegacyRuleList, exportRuleList, readyState, stateEditorKey;
    disposers = [];
    exportRuleList = OmegaSwitchProfileExport.createExportRuleListAction(scope, deps.trFilter, deps.downloadFile);
    exportLegacyRuleList = OmegaSwitchProfileExport.createExportLegacyRuleListAction(scope, deps.trFilter, deps.downloadFile);
    scope.conditionHelp = {
      show: deps.$location.search().help === 'condition'
    };
    addDisposer(disposers, OmegaSwitchProfileOptions.watchConditionMode(scope, exportRuleList, exportLegacyRuleList));
    readyState = OmegaSwitchProfileSession.createReadyState(deps.$q);
    addDisposer(disposers, OmegaSwitchProfileSession.watchRulesReady(scope, readyState));
    addDisposer(disposers, OmegaSwitchProfileAttached.watchAttachedIdentity(scope, deps.getAttachedName));
    addDisposer(disposers, OmegaSwitchProfileAttached.watchAttachedProfile(scope));
    addDisposer(disposers, scope.watchAndUpdateRevision('options[attachedKey]'));
    attachedSourceCache = {};
    addDisposer(disposers, OmegaSwitchProfileAttached.watchAttachedSourceChanges(scope, attachedSourceCache));
    scope.attachedOptions = OmegaSwitchProfileAttached.createAttachedOptions();
    addDisposer(disposers, OmegaSwitchProfileAttached.watchAttachedOptionSync(scope, readyState));
    stateEditorKey = 'web._profileEditor.' + scope.profile.name;
    scope.loadRules = false;
    scope.editSource = false;
    scope.createRuleSource = function() {
      return OmegaSwitchProfileSource.createSource(scope.profile, scope.attachedOptions);
    };
    scope.applyRuleSource = function(source: OmegaSwitchProfileSource.SourceState) {
      var valid;
      valid = OmegaSwitchProfileSource.parseSource(scope.profile, scope.attached, scope.attachedName, scope.attachedOptions, source, scope.options, deps.trFilter);
      if (!valid) {
        scope.editSource = true;
        return {
          ok: false,
          source: source
        };
      }
      return {
        ok: true
      };
    };
    scope.persistRuleEditorState = function(editSource: boolean) {
      return deps.omegaTarget.state(stateEditorKey, {
        editSource: editSource
      });
    };
    scope.markSwitchRulesLoaded = function() {
      return OmegaSwitchProfileStartup.markRulesLoaded(scope);
    };
    OmegaSwitchProfileBindings.bindScopeActions(scope, {
      $modal: deps.$modal,
      $q: deps.$q,
      $timeout: deps.$timeout,
      omegaTarget: deps.omegaTarget,
      reactModalTemplates: deps.reactModalTemplates,
      readyState: readyState,
      stateEditorKey: stateEditorKey,
      trFilter: deps.trFilter
    });
    addDisposer(disposers, OmegaSwitchProfileLifecycle.registerStateChangeGuard(scope, deps.$rootScope, deps.trFilter));
    addDisposer(disposers, OmegaSwitchProfileLifecycle.registerApplyOptionsGuard(scope, deps.$rootScope, deps.$timeout, deps.trFilter));
    OmegaSwitchProfileLifecycle.restoreEditorState(scope, {
      $q: deps.$q,
      omegaTarget: deps.omegaTarget,
      readyState: readyState,
      stateEditorKey: stateEditorKey
    });
    return function dispose() {
      var disposer;
      while (disposers.length) {
        disposer = disposers.pop();
        if (disposer) {
          disposer();
        }
      }
    };
  }
}
