import type {Options} from './options_client_types';

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

export function backupOptionsText(options: Options) {
  const plainOptions = JSON.parse(JSON.stringify(options));
  for (const value of Object.values(plainOptions)) {
    if (isRecordValue(value) && value.profileType === 'RuleListProfile' && value.sourceUrl && value.omitRuleListFromExport === true) {
      delete value.ruleList;
      delete value.lastUpdate;
    }
  }
  return JSON.stringify(plainOptions);
}

export function importExportBusy(status: ImportExportStatus) {
  return status === 'loading' || status === 'exporting' || status === 'restoringLocal' || status === 'restoringOnline';
}

export function syncBusy(status: SyncStatus) {
  return status !== 'ready';
}
