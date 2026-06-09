import OmegaPac from '@switchyagain/proxy-engine';
import BrowserStorage from './browser_storage';
import * as errors from './errors';
import Log from './log';
import Options from './options';
import OptionsSync from './options_sync';
import Storage from './storage';
import * as utils from './utils';

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

export {
  BrowserStorage,
  Log,
  Options,
  OptionsSync,
  Storage,
  OmegaPac
};

export * from './errors';
export * from './utils';

export default omegaTarget;
