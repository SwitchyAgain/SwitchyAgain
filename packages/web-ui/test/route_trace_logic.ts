import {
  formatRequestUrl,
  isAttachedRuleListProfile,
  profileFromExplanation,
  routeTraceStepCondition,
  routeTraceSteps
} from '../src/react/route_trace_logic';
import type {Options, RequestExplainStep} from '../src/react/options_client_types';

describe('route trace logic', () => {
  it('resolves known profiles from options and builds fallback profiles', () => {
    const options: Options = {
      '+proxy': {
        color: '#123456',
        name: 'proxy',
        profileType: 'FixedProfile'
      }
    };

    expect(profileFromExplanation(options, {name: 'proxy'})).toEqual({
      color: '#123456',
      name: 'proxy',
      profileType: 'FixedProfile'
    });
    expect(
      profileFromExplanation(options, {
        attachedToProfileName: 'auto',
        builtin: true,
        color: 1,
        name: 'missing',
        profileType: 'RuleListProfile',
        role: 'attachedRuleList'
      })
    ).toEqual({
      attachedToProfileName: 'auto',
      builtin: true,
      color: undefined,
      name: 'missing',
      profileType: 'RuleListProfile',
      role: 'attachedRuleList'
    });
    expect(profileFromExplanation(options, {})).toBeNull();
  });

  it('formats request URLs for display without fragments', () => {
    expect(formatRequestUrl('https://example.com:8443/path?q=1#hash')).toBe('https://example.com:8443/path?q=1');
    expect(formatRequestUrl('not a url')).toBe('not a url');
    expect(formatRequestUrl(null)).toBe('');
  });

  it('detects attached rule-list profiles', () => {
    expect(isAttachedRuleListProfile({name: '__ruleListOf_auto', role: 'attachedRuleList'})).toBe(true);
    expect(isAttachedRuleListProfile({name: 'proxy'})).toBe(false);
  });

  it('folds attached rule-list default steps into the next visible step', () => {
    const steps: RequestExplainStep[] = [
      {
        kind: 'profile',
        targetProfile: {
          name: 'auto'
        }
      },
      {
        kind: 'default',
        targetProfile: {
          name: '__ruleListOf_auto',
          role: 'attachedRuleList'
        }
      },
      {
        condition: '*.example.com',
        kind: 'rule',
        targetProfile: {
          name: 'proxy'
        }
      },
      {
        kind: 'default',
        targetProfile: {
          name: 'direct'
        }
      }
    ];

    expect(routeTraceSteps(steps)).toEqual([
      {
        kind: 'profile',
        targetProfile: {
          name: 'auto'
        }
      },
      {
        condition: '*.example.com',
        kind: 'attachedRuleList',
        targetProfile: {
          name: 'proxy'
        }
      },
      {
        kind: 'default',
        targetProfile: {
          name: 'direct'
        }
      }
    ]);
  });

  it('keeps dangling attached defaults when there is no following step', () => {
    const steps: RequestExplainStep[] = [
      {
        kind: 'default',
        targetProfile: {
          name: '__ruleListOf_auto',
          role: 'attachedRuleList'
        }
      }
    ];

    expect(routeTraceSteps(steps)).toEqual(steps);
  });

  it('chooses the most specific condition text for a step', () => {
    expect(
      routeTraceStepCondition({
        condition: 'condition',
        kind: 'rule',
        scheme: 'https',
        source: 'source'
      })
    ).toBe('source');
    expect(
      routeTraceStepCondition({
        condition: 'condition',
        kind: 'rule',
        scheme: 'https'
      })
    ).toBe('condition');
    expect(
      routeTraceStepCondition({
        kind: 'proxy',
        scheme: 'https'
      })
    ).toBe('https');
    expect(
      routeTraceStepCondition({
        kind: 'direct'
      })
    ).toBe('');
    expect(
      routeTraceStepCondition({
        condition: 'example.com',
        kind: 'globalBypass',
        supplementalListName: 'Default'
      })
    ).toBe('Default: example.com');
    expect(
      routeTraceStepCondition({
        condition: 'work.example',
        kind: 'supplementalBypass',
        supplementalListName: 'Work'
      })
    ).toBe('Work: work.example');
  });
});
