import type {Options} from './options_client';

export const UI_KEYS = [
  '-uiLocale',
  '-startupProfileName',
  '-showConditionTypes',
  '-enableQuickSwitch',
  '-quickSwitchProfiles',
  '-confirmDeletion',
  '-refreshOnProfileChange',
  '-showInspectMenu',
  '-addConditionsToBottom'
];

export function sameOptionValue(a: unknown, b: unknown) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }
  return a === b;
}

export function uiOptionsDirty(before: Options, after: Options) {
  return UI_KEYS.some((key) => !sameOptionValue(before[key], after[key]));
}

export function uiOptionPatch(before: Options, after: Options) {
  const patch: Options = {};
  for (const key of UI_KEYS) {
    if (!sameOptionValue(before[key], after[key])) {
      patch[key] = [before[key], after[key]];
    }
  }
  return patch;
}

export function quickSwitchProfileNames(value: unknown) {
  return Array.isArray(value) ? (value as string[]) : [];
}

export function notCycledProfileNames(profiles: Array<{name?: string}>, quickSwitchProfiles: string[]) {
  const quickSwitchProfileSet = new Set(quickSwitchProfiles);
  return profiles
    .map((profile) => profile.name || '')
    .filter((name) => {
      return name && !quickSwitchProfileSet.has(name);
    });
}

export function moveQuickSwitchProfileName(quickSwitchProfiles: string[], name: string, enabled: boolean) {
  if (enabled) {
    if (quickSwitchProfiles.indexOf(name) >= 0) {
      return quickSwitchProfiles;
    }
    return quickSwitchProfiles.concat(name);
  }
  const next = quickSwitchProfiles.filter((profileName) => profileName !== name);
  return next.length === quickSwitchProfiles.length ? quickSwitchProfiles : next;
}

export function reorderQuickSwitchProfileName(quickSwitchProfiles: string[], name: string, targetName: string, enabled: boolean) {
  if (!enabled) {
    return quickSwitchProfiles;
  }
  const fromIndex = quickSwitchProfiles.indexOf(name);
  const toIndex = quickSwitchProfiles.indexOf(targetName);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return quickSwitchProfiles;
  }
  const next = quickSwitchProfiles.slice();
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, name);
  return next;
}
