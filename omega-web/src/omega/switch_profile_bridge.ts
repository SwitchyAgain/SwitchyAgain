namespace OmegaSwitchProfileBridge {
  function attachedName(scope: any) {
    var ref;
    return ((ref = scope.attached) != null ? ref.name : void 0) || '';
  }

  function rules(scope: any) {
    return scope.profile && scope.profile.rules || [];
  }

  function runtime() {
    return (window as any).OmegaReactSwitchProfileRuntime;
  }

  function dirtyIfChanged(scope: any, changed: boolean) {
    if (changed) {
      scope.$root.optionsDirty = true;
    }
  }

  function digestSoon(scope: any) {
    return scope.$evalAsync(function() {});
  }

  function dirtyAndDigest(scope: any, changed: boolean) {
    dirtyIfChanged(scope, changed);
    return digestSoon(scope);
  }

  function syncEditorState(scope: any, state: any) {
    scope.editSource = !!state.editSource;
    scope.source = state.source || null;
    return digestSoon(scope);
  }

  export function buildProps(scope: any) {
    var currentRules;
    currentRules = rules(scope);
    return {
      attached: scope.attached,
      attachedRuleListError: scope.attachedRuleListError,
      attachedOptions: scope.attachedOptions,
      confirmDeletion: !!scope.options['-confirmDeletion'],
      editSource: scope.editSource,
      loadRules: scope.loadRules,
      onAddNote: function(index) {
        return digestSoon(scope);
      },
      onAddRule: function() {
        if (runtime() && runtime().addRule) {
          return dirtyAndDigest(scope, runtime().addRule(scope.profile, scope.attachedOptions.defaultProfileName));
        }
        scope.addRule();
        return dirtyAndDigest(scope, true);
      },
      onApplySource: function(source) {
        var result;
        result = scope.applyRuleSource ? scope.applyRuleSource(source) : {
          ok: true
        };
        digestSoon(scope);
        return result;
      },
      onAttachNew: function() {
        if (runtime() && runtime().attachNew) {
          scope.attached = runtime().attachNew(scope.options, scope.attachedKey, scope.profile, scope.attachedName, scope.attachedOptions);
          return dirtyAndDigest(scope, true);
        }
        scope.attachNew();
        return dirtyAndDigest(scope, true);
      },
      onAttachedChange: function(field, value) {
        if (scope.attached) {
          scope.attached[field] = value;
        }
        return digestSoon(scope);
      },
      onAttachedEnabledChange: function(enabled) {
        scope.attachedOptions.enabled = enabled;
        return digestSoon(scope);
      },
      onAttachedMatchProfileChange: function(name) {
        if (scope.attached) {
          scope.attached.matchProfileName = name;
        }
        return digestSoon(scope);
      },
      onCloneRule: function(index) {
        if (runtime() && runtime().cloneRule) {
          return dirtyAndDigest(scope, runtime().cloneRule(scope.profile, index));
        }
        scope.cloneRule(index);
        return dirtyAndDigest(scope, true);
      },
      onConditionHelpChange: function(shown) {
        scope.conditionHelp.show = !!shown;
        return digestSoon(scope);
      },
      onClose: function() {
        scope.conditionHelp.show = false;
        return digestSoon(scope);
      },
      onConditionFieldChange: function(index, field, value) {
        if (runtime() && runtime().updateConditionField) {
          return dirtyAndDigest(scope, runtime().updateConditionField(rules(scope)[index], field, value));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateConditionField(rules(scope)[index], field, value));
      },
      onConditionTypeChange: function(index, type) {
        if (runtime() && runtime().updateConditionType) {
          return dirtyAndDigest(scope, runtime().updateConditionType(rules(scope)[index], type));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateConditionType(rules(scope)[index], type));
      },
      onCreateSource: function() {
        if (scope.createRuleSource) {
          return scope.createRuleSource();
        }
        return null;
      },
      onDefaultProfileChange: function(name) {
        scope.attachedOptions.defaultProfileName = name;
        return digestSoon(scope);
      },
      onDownload: function(profileName) {
        return scope.updateProfile(profileName);
      },
      onEditorModeChange: function(editSource) {
        if (scope.persistRuleEditorState) {
          return scope.persistRuleEditorState(!!editSource);
        }
      },
      onEditorStateChange: function(state) {
        return syncEditorState(scope, state);
      },
      onIpConditionInputChange: function(index, value) {
        if (runtime() && runtime().updateIpCondition) {
          return dirtyAndDigest(scope, runtime().updateIpCondition(rules(scope)[index], value));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateIpCondition(rules(scope)[index], value));
      },
      onMoveRule: function(fromIndex, toIndex) {
        if (runtime() && runtime().moveRule) {
          return dirtyAndDigest(scope, runtime().moveRule(rules(scope), fromIndex, toIndex));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.moveRule(rules(scope), fromIndex, toIndex));
      },
      onNoteChange: function(index, note) {
        if (runtime() && runtime().updateRuleNote) {
          return dirtyAndDigest(scope, runtime().updateRuleNote(rules(scope)[index], note));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateRuleNote(rules(scope)[index], note));
      },
      onProfileChange: function(index, name) {
        if (runtime() && runtime().updateRuleProfile) {
          return dirtyAndDigest(scope, runtime().updateRuleProfile(rules(scope)[index], name));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateRuleProfile(rules(scope)[index], name));
      },
      onRemoveAttached: function() {
        if (runtime() && runtime().removeAttached && scope.attached) {
          return dirtyAndDigest(scope, runtime().removeAttached(scope.options, scope.attachedKey, scope.profile, scope.attached) !== false);
        }
        return scope.removeAttachedDirect ? dirtyAndDigest(scope, scope.removeAttachedDirect() !== false) : digestSoon(scope);
      },
      onRemoveRule: function(index) {
        if (runtime() && runtime().removeRule) {
          return dirtyAndDigest(scope, runtime().removeRule(scope.profile, index));
        }
        return scope.removeRuleDirect ? dirtyAndDigest(scope, scope.removeRuleDirect(index) !== false) : digestSoon(scope);
      },
      onResetRules: function() {
        if (runtime() && runtime().resetRuleProfiles) {
          return dirtyAndDigest(scope, runtime().resetRuleProfiles(scope.profile, scope.attachedOptions.defaultProfileName));
        }
        return scope.resetRulesDirect ? dirtyAndDigest(scope, scope.resetRulesDirect() !== false) : digestSoon(scope);
      },
      onRulesLoaded: function() {
        if (scope.markSwitchRulesLoaded) {
          scope.markSwitchRulesLoaded();
        }
        return digestSoon(scope);
      },
      onSourceChange: function(code) {
        if (scope.source) {
          scope.source.code = code;
          scope.source.touched = true;
          scope.$root.optionsDirty = true;
        }
        return digestSoon(scope);
      },
      onSourceDraftChange: function(source) {
        scope.source = source;
        scope.$root.optionsDirty = true;
        return digestSoon(scope);
      },
      onToggleConditionHelp: function() {
        scope.conditionHelp.show = !scope.conditionHelp.show;
        return digestSoon(scope);
      },
      onToggleSource: function() {
        return scope.toggleSource();
      },
      onWeekdayChange: function(index, dayIndex, selected) {
        if (runtime() && runtime().updateRuleWeekday) {
          return dirtyAndDigest(scope, runtime().updateRuleWeekday(rules(scope)[index], dayIndex, selected));
        }
        return dirtyAndDigest(scope, OmegaSwitchProfileState.updateRuleWeekday(rules(scope)[index], dayIndex, selected));
      },
      options: scope.options,
      profile: scope.profile,
      rules: currentRules,
      show: scope.conditionHelp && scope.conditionHelp.show,
      showConditionTypes: scope.showConditionTypes,
      showNotes: runtime() && runtime().hasNotes ? runtime().hasNotes(currentRules) : OmegaSwitchProfileRules.hasNotes(currentRules),
      source: scope.source,
      updating: !!(scope.updatingProfile && scope.updatingProfile[attachedName(scope)])
    };
  }

  export function watchProps(scope: any, render: () => void) {
    return [
      scope.$watch('attached', render, true),
      scope.$watch('attachedRuleListError', render),
      scope.$watch('attachedOptions', render, true),
      scope.$watch('conditionHelp.show', render),
      scope.$watch('editSource', render),
      scope.$watch('loadRules', render),
      scope.$watch('options', render, true),
      scope.$watch('profile.rules', render, true),
      scope.$watch('showConditionTypes', render),
      scope.$watch('source', render, true),
      scope.$watch(function() {
        return scope.updatingProfile && scope.updatingProfile[attachedName(scope)];
      }, render)
    ];
  }
}
