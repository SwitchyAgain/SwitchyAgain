import ListenerProxyImplModule = require('./proxy_impl_listener');
import SettingsProxyImplModule = require('./proxy_impl_settings');
import type {
  ProxyImplConstructor,
  ProxyImplInstance,
  ProxyLog
} from './proxy_types';

const ListenerProxyImpl = ListenerProxyImplModule;
const SettingsProxyImpl = SettingsProxyImplModule;

export const proxyImpls: ProxyImplConstructor[] = [ListenerProxyImpl, SettingsProxyImpl];

export function getProxyImpl(log: ProxyLog): ProxyImplInstance {
  for (const Impl of proxyImpls) {
    if (Impl.isSupported()) {
      return new Impl(log);
    }
  }
  throw new Error('Your browser does not support proxy settings!');
}
