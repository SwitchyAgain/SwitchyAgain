import extensionRuntime from '@switchyagain/extension-runtime';
import ExternalApi from './external_api';
import Options from './options';
import OptionsImport from './options_import';
import * as proxy from './proxy';
import Storage from './storage';
import ChromeTabs from './tabs';
import WebDavStorage from './webdav_storage';
import WebRequestMonitor from './web_request_monitor';

const Url = {
  parse(url: string) {
    const parsed = new URL(url);
    const query: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return {
      hostname: parsed.hostname.replace(/^\[(.*)\]$/, '$1'),
      path: `${parsed.pathname}${parsed.search}`,
      query,
      search: parsed.search,
      protocol: parsed.protocol
    };
  }
};

const browserExtensionRuntime: Record<string, unknown> = {
  Storage,
  WebDavStorage,
  Options,
  OptionsImport,
  ChromeTabs,
  ExternalApi,
  WebRequestMonitor,
  Url,
  proxy
};

for (const name of Object.keys(extensionRuntime)) {
  if (browserExtensionRuntime[name] == null) {
    browserExtensionRuntime[name] = extensionRuntime[name];
  }
}

export {ChromeTabs, ExternalApi, Options, OptionsImport, Storage, Url, WebDavStorage, WebRequestMonitor, proxy};

export default browserExtensionRuntime;
