import {
  RESTORE_URL_STATE,
  backupFilename,
  backupFilenameOptions,
  backupFilenameValidation,
  backupOptionsText,
  importExportBusy,
  importExportErrorMessage,
  syncBusy
} from '../src/react/import_export_logic';
import type {Options} from '../src/react/options_client_types';

describe('import export logic', () => {
  const metadata = {
    browser: 'firefox' as const,
    exportedAt: '2000-01-02T03:04:05.000Z',
    extensionVersion: '0.0.1'
  };

  it('uses a stable local state key for online restore URLs', () => {
    expect(RESTORE_URL_STATE).toBe('web.restoreOnlineUrl');
  });

  it('uses the existing backup filename when custom naming is disabled', () => {
    expect(
      backupFilename(backupFilenameOptions(undefined), {
        browser: 'firefox',
        date: new Date(2000, 0, 2),
        extensionVersion: '0.0.1'
      })
    ).toBe('SwitchyAgainBackup.json');
  });

  it('formats date and version backup filenames', () => {
    const date = new Date(2000, 0, 2);
    expect(
      backupFilename({enabled: true, scheme: 'date', template: 'ignored'}, {browser: 'firefox', date, extensionVersion: '0.0.1'})
    ).toBe('SwitchyAgainBackup_2000-01-02.json');
    expect(
      backupFilename({enabled: true, scheme: 'dateVersion', template: 'ignored'}, {browser: 'firefox', date, extensionVersion: '0.0.1'})
    ).toBe('SwitchyAgainBackup_2000-01-02_v0.0.1.json');
  });

  it('formats date and time backup filenames and expands all custom fields', () => {
    const date = new Date(2000, 0, 2, 5, 6, 7);
    expect(
      backupFilename({enabled: true, scheme: 'dateTime', template: 'ignored'}, {browser: 'firefox', date, extensionVersion: '0.0.1'})
    ).toBe('SwitchyAgainBackup_2000-01-02_05-06-07.json');
    expect(
      backupFilename(
        {enabled: true, scheme: 'custom', template: 'Backup_{date}_{time}_{version}_{browser}_{browserVersion}'},
        {browser: 'firefox', browserVersion: '1', date, extensionVersion: '0.0.1'}
      )
    ).toBe('Backup_2000-01-02_05-06-07_0.0.1_firefox_1.json');
  });

  it('uses the agreed human-readable month short names', () => {
    const months = [
      ['January', 'Jan'],
      ['February', 'Feb'],
      ['March', 'Mar'],
      ['April', 'Apr'],
      ['May', 'May'],
      ['June', 'June'],
      ['July', 'July'],
      ['August', 'Aug'],
      ['September', 'Sept'],
      ['October', 'Oct'],
      ['November', 'Nov'],
      ['December', 'Dec']
    ];
    months.forEach(([full, short], month) => {
      expect(
        backupFilename(
          {enabled: true, scheme: 'custom', template: '{monthName}_{monthShort}'},
          {browser: 'firefox', date: new Date(2000, month, 2), extensionVersion: '0.0.1'}
        )
      ).toBe(`${full}_${short}.json`);
    });
  });

  it('formats 12-hour boundaries and AM/PM markers', () => {
    const template = {enabled: true, scheme: 'custom' as const, template: '{hour24}_{hour12}_{ampm}'};
    expect(backupFilename(template, {browser: 'firefox', date: new Date(2000, 0, 2, 0), extensionVersion: '0.0.1'})).toBe('00_12_AM.json');
    expect(backupFilename(template, {browser: 'firefox', date: new Date(2000, 0, 2, 12), extensionVersion: '0.0.1'})).toBe('12_12_PM.json');
    expect(backupFilename(template, {browser: 'firefox', date: new Date(2000, 0, 2, 23), extensionVersion: '0.0.1'})).toBe('23_11_PM.json');
  });

  it('preserves unknown fields and supports escaped braces in custom templates', () => {
    expect(
      backupFilename(
        {enabled: true, scheme: 'custom', template: 'Backup_{unknown}_\\{date\\}_{date}'},
        {browser: 'firefox', date: new Date(2000, 0, 2), extensionVersion: '0.0.1'}
      )
    ).toBe('Backup_{unknown}_{date}_2000-01-02.json');
  });

  it('reports invalid characters and final UTF-8 filename length', () => {
    const context = {browser: 'firefox', date: new Date(2000, 0, 2), extensionVersion: '0.0.1'};
    expect(backupFilenameValidation({enabled: true, scheme: 'custom', template: 'Backup:{date}'}, context)?.error).toBe(
      'The filename contains invalid characters: :'
    );
    expect(backupFilenameValidation({enabled: true, scheme: 'custom', template: 'x'.repeat(176)}, context)?.error).toBe(
      'The filename is too long: 181/180 bytes.'
    );
  });

  it('formats import/export errors from message, reason, or primitive values', () => {
    expect(importExportErrorMessage(new Error('boom'))).toBe('boom');
    expect(importExportErrorMessage({reason: 'invalid'})).toBe('invalid');
    expect(importExportErrorMessage('plain')).toBe('plain');
    expect(importExportErrorMessage(null)).toBe('null');
  });

  it('serializes options through the SwitchyAgain backup envelope', () => {
    const options: Options = {
      schema: 'SwitchyAgainOptions',
      version: 1,
      '+proxy': {
        name: 'proxy',
        profileType: 'FixedProfile'
      },
      customOption: true,
      transient: undefined
    };

    expect(backupOptionsText(options, metadata)).toBe(
      JSON.stringify({
        schema: 'SwitchyAgainBackup',
        version: 1,
        metadata,
        options: {
          schema: 'SwitchyAgainOptions',
          version: 1,
          '+proxy': {
            name: 'proxy',
            profileType: 'FixedProfile'
          },
          customOption: true
        }
      })
    );
  });

  it('omits downloaded online rule-list content from backup when requested', () => {
    const options: Options = {
      schema: 'SwitchyAgainOptions',
      version: 1,
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

    expect(backupOptionsText(options, metadata)).toBe(
      JSON.stringify({
        schema: 'SwitchyAgainBackup',
        version: 1,
        metadata,
        options: {
          schema: 'SwitchyAgainOptions',
          version: 1,
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
