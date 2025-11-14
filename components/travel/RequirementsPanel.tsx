"use client";

import React from 'react';

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
  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-md transform bg-white shadow-xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
        <div className="text-sm font-medium text-gray-900">{countryName || 'Destination'}{iso2 ? ` (${iso2})` : ''}</div>
        <button className="text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>Close</button>
      </div>
      <div className="h-[calc(100%-3rem)] overflow-auto p-4 space-y-4">
        {!data && (
          <div className="text-sm text-gray-600">Loading…</div>
        )}
        {data && (
          <>
            <div className="text-sm">
              <div className="text-gray-500">Category</div>
              <div className={`font-medium ${data.category === 'visa-free' ? 'text-green-600' : data.category === 'evisa' ? 'text-amber-600' : data.category === 'visa' ? 'text-red-600' : 'text-gray-600'}`}>{data.category}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Summary</div>
              <div className="text-gray-900">{data.summary || '—'}</div>
            </div>
            {data.details?.length ? (
              <div className="text-sm">
                <div className="text-gray-500 mb-1">Details</div>
                <div className="space-y-2">
                  {data.details.map((d, i) => (
                    <div key={i} className="rounded border border-gray-200 p-2">
                      <div className="font-medium text-gray-900">{d.label}</div>
                      <div className="text-gray-700 whitespace-pre-wrap">{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {data.links?.length ? (
              <div className="text-sm">
                <div className="text-gray-500 mb-1">Links</div>
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
