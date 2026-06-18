import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useWindowEvent} from './dom_event_hooks';
import {message} from './i18n_client';

export type OptionsGuideKind = 'options' | 'switch';

export type OptionsGuideState = {
  kind: OptionsGuideKind;
  stepIndex: number;
};

type GuidePlacement = 'bottom' | 'fixedTopRight' | 'right' | 'top';

export type GuideStep = {
  fallback: string;
  id: string;
  messageKey: string;
  placement: GuidePlacement;
  selector: string;
};

type GuidePosition = {
  left: number;
  placement: Exclude<GuidePlacement, 'fixedTopRight'>;
  top: number;
};

export const OPTIONS_GUIDE_STEPS: GuideStep[] = [
  {
    fallback:
      'A <b>Proxy Profile</b> contains settings like server ip &amp; port for proxy.<br>Profiles are the the basic configuration units in SwitchyAgain.<br>We have already created an example profile for you. Try opening it.',
    id: 'fixed-profile-step',
    messageKey: 'options_guide_fixedProfileStep',
    placement: 'right',
    selector: '.nav-profile[data-profile-type="FixedProfile"]'
  },
  {
    fallback:
      "You can fill in your proxy server and port here as you like.<br>SwitchyAgain <b>does not come with any proxy servers</b>.<br>Please consult your network provider or proxy software manual if you don't know what should be filled in here.",
    id: 'fixed-servers-step',
    messageKey: 'options_guide_fixedServersStep',
    placement: 'bottom',
    selector: '.fixed-servers'
  },
  {
    fallback:
      'You can tell SwitchyAgain to switch between proxies automatically through the mighty <b>Switch Profile</b>.<br>However, its features cannot be covered in this quick guide.<br>You can open this profile to unlock its power some time later.',
    id: 'auto-switch-profile-step',
    messageKey: 'options_guide_autoSwitchProfileStep',
    placement: 'right',
    selector: '.nav-profile[data-profile-type="SwitchProfile"]'
  },
  {
    fallback:
      'Need more profiles? You can always add more <b>Proxy, Switch and other profiles</b><br>for all your proxying needs.<br>Enjoy proxying!',
    id: 'add-more-profiles-step',
    messageKey: 'options_guide_addMoreProfilesStep',
    placement: 'right',
    selector: '.nav-new-profile'
  }
];

export const SWITCH_PROFILE_GUIDE_STEPS: GuideStep[] = [
  {
    fallback:
      'SwitchyAgain can apply different profiles to requests based on <b>conditions</b>.<br> For example, the <b>Host wildcard</b> condition allows you to set the profile for all URLs in a domain.',
    id: 'condition-step',
    messageKey: 'options_guide_conditionStep',
    placement: 'bottom',
    selector: '.switch-rule-row'
  },
  {
    fallback:
      'You can use various condition types to match the host or full URL. <br> Click on the question mark to open the type reference.',
    id: 'condition-type-step',
    messageKey: 'options_guide_conditionTypeStep',
    placement: 'bottom',
    selector: '.condition-type-th'
  },
  {
    fallback:
      'SwitchyAgain applies the selected profile here to <b>any request matching the condition.</b> <br> The special <b>"[Direct]" profile</b> will cause the request to be sent without any proxy.',
    id: 'condition-profile-step',
    messageKey: 'options_guide_conditionProfileStep',
    placement: 'bottom',
    selector: '.switch-rule-row-target'
  },
  {
    fallback:
      'If no condition applies to some request, the "Default" profile will be used. <br>Conditions are always considered <b>from top to bottom</b> in order.<br>You can change their order by dragging the sort icon.',
    id: 'switch-default-step',
    messageKey: 'options_guide_switchDefaultStep',
    placement: 'top',
    selector: '.switch-default-row'
  },
  {
    fallback:
      "When you are done setting the switch profile, don't forget to <b>switch to it in the popup menu.</b><br/> The icon will show you the <b>final result</b> profile applied for the current tab. <br/> <b>Hovering</b> on the icon will reveal a tooltip with details.",
    id: 'apply-switch-profile-step',
    messageKey: 'options_guide_applySwitchProfileStep',
    placement: 'fixedTopRight',
    selector: 'body'
  }
];

function guideSteps(kind: OptionsGuideKind) {
  return kind === 'switch' ? SWITCH_PROFILE_GUIDE_STEPS : OPTIONS_GUIDE_STEPS;
}

const GUIDE_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
};

function decodeGuideText(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key[0] === '#') {
      const codePoint = key[1] === 'x' ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch (_err) {
          return match;
        }
      }
      return match;
    }
    return GUIDE_ENTITY_MAP[key] || match;
  });
}

