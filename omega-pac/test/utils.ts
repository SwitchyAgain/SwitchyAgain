var Utils, chai, should;

chai = require('chai');

should = chai.should();

Utils = require('../build-ts/utils');

describe('getBaseDomain', function() {
  var getBaseDomain;
  getBaseDomain = Utils.getBaseDomain;
  it('should return domains with zero level unchanged', function() {
    return getBaseDomain('someinternaldomain').should.equal('someinternaldomain');
  });
  it('should return domains with one level unchanged', function() {
    getBaseDomain('example.com').should.equal('example.com');
    getBaseDomain('e.test').should.equal('e.test');
    return getBaseDomain('a.b').should.equal('a.b');
  });
  it('should treat two-segment TLD as one component', function() {
    getBaseDomain('images.google.co.uk').should.equal('google.co.uk');
    getBaseDomain('images.google.co.jp').should.equal('google.co.jp');
    return getBaseDomain('example.com.cn').should.equal('example.com.cn');
  });
  it('should not mistake short domains with two-segment TLDs', function() {
    getBaseDomain('a.bc.com').should.equal('bc.com');
    return getBaseDomain('i.t.co').should.equal('t.co');
  });
  return it('should not try to modify IP address literals', function() {
    getBaseDomain('127.0.0.1').should.equal('127.0.0.1');
    getBaseDomain('[::1]').should.equal('[::1]');
    return getBaseDomain('::f').should.equal('::f');
  });
});
