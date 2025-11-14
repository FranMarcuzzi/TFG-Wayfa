"use client";

import React from 'react';

export function RequirementsLegend() {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white/70 backdrop-blur p-4 text-sm shadow-sm">
      <div className="mb-3 text-sm font-semibold tracking-tight text-gray-900">Legend</div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md border border-green-100 bg-green-50/60 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"/>
          <span className="text-gray-800">Visa-free</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50/60 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"/>
          <span className="text-gray-800">eVisa / eTA</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50/60 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"/>
          <span className="text-gray-800">Visa required</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300"/>
          <span className="text-gray-800">Unknown</span>
        </div>
      </div>
    </div>
  );
}
