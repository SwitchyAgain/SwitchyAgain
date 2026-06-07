type ProxyImplConstructor = {
  isSupported: () => boolean;
  new(log: unknown): unknown;
};

import ListenerProxyImplModule = require('./proxy_impl_listener');
import SettingsProxyImplModule = require('./proxy_impl_settings');

const ListenerProxyImpl = ListenerProxyImplModule as unknown as ProxyImplConstructor;
const SettingsProxyImpl = SettingsProxyImplModule as unknown as ProxyImplConstructor;

export const proxyImpls = [ListenerProxyImpl, SettingsProxyImpl];

export function getProxyImpl(log: unknown) {
  for (const Impl of proxyImpls) {
    if (Impl.isSupported()) {
      return new Impl(log);
    }
  }
  throw new Error('Your browser does not support proxy settings!');
}
