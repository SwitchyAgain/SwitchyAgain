import {RESTORE_URL_STATE, backupOptionsText, importExportBusy, importExportErrorMessage, syncBusy} from '../src/react/import_export_logic';
import type {Options} from '../src/react/options_client_types';

describe('import export logic', () => {
  it('uses a stable local state key for online restore URLs', () => {
    expect(RESTORE_URL_STATE).toBe('web.restoreOnlineUrl');
  });

  it('formats import/export errors from message, reason, or primitive values', () => {
    expect(importExportErrorMessage(new Error('boom'))).toBe('boom');
    expect(importExportErrorMessage({reason: 'invalid'})).toBe('invalid');
    expect(importExportErrorMessage('plain')).toBe('plain');
    expect(importExportErrorMessage(null)).toBe('null');
  });

  it('serializes options through a plain JSON backup shape', () => {
    const options: Options = {
      '+proxy': {
        name: 'proxy',
        profileType: 'FixedProfile'
      },
      customOption: true,
      transient: undefined
    };

    expect(backupOptionsText(options)).toBe(
      JSON.stringify({
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile'
        },
        customOption: true
      })
    );
  });

  it('omits downloaded online rule-list content from backup when requested', () => {
    const options: Options = {
      '+online': {
        defaultProfileName: 'direct',
        lastUpdate: '2024-01-01T00:00:00.000Z',
        matchProfileName: 'proxy',
        name: 'online',
        omitRuleListFromExport: true,
        profileType: 'RuleListProfile',
        ruleList: '*.example.com',
        sourceUrl: 'https://example.com/list.txt'
      },
      '+__ruleListOf_auto': {
        lastUpdate: '2024-01-03T00:00:00.000Z',
        name: '__ruleListOf_auto',
        omitRuleListFromExport: true,
        profileType: 'RuleListProfile',
        ruleList: '*.attached.example',
        sourceUrl: 'https://example.com/attached.txt'
      },
      '+manual': {
        name: 'manual',
        omitRuleListFromExport: true,
        profileType: 'RuleListProfile',
        ruleList: '*.manual.example'
      },
      '+full': {
        lastUpdate: '2024-01-02T00:00:00.000Z',
        name: 'full',
        profileType: 'RuleListProfile',
        ruleList: '*.full.example',
        sourceUrl: 'https://example.com/full.txt'
      }
    };

    expect(backupOptionsText(options)).toBe(
      JSON.stringify({
        '+online': {
          defaultProfileName: 'direct',
          matchProfileName: 'proxy',
          name: 'online',
          omitRuleListFromExport: true,
          profileType: 'RuleListProfile',
          sourceUrl: 'https://example.com/list.txt'
        },
        '+__ruleListOf_auto': {
          name: '__ruleListOf_auto',
          omitRuleListFromExport: true,
          profileType: 'RuleListProfile',
          sourceUrl: 'https://example.com/attached.txt'
        },
        '+manual': {
          name: 'manual',
          omitRuleListFromExport: true,
          profileType: 'RuleListProfile',
          ruleList: '*.manual.example'
        },
        '+full': {
          lastUpdate: '2024-01-02T00:00:00.000Z',
          name: 'full',
          profileType: 'RuleListProfile',
          ruleList: '*.full.example',
          sourceUrl: 'https://example.com/full.txt'
        }
      })
    );
  });

  it('detects busy import/export statuses', () => {
    expect(importExportBusy('loading')).toBe(true);
    expect(importExportBusy('exporting')).toBe(true);
    expect(importExportBusy('restoringLocal')).toBe(true);
    expect(importExportBusy('restoringOnline')).toBe(true);
    expect(importExportBusy('ready')).toBe(false);
    expect(importExportBusy('success')).toBe(false);
    expect(importExportBusy('error')).toBe(false);
  });

  it('detects busy sync statuses', () => {
    expect(syncBusy('ready')).toBe(false);
    expect(syncBusy('enabling')).toBe(true);
    expect(syncBusy('disabling')).toBe(true);
    expect(syncBusy('resetting')).toBe(true);
  });
});
