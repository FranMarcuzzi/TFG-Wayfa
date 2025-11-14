"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Player from 'lottie-react';
import passportAnim from '@/public/animations/passport.json';
import type { RequirementData } from './RequirementsPanel';

// Throttle: max N requests per second
const RATE_PER_SEC = 12;

// Client-side cache for requirements per destination
const clientCache = new Map<string, RequirementData>();

// Small helper to map category -> color token
function colorFor(cat: RequirementData extends null ? never : NonNullable<RequirementData>['category']) {
  switch (cat) {
    case 'visa-free':
      return '#22c55e'; // green-500
    case 'evisa':
      return '#f59e0b'; // amber-500
    case 'visa':
      return '#ef4444'; // red-500
    default:
      return '#d1d5db'; // gray-300
  }
}

// Minimal ISO maps (alpha3 -> alpha2). Extend if needed.
const ISO3_TO_2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', AND: 'AD', AGO: 'AO', ATG: 'AG', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT',
  AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD', BRB: 'BB', BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ', BTN: 'BT',
  BOL: 'BO', BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN', BGR: 'BG', BFA: 'BF', BDI: 'BI', CPV: 'CV', KHM: 'KH',
  CMR: 'CM', CAN: 'CA', CAF: 'CF', TCD: 'TD', CHL: 'CL', CHN: 'CN', COL: 'CO', COM: 'KM', COG: 'CG', COD: 'CD',
  CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE', SWZ: 'SZ', ETH: 'ET', FJI: 'FJ', FIN: 'FI',
  FRA: 'FR', GAB: 'GA', GMB: 'GM', GEO: 'GE', DEU: 'DE', GHA: 'GH', GRC: 'GR', GRD: 'GD', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HUN: 'HU', ISL: 'IS', IND: 'IN', IDN: 'ID', IRN: 'IR', IRQ: 'IQ',
  IRL: 'IE', ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', PRK: 'KP',
  KOR: 'KR', KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV', LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI',
  LTU: 'LT', LUX: 'LU', MDG: 'MG', MWI: 'MW', MYS: 'MY', MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MRT: 'MR',
  MUS: 'MU', MEX: 'MX', FSM: 'FM', MDA: 'MD', MCO: 'MC', MNG: 'MN', MNE: 'ME', MAR: 'MA', MOZ: 'MZ', MMR: 'MM',
  NAM: 'NA', NRU: 'NR', NPL: 'NP', NLD: 'NL', NZL: 'NZ', NIC: 'NI', NER: 'NE', NGA: 'NG', MKD: 'MK', NOR: 'NO',
  OMN: 'OM', PAK: 'PK', PLW: 'PW', PAN: 'PA', PNG: 'PG', PRY: 'PY', PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT',
  QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', KNA: 'KN', LCA: 'LC', VCT: 'VC', WSM: 'WS', SMR: 'SM', STP: 'ST',
  SAU: 'SA', SEN: 'SN', SRB: 'RS', SYC: 'SC', SLE: 'SL', SGP: 'SG', SVK: 'SK', SVN: 'SI', SLB: 'SB', SOM: 'SO',
  ZAF: 'ZA', SSD: 'SS', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR', SWE: 'SE', CHE: 'CH', SYR: 'SY', TJK: 'TJ',
  TZA: 'TZ', THA: 'TH', TLS: 'TL', TGO: 'TG', TON: 'TO', TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', TUV: 'TV',
  UGA: 'UG', UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US', URY: 'UY', UZB: 'UZ', VUT: 'VU', VAT: 'VA', VEN: 'VE',
  VNM: 'VN', YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW', RKS: 'XK', PSE: 'PS', TWN: 'TW', HKG: 'HK', MAC: 'MO',
};

const ISO2_TO_3: Record<string, string> = Object.fromEntries(Object.entries(ISO3_TO_2).map(([k, v]) => [v, k]));

function getISO2FromFeature(f: any): string {
  if (!f) return '';
  const p = (f.properties || {}) as Record<string, any>;
  const a2Candidates = ['iso_3166_1_alpha_2', 'iso_3166_1', 'iso_a2', 'wb_a2', 'ISO_A2'];
  for (const k of a2Candidates) {
    const v = p[k];
    if (typeof v === 'string' && v.length === 2) return v.toUpperCase();
  }
  const a3 = (p['iso_3166_1_alpha_3'] || (typeof f.id === 'string' && f.id.length === 3 ? f.id : '')) as string;
  if (typeof a3 === 'string' && a3.length === 3) {
    const m = ISO3_TO_2[a3.toUpperCase()];
    if (m) return m;
  }
  return '';
}

