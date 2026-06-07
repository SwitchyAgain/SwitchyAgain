import assert from 'assert';
import Promise from 'bluebird';
import OptionsClass from '../src/options';
import {assertCalledOnce, assertCalledWith, stubReturns} from './helpers/test_helpers';

describe('Options', function() {
  let Options: any;
  Options = OptionsClass;

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
