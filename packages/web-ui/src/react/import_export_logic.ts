import type {Options} from './options_client_types';

export type BackupMetadata = {
  browser: 'chrome' | 'chromium' | 'edge' | 'firefox' | 'unknown';
  exportedAt: string;
  extensionVersion: string;
};

export type BackupFilenameScheme = 'custom' | 'date' | 'dateTime' | 'dateVersion';

export type BackupFilenameOptions = {
  enabled: boolean;
  scheme: BackupFilenameScheme;
  template: string;
};

export type BackupFilenameValidation = {
  byteLength: number;
  error: {
    byteLength?: number;
    characters?: string;
    code: 'invalidCharacters' | 'jsonExtension' | 'required' | 'tooLong' | 'trailingCharacter';
    maxByteLength?: number;
  } | null;
  filename: string;
  maxByteLength: number;
};

export const DEFAULT_BACKUP_FILENAME_OPTIONS: BackupFilenameOptions = {
  enabled: false,
  scheme: 'date',
  template: 'SwitchyAgainBackup_{date}'
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export const RESTORE_URL_STATE = 'web.restoreOnlineUrl';

export type ImportExportStatus = 'loading' | 'ready' | 'exporting' | 'restoringLocal' | 'restoringOnline' | 'success' | 'error';

export type SyncStatus = 'ready' | 'enabling' | 'disabling' | 'resetting';

export function importExportErrorMessage(error: unknown) {
  const candidate = error as {message?: unknown; reason?: unknown} | null | undefined;
  return String(candidate?.message || candidate?.reason || error);
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function backupOptionsText(options: Options, metadata: BackupMetadata) {
  const plainOptions = JSON.parse(JSON.stringify(options));
  delete plainOptions.schemaVersion;
  for (const value of Object.values(plainOptions)) {
    if (isRecordValue(value) && value.profileType === 'RuleListProfile' && value.sourceUrl && value.omitRuleListFromExport === true) {
      delete value.ruleList;
      delete value.lastUpdate;
    }
  }
  return JSON.stringify({
    schema: 'SwitchyAgainBackup',
    version: 1,
    metadata,
    options: plainOptions
  });
}

export function backupFilenameOptions(value: unknown): BackupFilenameOptions {
  const current = isRecordValue(value) ? value : {};
  return {
    enabled: current.enabled === true,
    scheme: current.scheme === 'dateTime' || current.scheme === 'dateVersion' || current.scheme === 'custom' ? current.scheme : 'date',
    template: typeof current.template === 'string' ? current.template : DEFAULT_BACKUP_FILENAME_OPTIONS.template
  };
}

function localDateText(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeText(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

const MAX_BACKUP_FILENAME_BYTES = 180;
const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function expandedTemplate(template: string, values: Record<string, string>) {
  let result = '';
  for (let index = 0; index < template.length; index++) {
    const character = template[index];
    if (character === '\\' && (template[index + 1] === '{' || template[index + 1] === '}')) {
      result += template[index + 1];
      index++;
      continue;
    }
    if (character === '{') {
      const end = template.indexOf('}', index + 1);
      if (end >= 0) {
        const token = template.slice(index + 1, end);
        if (Object.prototype.hasOwnProperty.call(values, token)) {
          result += values[token];
          index = end;
          continue;
        }
      }
    }
    result += character;
  }
  return result;
}

export function backupFilename(
  options: BackupFilenameOptions,
  context: {browser: string; browserVersion?: string; date: Date; extensionVersion: string}
) {
  if (!options.enabled) {
    return 'SwitchyAgainBackup.json';
  }
  const date = localDateText(context.date);
  const time = localTimeText(context.date);
  const year = String(context.date.getFullYear()).padStart(4, '0');
  const monthNumber = context.date.getMonth();
  const month = String(monthNumber + 1).padStart(2, '0');
  const monthName = MONTH_NAMES[monthNumber];
  const monthShort = MONTH_SHORT_NAMES[monthNumber];
  const day = String(context.date.getDate()).padStart(2, '0');
  const version = context.extensionVersion || 'unknown';
  const browser = context.browser || 'unknown';
  const browserVersion = context.browserVersion || 'unknown';
  const hour24 = String(context.date.getHours()).padStart(2, '0');
  const hourNumber = context.date.getHours() % 12 || 12;
  const hour12 = String(hourNumber).padStart(2, '0');
  const minute = String(context.date.getMinutes()).padStart(2, '0');
  const second = String(context.date.getSeconds()).padStart(2, '0');
  const ampm = context.date.getHours() < 12 ? 'AM' : 'PM';
  const values = {
    ampm,
    browser,
    browserVersion,
    day,
    hour12,
    hour24,
    minute,
    month,
    monthName,
    monthShort,
    second,
    time,
    version,
    year,
    date
  };
  let base: string;
  switch (options.scheme) {
    case 'dateTime':
      base = `SwitchyAgainBackup_${date}_${time}`;
      break;
    case 'dateVersion':
      base = `SwitchyAgainBackup_${date}_v${version}`;
      break;
    case 'custom':
      base = expandedTemplate(options.template, values);
      break;
    default:
      base = `SwitchyAgainBackup_${date}`;
  }
  return `${base}.json`;
}

export function backupFilenameValidation(
  options: BackupFilenameOptions,
  context: {browser: string; browserVersion?: string; date: Date; extensionVersion: string}
): BackupFilenameValidation | null {
  if (!options.enabled || options.scheme !== 'custom') {
    return null;
  }
  const filename = backupFilename(options, context);
  const base = filename.slice(0, -'.json'.length);
  const byteLength = utf8ByteLength(filename);
  let error: BackupFilenameValidation['error'] = null;
  if (!base.trim()) {
    error = {code: 'required'};
  } else {
    const invalidCharacters = Array.from(new Set(base.match(INVALID_FILENAME_CHARACTERS) || []));
    if (invalidCharacters.length) {
      error = {characters: invalidCharacters.join(' '), code: 'invalidCharacters'};
    } else if (/[. ]$/.test(base)) {
      error = {code: 'trailingCharacter'};
    } else if (/\.json$/i.test(base)) {
      error = {code: 'jsonExtension'};
    } else if (byteLength > MAX_BACKUP_FILENAME_BYTES) {
      error = {
        byteLength,
        code: 'tooLong',
        maxByteLength: MAX_BACKUP_FILENAME_BYTES
      };
    }
  }
  return {
    byteLength,
    error,
    filename,
    maxByteLength: MAX_BACKUP_FILENAME_BYTES
  };
}

export function importExportBusy(status: ImportExportStatus) {
  return status === 'loading' || status === 'exporting' || status === 'restoringLocal' || status === 'restoringOnline';
}

export function syncBusy(status: SyncStatus) {
  return status !== 'ready';
}