async function tryBulkColor(nationality: string, map: any): Promise<boolean> {
  try {
    const res = await fetch(`/api/travel/requirements?nationality=${encodeURIComponent(nationality)}&debug=1`);
    const json = await res.json();
    if (!json || !json.bulk) return false;
    if (json?.debug) {
      console.log('[VisaMap] BULK raw (v2/visa/map)', json.raw);
    }
    const empty = (!json.green || json.green.length === 0) && (!json.blue || json.blue.length === 0) && (!json.yellow || json.yellow.length === 0) && (!json.red || json.red.length === 0);
    if (empty) return false;
    console.log('[VisaMap] BULK ok', {
      passport: nationality,
      counts: {
        green: json.green?.length || 0,
        blue: json.blue?.length || 0,
        yellow: json.yellow?.length || 0,
        red: json.red?.length || 0,
      },
    });
    if (!map || !map.getSource || !map.getLayer('countries-fill')) return false;
    if (!map.isSourceLoaded || !map.isSourceLoaded('countries')) {
      await new Promise<void>((resolve) => {
        const once = () => { try { map.off('idle', once); } catch {} resolve(); };
        map.on('idle', once);
      });
    }
    applyBulk(map, json);
    console.log('[VisaMap] BULK paint applied');
    return true;
  } catch {
    return false;
  }
}

function mapRefGlobal(): any | null {
  try {
    const anyWin = globalThis as any;
    return (anyWin && anyWin.__WAYFA_MAP__) || null;
  } catch {
    return null;
  }
}

function applyBulk(map: any, json: { green?: string[]; blue?: string[]; yellow?: string[]; red?: string[] }) {
  // Prefer a data-driven style using a match expression on iso_3166_1_alpha_2
  const up = (arr?: string[]) => (Array.isArray(arr) ? arr.map((x) => (typeof x === 'string' ? x.toUpperCase() : x)) : []);
  const g = up(json.green);
  const r = up(json.red);
  const b = up(json.blue);
  const y = up(json.yellow);

  const matchExpr: any[] = ['match', ['coalesce', ['get', 'iso_3166_1_alpha_2'], ['get', 'iso_3166_1'], ['get', 'iso_a2']]];
  if (g.length) matchExpr.push(g, '#22c55e'); // green
  if (r.length) matchExpr.push(r, '#ef4444'); // red
  const ev = [...b, ...y];
  if (ev.length) matchExpr.push(ev, '#f59e0b'); // amber
  matchExpr.push('#d1d5db'); // default gray

  try {
    if (map.getLayer('countries-fill')) {
      map.setPaintProperty('countries-fill', 'fill-color', matchExpr);
    }
  } catch {}

  // Also set feature-state as a secondary path (not strictly required when using match)
  const setMany = (codes: string[] | undefined, cat: string) => {
    if (!Array.isArray(codes)) return;
    for (const iso of codes) {
      try {
        const iso3 = ISO2_TO_3[iso] || '';
        if (!iso3) continue;
        map.setFeatureState(
          { source: 'countries', sourceLayer: 'country_boundaries', id: iso3 },
          { cat }
        );
      } catch {}
    }
  };
  setMany(g, 'vf');
  setMany(r, 'v');
  setMany(ev, 'ev');
}

// Map category to compact feature-state value to reduce memory
function catKey(cat: RequirementData extends null ? never : NonNullable<RequirementData>['category']) {
  if (cat === 'visa-free') return 'vf';
  if (cat === 'evisa') return 'ev';
  if (cat === 'visa') return 'v';
  return 'un';
}

