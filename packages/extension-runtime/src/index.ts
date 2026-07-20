import ProxyEngine from '@switchyagain/proxy-engine';
import BrowserStorage from './browser_storage';
import * as errors from './errors';
import Log from './log';
import Options from './options';
import OptionsSync from './options_sync';
import Storage from './storage';

const extensionRuntime: Record<string, unknown> = {
  Log,
  Storage,
  BrowserStorage,
  Options,
  OptionsSync,
  ProxyEngine
};

const errorExports = errors as Record<string, unknown>;
for (const name of Object.keys(errorExports)) {
  extensionRuntime[name] = errorExports[name];
}

export {BrowserStorage, Log, Options, OptionsSync, Storage, ProxyEngine};

export * from './errors';
export * from './options_schema';

export default extensionRuntime;
