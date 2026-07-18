import type {OptionsData, StorageChanges} from './types';

export const OPTIONS_SCHEMA = 'SwitchyAgainOptions';
export const OPTIONS_VERSION = 1;
export const LEGACY_OPTIONS_SCHEMA_VERSION = 3;

export function isCurrentOptions(options: OptionsData | null | undefined) {
  return options?.['schema'] === OPTIONS_SCHEMA && options?.['version'] === OPTIONS_VERSION;
}

export function isLegacyOptions(options: OptionsData | null | undefined) {
  return options?.['schemaVersion'] === LEGACY_OPTIONS_SCHEMA_VERSION;
}

export function isEmptyOptions(options: OptionsData | null | undefined) {
  return options == null || Object.keys(options).length === 0;
}

export function migrateLegacyOptions(options: OptionsData, changes: StorageChanges) {
  options['schema'] = OPTIONS_SCHEMA;
  options['version'] = OPTIONS_VERSION;
  delete options['schemaVersion'];
  changes['schema'] = OPTIONS_SCHEMA;
  changes['version'] = OPTIONS_VERSION;
  changes['schemaVersion'] = undefined;
}

export function isCurrentOrEmptySyncOptions(options: OptionsData | null | undefined) {
  return isEmptyOptions(options) || isCurrentOptions(options);
}

export function areCompatibleSyncChanges(changes: StorageChanges) {
  if (Object.prototype.hasOwnProperty.call(changes, 'schema') && changes['schema'] !== OPTIONS_SCHEMA) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'version') && changes['version'] !== OPTIONS_VERSION) {
    return false;
  }
  return true;
}
