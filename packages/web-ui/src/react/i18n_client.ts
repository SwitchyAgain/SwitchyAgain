import {applyRootLocale, extensionMessage, extensionUiLanguage, extensionUrl} from './browser_env';
import type {Options} from './options_client_types';

export type UiLocale = 'en' | 'zh-Hans' | 'zh-Hant' | 'es' | 'ru' | 'cs' | 'fa';

export type UiLocaleOption = {
  dir?: 'rtl';
  extensionLocale: string;
  label: string;
  value: UiLocale;
};

type LocaleMessage = {
  message: string;
  placeholders?: Record<
    string,
    {
      content: string;
    }
  >;
};

type LocaleCatalog = Record<string, LocaleMessage>;

export const UI_LOCALES: UiLocaleOption[] = [
  {value: 'en', extensionLocale: 'en', label: 'English'},
  {value: 'zh-Hans', extensionLocale: 'zh_CN', label: '简体中文'},
  {value: 'zh-Hant', extensionLocale: 'zh_TW', label: '繁體中文'},
  {value: 'es', extensionLocale: 'es', label: 'Español'},
  {value: 'ru', extensionLocale: 'ru', label: 'Русский'},
  {value: 'cs', extensionLocale: 'cs', label: 'Čeština'},
  {value: 'fa', extensionLocale: 'fa', label: 'فارسی', dir: 'rtl'}
];

const UI_LOCALE_BY_VALUE = new Map(UI_LOCALES.map((locale) => [locale.value, locale]));
const UI_LOCALE_BY_EXTENSION = new Map(UI_LOCALES.map((locale) => [locale.extensionLocale, locale]));
const localeCatalogs = new Map<UiLocale, LocaleCatalog | null>();

let currentCatalog: LocaleCatalog | null = null;
let englishCatalog: LocaleCatalog | null = null;

export function normalizeUiLocale(value: unknown): UiLocale | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/_/g, '-');
  if (UI_LOCALE_BY_VALUE.has(normalized as UiLocale)) {
    return normalized as UiLocale;
  }
  const extensionLocale = UI_LOCALE_BY_EXTENSION.get(value);
  return extensionLocale?.value || null;
}

export function browserUiLocale(language = extensionUiLanguage()): UiLocale {
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh-Hans';
  }
  if (
    normalized.startsWith('zh-hant') ||
    normalized.startsWith('zh-tw') ||
    normalized.startsWith('zh-hk') ||
    normalized.startsWith('zh-mo')
  ) {
    return 'zh-Hant';
  }
  if (normalized.startsWith('cs')) {
    return 'cs';
  }
  if (normalized.startsWith('es')) {
    return 'es';
  }
  if (normalized.startsWith('fa')) {
    return 'fa';
  }
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

export function uiLocaleForOptions(options?: Options | null): UiLocale {
  return normalizeUiLocale(options?.['-uiLocale']) || browserUiLocale();
}

function substitutionsArray(substitutions?: string | string[]) {
  if (Array.isArray(substitutions)) {
    return substitutions;
  }
  if (substitutions == null) {
    return [];
  }
  return [substitutions];
}

function replaceAllText(text: string, search: string, replacement: string) {
  return text.split(search).join(replacement);
}

function formatMessage(entry: LocaleMessage | undefined, substitutions?: string | string[]) {
  if (!entry) {
    return '';
  }
  let text = entry.message || '';
  const values = substitutionsArray(substitutions);
  if (entry.placeholders) {
    for (const [name, placeholder] of Object.entries(entry.placeholders)) {
      const match = placeholder.content.match(/^\$(\d+)$/);
      if (!match) {
        continue;
      }
      const value = values[Number(match[1]) - 1];
      if (value != null) {
        text = replaceAllText(text, `$${name}$`, String(value));
      }
    }
  }
  for (let i = 0; i < values.length; i++) {
    text = replaceAllText(text, `$${i}$`, String(values[i]));
    text = replaceAllText(text, `$${i + 1}$`, String(values[i]));
  }
  return text;
}

async function fetchLocaleCatalog(locale: UiLocale) {
  if (localeCatalogs.has(locale)) {
    return localeCatalogs.get(locale) || null;
  }
  const option = UI_LOCALE_BY_VALUE.get(locale);
  const url = option && extensionUrl(`_locales/${option.extensionLocale}/messages.json`, '');
  if (!url) {
    localeCatalogs.set(locale, null);
    return null;
  }
  if (url.startsWith('file:')) {
    localeCatalogs.set(locale, null);
    return null;
  }
  try {
    const response = await fetch(url, {cache: 'no-store'});
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const catalog = (await response.json()) as LocaleCatalog;
    localeCatalogs.set(locale, catalog);
    return catalog;
  } catch (_error) {
    localeCatalogs.set(locale, null);
    return null;
  }
}

function applyDocumentLocale(locale: UiLocale) {
  const option = UI_LOCALE_BY_VALUE.get(locale);
  applyRootLocale(locale, option?.dir || 'ltr');
}

export async function setUiLocale(locale: unknown) {
  const nextLocale = normalizeUiLocale(locale) || browserUiLocale();
  const [nextCatalog, fallbackCatalog] = await Promise.all([fetchLocaleCatalog(nextLocale), fetchLocaleCatalog('en')]);
  currentCatalog = nextCatalog;
  englishCatalog = fallbackCatalog;
  applyDocumentLocale(nextLocale);
  return nextLocale;
}

export function message(key: string, fallback = key, substitutions?: string | string[]) {
  const catalogMessage = formatMessage(currentCatalog?.[key] || englishCatalog?.[key], substitutions);
  return catalogMessage || extensionMessage(key, fallback, substitutions);
}

