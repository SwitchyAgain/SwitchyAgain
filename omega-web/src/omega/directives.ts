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
