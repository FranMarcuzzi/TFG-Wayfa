"use client";

import React from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';

export type RequirementData = {
  category: 'visa-free' | 'evisa' | 'visa' | 'unknown';
  summary: string;
  details: Array<{ label: string; value: string }>;
  links: Array<{ title: string; url: string }>;
} | null;

export function RequirementsPanel({ open, onClose, countryName, iso2, data }: {
  open: boolean;
  onClose: () => void;
  countryName?: string;
  iso2?: string;
  data: RequirementData;
}) {
  const { t } = useI18n();
  const categoryLabel = (cat?: RequirementData extends null ? never : NonNullable<RequirementData>['category']) => {
    switch (cat) {
      case 'visa-free':
        return t('travel.requirements.category.visaFree');
      case 'evisa':
        return t('travel.requirements.category.evisa');
      case 'visa':
        return t('travel.requirements.category.visa');
      default:
        return t('travel.requirements.category.unknown');
    }
  };
  const normalizeSummary = (summary?: string | null) => {
    const s = (summary || '').trim();
    if (!s) return t('travel.requirements.unavailable');
    const lowered = s.toLowerCase();
    if (lowered === 'unknown' || lowered === 'no data' || lowered === 'unavailable') {
      return t('travel.requirements.unavailable');
    }
    return s;
  };

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-md transform bg-card shadow-xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium text-foreground">{countryName || t('travel.requirements.destination')}{iso2 ? ` (${iso2})` : ''}</div>
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>{t('travel.requirements.close')}</button>
      </div>
      <div className="h-[calc(100%-3rem)] overflow-auto p-4 space-y-4">
        {!data && (
          <div className="text-sm text-muted-foreground">{t('travel.requirements.loading')}</div>
        )}
        {data && (
          <>
            <div className="text-sm">
              <div className="text-muted-foreground">{t('travel.requirements.category')}</div>
              <div className={`font-medium ${data.category === 'visa-free' ? 'text-green-600' : data.category === 'evisa' ? 'text-amber-600' : data.category === 'visa' ? 'text-red-600' : 'text-muted-foreground'}`}>{categoryLabel(data.category)}</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">{t('travel.requirements.summary')}</div>
              <div className="text-foreground">{normalizeSummary(data.summary)}</div>
            </div>
            {data.details?.length ? (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">{t('travel.requirements.details')}</div>
                <div className="space-y-2">
                  {data.details.map((d, i) => (
                    <div key={i} className="rounded border border-border p-2">
                      <div className="font-medium text-foreground">{d.label}</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {data.links?.length ? (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">{t('travel.requirements.links')}</div>
                <ul className="list-disc pl-5 space-y-1">
                  {data.links.map((l, i) => (
                    <li key={i}>
                      <a className="text-blue-600 hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
