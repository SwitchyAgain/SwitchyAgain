// @ts-nocheck
var ListenerProxyImpl, SettingsProxyImpl;

ListenerProxyImpl = require('./proxy_impl_listener');

SettingsProxyImpl = require('./proxy_impl_settings');

exports.proxyImpls = [ListenerProxyImpl, SettingsProxyImpl];

exports.getProxyImpl = function(log) {
  var Impl, i, len, ref;
  ref = exports.proxyImpls;
  for (i = 0, len = ref.length; i < len; i++) {
    Impl = ref[i];
    if (Impl.isSupported()) {
      return new Impl(log);
    }
  }
  throw new Error('Your browser does not support proxy settings!');
};

export {};
