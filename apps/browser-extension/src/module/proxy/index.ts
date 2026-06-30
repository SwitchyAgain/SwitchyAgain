import ListenerProxyImpl from './proxy_impl_listener';
import SettingsProxyImpl from './proxy_impl_settings';
import type {ProxyImplConstructor, ProxyImplInstance, ProxyLog} from './proxy_types';

export const proxyImpls: ProxyImplConstructor[] = [ListenerProxyImpl, SettingsProxyImpl];

export function getProxyImpl(log: ProxyLog): ProxyImplInstance {
  for (const Impl of proxyImpls) {
    if (Impl.isSupported()) {
      return new Impl(log);
    }
  }
  throw new Error('Your browser does not support proxy settings!');
}
