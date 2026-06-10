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
      });
    });

    it('should normalize unsupported UI locales during upgrade', function() {
      const options = Object.create(Options.prototype);
      options.defaultUiLocale = () => 'es';
      return options.upgrade({
        schemaVersion: 3,
        '-uiLocale': 'de'
      }).then(([upgraded, changes]: any[]) => {
        assert.strictEqual(upgraded['-uiLocale'], 'es');
        assert.strictEqual(changes['-uiLocale'], 'es');
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
});
