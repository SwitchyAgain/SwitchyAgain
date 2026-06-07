let chai: any, lolex: any, should: any;

chai = require('chai');

should = chai.should();

lolex = require('lolex');

describe('Conditions', function() {
  let Conditions: any, U2: any, testCond: (condition: any, request: any, should_match?: any) => any;
  Conditions = require('../build-ts/conditions').default;
  U2 = require('../build-ts/uglifyjs_shim').default;
  testCond = function(condition: any, request: any, should_match?: any): any {
    let compileResult, condExpr, friendlyError, matchResult, o_request, testFunc;
    o_request = request;
    should_match = !!should_match;
    if (typeof request === 'string') {
      request = Conditions.requestFromUrl(request);
    }
    matchResult = Conditions.match(condition, request);
    condExpr = Conditions.compile(condition);
    testFunc = new U2.AST_Function({
      argnames: [
        new U2.AST_SymbolFunarg({
          name: 'url'
        }), new U2.AST_SymbolFunarg({
          name: 'host'
        }), new U2.AST_SymbolFunarg({
          name: 'scheme'
        })
      ],
      body: [
        new U2.AST_Return({
          value: condExpr
        })
      ]
    });
    testFunc = eval('(' + testFunc.print_to_string() + ')');
    compileResult = testFunc(request.url, request.host, request.scheme);
    friendlyError = function(compiled?: any): any {
      let msg, printCompiled, printCond, printMatch;
      printCond = JSON.stringify(condition);
      printCompiled = compiled ? 'COMPILED ' : '';
      printMatch = should_match ? 'to match' : 'not to match';
      msg = ("expect " + printCompiled + "condition " + printCond + " ") + (printMatch + " request " + o_request);
      return chai.assert(false, msg);
    };
    if (matchResult !== should_match) {
      friendlyError();
    }
    if (compileResult !== should_match) {
      friendlyError('compiled');
    }
    return matchResult;
  };
  describe('TrueCondition', function() {
    return it('should always return true', function() {
      return testCond({
        conditionType: 'TrueCondition'
      }, {}, true);
    });
  });
  describe('FalseCondition', function() {
    return it('should always return false', function() {
      return testCond({
        conditionType: 'FalseCondition'
      }, {}, false);
    });
  });
  describe('UrlRegexCondition', function() {
    let cond: any;
    cond = {
      conditionType: 'UrlRegexCondition',
      pattern: 'example\\.com'
    };
    it('should match requests based on regex pattern', function() {
      return testCond(cond, 'http://www.example.com/', true);
    });
    it('should not match requests not matching the pattern', function() {
      return testCond(cond, 'http://www.example.net/', false);
    });
    it('should support regex meta chars', function() {
      let con;
      con = {
        conditionType: 'UrlRegexCondition',
        pattern: 'exam.*\\.com'
      };
      return testCond(con, 'http://www.example.com/', true);
    });
    return it('should fallback to not match if pattern is invalid', function() {
      let con;
      con = {
        conditionType: 'UrlRegexCondition',
        pattern: ')Invalid('
      };
      return testCond(con, 'http://www.example.com/', false);
    });
  });
  describe('UrlWildcardCondition', function() {
    let cond: any;
    cond = {
      conditionType: 'UrlWildcardCondition',
      pattern: '*example.com*'
    };
    it('should match requests based on wildcard pattern', function() {
      return testCond(cond, 'http://www.example.com/', true);
    });
    it('should not match requests not matching the pattern', function() {
      return testCond(cond, 'http://www.example.net/', false);
    });
    it('should support wildcard question marks', function() {
      cond = {
        conditionType: 'UrlWildcardCondition',
        pattern: '*exam???.com*'
      };
      return testCond(cond, 'http://www.example.com/', true);
    });
    it('should not support regex meta chars', function() {
      cond = {
        conditionType: 'UrlWildcardCondition',
        pattern: '.*example.com.*'
      };
      return testCond(cond, 'http://example.com/', false);
    });
    return it('should support multiple patterns in one condition', function() {
      cond = {
        conditionType: 'UrlWildcardCondition',
        pattern: '*.example.com/*|*.example.net/*'
      };
      testCond(cond, 'http://a.example.com/abc', true);
      testCond(cond, 'http://b.example.net/def', true);
      return testCond(cond, 'http://c.example.org/ghi', false);
    });
  });
  describe('HostRegexCondition', function() {
    let cond: any;
    cond = {
      conditionType: 'HostRegexCondition',
      pattern: '.*\\.example\\.com'
    };
    it('should match requests based on regex pattern', function() {
      return testCond(cond, 'http://www.example.com/', true);
    });
    it('should not match requests not matching the pattern', function() {
      return testCond(cond, 'http://example.com/', false);
    });
    return it('should not match URL parts other than the host', function() {
      return testCond(cond, 'http://example.net/www.example.com').should.be["false"];
    });
  });
  describe('HostWildcardCondition', function() {
    let cond: any;
    cond = {
      conditionType: 'HostWildcardCondition',
      pattern: '*.example.com'
    };
    it('should match requests based on wildcard pattern', function() {
      return testCond(cond, 'http://www.example.com/', true);
    });
    it('should also match hostname without the optional level', function() {
      return testCond(cond, 'http://example.com/', true);
    });
    it('should process patterns like *.*example.com correctly', function() {
      let con;
      con = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.*example.com'
      };
      testCond(con, 'http://example.com/', true);
      testCond(con, 'http://www.example.com/', true);
      testCond(con, 'http://www.some-example.com/', true);
      return testCond(con, 'http://xample.com/', false);
    });
    it('should allow override of the magical behavior', function() {
      let con;
      con = {
        conditionType: 'HostWildcardCondition',
        pattern: '**.example.com'
      };
      testCond(con, 'http://www.example.com/', true);
      return testCond(con, 'http://example.com/', false);
    });
    it('should not match URL parts other than the host', function() {
      return testCond(cond, 'http://example.net/www.example.com').should.be["false"];
    });
    return it('should support multiple patterns in one condition', function() {
      cond = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.example.com|*.example.net'
      };
      testCond(cond, 'http://a.example.com/abc', true);
      testCond(cond, 'http://example.net/def', true);
      return testCond(cond, 'http://c.example.org/ghi', false);
    });
  });
  describe('BypassCondition', function() {
    it('should correctly support patterns containing hosts', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '.example.com'
      };
      testCond(cond, 'http://www.example.com/', true);
      testCond(cond, 'http://example.com/', false);
      cond.pattern = '*.example.com';
      testCond(cond, 'http://www.example.com/', true);
      testCond(cond, 'http://example.com/', false);
      cond.pattern = 'example.com';
      testCond(cond, 'http://example.com/', true);
      testCond(cond, 'http://www.example.com/', false);
      cond.pattern = '*example.com';
      testCond(cond, 'http://example.com/', true);
      testCond(cond, 'http://www.example.com/', true);
      return testCond(cond, 'http://anotherexample.com/', true);
    });
    it('should match the scheme specified in the pattern', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: 'http://example.com'
      };
      testCond(cond, 'http://example.com/', true);
      return testCond(cond, 'https://example.com/', false);
    });
    it('should match the port specified in the pattern', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: 'http://example.com:8080'
      };
      testCond(cond, 'http://example.com:8080/', true);
      return testCond(cond, 'http://example.com:888/', false);
    });
    it('should correctly support patterns using IPv4 literals', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: 'http://127.0.0.1:8080'
      };
      testCond(cond, 'http://127.0.0.1:8080/', true);
      return testCond(cond, 'http://127.0.0.2:8080/', false);
    });
    it('should correctly support IPv6 canonicalization', function() {
      let cond, result;
      cond = {
        conditionType: 'BypassCondition',
        pattern: 'http://[0:0::1]:8080'
      };
      result = Conditions.analyze(cond);
      testCond(cond, 'http://[::1]:8080/', true);
      return testCond(cond, 'http://[1::1]:8080/', false);
    });
    it('should correctly support IPv6 canonicalization 2', function() {
      let cond, result;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '[::1]'
      };
      result = Conditions.analyze(cond);
      testCond(cond, 'http://[::1]:8080/', true);
      return testCond(cond, 'http://[1::1]:8080/', false);
    });
    it('should parse IPv4 CIDR notation', function() {
      let cond, result;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '192.168.0.0/16'
      };
      result = Conditions.analyze(cond).analyzed;
      should.exist(result.ip);
      return result.ip.should.eql({
        conditionType: 'IpCondition',
        ip: '192.168.0.0',
        prefixLength: 16
      });
    });
    it('should parse IPv6 CIDR notation', function() {
      let cond, result;
      cond = {
        conditionType: 'BypassCondition',
        pattern: 'fefe:13::abc/33'
      };
      result = Conditions.analyze(cond).analyzed;
      should.exist(result.ip);
      return result.ip.should.eql({
        conditionType: 'IpCondition',
        ip: 'fefe:13::abc',
        prefixLength: 33
      });
    });
    it('should parse IPv6 CIDR notation with zero prefixLength', function() {
      let cond, result;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '::/0'
      };
      result = Conditions.analyze(cond).analyzed;
      should.exist(result.ip);
      return result.ip.should.eql({
        conditionType: 'IpCondition',
        ip: '::',
        prefixLength: 0
      });
    });
    it('should match 127.0.0.1 when <local> is used', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '<local>'
      };
      return testCond(cond, 'http://127.0.0.1:8080/', true);
    });
    it('should match [::1] when <local> is used', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '<local>'
      };
      return testCond(cond, 'http://[::1]:8080/', true);
    });
    return it('should match any host without dots when <local> is used', function() {
      let cond;
      cond = {
        conditionType: 'BypassCondition',
        pattern: '<local>'
      };
      testCond(cond, 'http://localhost:8080/', true);
      testCond(cond, 'http://intranet:8080/', true);
      testCond(cond, 'http://foobar/', true);
      testCond(cond, 'http://example.com/', false);
      testCond(cond, 'http://[::ffff:eeee]/', true);
      return testCond(cond, 'http://[::1.2.3.4]/', false);
    });
  });
  describe('IpCondition', function() {
    it('should support IPv4 subnet', function() {
      let compiled, cond, request;
      cond = {
        conditionType: "IpCondition",
        ip: '192.168.1.1',
        prefixLength: 16
      };
      request = Conditions.requestFromUrl('http://192.168.4.4/');
      Conditions.match(cond, request).should.be["true"];
      compiled = Conditions.compile(cond).print_to_string();
      return compiled.should.contain('isInNet(host,"192.168.1.1","255.255.0.0")');
    });
    it('should support IPv6 subnet', function() {
      let compiled, cond, request;
      cond = {
        conditionType: "IpCondition",
        ip: 'fefe:13::abc',
        prefixLength: 33
      };
      request = Conditions.requestFromUrl('http://[fefe:13::def]/');
      Conditions.match(cond, request).should.be["true"];
      compiled = Conditions.compile(cond).print_to_string();
      compiled.should.contain('isInNet(host,"fefe:13::abc","ffff:ffff:8000::")');
      return compiled.should.contain('isInNetEx(host,"fefe:13::abc/33")');
    });
    it('should support IPv6 subnet with zero prefixLength', function() {
      let compiled, cond, request;
      cond = {
        conditionType: "IpCondition",
        ip: '::',
        prefixLength: 0
      };
      request = Conditions.requestFromUrl('http://[fefe:13::def]/');
      Conditions.match(cond, request).should.be["true"];
      compiled = Conditions.compile(cond).print_to_string();
      return compiled.indexOf('indexOf(').should.be.above(0);
    });
    it('should not match domain name to IP subnet', function() {
      let cond, request;
      cond = {
        conditionType: "IpCondition",
        ip: '::',
        prefixLength: 0
      };
      request = Conditions.requestFromUrl('http://www.example.com/');
      return Conditions.match(cond, request).should.be["false"];
    });
    return it('should not pass domain name to isInNet function', function() {
      let compiledFunc, ipToCompiledFunc;
      ipToCompiledFunc = function(ip: string, prefixLen: number): any {
        let cond, dummyIsInNet, testFunc;
        cond = {
          conditionType: "IpCondition",
          ip: ip,
          prefixLength: prefixLen
        };
        dummyIsInNet = new U2.AST_Function({
          argnames: [],
          body: [
            new U2.AST_Return({
              value: new U2.AST_True
            })
          ]
        });
        testFunc = new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({
              name: 'url'
            }), new U2.AST_SymbolFunarg({
              name: 'host'
            }), new U2.AST_SymbolFunarg({
              name: 'scheme'
            })
          ],
          body: [
            new U2.AST_Var({
              definitions: [
                new U2.AST_VarDef({
                  name: new U2.AST_SymbolVar({
                    name: 'isInNet'
                  }),
                  value: dummyIsInNet
                })
              ]
            }), new U2.AST_Return({
              value: Conditions.compile(cond)
            })
          ]
        });
        return eval('(' + testFunc.print_to_string() + ')');
      };
      compiledFunc = ipToCompiledFunc('0.0.0.0', 0);
      compiledFunc(null, 'www.example.com').should.equal(false);
      compiledFunc(null, '127.0.0.1').should.equal(true);
      compiledFunc = ipToCompiledFunc('0.0.0.0', 1);
      compiledFunc(null, 'www.example.com').should.equal(false);
      compiledFunc(null, '127.0.0.1').should.equal(true);
      compiledFunc = ipToCompiledFunc('::', 0);
      compiledFunc(null, 'www.example.com').should.equal(false);
      compiledFunc(null, '::1').should.equal(true);
      compiledFunc = ipToCompiledFunc('::', 1);
      compiledFunc(null, 'www.example.com').should.equal(false);
      return compiledFunc(null, '::1').should.equal(true);
    });
  });
  describe('KeywordCondition', function() {
    let cond;
    cond = {
      conditionType: 'KeywordCondition',
      pattern: 'example.com'
    };
    it('should match requests based on substring', function() {
      testCond(cond, 'http://www.example.com/', true);
      return testCond(cond, 'http://www.example.net/', false);
    });
    return it('should not match HTTPS requests', function() {
      testCond(cond, 'https://example.com/', false);
      return testCond(cond, 'https://example.net/', false);
    });
  });
  describe('WeekdayCondition', function() {
    let clock: any, testCondDay: (cond: any, day: number, match: boolean) => any;
    clock = null;
    before(function() {
      return clock = lolex.install(0, ['Date']);
    });
    after(function() {
      return clock.uninstall();
    });
    testCondDay = function(cond: any, day: number, match: boolean): any {
      let date;
      date = day > 0 ? day : 7;
      clock.setSystemTime(new Date("2016-02-0" + date + "T00:00:00Z").getTime());
      return testCond(cond, "http://weekday-" + day + "/", match);
    };
    it('should match requests based on date range', function() {
      let cond;
      cond = {
        conditionType: 'WeekdayCondition',
        startDay: 3,
        endDay: 5
      };
      testCondDay(cond, 0, false);
      testCondDay(cond, 1, false);
      testCondDay(cond, 2, false);
      testCondDay(cond, 3, true);
      testCondDay(cond, 4, true);
      testCondDay(cond, 5, true);
      return testCondDay(cond, 6, false);
    });
    it('should match the day if startDay == endDay', function() {
      let cond;
      cond = {
        conditionType: 'WeekdayCondition',
        startDay: 3,
        endDay: 3
      };
      testCondDay(cond, 0, false);
      testCondDay(cond, 1, false);
      testCondDay(cond, 2, false);
      testCondDay(cond, 3, true);
      testCondDay(cond, 4, false);
      testCondDay(cond, 5, false);
      return testCondDay(cond, 6, false);
    });
    it('should not match anything if startDay > endDay', function() {
      let cond;
      cond = {
        conditionType: 'WeekdayCondition',
        startDay: 4,
        endDay: 3
      };
      testCondDay(cond, 0, false);
      testCondDay(cond, 1, false);
      testCondDay(cond, 2, false);
      testCondDay(cond, 3, false);
      testCondDay(cond, 4, false);
      testCondDay(cond, 5, false);
      return testCondDay(cond, 6, false);
    });
    it('should match according to .days', function() {
      let cond;
      cond = {
        conditionType: 'WeekdayCondition',
        days: 'SMTWtFs'
      };
      testCondDay(cond, 0, true);
      testCondDay(cond, 1, true);
      testCondDay(cond, 2, true);
      testCondDay(cond, 3, true);
      testCondDay(cond, 4, true);
      testCondDay(cond, 5, true);
      testCondDay(cond, 6, true);
      cond = {
        conditionType: 'WeekdayCondition',
        days: 'S-TW-F-'
      };
      testCondDay(cond, 0, true);
      testCondDay(cond, 1, false);
      testCondDay(cond, 2, true);
      testCondDay(cond, 3, true);
      testCondDay(cond, 4, false);
      testCondDay(cond, 5, true);
      return testCondDay(cond, 6, false);
    });
    return it('should prefer .days to .startDay and .endDay', function() {
      let cond;
      cond = {
        conditionType: 'WeekdayCondition',
        days: '--TW---',
        startDay: 0,
        endDay: 0
      };
      testCondDay(cond, 0, false);
      testCondDay(cond, 1, false);
      testCondDay(cond, 2, true);
      testCondDay(cond, 3, true);
      testCondDay(cond, 4, false);
      testCondDay(cond, 5, false);
      return testCondDay(cond, 6, false);
    });
  });
  describe('TimeCondition', function() {
    let clock: any, testCondTime: (cond: any, time: string, match: boolean) => any;
    clock = null;
    before(function() {
      return clock = lolex.install(0, ['Date']);
    });
    after(function() {
      return clock.uninstall();
    });
    testCondTime = function(cond: any, time: string, match: boolean): any {
      clock.setSystemTime(new Date("01 Feb 2016 " + time).getTime());
      return testCond(cond, "http://time-" + time + "/", match);
    };
    it('should match requests based on hour range', function() {
      let cond;
      cond = {
        conditionType: 'TimeCondition',
        startHour: 7,
        endHour: 9
      };
      testCondTime(cond, '00:00:00', false);
      testCondTime(cond, '06:00:00', false);
      testCondTime(cond, '07:00:00', true);
      testCondTime(cond, '08:00:00', true);
      testCondTime(cond, '09:00:00', true);
      testCondTime(cond, '09:59:59', true);
      testCondTime(cond, '10:00:00', false);
      testCondTime(cond, '19:00:00', false);
      return testCondTime(cond, '23:00:00', false);
    });
    it('should match the hour if startHour == endHour', function() {
      let cond;
      cond = {
        conditionType: 'TimeCondition',
        startHour: 7,
        endHour: 7
      };
      testCondTime(cond, '00:00:00', false);
      testCondTime(cond, '06:00:00', false);
      testCondTime(cond, '07:00:00', true);
      testCondTime(cond, '07:00:01', true);
      testCondTime(cond, '07:59:59', true);
      testCondTime(cond, '08:00:00', false);
      return testCondTime(cond, '19:00:00', false);
    });
    return it('should not match anything if startHour > endHour', function() {
      let cond;
      cond = {
        conditionType: 'TimeCondition',
        startHour: 7,
        endHour: 6
      };
      testCondTime(cond, '00:00:00', false);
      testCondTime(cond, '06:00:00', false);
      testCondTime(cond, '06:59:59', false);
      testCondTime(cond, '07:00:00', false);
      testCondTime(cond, '08:00:00', false);
      testCondTime(cond, '09:00:00', false);
      testCondTime(cond, '10:00:00', false);
      testCondTime(cond, '19:00:00', false);
      return testCondTime(cond, '23:00:00', false);
    });
  });
  describe('#typeFromAbbr', function() {
    return it('should get condition types by abbrs', function() {
      Conditions.typeFromAbbr('True').should.equal('TrueCondition');
      return Conditions.typeFromAbbr('HR').should.equal('HostRegexCondition');
    });
  });
  return describe('#str and #fromStr', function() {
    it('should encode & decode TrueCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'TrueCondition'
      };
      result = Conditions.str(condition);
      result.should.equal('True:');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode conditions with pattern correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'UrlWildcardCondition',
        pattern: '*://*.example.com/*'
      };
      result = Conditions.str(condition);
      result.should.equal('UrlWildcard: ' + condition.pattern);
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode False while preserving pattern', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'FalseCondition',
        pattern: 'a b c'
      };
      result = Conditions.str(condition);
      result.should.equal('Disabled: a b c');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode FalseCondition without any pattern', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'FalseCondition'
      };
      result = Conditions.str(condition);
      result.should.equal('Disabled:');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode HostWildcardCondition using shorthand syntax', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.example.com'
      };
      result = Conditions.str(condition);
      result.should.equal(condition.pattern);
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode HostWildcardCondition ending with colon', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'HostWildcardCondition',
        pattern: 'bogus:'
      };
      result = Conditions.str(condition);
      result.should.equal('HostWildcard: ' + condition.pattern);
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode BypassCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'BypassCondition',
        pattern: '127.0.0.1/16'
      };
      result = Conditions.str(condition);
      result.should.equal('Bypass: 127.0.0.1/16');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should add brackets for IPv6 hosts in BypassCondition', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'BypassCondition',
        pattern: '::1'
      };
      result = Conditions.str(condition);
      result.should.equal('Bypass: [::1]');
      cond = Conditions.fromStr(result);
      cond.conditionType.should.equal('BypassCondition');
      return cond.pattern.should.equal('[::1]');
    });
    it('should add brackets for IPv6 hosts with scheme in BypassCondition', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'BypassCondition',
        pattern: 'http://::1'
      };
      result = Conditions.str(condition);
      result.should.equal('Bypass: http://[::1]');
      cond = Conditions.fromStr(result);
      cond.conditionType.should.equal('BypassCondition');
      return cond.pattern.should.equal('http://[::1]');
    });
    it('should encode & decode IpCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'IpCondition',
        ip: '127.0.0.1',
        prefixLength: 16
      };
      result = Conditions.str(condition);
      result.should.equal('Ip: 127.0.0.1/16');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should provide sensible fallbacks for invalid IpCondition', function() {
      let cond;
      cond = Conditions.fromStr('Ip: foo/-233');
      cond.should.eql({
        conditionType: 'IpCondition',
        ip: '0.0.0.0',
        prefixLength: 0
      });
      cond = Conditions.fromStr('Ip: nonsense stuff');
      return cond.should.eql({
        conditionType: 'IpCondition',
        ip: '0.0.0.0',
        prefixLength: 0
      });
    });
    it('should assume full match for IpCondition without prefixLength', function() {
      let cond;
      cond = Conditions.fromStr('Ip: 127.0.0.1');
      cond.should.eql({
        conditionType: 'IpCondition',
        ip: '127.0.0.1',
        prefixLength: 32
      });
      cond = Conditions.fromStr('Ip: ::1');
      return cond.should.eql({
        conditionType: 'IpCondition',
        ip: '::1',
        prefixLength: 128
      });
    });
    it('should provide sensible fallbacks for invalid IpCondition', function() {
      let cond;
      cond = Conditions.fromStr('Ip: 0.0.0.0/-233');
      return cond.should.eql({
        conditionType: 'IpCondition',
        ip: '0.0.0.0',
        prefixLength: 0
      });
    });
    it('should encode & decode HostLevelsCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'HostLevelsCondition',
        minValue: 4,
        maxValue: 7
      };
      result = Conditions.str(condition);
      result.should.equal('HostLevels: 4~7');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should provide sensible fallbacks for HostLevels out of range', function() {
      let cond;
      cond = Conditions.fromStr('HostLevels: A~-1');
      cond.should.eql({
        conditionType: 'HostLevelsCondition',
        minValue: 1,
        maxValue: 1
      });
      cond = Conditions.fromStr('HostLevels: nonsense');
      return cond.should.eql({
        conditionType: 'HostLevelsCondition',
        minValue: 1,
        maxValue: 1
      });
    });
    it('should encode & decode WeekdayCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'WeekdayCondition',
        startDay: 3,
        endDay: 6
      };
      result = Conditions.str(condition);
      result.should.equal('Weekday: 3~6');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should provide sensible fallbacks for Weekday out of range', function() {
      let cond;
      cond = Conditions.fromStr('Weekday: -1~100');
      cond.should.eql({
        conditionType: 'WeekdayCondition',
        startDay: 0,
        endDay: 0
      });
      cond = Conditions.fromStr('Weekday: nonsense');
      return cond.should.eql({
        conditionType: 'WeekdayCondition',
        startDay: 0,
        endDay: 0
      });
    });
    it('should encode & decode WeekdayCondition with days', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'WeekdayCondition',
        days: 'SMTWtFs'
      };
      result = Conditions.str(condition);
      result.should.equal('Weekday: SMTWtFs');
      cond = Conditions.fromStr(result);
      cond.should.eql(condition);
      condition = {
        conditionType: 'WeekdayCondition',
        days: 'SM-W-Fs'
      };
      result = Conditions.str(condition);
      result.should.equal('Weekday: SM-W-Fs');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should encode & decode TimeCondition correctly', function() {
      let cond, condition, result;
      condition = {
        conditionType: 'TimeCondition',
        startHour: 7,
        endHour: 23
      };
      result = Conditions.str(condition);
      result.should.equal('Hour: 7~23');
      cond = Conditions.fromStr(result);
      return cond.should.eql(condition);
    });
    it('should provide sensible fallbacks for Hour out of range', function() {
      let cond;
      cond = Conditions.fromStr('Hour: -1~100');
      cond.should.eql({
        conditionType: 'TimeCondition',
        startHour: 0,
        endHour: 0
      });
      cond = Conditions.fromStr('Hour: nonsense');
      return cond.should.eql({
        conditionType: 'TimeCondition',
        startHour: 0,
        endHour: 0
      });
    });
    it('should parse conditions with extra spaces correctly', function() {
      return Conditions.fromStr('url:    *abcde*   ').should.eql({
        conditionType: 'UrlWildcardCondition',
        pattern: '*abcde*'
      });
    });
    it('should parse abbreviated condition types correctly', function() {
      return Conditions.fromStr('url: *://*.example.com/*').should.eql({
        conditionType: 'UrlWildcardCondition',
        pattern: '*://*.example.com/*'
      });
    });
    return it('should parse escaped HostWildcardCondition starting with colon', function() {
      return Conditions.fromStr(': :bogus:').should.eql({
        conditionType: 'HostWildcardCondition',
        pattern: ':bogus:'
      });
    });
  });
});
