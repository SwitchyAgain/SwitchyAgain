import ExtensionRuntime from '@switchyagain/extension-runtime';
import type {ProxyBypassGroup, ProxyCondition, ProxyProfile} from './proxy/proxy_types';

const ProxyEngine = ExtensionRuntime.ProxyEngine;

type SupplementalList = {
  bypassGroups?: ProxyBypassGroup[];
  bypassList?: ProxyCondition[];
  id: string;
  name: string;
};

type EffectiveCondition = ProxyCondition & {
  globalBypass?: true;
  supplementalBypass?: true;
  supplementalListId: string;
  supplementalListName: string;
};

type ProfileGroup = {
  id?: string;
  supplementalListIds?: string[];
};

function supplementalLists(source: Record<string, unknown>): SupplementalList[] {
  const rawLists = Array.isArray(source['-supplementalLists']) ? source['-supplementalLists'] : [];
  return rawLists.filter((value): value is SupplementalList => {
    if (!value || typeof value !== 'object') return false;
    const list = value as Partial<SupplementalList>;
    return typeof list.id === 'string' && !!list.id && typeof list.name === 'string' && !!list.name;
  });
}

function listConditions(list: SupplementalList, global: boolean): EffectiveCondition[] {
  const conditions = Array.isArray(list.bypassList) ? [...list.bypassList] : [];
  for (const group of list.bypassGroups || []) {
    if (group?.enabled !== false && Array.isArray(group.bypassList)) conditions.push(...group.bypassList);
  }
  return conditions.map((condition) => ({
    ...condition,
    ...(global ? {globalBypass: true as const} : {supplementalBypass: true as const}),
    supplementalListId: list.id,
    supplementalListName: list.name
  }));
}

export function optionsWithProxyExceptions(options?: unknown) {
  if (!options || typeof options !== 'object') return options;
  const source = options as Record<string, unknown>;
  if (source['-proxyExceptionsEnabled'] !== true) return options;
  const lists = supplementalLists(source);
  if (!lists.length) return options;
  const listMap = new Map(lists.map((list) => [list.id, list]));
  const configuredGlobalListId = typeof source['-globalBypassListId'] === 'string' ? source['-globalBypassListId'] : '';
  const globalListId = listMap.has(configuredGlobalListId) ? configuredGlobalListId : lists[0].id;
  const globalList = listMap.get(globalListId);
  const globalConditions = globalList ? listConditions(globalList, true) : [];
  const profileGroupsEnabled = source['-profileGroupsEnabled'] === true;
  const profileGroups = Array.isArray(source['-profileGroups']) ? (source['-profileGroups'] as ProfileGroup[]) : [];
  const profileGroupMap = new Map(
    profileGroups.filter((group) => typeof group?.id === 'string').map((group) => [group.id as string, group])
  );
  const next = {...source};
  ProxyEngine.Profiles.each(source, (key: string, profile: ProxyProfile) => {
    if (profile.profileType !== 'FixedProfile') return;
    const conditions = [...globalConditions];
    const assignedIds = new Set(Array.isArray(profile.supplementalListIds) ? profile.supplementalListIds : []);
    if (profileGroupsEnabled && profile.profileGroupEnabled === true && typeof profile.profileGroupId === 'string') {
      for (const listId of profileGroupMap.get(profile.profileGroupId)?.supplementalListIds || []) assignedIds.add(listId);
    }
    for (const listId of assignedIds) {
      if (listId === globalListId) continue;
      const list = listMap.get(listId);
      if (list) conditions.push(...listConditions(list, false));
    }
    if (conditions.length) next[key] = {...profile, bypassList: [...(profile.bypassList || []), ...conditions]};
  });
  return next;
}

export function profileWithProxyExceptions(profile: ProxyProfile, options?: unknown) {
  const effectiveOptions = optionsWithProxyExceptions(options);
  const effectiveProfile =
    profile.name && effectiveOptions && typeof effectiveOptions === 'object'
      ? ProxyEngine.Profiles.byName(profile.name, effectiveOptions)
      : null;
  return {options: effectiveOptions, profile: effectiveProfile || profile};
}
