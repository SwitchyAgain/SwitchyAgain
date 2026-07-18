import assert from 'assert';
import Promise from '../src/promise';
import OptionsClass from '../src/options';
import {assertCalledOnce, assertCalledWith, stubReturns} from './helpers/test_helpers';

describe('Options', function () {
  let Options: any;
  Options = OptionsClass;

  describe('#parseOptions', function () {
    it('should extract options from a SwitchyAgain backup without importing metadata', function () {
      const options = Object.create(Options.prototype);
      const parsed = options.parseOptions(
        JSON.stringify({
          schema: 'SwitchyAgainBackup',
          version: 1,
          metadata: {
            browser: 'firefox',
            exportedAt: '2026-07-19T03:19:18.123Z',
            extensionVersion: '1.3.0'
          },
          options: {
            '+proxy': {
              name: 'proxy',
              profileType: 'FixedProfile'
            }
          }
        })
      );

      assert.deepStrictEqual(parsed, {
        schemaVersion: 3,
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile'
        }
      });
    });

    it('should preserve raw and base64 schemaVersion 3 backups', function () {
      const options = Object.create(Options.prototype);
      const raw = JSON.stringify({schemaVersion: 3, customOption: true});

      assert.deepStrictEqual(options.parseOptions(raw), {schemaVersion: 3, customOption: true});
      assert.deepStrictEqual(options.parseOptions(Buffer.from(raw, 'utf8').toString('base64')), {
        schemaVersion: 3,
        customOption: true
      });
    });

    it('should reject imported schemaVersion 1 and 2 backups', function () {
      const options = Object.create(Options.prototype);

      assert.throws(() => options.parseOptions(JSON.stringify({schemaVersion: 1})), /Invalid schemaVersion 1/);
      assert.throws(() => options.parseOptions(JSON.stringify({schemaVersion: 2})), /Invalid schemaVersion 2/);
    });

    it('should reject unsupported SwitchyAgain backup schemas and versions', function () {
      const options = Object.create(Options.prototype);

      assert.throws(() => options.parseOptions(JSON.stringify({schema: 'OtherBackup', version: 1, options: {}})), /Invalid backup file/);
      assert.throws(
        () => options.parseOptions(JSON.stringify({schema: 'SwitchyAgainBackup', version: 2, options: {}})),
        /Invalid backup file/
      );
    });
  });

  describe('#upgrade', function () {
    it('should preserve loopback bypass behavior when upgrading <local> from schemaVersion 2', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 2,
          '+proxy': {
            name: 'proxy',
            profileType: 'FixedProfile',
            bypassList: [
              {
                conditionType: 'BypassCondition',
                pattern: '<local>'
              }
            ]
          }
        })
        .then(([upgraded, changes]: any[]) => {
          assert.strictEqual(upgraded.schemaVersion, 3);
          assert.strictEqual(changes.schemaVersion, 3);
          assert.deepStrictEqual(
            upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern),
            ['<local>', '127.0.0.1', '[::1]', 'localhost']
          );
          assert.strictEqual(changes['+proxy'], upgraded['+proxy']);
        });
    });

    it('should not duplicate explicit local bypass entries when upgrading schemaVersion 2', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 2,
          '+proxy': {
            name: 'proxy',
            profileType: 'FixedProfile',
            bypassList: [
              {
                conditionType: 'BypassCondition',
                pattern: '<local>'
              },
              {
                conditionType: 'BypassCondition',
                pattern: '127.0.0.1'
              },
              {
                conditionType: 'BypassCondition',
                pattern: '[::1]'
              },
              {
                conditionType: 'BypassCondition',
                pattern: 'localhost'
              }
            ]
          }
        })
        .then(([upgraded]: any[]) => {
          assert.deepStrictEqual(
            upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern),
            ['<local>', '127.0.0.1', '[::1]', 'localhost']
          );
        });
    });

    it('should recognize unbracketed IPv6 loopback when upgrading schemaVersion 2', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 2,
          '+proxy': {
            name: 'proxy',
            profileType: 'FixedProfile',
            bypassList: [
              {
                conditionType: 'BypassCondition',
                pattern: '<local>'
              },
              {
                conditionType: 'BypassCondition',
                pattern: '::1'
              }
            ]
          }
        })
        .then(([upgraded]: any[]) => {
          assert.deepStrictEqual(
            upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern),
            ['<local>', '::1', '127.0.0.1', 'localhost']
          );
        });
    });

    it('should add a default UI locale when upgrading existing options', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 3
        })
        .then(([upgraded, changes]: any[]) => {
          assert.strictEqual(upgraded['-uiLocale'], 'en');
          assert.strictEqual(changes['-uiLocale'], 'en');
          assert.strictEqual(upgraded['-uiTheme'], 'light');
          assert.strictEqual(changes['-uiTheme'], 'light');
        });
    });

    it('should normalize unsupported UI locales and themes during upgrade', function () {
      const options = Object.create(Options.prototype);
      options.defaultUiLocale = () => 'es';
      return options
        .upgrade({
          schemaVersion: 3,
          '-uiLocale': 'de',
          '-uiTheme': 'unknown'
        })
        .then(([upgraded, changes]: any[]) => {
          assert.strictEqual(upgraded['-uiLocale'], 'es');
          assert.strictEqual(changes['-uiLocale'], 'es');
          assert.strictEqual(upgraded['-uiTheme'], 'light');
          assert.strictEqual(changes['-uiTheme'], 'light');
        });
    });

    it('should preserve supported UI themes during upgrade', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 3,
          '-uiLocale': 'en',
          '-uiTheme': 'system'
        })
        .then(([upgraded, changes]: any[]) => {
          assert.strictEqual(upgraded['-uiTheme'], 'system');
          assert.strictEqual(changes['-uiTheme'], undefined);
        });
    });

    it('should preserve tab group profile scope settings during upgrade', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 3,
          '-uiLocale': 'en',
          '-uiTheme': 'light',
          '-profileScopes': {
            tab: true,
            group: true,
            container: false,
            window: true
          }
        })
        .then(([upgraded, changes]: any[]) => {
          assert.deepStrictEqual(upgraded['-profileScopes'], {
            tab: true,
            group: true,
            container: false,
            window: true
          });
          assert.strictEqual(changes['-profileScopes'], undefined);
        });
    });

    it('should add default context menu options during upgrade', function () {
      const options = Object.create(Options.prototype);
      return options
        .upgrade({
          schemaVersion: 3,
          '-uiLocale': 'en',
          '-uiTheme': 'light'
        })
        .then(([upgraded, changes]: any[]) => {
          assert.deepStrictEqual(upgraded['-contextMenuOptions'], {
            switchProfile: true,
            tabProfile: false,
            groupProfile: false,
            containerProfile: false,
            windowProfile: false,
            linkProfileNewTab: false,
            linkProfileNewWindow: false,
            linkProfileNewPrivateWindow: false
          });
          assert.strictEqual(changes['-contextMenuOptions'], upgraded['-contextMenuOptions']);
        });
    });
  });

  describe('#setExternalProfile', function () {
    it('should revert to the current profile when no explicit revert target exists', function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '-revertProxyChanges': true,
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile'
        }
      };
      options._isSystem = false;
      options._currentProfileName = 'proxy';
      options._revertToProfileName = null;
      options.applyProfile = stubReturns(Promise.resolve());

      const result = options.setExternalProfile({
        name: '',
        profileType: 'PacProfile'
      });

      assertCalledOnce(options.applyProfile);
      assertCalledWith(options.applyProfile, 'proxy');
      assert.strictEqual(options._revertToProfileName, null);
      return result;
    });
  });

  describe('#applied profile dependencies', function () {
    it('should reapply the current profile when a subclass option affects proxy behavior', async function () {
      const options = new Options({schemaVersion: 3});
      await options.ready;
      options._options = {};
      options._watchingProfiles = {};
      options._currentProfileName = 'proxy';
      options.sync = null;
      options.optionAffectsAppliedProfile = (key: string) => key === '-runtimeProxyOption';
      options.applyProfile = stubReturns(Promise.resolve());

      await options._setOptions({'-runtimeProxyOption': true});
      assertCalledOnce(options.applyProfile);
      assertCalledWith(options.applyProfile, 'proxy', {update: false});
    });

    it('should watch profiles selected outside the current profile reference tree', function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '+proxy1': {
          name: 'proxy1',
          profileType: 'FixedProfile'
        },
        '+proxy2': {
          name: 'proxy2',
          profileType: 'FixedProfile'
        }
      };
      options.additionalAppliedProfileNames = () => ['proxy2'];

      assert.deepStrictEqual(options._watchingProfilesFor(options._options['+proxy1']), {
        '+proxy1': 'proxy1',
        '+proxy2': 'proxy2'
      });
    });
  });

  describe('#_setAvailableProfiles', function () {
    function stateRecorder() {
      const calls: any[] = [];
      return {
        calls,
        storage: {
          set(items: any) {
            calls.push(items);
            return Promise.resolve(items);
          }
        }
      };
    }

    it('should expose scope assignable profiles separately from rule result profiles', function () {
      const options = Object.create(Options.prototype);
      const state = stateRecorder();
      options._options = {
        '+auto': {
          name: 'auto',
          profileType: 'SwitchProfile',
          defaultProfileName: 'proxy',
          rules: []
        },
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile'
        },
        '+__attached': {
          name: '__attached',
          profileType: 'RuleListProfile',
          defaultProfileName: 'direct'
        },
        '+_temporary': {
          name: '_temporary',
          profileType: 'FixedProfile'
        }
      };
      options._state = state.storage;
      options._currentProfileName = 'auto';
      options._isSystem = false;

      return options._setAvailableProfiles().then(() => {
        const available = state.calls[0];
        assert.deepStrictEqual(available.scopeAssignableProfiles, ['auto', 'proxy', 'direct', 'system']);
        assert.deepStrictEqual(available.validResultProfiles, ['proxy', '__attached', '_temporary', 'direct']);
        assert.strictEqual(available.validResultProfiles.includes('system'), false);
      });
    });

    it('should clear scope assignable profiles while the current profile is system proxy', function () {
      const options = Object.create(Options.prototype);
      const state = stateRecorder();
      options._options = {
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile'
        }
      };
      options._state = state.storage;
      options._currentProfileName = 'system';
      options._isSystem = true;

      return options._setAvailableProfiles().then(() => {
        const available = state.calls[0];
        assert.deepStrictEqual(available.scopeAssignableProfiles, []);
        assert.deepStrictEqual(available.validResultProfiles, []);
      });
    });
  });

  describe('#explainRequest', function () {
    it('should explain switch profile rules down to the final fixed proxy result', function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '+auto': {
          name: 'auto',
          profileType: 'SwitchProfile',
          defaultProfileName: 'direct',
          rules: [
            {
              condition: {
                conditionType: 'HostWildcardCondition',
                pattern: '*.example.com'
              },
              profileName: 'proxy'
            }
          ]
        },
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile',
          fallbackProxy: {
            scheme: 'http',
            host: 'proxy.example',
            port: 8080
          }
        }
      };
      options._currentProfileName = 'auto';
      options._externalProfile = null;
      options._tempProfileActive = false;
      options._tempProfile = null;

      return options.explainRequest('https://www.example.com/path').then((explanation: any) => {
        assert.strictEqual(explanation.currentProfile.name, 'auto');
        assert.strictEqual(explanation.final.profile.name, 'proxy');
        assert.strictEqual(explanation.final.kind, 'proxy');
        assert.strictEqual(explanation.final.pacResult, 'PROXY proxy.example:8080');
        assert.deepStrictEqual(
          explanation.steps.map((step: any) => step.kind),
          ['rule', 'proxy']
        );
        assert.strictEqual(explanation.steps[0].targetProfile.name, 'proxy');
      });
    });

    it('should identify Global and Supplemental Bypass list matches', async function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '+global': {
          name: 'global',
          profileType: 'FixedProfile',
          bypassList: [
            {
              conditionType: 'BypassCondition',
              globalBypass: true,
              pattern: 'global.example',
              supplementalListName: 'Default'
            }
          ]
        },
        '+supplemental': {
          name: 'supplemental',
          profileType: 'FixedProfile',
          bypassList: [
            {
              conditionType: 'BypassCondition',
              pattern: 'work.example',
              supplementalBypass: true,
              supplementalListName: 'Work'
            }
          ]
        }
      };
      options._externalProfile = null;
      options._tempProfileActive = false;
      options._tempProfile = null;

      options._currentProfileName = 'global';
      const globalExplanation = await options.explainRequest('https://global.example/');
      assert.strictEqual(globalExplanation.steps[0].kind, 'globalBypass');
      assert.strictEqual(globalExplanation.steps[0].supplementalListName, 'Default');

      options._currentProfileName = 'supplemental';
      const supplementalExplanation = await options.explainRequest('https://work.example/');
      assert.strictEqual(supplementalExplanation.steps[0].kind, 'supplementalBypass');
      assert.strictEqual(supplementalExplanation.steps[0].supplementalListName, 'Work');
    });

    it('should mark attached rule list profiles without exposing them as normal profiles', function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '+auto switch': {
          name: 'auto switch',
          profileType: 'SwitchProfile',
          defaultProfileName: '__ruleListOf_auto switch',
          rules: []
        },
        '+__ruleListOf_auto switch': {
          name: '__ruleListOf_auto switch',
          profileType: 'RuleListProfile',
          color: '#99ccff',
          format: 'Switchy',
          defaultProfileName: 'direct',
          matchProfileName: 'direct',
          ruleList: ''
        }
      };
      options._currentProfileName = 'auto switch';
      options._externalProfile = null;
      options._tempProfileActive = false;
      options._tempProfile = null;

      return options.explainRequest('https://www.example.com/').then((explanation: any) => {
        assert.strictEqual(explanation.steps[0].kind, 'default');
        assert.strictEqual(explanation.steps[0].targetProfile.name, '__ruleListOf_auto switch');
        assert.strictEqual(explanation.steps[0].targetProfile.profileType, 'RuleListProfile');
        assert.strictEqual(explanation.steps[0].targetProfile.role, 'attachedRuleList');
        assert.strictEqual(explanation.steps[0].targetProfile.attachedToProfileName, 'auto switch');
      });
    });

    it('should explain temporary rules before the current direct profile', function () {
      const options = Object.create(Options.prototype);
      options._options = {
        '+proxy': {
          name: 'proxy',
          profileType: 'FixedProfile',
          fallbackProxy: {
            scheme: 'http',
            host: 'proxy.example',
            port: 8080
          }
        }
      };
      options._currentProfileName = 'direct';
      options._externalProfile = null;
      options._tempProfileActive = true;
      options._tempProfile = {
        name: '',
        profileType: 'SwitchProfile',
        defaultProfileName: 'direct',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            isTempRule: true,
            profileName: 'proxy'
          }
        ]
      };

      return options.explainRequest('https://www.example.com/').then((explanation: any) => {
        assert.strictEqual(explanation.tempRulesActive, true);
        assert.strictEqual(explanation.currentProfile.name, 'direct');
        assert.strictEqual(explanation.startProfile.name, '__temporary');
        assert.strictEqual(explanation.steps[0].kind, 'temporaryRule');
        assert.strictEqual(explanation.final.profile.name, 'proxy');
        assert.strictEqual(explanation.final.pacResult, 'PROXY proxy.example:8080');
      });
    });
  });
});
