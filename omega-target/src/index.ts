import BrowserStorage = require('./browser_storage');
import Log = require('./log');
import Options = require('./options');
import OptionsSync = require('./options_sync');
import Storage = require('./storage');
import * as errors from './errors';
import * as utils from './utils';

const OmegaPac = require('omega-pac');

const omegaTarget: Record<string, unknown> = {
  Log,
  Storage,
  BrowserStorage,
  Options,
  OptionsSync,
  OmegaPac
};

const utilExports = utils as Record<string, unknown>;
for (const name of Object.keys(utilExports)) {
  omegaTarget[name] = utilExports[name];
}

const errorExports = errors as Record<string, unknown>;
for (const name of Object.keys(errorExports)) {
  omegaTarget[name] = errorExports[name];
}

export = omegaTarget;