function renderGuideContent(content: string) {
  const nodes: React.ReactNode[] = [];
  const stack: Array<{children: React.ReactNode[]; tag: 'strong' | null}> = [{children: nodes, tag: null}];
  const tagPattern = /<\/?(b|strong|br)\s*\/?>/gi;
  let index = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  function currentChildren() {
    return stack[stack.length - 1].children;
  }

  function appendText(value: string) {
    if (value) {
      currentChildren().push(decodeGuideText(value));
    }
  }

  while ((match = tagPattern.exec(content)) != null) {
    appendText(content.slice(index, match.index));
    const rawTag = match[0];
    const tag = match[1].toLowerCase();
    index = tagPattern.lastIndex;

    if (tag === 'br') {
      currentChildren().push(<br key={`br-${key++}`} />);
      continue;
    }

    if (rawTag[1] === '/') {
      if (stack.length > 1) {
        const frame = stack.pop();
        currentChildren().push(<strong key={`strong-${key++}`}>{frame?.children}</strong>);
      }
      continue;
    }

    stack.push({children: [], tag: 'strong'});
  }

  appendText(content.slice(index));
  while (stack.length > 1) {
    const frame = stack.pop();
    currentChildren().push(<strong key={`strong-${key++}`}>{frame?.children}</strong>);
  }

  return nodes;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function resolveTarget(selector: string) {
  if (selector === 'body') {
    return document.body;
  }
  return document.querySelector<HTMLElement>(selector);
}

function scrollTargetIntoView(target: HTMLElement, step: GuideStep) {
  if (step.placement === 'fixedTopRight' || target === document.body) {
    return;
  }
  target.scrollIntoView({
    block: 'nearest',
    inline: 'nearest'
  });
}

function positionForTarget(target: HTMLElement, step: GuideStep, popover?: HTMLElement | null): GuidePosition {
  const margin = 12;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
  const popoverWidth = popover?.offsetWidth || 340;
  const popoverHeight = popover?.offsetHeight || 160;

  if (step.placement === 'fixedTopRight') {
    return {
      left: Math.max(margin, viewportWidth - popoverWidth - margin),
      placement: 'top',
      top: margin
    };
  }

  const rect = target.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;

  switch (step.placement) {
    case 'bottom':
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      top = rect.bottom + margin;
      break;
    case 'right':
      left = rect.right + margin;
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      break;
    case 'top':
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      top = rect.top - popoverHeight - margin;
      break;
  }

  return {
    left: clamp(left, margin, Math.max(margin, viewportWidth - popoverWidth - margin)),
    placement: step.placement,
    top: clamp(top, margin, Math.max(margin, viewportHeight - popoverHeight - margin))
  };
}

export function OptionsGuide({
  guide,
  onDone,
  onNext,
  onSkip
}: {
  guide: OptionsGuideState;
  onDone?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
}) {
  const steps = guideSteps(guide.kind);
  const step = steps[guide.stepIndex];
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<GuidePosition | null>(null);
  const isLastStep = guide.stepIndex >= steps.length - 1;

  const content = useMemo(() => (step ? message(step.messageKey, step.fallback) : ''), [step]);
  const contentNodes = useMemo(() => renderGuideContent(content), [content]);
  const nowrapContent = guide.kind === 'options';

  function updatePosition() {
    if (!targetRef.current || !step) {
      return;
    }
    setPosition(positionForTarget(targetRef.current, step, popoverRef.current));
  }

  useWindowEvent('resize', updatePosition, undefined, !!step);
  useWindowEvent('scroll', updatePosition, true, !!step);

  useEffect(() => {
    if (!step) {
      return;
    }

    document.body.classList.add('options-guide-active');
    document.body.setAttribute('data-options-guide-step', step.id);

    let cancelled = false;
    let timeout: number | undefined;

    function clearTarget() {
      if (targetRef.current) {
        targetRef.current.classList.remove('options-guide-target');
        targetRef.current = null;
      }
    }

    function resolve(attempt = 0) {
      const target = resolveTarget(step.selector);
      if (!target && attempt < 30) {
        timeout = window.setTimeout(() => resolve(attempt + 1), 100);
        return;
      }
      if (cancelled) {
        return;
      }
      clearTarget();
      targetRef.current = target || document.body;
      targetRef.current.classList.add('options-guide-target');
      scrollTargetIntoView(targetRef.current, step);
      window.requestAnimationFrame(updatePosition);
    }

    resolve();

    return () => {
      cancelled = true;
      if (timeout != null) {
        window.clearTimeout(timeout);
      }
      clearTarget();
      document.body.classList.remove('options-guide-active');
      document.body.removeAttribute('data-options-guide-step');
    };
  }, [step]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !step) {
      return;
    }
    setPosition(positionForTarget(target, step, popoverRef.current));
  }, [content, step]);

  if (!step) {
    return null;
  }

  const placement = position?.placement || (step.placement === 'fixedTopRight' ? 'top' : step.placement);

  return (
    <div
      ref={popoverRef}
      className={`popover fade in ${placement} options-guide-popover${nowrapContent ? ' options-guide-popover-nowrap' : ''}`}
      role="dialog"
      style={{
        left: position ? `${position.left}px` : '-9999px',
        top: position ? `${position.top}px` : '-9999px'
      }}
    >
      <div className="arrow" />
      <div className="popover-content">
        <div className={nowrapContent ? 'options-guide-content-nowrap' : undefined}>{contentNodes}</div>
        <div className="options-guide-actions">
          {!isLastStep && (
            <button type="button" className="options-guide-button options-guide-button-secondary" onClick={onSkip}>
              {message('options_guideSkip', 'Skip guide')}
            </button>
          )}
          <button type="button" className="options-guide-button" onClick={isLastStep ? onDone : onNext}>
            {message(isLastStep ? 'options_guideDone' : 'options_guideNext', isLastStep ? 'Done' : 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}
