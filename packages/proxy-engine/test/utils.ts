import assert from 'assert';
import * as Utils from '../src/utils';

describe('getBaseDomain', function () {
  let getBaseDomain;
  getBaseDomain = Utils.getBaseDomain;
  it('should return domains with zero level unchanged', function () {
    return assert.strictEqual(getBaseDomain('someinternaldomain'), 'someinternaldomain');
  });
  it('should return domains with one level unchanged', function () {
    assert.strictEqual(getBaseDomain('example.com'), 'example.com');
    assert.strictEqual(getBaseDomain('e.test'), 'e.test');
    return assert.strictEqual(getBaseDomain('a.b'), 'a.b');
  });
  it('should treat two-segment TLD as one component', function () {
    assert.strictEqual(getBaseDomain('images.google.co.uk'), 'google.co.uk');
    assert.strictEqual(getBaseDomain('images.google.co.jp'), 'google.co.jp');
    return assert.strictEqual(getBaseDomain('example.com.cn'), 'example.com.cn');
  });
  it('should not mistake short domains with two-segment TLDs', function () {
    assert.strictEqual(getBaseDomain('a.bc.com'), 'bc.com');
    return assert.strictEqual(getBaseDomain('i.t.co'), 't.co');
  });
  it('should not try to modify IP address literals', function () {
    assert.strictEqual(getBaseDomain('127.0.0.1'), '127.0.0.1');
    assert.strictEqual(getBaseDomain('[::1]'), '[::1]');
    return assert.strictEqual(getBaseDomain('::f'), '::f');
  });
});
