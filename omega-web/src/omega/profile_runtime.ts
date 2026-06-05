namespace OmegaProfileRuntime {
  type Disposer = () => void;

  function once(disposer?: Disposer) {
    var active = true;
    return function() {
      if (!active) {
        return;
      }
      active = false;
      if (disposer) {
        return disposer();
      }
    };
  }

  function profileKey(name: string) {
    return OmegaPac.Profiles.nameAsKey(name);
  }

  function normalizeLegacyRuleListProfile(profile: any) {
    if (OmegaPac.Profiles.formatByType[profile.profileType]) {
      profile.format = OmegaPac.Profiles.formatByType[profile.profileType];
      profile.profileType = 'RuleListProfile';
    }
  }

  function createRevisionWatcher() {
    return function(this: any, expression: string) {
      var onChange, revisionChanged;
      revisionChanged = false;
      onChange = function(profile: any, oldProfile: any) {
        if (profile === oldProfile || !profile || !oldProfile) {
          return profile;
        }
        if (revisionChanged && profile.revision !== oldProfile.revision) {
          return revisionChanged = false;
        } else {
          OmegaPac.Profiles.updateRevision(profile);
          return revisionChanged = true;
        }
      };
      return this.$watch(expression, onChange, true);
    };
  }

  function createDeleteProfile(scope: any, deps: any) {
    return function() {
      var key, parent, pname, profileName, refProfiles, refSet, refs, modalScope;
      profileName = scope.profile.name;
      refs = OmegaPac.Profiles.referencedBySet(profileName, deps.$rootScope.options);
      modalScope = deps.$rootScope.$new('isolate');
      modalScope.profile = scope.profile;
      modalScope.dispNameFilter = scope.dispNameFilter;
      modalScope.options = scope.options;
      if (Object.keys(refs).length > 0) {
        refSet = {};
        for (key in refs) {
          if (!Object.prototype.hasOwnProperty.call(refs, key)) continue;
          pname = refs[key];
          parent = deps.getParentName(pname);
          if (parent) {
            key = OmegaPac.Profiles.nameAsKey(parent);
            pname = parent;
          }
          refSet[key] = pname;
        }
        refProfiles = [];
        for (key in refSet) {
          if (!Object.prototype.hasOwnProperty.call(refSet, key)) continue;
          refProfiles.push(OmegaPac.Profiles.byKey(key, deps.$rootScope.options));
        }
        modalScope.refs = refProfiles;
        deps.$modal.open({
          template: deps.reactModalTemplates.cannotDeleteProfile,
          scope: modalScope
        });
      } else {
        return deps.$modal.open({
          template: deps.reactModalTemplates.deleteProfile,
          scope: modalScope
        }).result.then(function() {
          var attachedName, i, j, quickSwitch, ref;
          attachedName = deps.getAttachedName(profileName);
          delete deps.$rootScope.options[profileKey(attachedName)];
          delete deps.$rootScope.options[profileKey(profileName)];
          if (deps.$rootScope.options['-startupProfileName'] === profileName) {
            deps.$rootScope.options['-startupProfileName'] = "";
          }
          quickSwitch = deps.$rootScope.options['-quickSwitchProfiles'];
          for (i = j = 0, ref = quickSwitch.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
            if (profileName === quickSwitch[i]) {
              quickSwitch.splice(i, 1);
              break;
            }
          }
          return deps.$state.go('ui');
        });
      }
    };
  }

  function watchProfile(scope: any, deps: any) {
    var name, unwatchOptionsReady, unwatchProfile, unwatchRevision;
    name = deps.$stateParams.name;
    unwatchOptionsReady = null;
    unwatchRevision = null;
    unwatchProfile = scope.$watch((function() {
      var ref;
      return (ref = scope.options) != null ? ref['+' + name] : void 0;
    }), function(profile: any) {
      if (!profile) {
        if (scope.options) {
          if (unwatchProfile) {
            unwatchProfile();
          }
          deps.$location.path('/');
        } else {
          unwatchOptionsReady = scope.$watch('options', function() {
            if (scope.options) {
              if (unwatchOptionsReady) {
                unwatchOptionsReady();
                unwatchOptionsReady = null;
              }
              if (!scope.options['+' + name]) {
                if (unwatchProfile) {
                  unwatchProfile();
                }
                return deps.$location.path('/');
              }
            }
          });
        }
        return;
      }
      normalizeLegacyRuleListProfile(profile);
      scope.profile = profile;
      scope.scriptable = true;
      if (unwatchRevision) {
        unwatchRevision();
      }
      unwatchRevision = scope.watchAndUpdateRevision('profile');
    });
    return function() {
      if (unwatchRevision) {
        unwatchRevision();
        unwatchRevision = null;
      }
      if (unwatchOptionsReady) {
        unwatchOptionsReady();
        unwatchOptionsReady = null;
      }
      if (unwatchProfile) {
        unwatchProfile();
        unwatchProfile = null;
      }
    };
  }

  export function initialize(scope: any, deps: any) {
    var disposeProfileWatch;
    scope.getProfileColor = function() {
      var color, profile;
      color = void 0;
      profile = scope.profile;
      while (profile) {
        color = profile.color;
        profile = deps.getVirtualTarget(profile, scope.options);
      }
      return color;
    };
    scope.deleteProfile = createDeleteProfile(scope, deps);
    scope.watchAndUpdateRevision = createRevisionWatcher();
    scope.exportRuleList = null;
    scope.exportRuleListOptions = null;
    scope.setExportRuleListHandler = function(exportRuleList: any, options: any) {
      scope.exportRuleList = exportRuleList;
      return scope.exportRuleListOptions = options;
    };
    disposeProfileWatch = once(watchProfile(scope, deps));
    return disposeProfileWatch;
  }
}
