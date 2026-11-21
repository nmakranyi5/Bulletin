import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import type { MessageKey } from './en';
import {
  Language,
  LanguageSetting,
  deviceLanguage,
  localeTag,
  resolveLanguage,
  setCurrentLanguage,
  translate,
} from './core';

export { LANGUAGES, getLanguage, localeTag, t, tv } from './core';
export type { Language, LanguageSetting } from './core';
export type { MessageKey } from './en';

const STORAGE_KEY = 'bulletin.language';

type Vars = Record<string, string | number | null | undefined>;

type I18nValue = {
  language: Language;
  setting: LanguageSetting;
  setSetting: (next: LanguageSetting) => void;
  t: (key: MessageKey | (string & {}), vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue>({
  language: 'en',
  setting: 'system',
  setSetting: () => {},
  t: (key, vars) => translate('en', key, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // The web page is pre-rendered in English and then hydrated; starting there and switching
  // after mount avoids a hydration mismatch (same reason the theme starts light on web).
  const [setting, setSettingState] = useState<LanguageSetting>('system');
  const [language, setLanguage] = useState<Language>(
    Platform.OS === 'web' ? 'en' : deviceLanguage()
  );

  const apply = useCallback((next: LanguageSetting) => {
    const resolved = resolveLanguage(next);
    setCurrentLanguage(resolved);
    setLanguage(resolved);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = resolved;
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        const next: LanguageSetting = saved === 'en' || saved === 'es' ? saved : 'system';
        setSettingState(next);
        apply(next);
      })
      .catch(() => apply('system'));
  }, [apply]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setting,
      setSetting: (next) => {
        setSettingState(next);
        apply(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setting, apply]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

// Date/time formatting in the current language.
export function useLocale() {
  return localeTag(useContext(I18nContext).language);
}
