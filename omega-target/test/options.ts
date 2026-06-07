import assert from 'assert';
import Promise from 'bluebird';
import sinon from 'sinon';
import OptionsClass from '../src/options';

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
      options.applyProfile = sinon.stub().returns(Promise.resolve());

      const result = options.setExternalProfile({
        name: '',
        profileType: 'PacProfile'
      });

      sinon.assert.calledOnce(options.applyProfile);
      sinon.assert.calledWith(options.applyProfile, 'proxy');
      assert.strictEqual(options._revertToProfileName, null);
      return result;
    });
  });
});
