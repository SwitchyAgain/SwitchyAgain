import assert from 'assert';
import Promise from '../src/promise';
import OptionsClass from '../src/options';
import {assertCalledOnce, assertCalledWith, stubReturns} from './helpers/test_helpers';

describe('Options', function() {
  let Options: any;
  Options = OptionsClass;

  describe('#upgrade', function() {
    it('should preserve loopback bypass behavior when upgrading <local> from schemaVersion 2', function() {
      const options = Object.create(Options.prototype);
      return options.upgrade({
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
      }).then(([upgraded, changes]: any[]) => {
        assert.strictEqual(upgraded.schemaVersion, 3);
        assert.strictEqual(changes.schemaVersion, 3);
        assert.deepStrictEqual(upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern), [
          '<local>',
          '127.0.0.1',
          '[::1]',
          'localhost'
        ]);
        assert.strictEqual(changes['+proxy'], upgraded['+proxy']);
      });
    });

    it('should not duplicate explicit local bypass entries when upgrading schemaVersion 2', function() {
      const options = Object.create(Options.prototype);
      return options.upgrade({
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
      }).then(([upgraded]: any[]) => {
        assert.deepStrictEqual(upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern), [
          '<local>',
          '127.0.0.1',
          '[::1]',
          'localhost'
        ]);
      });
    });

    it('should recognize unbracketed IPv6 loopback when upgrading schemaVersion 2', function() {
      const options = Object.create(Options.prototype);
      return options.upgrade({
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
      }).then(([upgraded]: any[]) => {
        assert.deepStrictEqual(upgraded['+proxy'].bypassList.map((condition: any) => condition.pattern), [
          '<local>',
          '::1',
          '127.0.0.1',
          'localhost'
        ]);
      });
    });

    it('should add a default UI locale when upgrading existing options', function() {
      const options = Object.create(Options.prototype);
      return options.upgrade({
        schemaVersion: 3
      }).then(([upgraded, changes]: any[]) => {
        assert.strictEqual(upgraded['-uiLocale'], 'en');
        assert.strictEqual(changes['-uiLocale'], 'en');
        assert.strictEqual(upgraded['-uiTheme'], 'light');
        assert.strictEqual(changes['-uiTheme'], 'light');
      });
    });

    it('should normalize unsupported UI locales and themes during upgrade', function() {
      const options = Object.create(Options.prototype);
      options.defaultUiLocale = () => 'es';
      return options.upgrade({
        schemaVersion: 3,
        '-uiLocale': 'de',
        '-uiTheme': 'unknown'
      }).then(([upgraded, changes]: any[]) => {
        assert.strictEqual(upgraded['-uiLocale'], 'es');
        assert.strictEqual(changes['-uiLocale'], 'es');
        assert.strictEqual(upgraded['-uiTheme'], 'light');
        assert.strictEqual(changes['-uiTheme'], 'light');
      });
    });

    it('should preserve supported UI themes during upgrade', function() {
      const options = Object.create(Options.prototype);
      return options.upgrade({
        schemaVersion: 3,
        '-uiLocale': 'en',
        '-uiTheme': 'system'
      }).then(([upgraded, changes]: any[]) => {
        assert.strictEqual(upgraded['-uiTheme'], 'system');
        assert.strictEqual(changes['-uiTheme'], undefined);
      });
    });
  });

  describe('#setExternalProfile', function() {
    it('should revert to the current profile when no explicit revert target exists', function() {
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

  describe('#explainRequest', function() {
    it('should explain switch profile rules down to the final fixed proxy result', function() {
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
        assert.deepStrictEqual(explanation.steps.map((step: any) => step.kind), ['rule', 'proxy']);
        assert.strictEqual(explanation.steps[0].targetProfile.name, 'proxy');
      });
    });

    it('should mark attached rule list profiles without exposing them as normal profiles', function() {
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

    it('should explain temporary rules before the current direct profile', function() {
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
