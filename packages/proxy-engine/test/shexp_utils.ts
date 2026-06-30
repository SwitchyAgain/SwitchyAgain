import assert from 'assert';
import * as ShexpUtils from '../src/shexp_utils';

describe('ShexpUtils', function () {
  describe('#escapeSlash', function () {
    it('should escape all forward slashes', function () {
      let regex;
      regex = ShexpUtils.escapeSlash('/test/');
      return assert.strictEqual(regex, '\\/test\\/');
    });
    it('should not escape slashes that are already escaped', function () {
      let regex;
      regex = ShexpUtils.escapeSlash('\\/test\\/');
      return assert.strictEqual(regex, '\\/test\\/');
    });
    it('should know the difference between escaped and unescaped slashes', function () {
      let regex;
      regex = ShexpUtils.escapeSlash('\\\\/\\/test\\/');
      return assert.strictEqual(regex, '\\\\\\/\\/test\\/');
    });
  });
  describe('#shExp2RegExp', function () {
    it('should escape regex meta chars and back slashes', function () {
      let regex;
      regex = ShexpUtils.shExp2RegExp('this.is|a\\test+');
      return assert.strictEqual(regex, '^this\\.is\\|a\\\\test\\+$');
    });
  });
});
