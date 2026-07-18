import ExtensionRuntime from '@switchyagain/extension-runtime';

type OptionsData = Record<string, unknown>;

const BACKUP_SCHEMA = 'SwitchyAgainBackup';
const BACKUP_VERSION = 1;
const LEGACY_SCHEMA_VERSION = 3;
const {schema: OPTIONS_SCHEMA, version: OPTIONS_VERSION} = ExtensionRuntime.Options as unknown as {
  schema: string;
  version: number;
};

function isRecord(value: unknown): value is OptionsData {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCurrentOptions(options: OptionsData) {
  return options.schema === OPTIONS_SCHEMA && options.version === OPTIONS_VERSION;
}

export function migrateLegacyOptions(options: OptionsData): OptionsData | null {
  if (options.schemaVersion !== LEGACY_SCHEMA_VERSION) {
    return null;
  }
  const migrated: OptionsData = {
    ...options,
    schema: OPTIONS_SCHEMA,
    version: OPTIONS_VERSION
  };
  delete migrated.schemaVersion;
  return migrated;
}

export function parseImportedOptions(content: string): OptionsData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    throw new Error('Invalid backup file!');
  }
  if (!isRecord(parsed)) {
    throw new Error('Invalid backup file!');
  }
  const legacyOptions = migrateLegacyOptions(parsed);
  if (legacyOptions) {
    return legacyOptions;
  }
  if (parsed.schema !== BACKUP_SCHEMA || parsed.version !== BACKUP_VERSION || !isRecord(parsed.options)) {
    throw new Error('Invalid backup file!');
  }
  if (!isCurrentOptions(parsed.options)) {
    throw new Error('Invalid backup file!');
  }
  return {...parsed.options};
}

const OptionsImport = {
  migrateLegacyOptions,
  parseImportedOptions
};

export default OptionsImport;
