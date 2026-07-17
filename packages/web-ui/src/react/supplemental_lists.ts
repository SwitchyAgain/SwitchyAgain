import type {Options} from './options_client_types';
import {message} from './i18n_client';
import type {SupplementalBypassList} from './profile_types';

const LIST_ID_PREFIX = 'supplemental-list-';
export const DEFAULT_SUPPLEMENTAL_LIST_ID = `${LIST_ID_PREFIX}default`;

function cleanName(value: unknown) {
  return String(value || '').trim();
}

function normalizedName(value: string) {
  return cleanName(value).toLowerCase();
}

export function supplementalListsForOptions(options?: Options | null): SupplementalBypassList[] {
  const rawLists = options?.['-supplementalLists'];
  if (!Array.isArray(rawLists)) return [];
  const seen = new Set<string>();
  const lists: SupplementalBypassList[] = [];
  for (const value of rawLists) {
    if (!value || typeof value !== 'object') continue;
    const source = value as Partial<SupplementalBypassList>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const name = cleanName(source.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    lists.push({
      id,
      name,
      bypassList: Array.isArray(source.bypassList) ? source.bypassList : [],
      bypassGroups: Array.isArray(source.bypassGroups) ? source.bypassGroups : []
    });
  }
  return lists;
}

export function createSupplementalListId(name: string, lists: SupplementalBypassList[]) {
  const existing = new Set(lists.map((list) => list.id));
  const base =
    cleanName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'list';
  let id = `${LIST_ID_PREFIX}${base}`;
  let index = 2;
  while (existing.has(id)) {
    id = `${LIST_ID_PREFIX}${base}-${index}`;
    index++;
  }
  return id;
}

export function supplementalListNameError(name: string, lists: SupplementalBypassList[], currentListId?: string) {
  const normalized = normalizedName(name);
  if (!normalized) return message('options_supplementalListNameRequired', 'List name is required.');
  if (lists.some((list) => list.id !== currentListId && normalizedName(list.name) === normalized)) {
    return message('options_supplementalListNameTaken', 'A Supplemental List with this name already exists.');
  }
  return '';
}

export function addSupplementalList(options: Options, name: string) {
  const lists = supplementalListsForOptions(options);
  const list: SupplementalBypassList = {
    id: createSupplementalListId(name, lists),
    name: cleanName(name),
    bypassList: [],
    bypassGroups: []
  };
  options['-supplementalLists'] = lists.concat(list);
  if (!options['-globalBypassListId']) options['-globalBypassListId'] = list.id;
  return list;
}

export function ensureDefaultSupplementalList(options: Options) {
  const lists = supplementalListsForOptions(options);
  const existingDefault = lists.find((list) => list.id === DEFAULT_SUPPLEMENTAL_LIST_ID);
  if (existingDefault) {
    if (!lists.some((list) => list.id === options['-globalBypassListId'])) options['-globalBypassListId'] = existingDefault.id;
    return existingDefault;
  }
  const list: SupplementalBypassList = {
    id: DEFAULT_SUPPLEMENTAL_LIST_ID,
    name: 'Default',
    bypassList: [],
    bypassGroups: []
  };
  options['-supplementalLists'] = lists.concat(list);
  if (!lists.some((candidate) => candidate.id === options['-globalBypassListId'])) options['-globalBypassListId'] = list.id;
  return list;
}
