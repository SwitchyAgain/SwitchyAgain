import type {Options} from './options_client_types';

export const NETWORK_REQUEST_IGNORE_LIST_KEY = '-networkRequestIgnoreList';

export function normalizeNetworkRequestIgnoreList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen: Record<string, boolean> = {};
  const result: string[] = [];
  for (const item of value) {
    const pattern = String(item || '').trim();
    if (!pattern || seen[pattern]) {
      continue;
    }
    seen[pattern] = true;
    result.push(pattern);
  }
  return result;
}

export function networkRequestIgnoreListFromText(value: string): string[] {
  return normalizeNetworkRequestIgnoreList(value.split(/\r?\n/));
}

export function networkRequestIgnoreText(value: Options | string[] | undefined | null): string {
  const list = Array.isArray(value) ? value : value?.[NETWORK_REQUEST_IGNORE_LIST_KEY];
  return normalizeNetworkRequestIgnoreList(list).join('\n');
}

export function addNetworkRequestIgnorePatterns(current: unknown, patterns: string[]) {
  return normalizeNetworkRequestIgnoreList([...normalizeNetworkRequestIgnoreList(current), ...patterns]);
}

export function removeNetworkRequestIgnorePatterns(current: unknown, patterns: string[]) {
  const removeSet: Record<string, boolean> = {};
  for (const pattern of patterns) {
    removeSet[pattern] = true;
  }
  return normalizeNetworkRequestIgnoreList(current).filter((pattern) => !removeSet[pattern]);
}
