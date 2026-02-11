"use client";

import React from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';

export function RequirementsLegend() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 backdrop-blur p-4 text-sm shadow-sm">
      <div className="mb-3 text-sm font-semibold tracking-tight text-foreground">{t('travel.requirements.legend')}</div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md border border-green-100 bg-green-50/60 dark:bg-green-900/20 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"/>
          <span className="text-foreground">{t('travel.requirements.category.visaFree')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50/60 dark:bg-amber-900/20 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"/>
          <span className="text-foreground">{t('travel.requirements.category.evisa')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50/60 dark:bg-red-900/20 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"/>
          <span className="text-foreground">{t('travel.requirements.category.visa')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300"/>
          <span className="text-foreground">{t('travel.requirements.category.unknown')}</span>
        </div>
      </div>
    </div>
  );
}
