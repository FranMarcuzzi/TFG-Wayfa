"use client";

import React, { useMemo, useState } from 'react';
import { NavBar } from '@/components/NavBar';
import { NationalitySelect } from '@/components/travel/NationalitySelect';
import { RequirementsLegend } from '@/components/travel/RequirementsLegend';
import { RequirementsPanel, type RequirementData } from '@/components/travel/RequirementsPanel';
import { MapRequirements } from '@/components/travel/MapRequirements';

export default function TravelRequirementsPage() {
  const [nationality, setNationality] = useState<string>('AR');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelISO, setPanelISO] = useState<string | undefined>(undefined);
  const [panelName, setPanelName] = useState<string | undefined>(undefined);
  const [panelData, setPanelData] = useState<RequirementData>(null);

  const onCountryClick = (info: { iso2: string; name?: string; data: RequirementData }) => {
    setPanelISO(info.iso2);
    setPanelName(info.name);
    setPanelData(info.data);
    setPanelOpen(true);
  };

  return (
    <>
      <NavBar />
      <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] w-full flex-col md:flex-row">
        <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white">
          <div className="p-4 space-y-4">
            <NationalitySelect value={nationality} onChange={setNationality} />
            <RequirementsLegend />
            <div className="text-xs text-gray-500">Data via RapidAPI – Visa Requirement. Colors render progressively as the map loads.</div>
          </div>
        </div>

        <div className="relative flex-1">
          <MapRequirements nationality={nationality} onCountryClick={onCountryClick} />
        </div>

        <RequirementsPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          countryName={panelName}
          iso2={panelISO}
          data={panelData}
        />
      </div>
    </>
  );
}
