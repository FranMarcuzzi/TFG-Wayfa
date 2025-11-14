"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "@/lib/i18n/messages/en";
import es from "@/lib/i18n/messages/es";

type Messages = Record<string, string>;

type I18nContextType = {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (loc: string) => void;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const v = document.cookie.split(";").map((c) => c.trim());
  for (const p of v) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.substring(name.length + 1));
  }
  return null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/`;
}

const ALL: Record<string, Messages> = { en, es } as const;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => {
    if (typeof navigator !== "undefined") {
      const c = getCookie("lang");
      const fromCookie = c && ALL[c] ? c : null;
      if (fromCookie) return fromCookie;
      const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
      return ALL[nav] ? nav : "en";
    }
    return "en";
  }, []);

  const [locale, setLocaleState] = useState<string>(initial);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {}
  }, [locale]);

  const setLocale = (loc: string) => {
    if (!ALL[loc]) return;
    setLocaleState(loc);
    setCookie("lang", loc);
  };

  // Merge locale messages over English so missing keys fall back to en
  const messages: Messages = useMemo(() => ({
    ...en,
    ...(ALL[locale] || {}),
  }), [locale]);

  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = messages[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  };

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