export function MapRequirements({ nationality, onCountryClick }: {
  nationality: string;
  onCountryClick: (info: { iso2: string; name?: string; data: RequirementData }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; iso2: string; name: string; cat?: string } | null>(null);
  const queueRef = useRef<{ set: Set<string>; timer: any } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Build paint expression once
  const fillPaint = useMemo(() => (
    {
      'fill-color': [
        'case',
        ['==', ['feature-state', 'cat'], 'vf'], '#22c55e',
        ['==', ['feature-state', 'cat'], 'ev'], '#f59e0b',
        ['==', ['feature-state', 'cat'], 'v'], '#ef4444',
        '#d1d5db'
      ],
      'fill-opacity': 0.75,
    } as any
  ), []);

  // Init map
  useEffect(() => {
    let disposed = false;

    async function init() {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
      if (!containerRef.current || !mapboxgl.accessToken) return;

      // Ensure container is empty before initializing the map (avoids Mapbox warning)
      try { if (containerRef.current) containerRef.current.innerHTML = ''; } catch {}

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 20],
        zoom: 1.2,
        attributionControl: false,
      });
      mapRef.current = map;
      try { (globalThis as any).__WAYFA_MAP__ = map; } catch {}

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('load', async () => {
        if (disposed) return;
        // Country boundaries vector source; promote ISO2 as feature id for setFeatureState
        map.addSource('countries', {
          type: 'vector',
          url: 'mapbox://mapbox.country-boundaries-v1',
          // Use ISO3 as feature id; tileset always has iso_3166_1_alpha_3
          promoteId: { country_boundaries: 'iso_3166_1_alpha_3' } as any,
        } as any);

        map.addLayer({
          id: 'countries-fill',
          type: 'fill',
          source: 'countries',
          'source-layer': 'country_boundaries',
          paint: fillPaint,
        });

        map.addLayer({
          id: 'countries-outline',
          type: 'line',
          source: 'countries',
          'source-layer': 'country_boundaries',
          paint: {
            'line-color': '#ffffff',
            'line-width': 0.5,
            'line-opacity': 0.6,
          },
        });

        // First try bulk coloring for entire map after tiles settle
        map.once('idle', async () => {
          const ok = await tryBulkColor(nationality, map);
          if (!ok) {
            scheduleViewportFetches();
          }
          setMapReady(true);
        });
      });

      // Hover tooltip
      const onMove = (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['countries-fill'] });
        const f = features && features[0];
        if (!f) {
          setHoverInfo(null);
          return;
        }
        const iso2: string = getISO2FromFeature(f);
        if (!iso2) console.log('[VisaMap] WARN hover: no ISO2 on feature', { props: f.properties });
        const name: string = f.properties?.name_en || f.properties?.name || '';
        const iso3 = ISO2_TO_3[iso2] || f.properties?.iso_3166_1_alpha_3 || '';
        const state: any = iso3 ? map.getFeatureState({ source: 'countries', sourceLayer: 'country_boundaries', id: iso3 }) : {};
        const cat = state?.cat as string | undefined;
        setHoverInfo({ x: e.point.x, y: e.point.y, iso2, name, cat });
        // Debounce a single fetch for hover if missing
        if (!clientCache.has(`${nationality}:${iso2}`)) enqueueDest(iso2);
      };

      const onLeave = () => setHoverInfo(null);
      map.on('mousemove', 'countries-fill', onMove);
      map.on('mouseleave', 'countries-fill', onLeave);

      // Click to open panel
      const onClick = (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['countries-fill'] });
        const f = features && features[0];
        if (!f) return;
        const iso2: string = getISO2FromFeature(f);
        if (!iso2) console.log('[VisaMap] WARN click: no ISO2 on feature', { props: f.properties });
        const name: string = f.properties?.name_en || f.properties?.name || '';
        console.log('[VisaMap] CLICK check', { passport: nationality, destination: iso2 });
        getReq(nationality, iso2).then((data) => {
          console.log('[VisaMap] CHECK result', { destination: iso2, category: data?.category, summary: data?.summary });
          onCountryClick({ iso2, name, data });
        });
      };
      map.on('click', 'countries-fill', onClick);

      // On move, schedule progressive fetch for visible countries
      const onIdle = () => scheduleViewportFetches();
      map.on('moveend', onIdle);

      function scheduleViewportFetches() {
        if (!map.getLayer('countries-fill')) return;
        const bounds = map.getBounds() as any;
        const sw = map.project([bounds.getWest(), bounds.getSouth()]);
        const ne = map.project([bounds.getEast(), bounds.getNorth()]);
        const features = map.queryRenderedFeatures([sw, ne], { layers: ['countries-fill'] });
        const isoSet = new Set<string>();
        for (const f of features) {
          const iso3: string = (typeof f.id === 'string' && f.id.length === 3)
            ? f.id
            : (f.properties?.iso_3166_1_alpha_3 as string) || '';
          const iso2: string = iso3 ? (ISO3_TO_2[iso3.toUpperCase()] || '') : '';
          if (iso2 && !clientCache.has(`${nationality}:${iso2}`)) isoSet.add(iso2);
        }
        if (isoSet.size) console.log('[VisaMap] Progressive enqueue', isoSet.size, 'destinations');
        Array.from(isoSet).forEach((iso) => enqueueDest(iso));
      }

      function enqueueDest(iso2: string) {
        if (!queueRef.current) queueRef.current = { set: new Set(), timer: null };
        queueRef.current.set.add(iso2);
        if (!queueRef.current.timer) {
          queueRef.current.timer = setInterval(async () => {
            const q = queueRef.current!;
            const batch = Array.from(q.set).slice(0, RATE_PER_SEC);
            for (const iso of batch) {
              q.set.delete(iso);
              const data = await getReq(nationality, iso);
              if (mapRef.current) paintISO(iso, data);
            }
            if (q.set.size === 0) {
              clearInterval(q.timer);
              q.timer = null;
            }
          }, 1000);
        }
      }

      function paintISO(iso2: string, data: RequirementData) {
        const cat = data?.category || 'unknown';
        const iso3 = ISO2_TO_3[iso2] || '';
        if (!iso3) return;
        map.setFeatureState(
          { source: 'countries', sourceLayer: 'country_boundaries', id: iso3 },
          { cat: catKey(cat) }
        );
      }

      // Initial neutral paint reset when nationality changes
      resetAllStates(map);
    }

    init();

    return () => {
      disposed = true;
      if (queueRef.current?.timer) clearInterval(queueRef.current.timer);
      const map = mapRef.current;
      if (map) {
        try { map.remove(); } catch {}
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On nationality change: reset feature-state and try bulk coloring; fallback to progressive
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapReady(false);
    setAnimDone(false);
    setAnimKey((k) => k + 1);
    resetAllStates(map);
    const run = async () => {
      if (!map.getLayer('countries-fill')) return;
      if (!map.isSourceLoaded || !map.isSourceLoaded('countries')) {
        await new Promise<void>((resolve) => {
          const once = () => { try { map.off('idle', once); } catch {} resolve(); };
          map.on('idle', once);
        });
      }
      const ok = await tryBulkColor(nationality, map);
      if (!ok) {
        try {
          const center = map.getCenter();
          map.easeTo({ center });
        } catch {}
      }
      setMapReady(true);
    };
    run();
  }, [nationality]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {(!mapReady || !animDone) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <Player
            key={animKey}
            autoplay
            loop={false}
            animationData={passportAnim as any}
            style={{ width: 320, height: 320 }}
            onComplete={() => setAnimDone(true)}
          />
        </div>
      )}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-30 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 shadow"
          style={{ left: hoverInfo.x + 8, top: hoverInfo.y + 8 }}
        >
          <div className="font-medium">{hoverInfo.name} ({hoverInfo.iso2})</div>
          <div className="text-gray-600">{labelFromCat(hoverInfo.cat)}</div>
        </div>
      )}
    </div>
  );
}

