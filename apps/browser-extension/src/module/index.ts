import omegaTarget from '@switchyagain/extension-runtime';
import ExternalApi from './external_api';
import Options from './options';
import * as proxy from './proxy';
import Storage from './storage';
import ChromeTabs from './tabs';
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

const chromiumTarget: Record<string, unknown> = {
  Storage,
  Options,
  ChromeTabs,
  ExternalApi,
  WebRequestMonitor,
  Url,
  proxy
};

for (const name of Object.keys(omegaTarget)) {
  if (chromiumTarget[name] == null) {
    chromiumTarget[name] = omegaTarget[name];
  }
}

export {
  ChromeTabs,
  ExternalApi,
  Options,
  Storage,
  Url,
  WebRequestMonitor,
  proxy
};

export default chromiumTarget;
