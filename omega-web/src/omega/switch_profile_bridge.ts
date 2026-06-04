namespace OmegaSwitchProfileBridge {
  function attachedName(scope: any) {
    var ref;
    return ((ref = scope.attached) != null ? ref.name : void 0) || '';
  }

  function rules(scope: any) {
    return scope.profile && scope.profile.rules || [];
  }

  function dirtyIfChanged(scope: any, changed: boolean) {
    if (changed) {
      scope.$root.optionsDirty = true;
    }
  }

  export function buildProps(scope: any) {
    var currentRules;
    currentRules = rules(scope);
    return {
      attached: scope.attached,
      attachedRuleListError: scope.attachedRuleListError,
      attachedOptions: scope.attachedOptions,
      editSource: scope.editSource,
      loadRules: scope.loadRules,
      onAddNote: function(index) {
        return scope.addNote(index);
      },
      onAddRule: function() {
        return scope.addRule();
      },
      onAttachNew: function() {
        return scope.attachNew();
      },
      onAttachedChange: function(field, value) {
        return scope.$evalAsync(function() {
          if (scope.attached) {
            return scope.attached[field] = value;
          }
        });
      },
      onAttachedEnabledChange: function(enabled) {
        return scope.$evalAsync(function() {
          return scope.attachedOptions.enabled = enabled;
        });
      },
      onAttachedMatchProfileChange: function(name) {
        return scope.$evalAsync(function() {
          if (scope.attached) {
            return scope.attached.matchProfileName = name;
          }
        });
      },
      onCloneRule: function(index) {
        return scope.$evalAsync(function() {
          return scope.cloneRule(index);
        });
      },
      onClose: function() {
        return scope.$evalAsync(function() {
          return scope.conditionHelp.show = false;
        });
      },
      onConditionFieldChange: function(index, field, value) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateConditionField(rules(scope)[index], field, value));
        });
      },
      onConditionTypeChange: function(index, type) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateConditionType(rules(scope)[index], type));
        });
      },
      onDefaultProfileChange: function(name) {
        return scope.$evalAsync(function() {
          return scope.attachedOptions.defaultProfileName = name;
        });
      },
      onDownload: function(profileName) {
        return scope.updateProfile(profileName);
      },
      onIpConditionInputChange: function(index, value) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateIpCondition(rules(scope)[index], value));
        });
      },
      onMoveRule: function(fromIndex, toIndex) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.moveRule(rules(scope), fromIndex, toIndex));
        });
      },
      onNoteChange: function(index, note) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateRuleNote(rules(scope)[index], note));
        });
      },
      onProfileChange: function(index, name) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateRuleProfile(rules(scope)[index], name));
        });
      },
      onRemoveAttached: function() {
        return scope.removeAttached();
      },
      onRemoveRule: function(index) {
        return scope.removeRule(index);
      },
      onResetRules: function() {
        return scope.resetRules();
      },
      onSourceChange: function(code) {
        return scope.$evalAsync(function() {
          if (scope.source) {
            scope.source.code = code;
            scope.source.touched = true;
            return scope.$root.optionsDirty = true;
          }
        });
      },
      onToggleConditionHelp: function() {
        return scope.$evalAsync(function() {
          return scope.conditionHelp.show = !scope.conditionHelp.show;
        });
      },
      onToggleSource: function() {
        return scope.toggleSource();
      },
      onWeekdayChange: function(index, dayIndex, selected) {
        return scope.$evalAsync(function() {
          return dirtyIfChanged(scope, OmegaSwitchProfileState.updateRuleWeekday(rules(scope)[index], dayIndex, selected));
        });
      },
      options: scope.options,
      profile: scope.profile,
      rules: currentRules,
      show: scope.conditionHelp && scope.conditionHelp.show,
      showConditionTypes: scope.showConditionTypes,
      showNotes: scope.showNotes,
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
      scope.$watch('showNotes', render),
      scope.$watch('source', render, true),
      scope.$watch(function() {
        return scope.updatingProfile && scope.updatingProfile[attachedName(scope)];
      }, render)
    ];
  }
}
