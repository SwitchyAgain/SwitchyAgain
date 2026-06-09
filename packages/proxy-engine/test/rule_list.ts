import assert from 'assert';
import * as RuleList from '../src/rule_list';


describe('RuleList', function() {
  describe('AutoProxy', function() {
    let parse;
    parse = RuleList['AutoProxy'].parse;
    it('should parse keyword conditions', function() {
      let line, result;
      line = 'example.com';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'KeywordCondition',
          pattern: 'example.com'
        }
      });
    });
    it('should parse keyword conditions with asterisks', function() {
      let line, result;
      line = 'example*.com';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://*example*.com*'
        }
      });
    });
    it('should parse host conditions', function() {
      let line, result;
      line = '||example.com';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        }
      });
    });
    it('should parse "starts-with" conditions', function() {
      let line, result;
      line = '|https://ssl.example.com';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'https://ssl.example.com*'
        }
      });
    });
    it('should parse "starts-with" conditions for the HTTP scheme', function() {
      let line, result;
      line = '|http://example.com';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://example.com*'
        }
      });
    });
    it('should parse url regex conditions', function() {
      let line, result;
      line = '/^https?:\\/\\/[^\\/]+example\.com/';
      result = parse(line, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: line,
        profileName: 'match',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^https?:\\/\\/[^\\/]+example\.com'
        }
      });
    });
    it('should ignore comment lines', function() {
      let result;
      result = parse('!example.com', 'match', 'notmatch');
      return assert.strictEqual(result.length, 0);
    });
    it('should parse multiple lines', function() {
      let result;
      result = parse('example.com\n!comment\n||example.com', 'match', 'notmatch');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0], {
        source: 'example.com',
        profileName: 'match',
        condition: {
          conditionType: 'KeywordCondition',
          pattern: 'example.com'
        }
      });
      return assert.deepStrictEqual(result[1], {
        source: '||example.com',
        profileName: 'match',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        }
      });
    });
    return it('should put exclusive rules first', function() {
      let result;
      result = parse('example.com\n@@||example.com', 'match', 'notmatch');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0], {
        source: '@@||example.com',
        profileName: 'notmatch',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        }
      });
      return assert.deepStrictEqual(result[1], {
        source: 'example.com',
        profileName: 'match',
        condition: {
          conditionType: 'KeywordCondition',
          pattern: 'example.com'
        }
      });
    });
  });
  describe('Switchy', function() {
    let compose, parse;
    parse = RuleList['Switchy'].parse;
    compose = function(sections: Record<string, string[]>): string {
      let i, len, list, rule, rules, sec;
      list = '#BEGIN\r\n\r\n';
      for (sec in sections) {
        rules = sections[sec];
        list += "[" + sec + "]\r\n";
        for (i = 0, len = rules.length; i < len; i++) {
          rule = rules[i];
          list += rule;
          list += '\r\n';
        }
      }
      return list += '\r\n\r\n#END\r\n';
    };
    it('should parse empty rule lists', function() {
      let list, result;
      list = compose({});
      result = parse(list, 'match', 'notmatch');
      return assert.strictEqual(result.length, 0);
    });
    it('should ignore stuff before #BEGIN or after #END.', function() {
      let list, result;
      list = compose({});
      list += '[RegExp]\r\ntest\r\n';
      list = '[Wildcard]\r\ntest\r\n' + list;
      result = parse(list, 'match', 'notmatch');
      return assert.strictEqual(result.length, 0);
    });
    it('should parse wildcard rules', function() {
      let list, result;
      list = compose({
        'Wildcard': ['*://example.com/abc/*']
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: '*://example.com/abc/*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: '*://example.com/abc/*'
        }
      });
    });
    it('should parse RegExp rules', function() {
      let list, result;
      list = compose({
        'RegExp': ['^http://www\.example\.com/.*']
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: '^http://www\.example\.com/.*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^http://www\.example\.com/.*'
        }
      });
    });
    it('should parse exclusive rules', function() {
      let list, result;
      list = compose({
        'RegExp': ['!^http://www\.example\.com/.*']
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: '!^http://www\.example\.com/.*',
        profileName: 'notmatch',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^http://www\.example\.com/.*'
        }
      });
    });
    it('should parse multiple rules in multiple sections', function() {
      let list, result;
      list = compose({
        'Wildcard': ['http://www.example.com/*', 'http://example.com/*'],
        'RegExp': ['^http://www\.example\.com/.*', '^http://example\.com/.*']
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 4);
      assert.deepStrictEqual(result[0], {
        source: 'http://www.example.com/*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://www.example.com/*'
        }
      });
      assert.deepStrictEqual(result[1], {
        source: 'http://example.com/*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://example.com/*'
        }
      });
      assert.deepStrictEqual(result[2], {
        source: '^http://www\.example\.com/.*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^http://www\.example\.com/.*'
        }
      });
      return assert.deepStrictEqual(result[3], {
        source: '^http://example\.com/.*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^http://example\.com/.*'
        }
      });
    });
    return it('should put exclusive rules first', function() {
      let list, result;
      list = compose({
        'Wildcard': ['http://www\.example\.com/*'],
        'RegExp': ['!^http://www\.example\.com/.*']
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0], {
        source: '!^http://www\.example\.com/.*',
        profileName: 'notmatch',
        condition: {
          conditionType: 'UrlRegexCondition',
          pattern: '^http://www.example\.com/.*'
        }
      });
      return assert.deepStrictEqual(result[1], {
        source: 'http://www\.example\.com/*',
        profileName: 'match',
        condition: {
          conditionType: 'UrlWildcardCondition',
          pattern: 'http://www.example.com/*'
        }
      });
    });
  });
  return describe('Switchy (omega format)', function() {
    let compose, parse;
    parse = RuleList['Switchy'].parse;
    compose = RuleList['Switchy'].compose;
    it('should parse empty rule lists', function() {
      let list, result;
      list = compose({
        rules: []
      });
      result = parse(list, 'match', 'notmatch');
      return assert.strictEqual(result.length, 0);
    });
    it('should ignore comment lines.', function() {
      let list, result;
      list = compose({
        rules: []
      });
      list += ';*.example.com \r\n';
      result = parse(list, 'match', 'notmatch');
      return assert.strictEqual(result.length, 0);
    });
    it('should compose and parse HostWildcardCondition', function() {
      let list, result, rule;
      rule = {
        source: '*.example.com',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'match'
      };
      list = compose({
        rules: [rule],
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], rule);
    });
    it('should compose and parse HostRegexCondition', function() {
      let list, result, rule;
      rule = {
        source: 'HostRegex: ^http://www\.example\.com/.*',
        condition: {
          conditionType: 'HostRegexCondition',
          pattern: '^http://www\.example\.com/.*'
        },
        profileName: 'match'
      };
      list = compose({
        rules: [rule],
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], rule);
    });
    it('should compose and parse disabled rules', function() {
      let list, result, rule;
      rule = {
        source: 'Disabled: *.example.com',
        condition: {
          conditionType: 'FalseCondition',
          pattern: '*.example.com'
        },
        profileName: 'match'
      };
      list = compose({
        rules: [rule],
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], rule);
    });
    it('should compose and parse exclusive rules', function() {
      let list, result, rule;
      rule = {
        source: '!*.example.com',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.example.com'
        },
        profileName: 'notmatch'
      };
      list = compose({
        rules: [rule],
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], rule);
    });
    it('should compose and parse conditions starting with special chars', function() {
      let list, result, rule;
      rule = {
        source: ': ;abc',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: ';abc'
        },
        profileName: 'match'
      };
      list = compose({
        rules: [rule],
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], rule);
    });
    it('should parse multiple conditions', function() {
      let list, result, rules;
      rules = [
        {
          source: '*.example.com',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'match'
        }, {
          source: '*.example.org',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.org'
          },
          profileName: 'match'
        }
      ];
      list = compose({
        rules: rules,
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      return assert.deepStrictEqual(result, rules);
    });
    it('should respect the top-down order of conditions', function() {
      let list, result, rules;
      rules = [
        {
          source: 'b.example.com',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'b.example.com'
          },
          profileName: 'match'
        }, {
          source: '!a.example.org',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'a.example.org'
          },
          profileName: 'notmatch'
        }
      ];
      list = compose({
        rules: rules,
        defaultProfileName: 'notmatch'
      });
      result = parse(list, 'match', 'notmatch');
      return assert.deepStrictEqual(result, rules);
    });
    it('should add a default rule when results are enabled', function() {
      let list, result;
      list = compose({
        rules: [],
        defaultProfileName: 'notmatch'
      }, {
        withResult: true
      });
      assert.ok(list.split(/\r|\n/).indexOf('@with result') >= 0);
      result = parse(list, 'ignored', 'alsoIgnored');
      assert.strictEqual(result.length, 1);
      return assert.deepStrictEqual(result[0], {
        source: '*',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*'
        },
        profileName: 'notmatch'
      });
    });
    it('should compose and parse conditions with results', function() {
      let list, result, rules;
      rules = [
        {
          source: 'b.example.com',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'b.example.com'
          },
          profileName: 'abc'
        }, {
          source: 'a.example.org',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'a.example.org'
          },
          profileName: 'def'
        }
      ];
      list = compose({
        rules: rules,
        defaultProfileName: 'ghi'
      }, {
        withResult: true
      });
      result = parse(list, 'ignored', 'alsoIgnored');
      rules.push({
        source: '*',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*'
        },
        profileName: 'ghi'
      });
      return assert.deepStrictEqual(result, rules);
    });
    return it('should compose and parse exclusive conditions with results', function() {
      let list, result, rules;
      rules = [
        {
          source: '!b.example.com',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'b.example.com'
          },
          profileName: 'default profile'
        }, {
          source: 'a.example.org',
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: 'a.example.org'
          },
          profileName: 'some profile'
        }
      ];
      list = compose({
        rules: rules,
        defaultProfileName: 'default profile'
      }, {
        withResult: true,
        useExclusive: true
      });
      result = parse(list, 'ignored', 'alsoIgnored');
      rules.push({
        source: '*',
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*'
        },
        profileName: 'default profile'
      });
      return assert.deepStrictEqual(result, rules);
    });
  });
});
