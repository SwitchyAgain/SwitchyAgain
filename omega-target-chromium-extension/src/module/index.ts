import omegaTarget from 'omega-target';
import Url from 'url';
import ExternalApi from './external_api';
import Inspect from './inspect';
import Options from './options';
import * as proxy from './proxy';
import Storage from './storage';
import ChromeTabs from './tabs';
import WebRequestMonitor from './web_request_monitor';

const chromiumTarget: Record<string, unknown> = {
  Storage,
  Options,
  ChromeTabs,
  ExternalApi,
  WebRequestMonitor,
  Inspect,
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
  Inspect,
  Options,
  Storage,
  Url,
  WebRequestMonitor,
  proxy
};

export default chromiumTarget;
