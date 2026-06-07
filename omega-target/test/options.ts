let chai: any, should: any, sinon: any;

chai = require('chai');
should = chai.should();
sinon = require('sinon');

chai.use(require('sinon-chai'));

describe('Options', function() {
  let Options: any, Promise: any;

  Options = require('../build-ts/options').default;
  Promise = require('bluebird');

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

      options.applyProfile.should.have.been.calledOnce.and.calledWith('proxy');
      should.equal(options._revertToProfileName, null);
      return result;
    });
  });
});
