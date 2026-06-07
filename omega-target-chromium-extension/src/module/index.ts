import Storage = require('./storage');
import Options = require('./options');
import ChromeTabs = require('./tabs');
import ExternalApi = require('./external_api');
import WebRequestMonitor = require('./web_request_monitor');
import Inspect = require('./inspect');
import Url = require('url');
import proxy = require('./proxy');
import omegaTarget = require('omega-target');

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

export = chromiumTarget;
