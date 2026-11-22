// Tiny translation layer. `t('key', { name })` looks the key up in the current language
// (falling back to English) and fills {placeholders}. Plurals use `key_one` / `key_other`
// variants, picked by `count`. No native module is needed, so adding a language never needs
// a new app build.

import { en, type MessageKey } from './en';
import { es } from './es';

export type Language = 'en' | 'es';
export type LanguageSetting = Language | 'system';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const dictionaries: Record<Language, Record<string, string>> = { en, es };

let current: Language = 'en';

export function getLanguage(): Language {
  return current;
}

export function setCurrentLanguage(language: Language) {
  current = language;
}

// The device's language if we support it, otherwise English.
export function deviceLanguage(): Language {
  let tag = '';
  try {
    if (typeof navigator !== 'undefined' && navigator.language) tag = navigator.language;
    else tag = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    tag = '';
  }
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((l) => l.code === base) ? (base as Language) : 'en';
}

export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === 'system' ? deviceLanguage() : setting;
}

// BCP 47 tag for Intl formatting (dates, numbers).
export function localeTag(language: Language = current): string {
  return language === 'es' ? 'es-US' : 'en-US';
}

type Vars = Record<string, string | number | null | undefined>;

export function translate(
  language: Language,
  key: MessageKey | (string & {}),
  vars?: Vars
): string {
  const dict = dictionaries[language];
  let template: string | undefined;

  if (vars && typeof vars.count === 'number') {
    const rule = new Intl.PluralRules(localeTag(language)).select(vars.count);
    template = dict[`${key}_${rule}`] ?? dict[`${key}_other`];
    if (template === undefined)
      template = en[`${key}_${rule}` as MessageKey] ?? en[`${key}_other` as MessageKey];
  }
  template = template ?? dict[key] ?? (en as Record<string, string>)[key] ?? key;

  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

// For code outside React (helpers, hooks' alerts). Components should use `useT()` so they
// re-render when the language changes.
export function t(key: MessageKey | (string & {}), vars?: Vars): string {
  return translate(current, key, vars);
}

// An object whose values are looked up fresh on every read (`labelMap('decline', ['a'])`
// gives { a: t('decline.a') }), so constant label tables follow the current language.
export function labelMap<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) {
    Object.defineProperty(out, k, { enumerable: true, get: () => t(`${prefix}.${k}`) });
  }
  return out;
}

// A value stored in the database in English (a work type, schedule, role...), shown in the
// current language when we have a translation for it.
export function tv(value: string): string {
  const key = `val.${value}`;
  return key in dictionaries[current] || key in en ? translate(current, key) : value;
}
