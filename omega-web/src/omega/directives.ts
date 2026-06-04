(function() {
  angular.module('omega').directive('omegaReactImportExport', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var invoke, mount, mounted, props, render, unwatchOptions, unwatchOptionsDirty;
        invoke = function(action) {
          return new Promise(function(resolve, reject) {
            return scope.$evalAsync(function() {
              try {
                return Promise.resolve(action()).then(resolve, reject);
              } catch (error) {
                return reject(error);
              }
            });
          });
        };
        props = function() {
          return {
            embedded: true,
            options: scope.$root.options,
            optionsDirty: scope.$root.optionsDirty,
            onApplyOptions: function() {
              return invoke(function() {
                var result;
                result = scope.$root.applyOptions();
                if (!result) {
                  return Promise.reject('form_invalid');
                }
                return result;
              });
            },
            onImportSuccess: function() {
              return invoke(function() {
                return scope.$root.showAlert({
                  type: 'success',
                  i18n: 'options_importSuccess',
                  message: 'Options imported.'
                });
              });
            },
            onOptionsReplace: function(nextOptions, options) {
              return scope.$evalAsync(function() {
                var dirty;
                options || (options = {});
                dirty = options.dirty;
                scope.$root.options = nextOptions;
                scope.$root.optionsOld = angular.copy(nextOptions);
                return $timeout(function() {
                  return scope.$root.optionsDirty = dirty != null ? dirty : false;
                });
              });
            }
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          var bridge;
          bridge = window.OmegaReactImportExport;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
            unwatchOptionsDirty = scope.$root.$watch('optionsDirty', render);
            unwatchOptions = scope.$root.$watch('options', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchOptions) {
            unwatchOptions();
          }
          if (unwatchOptionsDirty) {
            unwatchOptionsDirty();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactGeneralSettings', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, unwatch;
        props = function() {
          return {
            embedded: true,
            options: scope.$root.options,
            onOptionsChange: function(nextOptions) {
              return scope.$evalAsync(function() {
                var key, results;
                results = [];
                for (key in nextOptions) {
                  results.push(scope.$root.options[key] = nextOptions[key]);
                }
                return results;
              });
            }
          };
        };
        mount = function() {
          bridge = window.OmegaReactGeneralSettings;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
            unwatch = scope.$root.$watch('options', function(options, oldOptions) {
              if (options !== oldOptions && (mounted != null ? mounted.render : void 0)) {
                return mounted.render(props());
              }
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatch) {
            unwatch();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactUiSettings', function($timeout, omegaTarget) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, unwatch;
        props = function() {
          return {
            embedded: true,
            options: scope.$root.options,
            onOpenShortcutConfig: function() {
              return omegaTarget.openShortcutConfig();
            },
            onOptionsChange: function(nextOptions) {
              return scope.$evalAsync(function() {
                var key, results;
                results = [];
                for (key in nextOptions) {
                  results.push(scope.$root.options[key] = nextOptions[key]);
                }
                return results;
              });
            }
          };
        };
        mount = function() {
          bridge = window.OmegaReactUiSettings;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
            unwatch = scope.$root.$watch('options', function(options, oldOptions) {
              if (options !== oldOptions && (mounted != null ? mounted.render : void 0)) {
                return mounted.render(props());
              }
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatch) {
            unwatch();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactAbout', function($timeout, $modal, omegaDebug, reactModalTemplates) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props;
        props = function() {
          var version;
          try {
            version = omegaDebug.getProjectVersion();
          } catch (error) {
            version = '?.?.?';
          }
          return {
            embedded: true,
            isExperimental: scope.isExperimental,
            version: version,
            onDownloadLog: omegaDebug.downloadLog,
            onResetOptions: function() {
              return $modal.open({
                template: reactModalTemplates.resetOptionsConfirm
              }).result.then(function() {
                return omegaDebug.resetOptions();
              });
            }
          };
        };
        mount = function() {
          bridge = window.OmegaReactAbout;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactConfirmModal', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactConfirmModal;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], {
              attached: scope.attached,
              fromName: scope.fromName,
              kind: attrs.modalKind,
              onClose: function(value) {
                return scope.$close(value || 'ok');
              },
              onDismiss: function() {
                return scope.$dismiss();
              },
              options: scope.options,
              profile: scope.profile,
              refs: scope.refs,
              rule: scope.rule,
              ruleProfile: scope.ruleProfile,
              toName: scope.toName
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactRenameProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactProfileModals;
          if (bridge != null ? bridge.mountRenameProfile : void 0) {
            mounted = bridge.mountRenameProfile(element[0], {
              fromName: scope.fromName,
              isProfileNameHidden: scope.isProfileNameHidden,
              isProfileNameReserved: scope.isProfileNameReserved,
              onClose: function(name) {
                return scope.$close(name);
              },
              onDismiss: function() {
                return scope.$dismiss();
              },
              profileByName: scope.profileByName
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactNewProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactProfileModals;
          if (bridge != null ? bridge.mountNewProfile : void 0) {
            mounted = bridge.mountNewProfile(element[0], {
              isProfileNameHidden: scope.isProfileNameHidden,
              isProfileNameReserved: scope.isProfileNameReserved,
              onClose: function(profile) {
                return scope.$close(profile);
              },
              onDismiss: function() {
                return scope.$dismiss();
              },
              pacProfilesUnsupported: scope.pacProfilesUnsupported,
              profileByName: scope.profileByName
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactProxyAuth', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactProfileModals;
          if (bridge != null ? bridge.mountProxyAuth : void 0) {
            mounted = bridge.mountProxyAuth(element[0], {
              auth: scope.auth,
              authSupported: scope.authSupported,
              onClose: function(auth) {
                return scope.$close(auth);
              },
              onDismiss: function() {
                return scope.$dismiss();
              },
              protocolDisp: scope.protocolDisp
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactUnsupportedProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountUnsupportedProfile : void 0) {
            mounted = bridge.mountUnsupportedProfile(element[0], {
              profile: scope.profile
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactProfileShell', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchers;
        unwatchers = [];
        props = function() {
          var name, ref, ref1;
          name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
          return {
            exportRuleListAvailable: !!scope.exportRuleList,
            exportRuleListWarning: !!((ref1 = scope.exportRuleListOptions) != null ? ref1.warning : void 0),
            onColorChange: function(color) {
              return scope.$evalAsync(function() {
                if (scope.profile) {
                  return scope.profile.color = color;
                }
              });
            },
            onDelete: function() {
              return scope.deleteProfile(name);
            },
            onExportRuleList: function() {
              if (scope.exportRuleList) {
                return scope.exportRuleList(name);
              }
            },
            onExportScript: function() {
              return scope.exportScript(name);
            },
            onRename: function() {
              return scope.renameProfile(name);
            },
            profile: scope.profile,
            profileColor: scope.getProfileColor ? scope.getProfileColor() : void 0,
            scriptable: !!scope.scriptable
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountProfileShell : void 0) {
            mounted = bridge.mountProfileShell(element[0], props());
            unwatchers.push(scope.$watch('profile', render, true));
            unwatchers.push(scope.$watch('options', render, true));
            unwatchers.push(scope.$watch('exportRuleList', render));
            unwatchers.push(scope.$watch('exportRuleListOptions.warning', render));
            unwatchers.push(scope.$watch('scriptable', render));
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          var i, len, unwatch;
          for (i = 0, len = unwatchers.length; i < len; i++) {
            unwatch = unwatchers[i];
            if (unwatch) {
              unwatch();
            }
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaProfileContentHost', function($compile) {
    var templates;
    templates = {
      FixedProfile: '<div ng-controller="FixedProfileCtrl"><div omega-react-fixed-profile></div></div>',
      PacProfile: '<div omega-react-pac-profile></div>',
      RuleListProfile: '<div omega-react-rule-list-profile></div>',
      SwitchProfile: [
        '<div ng-controller="SwitchProfileCtrl">',
        '  <div omega-react-switch-profile></div>',
        '</div>'
      ].join(''),
      UnsupportedProfile: '<div omega-react-unsupported-profile></div>',
      VirtualProfile: '<div omega-react-virtual-profile></div>'
    };
    return {
      restrict: 'A',
      link: function(scope, element) {
        var childScope, currentType, render, unwatch;
        currentType = null;
        render = function(profile) {
          var template, type;
          type = (profile != null ? profile.profileType : void 0) || 'UnsupportedProfile';
          if (type === currentType) {
            return;
          }
          currentType = type;
          if (childScope) {
            childScope.$destroy();
          }
          element.empty();
          childScope = scope.$new();
          template = templates[type] || templates.UnsupportedProfile;
          element.html(template);
          return $compile(element.contents())(childScope);
        };
        unwatch = scope.$watch('profile.profileType', function() {
          return render(scope.profile);
        });
        render(scope.profile);
        return scope.$on('$destroy', function() {
          if (unwatch) {
            unwatch();
          }
          if (childScope) {
            childScope.$destroy();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactVirtualProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props;
        props = function() {
          return {
            onReplaceProfile: function(fromName, toName) {
              return scope.replaceProfile(fromName, toName);
            },
            onTargetChange: function(name) {
              return scope.$evalAsync(function() {
                return scope.profile.defaultProfileName = name;
              });
            },
            options: scope.options,
            profile: scope.profile
          };
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountVirtualProfile : void 0) {
            mounted = bridge.mountVirtualProfile(element[0], props());
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactPacProfile', function($timeout, $modal, reactModalTemplates) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, oldLastUpdate, oldPacScript, oldPacUrl, props, referenced, render, unwatchProfile, unwatchUpdating;
        oldPacUrl = null;
        oldLastUpdate = null;
        oldPacScript = null;
        referenced = function() {
          var set;
          set = OmegaPac.Profiles.referencedBySet(scope.profile, scope.options);
          return Object.keys(set).length > 0;
        };
        props = function() {
          var name, ref;
          name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
          return {
            onDownload: function(profileName) {
              return scope.updateProfile(profileName);
            },
            onEditProxyAuth: function() {
              var auth, modalScope, prop, ref1;
              prop = 'all';
              auth = (ref1 = scope.profile.auth) != null ? ref1[prop] : void 0;
              modalScope = scope.$new('isolate');
              modalScope.auth = auth && angular.copy(auth);
              return $modal.open({
                template: reactModalTemplates.proxyAuth,
                scope: modalScope,
                size: 'sm'
              }).result.then(function(auth) {
                var base;
                if (!(auth != null ? auth.username : void 0)) {
                  if (scope.profile.auth) {
                    return scope.profile.auth[prop] = void 0;
                  }
                } else {
                  if ((base = scope.profile).auth == null) {
                    base.auth = {};
                  }
                  return scope.profile.auth[prop] = auth;
                }
              });
            },
            onProfileChange: function(field, value) {
              return scope.$evalAsync(function() {
                var previousPacUrl;
                if (!scope.profile) {
                  return;
                }
                if (field === 'pacUrl') {
                  previousPacUrl = scope.profile.pacUrl;
                  if (value !== previousPacUrl) {
                    if (scope.profile.lastUpdate) {
                      oldPacUrl = previousPacUrl;
                      oldLastUpdate = scope.profile.lastUpdate;
                      oldPacScript = scope.profile.pacScript;
                      scope.profile.lastUpdate = null;
                    } else if (oldPacUrl && value === oldPacUrl) {
                      scope.profile.lastUpdate = oldLastUpdate;
                      scope.profile.pacScript = oldPacScript;
                    }
                  }
                }
                return scope.profile[field] = value;
              });
            },
            pacProfilesUnsupported: scope.pacProfilesUnsupported,
            profile: scope.profile,
            referenced: referenced(),
            updating: !!(scope.updatingProfile && scope.updatingProfile[name])
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountPacProfile : void 0) {
            mounted = bridge.mountPacProfile(element[0], props());
            unwatchProfile = scope.$watch('profile', render, true);
            unwatchUpdating = scope.$watch(function() {
              var name, ref;
              name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
              return scope.updatingProfile && scope.updatingProfile[name];
            }, render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchProfile) {
            unwatchProfile();
          }
          if (unwatchUpdating) {
            unwatchUpdating();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactFixedProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchers;
        unwatchers = [];
        props = function() {
          var rules, visibleRuleCount;
          rules = scope.profile && scope.profile.rules || [];
          visibleRuleCount = Math.min(scope.visibleRuleCount || 0, rules.length);
          return {
            bypassList: scope.bypassList,
            isProxyAuthActive: function(scheme) {
              return scope.isProxyAuthActive(scheme);
            },
            onBypassListChange: function(value) {
              return scope.$evalAsync(function() {
                return scope.bypassList = value;
              });
            },
            onEditProxyAuth: function(scheme) {
              return scope.editProxyAuth(scheme);
            },
            onProxyEditorChange: function(scheme, field, value) {
              return scope.$evalAsync(function() {
                var base;
                if (!scope.proxyEditors[scheme]) {
                  scope.proxyEditors[scheme] = {};
                }
                base = scope.proxyEditors[scheme];
                if (typeof value === 'undefined') {
                  return delete base[field];
                } else {
                  return base[field] = value;
                }
              });
            },
            onShowAdvanced: function() {
              return scope.$evalAsync(function() {
                return scope.showAdvanced = true;
              });
            },
            optionsForScheme: scope.optionsForScheme,
            proxyEditors: angular.copy(scope.proxyEditors),
            schemeDisp: scope.schemeDisp,
            showAdvanced: scope.showAdvanced,
            urlSchemes: scope.urlSchemes
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountFixedProfile : void 0) {
            mounted = bridge.mountFixedProfile(element[0], props());
            unwatchers.push(scope.$watch('proxyEditors', render, true));
            unwatchers.push(scope.$watch('bypassList', render));
            unwatchers.push(scope.$watch('showAdvanced', render));
            unwatchers.push(scope.$watch('profile.auth', render, true));
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          var i, len, unwatch;
          for (i = 0, len = unwatchers.length; i < len; i++) {
            unwatch = unwatchers[i];
            if (unwatch) {
              unwatch();
            }
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactRuleListProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchProfile, unwatchUpdating;
        props = function() {
          var name, ref;
          name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
          return {
            onDownload: function(profileName) {
              return scope.updateProfile(profileName);
            },
            onProfileChange: function(field, value) {
              return scope.$evalAsync(function() {
                if (scope.profile) {
                  return scope.profile[field] = value;
                }
              });
            },
            options: scope.options,
            profile: scope.profile,
            updating: !!(scope.updatingProfile && scope.updatingProfile[name])
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountRuleListProfile : void 0) {
            mounted = bridge.mountRuleListProfile(element[0], props());
            unwatchProfile = scope.$watch('profile', render, true);
            unwatchUpdating = scope.$watch(function() {
              var name, ref;
              name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
              return scope.updatingProfile && scope.updatingProfile[name];
            }, render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchProfile) {
            unwatchProfile();
          }
          if (unwatchUpdating) {
            unwatchUpdating();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactSwitchProfile', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchers;
        unwatchers = [];
        props = function() {
          var name, ref, rules, visibleRuleCount;
          rules = scope.profile && scope.profile.rules || [];
          visibleRuleCount = Math.min(scope.visibleRuleCount || 0, rules.length);
          name = ((ref = scope.attached) != null ? ref.name : void 0) || '';
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
                if (OmegaSwitchProfileState.updateConditionField(scope.profile.rules[index], field, value)) {
                  return scope.$root.optionsDirty = true;
                }
              });
            },
            onConditionTypeChange: function(index, type) {
              return scope.$evalAsync(function() {
                if (OmegaSwitchProfileState.updateConditionType(scope.profile.rules[index], type)) {
                  return scope.$root.optionsDirty = true;
                }
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
                if (OmegaSwitchProfileState.updateIpCondition(scope.profile.rules[index], value)) {
                  return scope.$root.optionsDirty = true;
                }
              });
            },
            onMoveRule: function(fromIndex, toIndex) {
              return scope.$evalAsync(function() {
                if (OmegaSwitchProfileState.moveRule(scope.profile.rules, fromIndex, toIndex)) {
                  return scope.$root.optionsDirty = true;
                }
              });
            },
            onNoteChange: function(index, note) {
              return scope.$evalAsync(function() {
                if (OmegaSwitchProfileState.updateRuleNote(scope.profile.rules[index], note)) {
                  return scope.$root.optionsDirty = true;
                }
              });
            },
            onProfileChange: function(index, name) {
              return scope.$evalAsync(function() {
                if (OmegaSwitchProfileState.updateRuleProfile(scope.profile.rules[index], name)) {
                  return scope.$root.optionsDirty = true;
                }
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
                var rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                scope.updateDay(rule.condition, dayIndex, selected);
                return scope.$root.optionsDirty = true;
              });
            },
            options: scope.options,
            profile: scope.profile,
            rules: rules,
            show: scope.conditionHelp && scope.conditionHelp.show,
            showConditionTypes: scope.showConditionTypes,
            showNotes: scope.showNotes,
            source: scope.source,
            updating: !!(scope.updatingProfile && scope.updatingProfile[name]),
            visibleRuleCount: visibleRuleCount
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountSwitchProfile : void 0) {
            mounted = bridge.mountSwitchProfile(element[0], props());
            unwatchers.push(scope.$watch('attached', render, true));
            unwatchers.push(scope.$watch('attachedRuleListError', render));
            unwatchers.push(scope.$watch('attachedOptions', render, true));
            unwatchers.push(scope.$watch('conditionHelp.show', render));
            unwatchers.push(scope.$watch('editSource', render));
            unwatchers.push(scope.$watch('loadRules', render));
            unwatchers.push(scope.$watch('options', render, true));
            unwatchers.push(scope.$watch('profile.rules', render, true));
            unwatchers.push(scope.$watch('showConditionTypes', render));
            unwatchers.push(scope.$watch('showNotes', render));
            unwatchers.push(scope.$watch('source', render, true));
            unwatchers.push(scope.$watch('visibleRuleCount', render));
            unwatchers.push(scope.$watch(function() {
              var name, ref;
              name = ((ref = scope.attached) != null ? ref.name : void 0) || '';
              return scope.updatingProfile && scope.updatingProfile[name];
            }, render));
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          var i, len, unwatch;
          for (i = 0, len = unwatchers.length; i < len; i++) {
            unwatch = unwatchers[i];
            if (unwatch) {
              unwatch();
            }
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactOptionsWelcome', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted;
        mount = function() {
          bridge = window.OmegaReactOptionsModals;
          if (bridge != null ? bridge.mountWelcome : void 0) {
            mounted = bridge.mountWelcome(element[0], {
              onClose: function(result) {
                return scope.$close(result);
              },
              onDismiss: function() {
                return scope.$dismiss();
              },
              upgrade: scope.upgrade
            });
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactOptionsShell', function($timeout, $state, $stateParams) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchers;
        unwatchers = [];
        props = function() {
          return {
            currentProfileName: $stateParams.name || '',
            currentState: ($state.current && $state.current.name) || '',
            generalHref: $state.href('general'),
            importExportHref: $state.href('io'),
            isExperimental: !!scope.isExperimental,
            newProfileHref: '#',
            onApply: function() {
              return scope.applyOptions();
            },
            onDiscard: function() {
              return scope.revertOptions();
            },
            onNavigate: function(state, params) {
              return scope.$evalAsync(function() {
                return $state.go(state, params);
              });
            },
            onNewProfile: function() {
              return scope.newProfile();
            },
            options: scope.options,
            optionsDirty: !!scope.optionsDirty,
            profileHref: function(profile) {
              return $state.href('profile', {
                name: profile.name
              });
            },
            uiHref: $state.href('ui')
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = (window as any).OmegaReactOptionsShell;
          if (bridge != null ? bridge.mountOptionsShell : void 0) {
            mounted = bridge.mountOptionsShell(element[0], props());
            unwatchers.push(scope.$watch('options', render, true));
            unwatchers.push(scope.$watch('optionsDirty', render));
            unwatchers.push(scope.$watch('isExperimental', render));
            unwatchers.push(scope.$on('$stateChangeSuccess', render));
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          var i, len, unwatch;
          for (i = 0, len = unwatchers.length; i < len; i++) {
            unwatch = unwatchers[i];
            if (unwatch) {
              unwatch();
            }
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactOptionsAlert', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchers;
        unwatchers = [];
        props = function() {
          return {
            alert: scope.alert,
            onClose: function() {
              return scope.hideAlert();
            },
            shown: !!scope.alertShown
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = (window as any).OmegaReactOptionsShell;
          if (bridge != null ? bridge.mountOptionsAlert : void 0) {
            mounted = bridge.mountOptionsAlert(element[0], props());
            unwatchers.push(scope.$watch('alert', render, true));
            unwatchers.push(scope.$watch('alertShown', render));
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          var i, len, unwatch;
          for (i = 0, len = unwatchers.length; i < len; i++) {
            unwatch = unwatchers[i];
            if (unwatch) {
              unwatch();
            }
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaIp2str', function() {
    return {
      restrict: 'A',
      priority: 2,
      require: 'ngModel',
      link: function(scope, element, attr, ngModel) {
        ngModel.$parsers.push(function(value) {
          if (value) {
            return OmegaPac.Conditions.fromStr('Ip: ' + value);
          } else {
            return {
              conditionType: 'IpCondition',
              ip: '0.0.0.0',
              prefixLength: 0
            };
          }
        });
        return ngModel.$formatters.push(function(value) {
          if (value != null ? value.ip : void 0) {
            return OmegaPac.Conditions.str(value).split(' ', 2)[1];
          } else {
            return '';
          }
        });
      }
    };
  });

}).call(this);
