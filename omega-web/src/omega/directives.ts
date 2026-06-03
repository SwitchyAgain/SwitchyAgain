(function() {
  angular.module('omega').directive('inputGroupClear', function($timeout) {
    return {
      restrict: 'A',
      templateUrl: 'partials/input_group_clear.html',
      scope: {
        'model': '=model',
        'type': '@type',
        'ngPattern': '=?ngPattern',
        'placeholder': '@placeholder',
        'controller': '=?controller'
      },
      link: function(scope, element, attrs) {
        scope.catchAll = new RegExp('');
        $timeout(function() {
          return scope.controller = element.find('input').controller('ngModel');
        });
        scope.oldModel = '';
        scope.controller = scope.input;
        scope.modelChange = function() {
          if (scope.model) {
            return scope.oldModel = '';
          }
        };
        return scope.toggleClear = function() {
          var ref;
          return ref = [scope.oldModel, scope.model], scope.model = ref[0], scope.oldModel = ref[1], ref;
        };
      }
    };
  });

  angular.module('omega').directive('omegaReactImportExport', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var invoke, mount, mounted, props, render, unwatchOptions;
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
            onApplyOptionsConfirm: function() {
              return invoke(function() {
                return scope.$root.applyOptionsConfirm();
              });
            },
            onOptionsChange: function(nextOptions, options) {
              return scope.$evalAsync(function() {
                var dirty, key, replace, results;
                options || (options = {});
                replace = options.replace;
                dirty = options.dirty;
                if (replace) {
                  scope.$root.options = nextOptions;
                  scope.$root.optionsOld = angular.copy(nextOptions);
                  scope.$root.optionsDirty = dirty != null ? dirty : false;
                  return;
                }
                results = [];
                for (key in nextOptions) {
                  scope.$root.options[key] = nextOptions[key];
                  results.push(scope.$root.optionsDirty = dirty != null ? dirty : true);
                }
                return results;
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

  angular.module('omega').directive('omegaReactAbout', function($timeout, $modal, omegaDebug) {
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
                templateUrl: 'partials/reset_options_confirm.html'
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
              dispName: scope.dispNameFilter,
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

  angular.module('omega').directive('omegaReactVirtualProfile', function($timeout, $filter) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props;
        props = function() {
          return {
            dispName: scope.dispNameFilter,
            onReplaceProfile: function(fromName, toName) {
              return scope.replaceProfile(fromName, toName);
            },
            onTargetChange: function(name) {
              return scope.$evalAsync(function() {
                return scope.profile.defaultProfileName = name;
              });
            },
            options: scope.options,
            profile: scope.profile,
            targetProfiles: $filter('profiles')(scope.options, scope.profile)
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

  angular.module('omega').directive('omegaReactPacProfile', function($timeout, $modal, $filter) {
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
            formattedLastUpdate: scope.profile && scope.profile.lastUpdate ? $filter('date')(scope.profile.lastUpdate, 'medium') : '',
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
                templateUrl: 'partials/fixed_auth_edit.html',
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

  angular.module('omega').directive('omegaReactRuleListProfile', function($timeout, $filter) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchProfile, unwatchUpdating;
        props = function() {
          var name, ref;
          name = ((ref = scope.profile) != null ? ref.name : void 0) || '';
          return {
            dispName: scope.dispNameFilter,
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
            resultProfiles: $filter('profiles')(scope.options, scope.profile),
            ruleListFormats: OmegaPac.Profiles.ruleListFormats,
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

  angular.module('omega').directive('omegaReactSwitchAttachedProfile', function($timeout, $filter) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchAttached, unwatchError, unwatchUpdating;
        props = function() {
          var name, ref;
          name = ((ref = scope.attached) != null ? ref.name : void 0) || '';
          return {
            attached: scope.attached,
            attachedRuleListError: scope.attachedRuleListError,
            formattedLastUpdate: scope.attached && scope.attached.lastUpdate ? $filter('date')(scope.attached.lastUpdate, 'medium') : '',
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
            onDownload: function(profileName) {
              return scope.updateProfile(profileName);
            },
            ruleListFormats: scope.ruleListFormats,
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
          if (bridge != null ? bridge.mountSwitchAttachedProfile : void 0) {
            mounted = bridge.mountSwitchAttachedProfile(element[0], props());
            unwatchAttached = scope.$watch('attached', render, true);
            unwatchError = scope.$watch('attachedRuleListError', render);
            unwatchUpdating = scope.$watch(function() {
              var name, ref;
              name = ((ref = scope.attached) != null ? ref.name : void 0) || '';
              return scope.updatingProfile && scope.updatingProfile[name];
            }, render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchAttached) {
            unwatchAttached();
          }
          if (unwatchError) {
            unwatchError();
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

  angular.module('omega').directive('omegaReactSwitchConditionHelp', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchShow, unwatchTypes;
        props = function() {
          return {
            advancedConditionTypes: scope.advancedConditionTypes,
            basicConditionTypes: scope.basicConditionTypes,
            isUrlConditionType: scope.isUrlConditionType,
            onClose: function() {
              return scope.$evalAsync(function() {
                return scope.conditionHelp.show = false;
              });
            },
            show: scope.conditionHelp && scope.conditionHelp.show,
            showConditionTypes: scope.showConditionTypes
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountSwitchConditionHelp : void 0) {
            mounted = bridge.mountSwitchConditionHelp(element[0], props());
            unwatchShow = scope.$watch('conditionHelp.show', render);
            unwatchTypes = scope.$watch('showConditionTypes', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchShow) {
            unwatchShow();
          }
          if (unwatchTypes) {
            unwatchTypes();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactSwitchRulesHeader', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchEditSource, unwatchSource, unwatchUrlConditions;
        props = function() {
          return {
            editSource: scope.editSource,
            hasUrlConditions: scope.hasUrlConditions,
            onSourceChange: function(code) {
              return scope.$evalAsync(function() {
                if (scope.source) {
                  scope.source.code = code;
                  scope.source.touched = true;
                  return scope.$root.optionsDirty = true;
                }
              });
            },
            onToggleSource: function() {
              return scope.toggleSource();
            },
            source: scope.source
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountSwitchRulesHeader : void 0) {
            mounted = bridge.mountSwitchRulesHeader(element[0], props());
            unwatchEditSource = scope.$watch('editSource', render);
            unwatchSource = scope.$watch('source', render, true);
            unwatchUrlConditions = scope.$watch('hasUrlConditions', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchEditSource) {
            unwatchEditSource();
          }
          if (unwatchSource) {
            unwatchSource();
          }
          if (unwatchUrlConditions) {
            unwatchUrlConditions();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactSwitchRuleTableHeader', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchShowNotes;
        props = function() {
          return {
            onToggleConditionHelp: function() {
              return scope.$evalAsync(function() {
                return scope.conditionHelp.show = !scope.conditionHelp.show;
              });
            },
            showNotes: scope.showNotes
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountSwitchRuleTableHeader : void 0) {
            mounted = bridge.mountSwitchRuleTableHeader(element[0], props());
            unwatchShowNotes = scope.$watch('showNotes', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchShowNotes) {
            unwatchShowNotes();
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactSwitchRuleRows', function($timeout, $filter) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, refreshSortable, render, sortStartIndex, unwatchConditionTypes, unwatchOptions, unwatchRules, unwatchShowNotes, unwatchVisibleRuleCount;
        props = function() {
          return {
            conditionHasWarning: function(condition) {
              return scope.conditionHasWarning(condition);
            },
            conditionTypes: scope.conditionTypes,
            dispName: scope.dispNameFilter,
            formatIpCondition: function(condition) {
              if (condition != null ? condition.ip : void 0) {
                return OmegaPac.Conditions.str(condition).split(' ', 2)[1];
              }
              return '';
            },
            getWeekdayList: function(condition) {
              return scope.getWeekdayList(condition);
            },
            isUrlConditionType: scope.isUrlConditionType,
            onAddNote: function(index) {
              return scope.addNote(index);
            },
            onCloneRule: function(index) {
              return scope.$evalAsync(function() {
                return scope.cloneRule(index);
              });
            },
            onConditionFieldChange: function(index, field, value) {
              return scope.$evalAsync(function() {
                var numberValue, rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                if (field === 'minValue' || field === 'maxValue' || field === 'startHour' || field === 'endHour') {
                  numberValue = value === '' ? null : Number(value);
                  rule.condition[field] = numberValue;
                } else {
                  rule.condition[field] = value;
                }
                return scope.$root.optionsDirty = true;
              });
            },
            onConditionTypeChange: function(index, type) {
              return scope.$evalAsync(function() {
                var rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                rule.condition.conditionType = type;
                return scope.$root.optionsDirty = true;
              });
            },
            onIpConditionInputChange: function(index, value) {
              return scope.$evalAsync(function() {
                var rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                rule.condition = value ? OmegaPac.Conditions.fromStr('Ip: ' + value) : {
                  conditionType: 'IpCondition',
                  ip: '0.0.0.0',
                  prefixLength: 0
                };
                return scope.$root.optionsDirty = true;
              });
            },
            onNoteChange: function(index, note) {
              return scope.$evalAsync(function() {
                var rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                rule.note = note;
                return scope.$root.optionsDirty = true;
              });
            },
            onProfileChange: function(index, name) {
              return scope.$evalAsync(function() {
                var rule;
                rule = scope.profile.rules[index];
                if (!rule) {
                  return;
                }
                rule.profileName = name;
                return scope.$root.optionsDirty = true;
              });
            },
            onRemoveRule: function(index) {
              return scope.removeRule(index);
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
            resultProfiles: $filter('profiles')(scope.options, scope.profile),
            rules: scope.profile.rules,
            showNotes: scope.showNotes,
            visibleRuleCount: scope.visibleRuleCount
          };
        };
        refreshSortable = function() {
          return $timeout(function() {
            if (element.data('ui-sortable')) {
              return element.sortable('refresh');
            }
          }, 0, false);
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            mounted.render(props());
            return refreshSortable();
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if ((bridge != null ? bridge.mountSwitchRuleRows : void 0) && !mounted) {
            mounted = bridge.mountSwitchRuleRows(element[0], props());
            element.sortable({
              handle: '.sort-bar',
              tolerance: 'pointer',
              axis: 'y',
              forceHelperSize: true,
              forcePlaceholderSize: true,
              containment: 'parent',
              start: function(event, ui) {
                return sortStartIndex = ui.item.index();
              },
              stop: function(event, ui) {
                var sortEndIndex;
                sortEndIndex = ui.item.index();
                if (sortStartIndex === sortEndIndex) {
                  return;
                }
                return scope.$evalAsync(function() {
                  var rule;
                  rule = scope.profile.rules.splice(sortStartIndex, 1)[0];
                  scope.profile.rules.splice(sortEndIndex, 0, rule);
                  return scope.$root.optionsDirty = true;
                });
              }
            });
            unwatchRules = scope.$watch('profile.rules', render, true);
            unwatchConditionTypes = scope.$watch('conditionTypes', render);
            unwatchOptions = scope.$watch('options', render, true);
            unwatchShowNotes = scope.$watch('showNotes', render);
            unwatchVisibleRuleCount = scope.$watch('visibleRuleCount', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchRules) {
            unwatchRules();
          }
          if (unwatchConditionTypes) {
            unwatchConditionTypes();
          }
          if (unwatchOptions) {
            unwatchOptions();
          }
          if (unwatchShowNotes) {
            unwatchShowNotes();
          }
          if (unwatchVisibleRuleCount) {
            unwatchVisibleRuleCount();
          }
          if (element.data('ui-sortable')) {
            element.sortable('destroy');
          }
          if (mounted != null ? mounted.unmount : void 0) {
            return mounted.unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactSwitchRuleFooter', function($timeout, $filter) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mount, mounted, props, render, unwatchAttached, unwatchAttachedOptions, unwatchShowNotes;
        props = function() {
          return {
            attached: scope.attached,
            attachedOptions: scope.attachedOptions,
            dispName: scope.dispNameFilter,
            onAddRule: function() {
              return scope.addRule();
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
            onDefaultProfileChange: function(name) {
              return scope.$evalAsync(function() {
                return scope.attachedOptions.defaultProfileName = name;
              });
            },
            onRemoveAttached: function() {
              return scope.removeAttached();
            },
            onResetRules: function() {
              return scope.resetRules();
            },
            options: scope.options,
            resultProfiles: $filter('profiles')(scope.options, scope.profile),
            ruleListIcon: scope.profileIcons['RuleListProfile'],
            showNotes: scope.showNotes
          };
        };
        render = function() {
          if (mounted != null ? mounted.render : void 0) {
            return mounted.render(props());
          }
        };
        mount = function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountSwitchRuleFooter : void 0) {
            mounted = bridge.mountSwitchRuleFooter(element[0], props());
            unwatchAttached = scope.$watch('attached', render, true);
            unwatchAttachedOptions = scope.$watch('attachedOptions', render, true);
            unwatchShowNotes = scope.$watch('showNotes', render);
          }
        };
        mount();
        if (!mounted) {
          $timeout(mount);
        }
        return scope.$on('$destroy', function() {
          if (unwatchAttached) {
            unwatchAttached();
          }
          if (unwatchAttachedOptions) {
            unwatchAttachedOptions();
          }
          if (unwatchShowNotes) {
            unwatchShowNotes();
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
