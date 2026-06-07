import assert from 'assert';
import ConditionsApi from '../src/conditions';
import ProfilesApi from '../src/profiles';
import UglifyJS from '../src/uglifyjs_shim';

describe('Profiles', function() {
  let Conditions: any,
    Profiles: any,
    U2: any,
    ruleListResult: (profileName: any, source: any) => any,
    testProfile: (profile: any, request: any, expected: any, expectedCompiled?: any) => any;
  Profiles = ProfilesApi;
  Conditions = ConditionsApi;
  U2 = UglifyJS;
  ruleListResult = function(profileName: any, source: any): any {
    return {
      profileName: profileName,
      source: source
    };
  };
  testProfile = function(profile: any, request: any, expected: any, expectedCompiled?: any): any {
    let _, compileResult, compiled, matchResult, msg, o_request, printResult, ref;
    o_request = request;
    if (typeof request === 'string') {
      request = Conditions.requestFromUrl(request);
    }
    if (expectedCompiled == null) {
      expectedCompiled = (ref = expected[0]) != null ? ref : Profiles.nameAsKey(expected.profileName);
    }
    compiled = Profiles.compile(profile);
    compileResult = eval('(' + compiled.print_to_string() + ')');
    if (typeof compileResult === 'function') {
      compileResult = compileResult(request.url, request.host, request.scheme);
    }
    if (expected != null) {
      matchResult = Profiles.match(profile, request);
      try {
        if (expected.source != null) {
          assert.strictEqual(matchResult.profileName, expected.profileName);
          assert.strictEqual(matchResult.source, expected.source);
        } else {
          assert.deepStrictEqual(matchResult, expected);
        }
      } catch (error) {
        _ = error;
        printResult = JSON.stringify(matchResult);
        msg = ("expect profile to return " + (JSON.stringify(expected)) + " ") + ("instead of " + printResult + " for request " + o_request);
        assert.fail(msg);
      }
    }
    if (compileResult !== expectedCompiled) {
      msg = ("expect COMPILED profile to return " + expectedCompiled + " ") + ("instead of " + compileResult + " for request " + o_request);
      assert.fail(msg);
    }
    return expected;
  };
  describe('#pacResult', function() {
    it('should return DIRECT for no proxy', function() {
      assert.strictEqual(Profiles.pacResult(), "DIRECT");
    });
    it('should return a valid PAC result for a proxy', function() {
      let proxy;
      proxy = {
        scheme: "http",
        host: "127.0.0.1",
        port: 8888
      };
      assert.strictEqual(Profiles.pacResult(proxy), "PROXY 127.0.0.1:8888");
    });
    return it('should return special compatible result for SOCKS5', function() {
      let compatibleResult, proxy;
      proxy = {
        scheme: "socks5",
        host: "127.0.0.1",
        port: 8888
      };
      compatibleResult = "SOCKS5 127.0.0.1:8888; SOCKS 127.0.0.1:8888";
      assert.strictEqual(Profiles.pacResult(proxy), compatibleResult);
    });
  });
  describe('#byName', function() {
    it('should get profiles from builtin profiles', function() {
      let profile;
      profile = Profiles.byName('direct');
      assert.strictEqual(typeof profile, 'object');
      assert.strictEqual(profile.profileType, 'DirectProfile');
    });
    return it('should get profiles from given options', function() {
      let profile;
      profile = {};
      profile = Profiles.byName('profile', {
        "+profile": profile
      });
      assert.strictEqual(profile, profile);
    });
  });
  describe('#allReferenceSet', function() {
    let profile: any;
    profile = Profiles.create('test', 'VirtualProfile');
    profile.defaultProfileName = 'bogus';
    it('should throw if referenced profile does not exist', function() {
      let getAllReferenceSet;
      getAllReferenceSet = function() {
        return Profiles.allReferenceSet(profile, {});
      };
      assert.throws(getAllReferenceSet, Error);
    });
    return it('should process a dumb profile for each missing profile if requested', function() {
      let refs;
      profile.defaultProfileName = 'bogus';
      refs = Profiles.allReferenceSet(profile, {}, {
        profileNotFound: 'dumb'
      });
      assert.strictEqual(refs['+bogus'], 'bogus');
    });
  });
  describe('SystemProfile', function() {
    it('should be builtin with the name "system"', function() {
      let profile;
      profile = Profiles.byName('system');
      assert.strictEqual(typeof profile, 'object');
      assert.strictEqual(profile.profileType, 'SystemProfile');
    });
    it('should not match request to profiles', function() {
      let profile;
      profile = Profiles.byName('system');
      assert.equal(Profiles.match(profile, {}), null);
    });
    return it('should throw when trying to compile', function() {
      let profile;
      profile = Profiles.byName('system');
      assert.throws(function() {
        return Profiles.compile(profile);
      });
    });
  });
  describe('DirectProfile', function() {
    it('should be builtin with the name "direct"', function() {
      let profile;
      profile = Profiles.byName('direct');
      assert.strictEqual(typeof profile, 'object');
      assert.strictEqual(profile.profileType, 'DirectProfile');
    });
    return it('should return "DIRECT" when compiled', function() {
      let profile;
      profile = Profiles.byName('direct');
      return testProfile(profile, {}, null, 'DIRECT');
    });
  });
  describe('FixedProfile', function() {
    let profile: any;
    profile = {
      profileType: 'FixedProfile',
      bypassList: [
        {
          conditionType: 'BypassCondition',
          pattern: '<local>'
        }
      ],
      proxyForHttp: {
        scheme: 'socks4',
        host: '127.0.0.1',
        port: 1234
      },
      proxyForHttps: {
        scheme: 'http',
        host: '127.0.0.1',
        port: 2345
      },
      fallbackProxy: {
        scheme: 'socks4',
        host: '127.0.0.1',
        port: 3456
      },
      auth: {
        proxyForHttps: {
          username: 'test',
          password: 'cheesecake'
        }
      }
    };
    it('should use protocol-specific proxies if suitable', function() {
      return testProfile(profile, 'https://www.example.com/', ['PROXY 127.0.0.1:2345', 'https', profile.proxyForHttps, profile.auth.proxyForHttps]);
    });
    it('should use fallback proxies for other protocols', function() {
      return testProfile(profile, 'ftp://www.example.com/', ['SOCKS 127.0.0.1:3456', '', profile.fallbackProxy, void 0]);
    });
    it('should not return authentication if not provided for protocol', function() {
      return testProfile(profile, 'http://www.example.com/', ['SOCKS 127.0.0.1:1234', 'http', profile.proxyForHttp, void 0]);
    });
    return it('should not use any proxy for requests matching the bypassList', function() {
      return testProfile(profile, 'ftp://localhost/', [
        'DIRECT', profile.bypassList[0], {
          scheme: 'direct'
        }, void 0
      ]);
    });
  });
  describe('PacProfile', function() {
    let profile: any;
    profile = Profiles.create('test', 'PacProfile');
    profile.pacScript = 'function FindProxyForURL(url, host) {\n  return "PROXY " + host + ":8080";\n}';
    it('should return the result of the pac script', function() {
      return testProfile(profile, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080');
    });
    it('should not fail for PAC with trailing comments', function() {
      let p;
      p = Profiles.create('test', 'PacProfile');
      p.pacScript = profile.pacScript + '// This is a trailing line comment.';
      testProfile(p, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080');
      p = Profiles.create('test', 'PacProfile');
      p.pacScript = profile.pacScript + '/* This is a multiline comment which is not properly closed.';
      return testProfile(p, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080');
    });
    it('should return includable for non-file pacUrl', function() {
      assert.strictEqual(Profiles.isIncludable(profile), true);
    });
    return it('should return not includable for file: pacUrl', function() {
      let p;
      p = Profiles.create('test', 'PacProfile');
      p.pacUrl = 'file:///proxy.pac';
      assert.strictEqual(Profiles.isIncludable(p), false);
    });
  });
  describe('SwitchProfile', function() {
    let profile: any;
    profile = Profiles.create('test', 'SwitchProfile');
    profile.rules = [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: 'company.abc.example.com'
        },
        profileName: 'company'
      }, {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'example'
      }, {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.abc.example.com'
        },
        profileName: 'abc'
      }
    ];
    profile.defaultProfileName = 'default';
    it('should match requests based on rules', function() {
      return testProfile(profile, 'http://company.abc.example.com:998/abc', profile.rules[0]);
    });
    it('should respect the order of rules', function() {
      testProfile(profile, 'http://abc.example.com:9999/abc', profile.rules[1]);
      return testProfile(profile, 'http://www.example.com:9999/abc', profile.rules[1]);
    });
    it('should return defaultProfileName when no rules match', function() {
      return testProfile(profile, 'http://www.example.org:9999/abc', ['+default', null]);
    });
    it('should calulate directly referenced profiles correctly', function() {
      let set;
      set = Profiles.directReferenceSet(profile);
      assert.deepStrictEqual(set, {
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc',
        '+default': 'default'
      });
    });
    it('should clear the reference cache on profile revision change', function() {
      let newSet, set;
      profile.revision = 'a';
      set = Profiles.directReferenceSet(profile);
      profile.defaultProfileName = 'abc';
      profile.revision = 'b';
      newSet = Profiles.directReferenceSet(profile);
      assert.deepStrictEqual(newSet, {
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc'
      });
    });
    return it('should clear the reference cache if explicitly requested', function() {
      let newSet, set;
      profile.revision = 'a';
      set = Profiles.directReferenceSet(profile);
      profile.defaultProfileName = 'abc';
      Profiles.dropCache(profile);
      newSet = Profiles.directReferenceSet(profile);
      assert.deepStrictEqual(newSet, {
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc'
      });
    });
  });
  describe('VirtualProfile', function() {
    let profile: any;
    profile = Profiles.create('test', 'VirtualProfile');
    profile.defaultProfileName = 'default';
    return it('should always return defaultProfileName', function() {
      return testProfile(profile, 'http://www.example.com/abc', ['+default', null]);
    });
  });
  return describe('RulelistProfile', function() {
    let profile: any;
    profile = Profiles.create('test', 'AutoProxyRuleListProfile');
    profile.defaultProfileName = 'default';
    profile.matchProfileName = 'example';
    profile.ruleList = 'example.com';
    profile.revision = 'a';
    it('should calulate directly referenced profiles correctly', function() {
      let set;
      set = Profiles.directReferenceSet(profile);
      assert.deepStrictEqual(set, {
        '+example': 'example',
        '+default': 'default'
      });
    });
    it('should calulate referenced profiles for rule list with results', function() {
      let set;
      set = Profiles.directReferenceSet({
        profileType: 'RuleListProfile',
        format: 'Switchy',
        matchProfileName: 'ignored',
        defaultProfileName: 'alsoIgnored',
        ruleList: '[SwitchyOmega Conditions]\n@with result\n!*.example.org\n*.example.com +ABC\n* +DEF'
      });
      assert.deepStrictEqual(set, {
        '+ABC': 'ABC',
        '+DEF': 'DEF'
      });
    });
    it('should match requests based on the rule list', function() {
      testProfile(profile, 'http://localhost/example.com', ruleListResult('example', 'example.com'));
      return testProfile(profile, 'http://localhost/example.org', ['+default', null]);
    });
    it('should update rule list on update', function() {
      Profiles.update(profile, 'example.org');
      profile.revision = 'b';
      testProfile(profile, 'http://localhost/example.com', ['+default', null]);
      return testProfile(profile, 'http://localhost/example.org', ruleListResult('example', 'example.org'));
    });
    it('should not fail when ruleList is not provided', function() {
      let p;
      p = {
        profileType: 'RuleListProfile',
        format: 'Switchy',
        matchProfileName: 'match',
        defaultProfileName: 'default'
      };
      assert.strictEqual(typeof Profiles.directReferenceSet(p), 'object');
      return testProfile(p, 'http://localhost/example.com', ['+default', null]);
    });
    return it('should switch to AutoProxy format on update if detected', function() {
      profile = Profiles.create('test2', 'RuleListProfile');
      profile.format = 'Switchy';
      profile.defaultProfileName = 'default';
      profile.matchProfileName = 'example';
      assert.strictEqual(profile.format, 'Switchy');
      Profiles.update(profile, '[AutoProxy]\nexample.org');
      assert.strictEqual(profile.format, 'AutoProxy');
      testProfile(profile, 'http://localhost/example.com', ['+default', null]);
      return testProfile(profile, 'http://localhost/example.org', ruleListResult('example', 'example.org'));
    });
  });
});
