"use client";

import React from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';

type Option = { code: string; name: string };

const DEFAULTS: Option[] = [
  { code: "AR", name: "Argentina" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "BR", name: "Brazil" },
  { code: "CL", name: "Chile" },
  { code: "UY", name: "Uruguay" },
  { code: "MX", name: "Mexico" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
];

export function NationalitySelect({ value, onChange, options = DEFAULTS }: { value: string; onChange: (v: string) => void; options?: Option[]; }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{t('travel.nationality')}</label>
      <div className="relative">
        <select
          className="w-full appearance-none rounded-lg border border-border bg-background/90 px-3 py-2.5 pr-10 text-sm shadow-sm transition focus:border-border focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.code} value={o.code}>{`${o.name} (${o.code})`}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}
