(function() {
  angular.module('omega').controller('PacProfileCtrl', function($scope, $modal, reactModalTemplates) {
    var oldLastUpdate, oldPacScript, oldPacUrl, onProfileChange, set;
    $scope.urlRegex = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
    $scope.urlWithFile = /^(ftp|http|https|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
    $scope.isFileUrl = OmegaPac.Profiles.isFileUrl;
    $scope.pacUrlCtrl = {
      ctrl: null
    };
    set = OmegaPac.Profiles.referencedBySet($scope.profile, $scope.options);
    $scope.referenced = Object.keys(set).length > 0;
    oldPacUrl = null;
    oldLastUpdate = null;
    oldPacScript = null;
    onProfileChange = function(profile, oldProfile) {
      if (!(profile && oldProfile)) {
        return;
      }
      if (profile.pacUrl !== oldProfile.pacUrl) {
        if (profile.lastUpdate) {
          oldPacUrl = oldProfile.pacUrl;
          oldLastUpdate = profile.lastUpdate;
          oldPacScript = oldProfile.pacScript;
          profile.lastUpdate = null;
        } else if (oldPacUrl && profile.pacUrl === oldPacUrl) {
          profile.lastUpdate = oldLastUpdate;
          profile.pacScript = oldPacScript;
        }
      }
      return $scope.pacUrlIsFile = $scope.isFileUrl(profile.pacUrl);
    };
    $scope.$watch('profile', onProfileChange, true);
    return $scope.editProxyAuth = function(scheme) {
      var auth, prop, ref, scope;
      prop = 'all';
      auth = (ref = $scope.profile.auth) != null ? ref[prop] : void 0;
      scope = $scope.$new('isolate');
      scope.auth = auth && angular.copy(auth);
      return $modal.open({
        template: reactModalTemplates.proxyAuth,
        scope: scope,
        size: 'sm'
      }).result.then(function(auth) {
        var base;
        if (!(auth != null ? auth.username : void 0)) {
          if ($scope.profile.auth) {
            return $scope.profile.auth[prop] = void 0;
          }
        } else {
          if ((base = $scope.profile).auth == null) {
            base.auth = {};
          }
          return $scope.profile.auth[prop] = auth;
        }
      });
    };
  });

}).call(this);
