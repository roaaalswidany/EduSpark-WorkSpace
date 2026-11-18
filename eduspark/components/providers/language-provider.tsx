/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dictionaries, type Locale, type DictionaryKey } from "@/lib/i18n/dictionary";

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
  dir: "ltr" | "rtl";
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("eduspark-locale") as Locale;
    if (saved === "ar" || saved === "en") {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("eduspark-locale", newLocale);
  };

  const t = (key: DictionaryKey) => {
    return dictionaries[locale][key] || key;
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  // تحديث اتجاه الصفحة (RTL/LTR) واللغة تلقائياً
  useEffect(() => {
    if (mounted) {
      document.documentElement.dir = dir;
      document.documentElement.lang = locale;
    }
  }, [dir, locale, mounted]);

  // لمنع وميض التصميم (Hydration Mismatch)
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}