var errors;
var utils;

module.exports = {
  Log: require('./build-ts/log'),
  Storage: require('./build-ts/storage'),
  BrowserStorage: require('./build-ts/browser_storage'),
  Options: require('./build-ts/options'),
  OptionsSync: require('./build-ts/options_sync'),
  OmegaPac: require('omega-pac')
};

utils = require('./build-ts/utils');
for (var name in utils) {
  if (!Object.prototype.hasOwnProperty.call(utils, name)) {
    continue;
  }
  module.exports[name] = utils[name];
}

errors = require('./build-ts/errors');
for (var errorName in errors) {
  if (!Object.prototype.hasOwnProperty.call(errors, errorName)) {
    continue;
  }
  module.exports[errorName] = errors[errorName];
}
