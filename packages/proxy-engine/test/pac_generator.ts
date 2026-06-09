import assert from 'assert';
import * as PacGenerator from '../src/pac_generator';

describe('PacGenerator', function() {
  let options;
  options = {
    '+auto': {
      name: 'auto',
      profileType: 'SwitchProfile',
      revision: 'test',
      defaultProfileName: 'direct',
      rules: [
        {
          profileName: 'proxy',
          condition: {
            conditionType: 'UrlRegexCondition',
            pattern: '^http://(www|www2)\\.example\\.com/'
          }
        }, {
          profileName: 'direct',
          condition: {
            conditionType: 'HostLevelsCondition',
            minValue: 3,
            maxValue: 8
          }
        }, {
          profileName: 'proxy',
          condition: {
            conditionType: 'KeywordCondition',
            pattern: 'keyword'
          }
        }, {
          profileName: 'proxy',
          condition: {
            conditionType: 'UrlWildcardCondition',
            pattern: 'https://ssl.example.com/*'
          }
        }
      ]
    },
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile',
      revision: 'test',
      fallbackProxy: {
        scheme: 'http',
        host: '127.0.0.1',
        port: 8888
      },
      bypassList: [
        {
          conditionType: 'BypassCondition',
          pattern: '127.0.0.1:8080'
        }, {
          conditionType: 'BypassCondition',
          pattern: '127.0.0.1'
        }, {
          conditionType: 'BypassCondition',
          pattern: '<local>'
        }
      ]
    }
  };
  it('should generate pac scripts from options', function() {
    let ast, func, pac, result;
    ast = PacGenerator.script(options, 'auto');
    pac = ast.print_to_string({
      beautify: true,
      comments: true
    });
    assert.notStrictEqual(pac, '');
    func = eval("(function () { " + pac + "\n return FindProxyForURL; })()");
    result = func('http://www.example.com/', 'www.example.com');
    return assert.strictEqual(result, 'PROXY 127.0.0.1:8888');
  });
  return it('should be able to compress pac scripts', function() {
    let ast, func, pac, result;
    ast = PacGenerator.script(options, 'auto');
    pac = (PacGenerator.compress(ast) as any).print_to_string();
    assert.notStrictEqual(pac, '');
    func = eval("(function () { " + pac + "\n return FindProxyForURL; })()");
    result = func('http://www.example.com/', 'www.example.com');
    return assert.strictEqual(result, 'PROXY 127.0.0.1:8888');
  });
});
