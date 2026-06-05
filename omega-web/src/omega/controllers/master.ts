(function() {
  angular.module('omega').controller('MasterCtrl', function($scope, $rootScope, $window, $q, $modal, $state, profileColors, profileIcons, omegaTarget, $timeout, $location, $filter, getAttachedName, isProfileNameReserved, isProfileNameHidden, dispNameFilter, downloadFile, reactModalTemplates) {
    return OmegaOptionsRuntime.initialize($scope, {
      $filter: $filter,
      $location: $location,
      $modal: $modal,
      $q: $q,
      $rootScope: $rootScope,
      $state: $state,
      $timeout: $timeout,
      $window: $window,
      dispNameFilter: dispNameFilter,
      downloadFile: downloadFile,
      getAttachedName: getAttachedName,
      isProfileNameHidden: isProfileNameHidden,
      isProfileNameReserved: isProfileNameReserved,
      omegaTarget: omegaTarget,
      profileColors: profileColors,
      profileIcons: profileIcons,
      reactModalTemplates: reactModalTemplates
    });
  });

}).call(this);
