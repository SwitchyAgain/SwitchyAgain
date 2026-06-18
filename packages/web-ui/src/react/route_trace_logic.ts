import type {Options, RequestExplainProfile, RequestExplainStep} from './options_client_types';
import {profileByName} from './profile_widgets';
import type {Profile} from './profile_widgets';

export function profileFromExplanation(options: Options | null | undefined, profile?: RequestExplainProfile): Profile | null {
  const profileName = typeof profile?.name === 'string' ? profile.name : '';
  if (!profileName) {
    return null;
  }
  return (
    profileByName(options, profileName) || {
      attachedToProfileName: profile?.attachedToProfileName,
      builtin: !!profile?.builtin,
      color: typeof profile?.color === 'string' ? profile.color : undefined,
      name: profileName,
      profileType: typeof profile?.profileType === 'string' ? profile.profileType : 'VirtualProfile',
      role: profile?.role
    }
  );
}

export function formatRequestUrl(url: unknown) {
  const rawUrl = String(url || '');
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return rawUrl;
  }
}

export function isAttachedRuleListProfile(profile?: RequestExplainProfile) {
  return profile?.role === 'attachedRuleList';
}

export function routeTraceSteps(steps: RequestExplainStep[]) {
  const visibleSteps: RequestExplainStep[] = [];
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const nextStep = steps[index + 1];
    if (step.kind === 'default' && isAttachedRuleListProfile(step.targetProfile) && nextStep) {
      visibleSteps.push({
        ...nextStep,
        kind: 'attachedRuleList'
      });
      index++;
      continue;
    }
    visibleSteps.push(step);
  }
  return visibleSteps;
}

export function routeTraceStepCondition(step: RequestExplainStep) {
  return step.source || step.condition || step.scheme || '';
}
