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

  angular.module('omega').directive('omegaUpload', function() {
    return {
      restrict: 'A',
      scope: {
        success: '&omegaUpload',
        error: '&omegaError'
      },
      link: function(scope, element, attrs) {
        var input;
        input = element[0];
        return element.on('change', function() {
          var reader;
          if (input.files.length > 0 && input.files[0].name.length > 0) {
            reader = new FileReader();
            reader.addEventListener('load', function(e) {
              return scope.$apply(function() {
                return scope.success({
                  '$content': e.target.result
                });
              });
            });
            reader.addEventListener('error', function(e) {
              return scope.$apply(function() {
                return scope.error({
                  '$error': e.target.error
                });
              });
            });
            reader.readAsText(input.files[0]);
            return input.value = '';
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactBackupRestore', function($timeout, omegaTarget) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var unmount;
        $timeout(function() {
          var bridge;
          bridge = window.OmegaReactBackupRestore;
          if (bridge != null ? bridge.mount : void 0) {
            unmount = bridge.mount(element[0], {
              embedded: true,
              onOptionsReset: function() {
                return omegaTarget.refresh();
              },
              showAlert: function(alert) {
                return scope.$evalAsync(function() {
                  return scope.$root.showAlert(alert);
                });
              }
            });
          }
        });
        return scope.$on('$destroy', function() {
          if (typeof unmount === 'function') {
            return unmount();
          }
        });
      }
    };
  });

  angular.module('omega').directive('omegaReactGeneralSettings', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mounted, props, unwatch;
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
        $timeout(function() {
          bridge = window.OmegaReactGeneralSettings;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
            unwatch = scope.$root.$watch('options', function(options, oldOptions) {
              if (options !== oldOptions && (mounted != null ? mounted.render : void 0)) {
                return mounted.render(props());
              }
            });
          }
        });
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
        var bridge, mounted, props, unwatch;
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
        $timeout(function() {
          bridge = window.OmegaReactUiSettings;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
            unwatch = scope.$root.$watch('options', function(options, oldOptions) {
              if (options !== oldOptions && (mounted != null ? mounted.render : void 0)) {
                return mounted.render(props());
              }
            });
          }
        });
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
        var bridge, mounted, props;
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
        $timeout(function() {
          bridge = window.OmegaReactAbout;
          if (bridge != null ? bridge.mount : void 0) {
            mounted = bridge.mount(element[0], props());
          }
        });
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
        var bridge, mounted;
        $timeout(function() {
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
        });
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
        var bridge, mounted;
        $timeout(function() {
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
        });
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
        var bridge, mounted;
        $timeout(function() {
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
        });
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
        var bridge, mounted;
        $timeout(function() {
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
        });
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
        var bridge, mounted;
        $timeout(function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountUnsupportedProfile : void 0) {
            mounted = bridge.mountUnsupportedProfile(element[0], {
              profile: scope.profile
            });
          }
        });
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
        var bridge, mounted, props;
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
        $timeout(function() {
          bridge = window.OmegaReactProfileContent;
          if (bridge != null ? bridge.mountVirtualProfile : void 0) {
            mounted = bridge.mountVirtualProfile(element[0], props());
          }
        });
        return scope.$on('$destroy', function() {
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
        var bridge, mounted, props, render, unwatchProfile, unwatchUpdating;
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
        $timeout(function() {
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
        });
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

  angular.module('omega').directive('omegaReactOptionsWelcome', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        var bridge, mounted;
        $timeout(function() {
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
        });
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
