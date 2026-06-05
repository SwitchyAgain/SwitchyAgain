namespace OmegaSwitchProfileAttached {
  function runtime() {
    return (window as any).OmegaReactSwitchProfileRuntime;
  }

  export function watchAttachedIdentity(scope: any, getAttachedName: (name: string) => string) {
    return scope.$watch('profile.name', function(name) {
      var identity;
      identity = OmegaSwitchProfileState.createAttachedIdentity(name, getAttachedName);
      scope.attachedName = identity.attachedName;
      return scope.attachedKey = identity.attachedKey;
    });
  }

  export function watchAttachedProfile(scope: any) {
    return scope.$watch('options[attachedKey]', function(attached) {
      return scope.attached = attached;
    });
  }

  export function watchAttachedSourceChanges(scope: any, cache: OmegaSwitchProfileState.AttachedSourceCache) {
    return scope.$watch('options[attachedKey]', function(attached, oldAttached) {
      return OmegaSwitchProfileState.preserveAttachedUpdateOnSourceChange(attached, oldAttached, cache);
    }, true);
  }

  export function createAttachedOptions() {
    return {
      enabled: false
    };
  }

  export function watchAttachedOptionSync(scope: any, readyState: any) {
    return [
      scope.$watch('profile.defaultProfileName', function(name) {
        if (runtime() && runtime().syncAttachedOptionsFromProfile) {
          return runtime().syncAttachedOptionsFromProfile(scope.profile, scope.attached, scope.attachedName, scope.attachedOptions);
        }
        return OmegaSwitchProfileState.syncOptionsFromProfileDefault(name, scope.attachedName, scope.attached, scope.attachedOptions);
      }),
      scope.$watch('attachedOptions.enabled', function(enabled, oldValue) {
        if (runtime() && runtime().setAttachedEnabled) {
          return runtime().setAttachedEnabled(scope.profile, scope.attached, scope.attachedName, scope.attachedOptions, enabled, oldValue);
        }
        return OmegaSwitchProfileState.setAttachedEnabled(scope.profile, scope.attached, scope.attachedName, scope.attachedOptions, enabled, oldValue);
      }),
      scope.$watch('attached.defaultProfileName', function(name) {
        if (runtime() && runtime().syncDefaultFromAttached) {
          return runtime().syncDefaultFromAttached(scope.attachedOptions, scope.attachedOptions.enabled, name);
        }
        return OmegaSwitchProfileState.syncDefaultFromAttached(scope.attachedOptions, scope.attachedOptions.enabled, name);
      }),
      scope.$watch('attachedOptions.defaultProfileName', function(name) {
        readyState.attachedReadyDefer.resolve();
        if (runtime() && runtime().setDefaultProfile) {
          return runtime().setDefaultProfile(scope.profile, scope.attached, scope.attachedOptions, name);
        }
        return OmegaSwitchProfileState.setDefaultProfile(scope.profile, scope.attached, scope.attachedOptions, name);
      })
    ];
  }

  export function attachNew(scope: any) {
    if (runtime() && runtime().attachNew) {
      scope.attached = runtime().attachNew(scope.options, scope.attachedKey, scope.profile, scope.attachedName, scope.attachedOptions);
      return scope.attached;
    }
    scope.attached = OmegaSwitchProfileState.attachNew(scope.options, scope.attachedKey, scope.profile, scope.attachedName, scope.attachedOptions);
    return scope.attached;
  }

  export function removeAttached(scope: any) {
    if (runtime() && runtime().removeAttached) {
      return runtime().removeAttached(scope.options, scope.attachedKey, scope.profile, scope.attached);
    }
    return OmegaSwitchProfileState.removeAttached(scope.options, scope.attachedKey, scope.profile, scope.attached);
  }

  export function createDeleteAttachedScope(parentScope: any) {
    var scope = parentScope.$new('isolate');
    scope.attached = parentScope.attached;
    scope.dispNameFilter = parentScope.dispNameFilter;
    scope.options = parentScope.options;
    return scope;
  }
}
