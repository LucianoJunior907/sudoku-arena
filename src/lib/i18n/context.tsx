"use client";

import { useCallback, useMemo } from "react";
import translations, { type Locale, type TranslationKey } from "./translations";
import { useAppStore } from "@/lib/store/app-store";

export { LOCALES, LOCALE_LABELS } from "./translations";
export type { Locale } from "./translations";

/** Returns the locale + a `t()` function, driven by the persisted app store. */
export function useI18n() {
  const locale = useAppStore((s) => s.settings.locale);
  const setSettings = useAppStore((s) => s.setSettings);

  const setLocale = useCallback(
    (l: Locale) => {
      setSettings({ locale: l });
    },
    [setSettings]
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = translations[locale] as Record<string, string>;
      let str = dict[key] ?? (translations["en"] as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [locale]
  );

  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}

export function useT() {
  return useI18n().t;
}
