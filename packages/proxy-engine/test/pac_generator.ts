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
  it('should be able to compress pac scripts', function() {
    let ast, func, pac, result;
    ast = PacGenerator.script(options, 'auto');
    pac = (PacGenerator.compress(ast) as any).print_to_string();
    assert.notStrictEqual(pac, '');
    func = eval("(function () { " + pac + "\n return FindProxyForURL; })()");
    result = func('http://www.example.com/', 'www.example.com');
    return assert.strictEqual(result, 'PROXY 127.0.0.1:8888');
  });
  it('should only match URL path rules when the browser provides the full URL', function() {
    const pathOptions = {
      '+auto': {
        name: 'auto',
        profileType: 'SwitchProfile',
        revision: 'test',
        defaultProfileName: 'direct',
        rules: [
          {
            profileName: 'proxy',
            condition: {
              conditionType: 'UrlWildcardCondition',
              pattern: 'http://example.com/path*'
            }
          },
          {
            profileName: 'proxy',
            condition: {
              conditionType: 'UrlWildcardCondition',
              pattern: 'https://example.com/path*'
            }
          },
          {
            profileName: 'proxy',
            condition: {
              conditionType: 'UrlWildcardCondition',
              pattern: 'ws://example.com/socket*'
            }
          },
          {
            profileName: 'proxy',
            condition: {
              conditionType: 'UrlWildcardCondition',
              pattern: 'wss://example.com/socket*'
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
        }
      }
    };
    const ast = PacGenerator.script(pathOptions, 'auto');
    const pac = (PacGenerator.compress(ast) as any).print_to_string();
    const func = eval("(function () { " + pac + "\n return FindProxyForURL; })()");

    assert.strictEqual(func('http://example.com/path?a=1', 'example.com'), 'PROXY 127.0.0.1:8888');
    assert.strictEqual(func('https://example.com/path?a=1', 'example.com'), 'PROXY 127.0.0.1:8888');
    assert.strictEqual(func('ws://example.com/socket?a=1', 'example.com'), 'PROXY 127.0.0.1:8888');
    assert.strictEqual(func('wss://example.com/socket?a=1', 'example.com'), 'PROXY 127.0.0.1:8888');

    assert.strictEqual(func('https://example.com/', 'example.com'), 'DIRECT');
    assert.strictEqual(func('wss://example.com/', 'example.com'), 'DIRECT');
  });
});