function labelFromCat(cat?: string) {
  switch (cat) {
    case 'vf': return 'Visa-free';
    case 'ev': return 'eVisa / eTA';
    case 'v': return 'Visa required';
    default: return 'Unknown';
  }
}

async function getReq(nationality: string, destination: string): Promise<RequirementData> {
  const key = `${nationality}:${destination}`;
  if (clientCache.has(key)) return clientCache.get(key)!;
  try {
    const url = `/api/travel/requirements?nationality=${encodeURIComponent(nationality)}&destination=${encodeURIComponent(destination)}&debug=1`;
    const res = await fetch(url);
    const json = (await res.json()) as any;
    if (json?.debug) {
      console.log('[VisaMap] CHECK raw (v2/visa/check)', json.raw);
    }
    const norm: RequirementData = json && typeof json === 'object' && 'category' in json ? json : { category: 'unknown', summary: 'Unavailable', details: [], links: [] };
    clientCache.set(key, norm);
    return norm;
  } catch {
    const fallback: RequirementData = { category: 'unknown', summary: 'Unavailable', details: [], links: [] };
    clientCache.set(key, fallback);
    return fallback;
  }
}

function resetAllStates(map: any) {
  // Reset paint by reloading style states quickly: simplest is to set a new empty feature-state
  // But feature-state persists across style changes. We'll iterate visible tiles' features roughly via queryRenderedFeatures full viewport.
  try {
    if (!map.getLayer('countries-fill')) return;
    const bounds = map.getBounds() as any;
    const sw = map.project([bounds.getWest(), bounds.getSouth()]);
    const ne = map.project([bounds.getEast(), bounds.getNorth()]);
    const features = map.queryRenderedFeatures([sw, ne], { layers: ['countries-fill'] });
    features.forEach((f: any) => {
      const p = f.properties || {};
      const iso3 = (p.iso_3166_1_alpha_3 || (typeof f.id === 'string' && f.id.length === 3 ? f.id : '')) as string;
      if (!iso3) return;
      map.setFeatureState({ source: 'countries', sourceLayer: 'country_boundaries', id: iso3 }, { cat: 'un' });
    });
  } catch {}
}
