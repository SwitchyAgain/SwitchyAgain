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
  it('should include private suffixes in the domain boundary', function () {
    assert.strictEqual(getBaseDomain('sub.foo.github.io'), 'foo.github.io');
    return assert.strictEqual(getBaseDomain('sub.foo.blogspot.com'), 'foo.blogspot.com');
  });
  it('should preserve hostname normalization behavior', function () {
    assert.strictEqual(getBaseDomain('WWW.Example.COM'), 'example.com');
    assert.strictEqual(getBaseDomain('www.example.com.'), 'example.com');
    return assert.strictEqual(getBaseDomain('www.食狮.com.cn'), 'xn--85x722f.com.cn');
  });
  it('should leave invalid hostnames unchanged', function () {
    assert.strictEqual(getBaseDomain('foo._tcp.example.com'), 'foo._tcp.example.com');
    assert.strictEqual(getBaseDomain('.foo.example.com'), '.foo.example.com');
    return assert.strictEqual(getBaseDomain('foo..example.com'), 'foo..example.com');
  });
  it('should not try to modify IP address literals', function () {
    assert.strictEqual(getBaseDomain('127.0.0.1'), '127.0.0.1');
    assert.strictEqual(getBaseDomain('[::1]'), '[::1]');
    return assert.strictEqual(getBaseDomain('::f'), '::f');
  });
});
