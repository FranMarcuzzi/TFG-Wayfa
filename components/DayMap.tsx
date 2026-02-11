"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";

type ActivityLite = {
  id: string;
  title?: string | null;
  // these may or may not exist depending on DB; we read defensively
  lat?: number | null;
  lng?: number | null;
  // sometimes coords may be nested or stored differently; keep loose typing
  [key: string]: any;
};

interface DayMapProps {
  activities: ActivityLite[];
  className?: string;
  height?: number | string;
  centerHint?: { lat: number; lng: number } | null;
  profile?: 'walking' | 'driving' | 'cycling';
}

export function DayMap({ activities, className, height = 260, centerHint = null, profile = 'walking' }: DayMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineIdRef = useRef<string | null>(null);
  const { resolvedTheme } = useTheme();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const points = useMemo(() => {
    const arr = Array.isArray(activities) ? [...activities] : [];
    // sort by custom 'orden' if provided, otherwise by starts_at then title
    arr.sort((a: any, b: any) => {
      const ao = typeof a?.orden === 'number' ? a.orden : null;
      const bo = typeof b?.orden === 'number' ? b.orden : null;
      if (ao != null && bo != null) return ao - bo;
      const at = a?.starts_at ? Date.parse(a.starts_at) : NaN;
      const bt = b?.starts_at ? Date.parse(b.starts_at) : NaN;
      if (isFinite(at) && isFinite(bt)) return at - bt;
      if (isFinite(at)) return -1;
      if (isFinite(bt)) return 1;
      const an = (a?.title || '').localeCompare?.(b?.title || '') || 0;
      return an;
    });
    const pts: { id: string; title: string; lat: number; lng: number }[] = [];
    for (const a of arr) {
      const rawLat = (a as any).lat ?? (a as any).latitude ?? null;
      const rawLng = (a as any).lng ?? (a as any).longitude ?? null;
      const lat = typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat;
      const lng = typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng;
      if (typeof lat === 'number' && isFinite(lat) && typeof lng === 'number' && isFinite(lng)) {
        pts.push({ id: (a as any).id, title: (a as any).title || 'Stop', lat, lng });
      }
    }
    return pts;
  }, [activities]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      if (!token) return; // token missing; show empty container

      const mapboxgl: any = (await import("mapbox-gl")).default as any;
      mapboxgl.accessToken = token as string;
      mapboxRef.current = mapboxgl;

      if (cancelled) return;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: resolvedTheme === 'dark' ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12",
        center: centerHint ? [centerHint.lng, centerHint.lat] : [0, 20],
        zoom: centerHint ? 11 : 1.5,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        renderMarkersAndRoute();
      });
    }

    init();

    return () => {
      cancelled = true;
      // cleanup
      try {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
      } catch { }
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { }
        mapRef.current = null;
      }
    };
}, [token]); // removed resolvedTheme from dependency to avoid re-init map

useEffect(() => {
  if (mapRef.current && mapRef.current.setStyle) {
    mapRef.current.setStyle(resolvedTheme === 'dark' ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12");
  }
}, [resolvedTheme]);

useEffect(() => {
  renderMarkersAndRoute();
}, [points]);

function renderMarkersAndRoute() {
  const map = mapRef.current;
  if (!map) return;
  if (!map.isStyleLoaded?.()) {
    // try again shortly if the style isn't ready
    setTimeout(renderMarkersAndRoute, 100);
    return;
  }

  // markers removed by request; no-op cleanup

  // remove old route
  if (lineIdRef.current && map.getLayer(lineIdRef.current)) {
    try { map.removeLayer(lineIdRef.current); } catch { }
  }
  if (lineIdRef.current && map.getSource(lineIdRef.current)) {
    try { map.removeSource(lineIdRef.current); } catch { }
  }
  lineIdRef.current = null;

  // remove previous stops layer/source if exist
  const stopsSrcId = 'day-stops-src';
  const stopsLayerId = 'day-stops-circles';
  if (map.getLayer(stopsLayerId)) {
    try { map.removeLayer(stopsLayerId); } catch { }
  }
  if (map.getSource(stopsSrcId)) {
    try { map.removeSource(stopsSrcId); } catch { }
  }

  if (!points || points.length === 0) {
    if (centerHint) {
      try { map.flyTo({ center: [centerHint.lng, centerHint.lat], zoom: 12 }); } catch { }
    }
    return;
  }

  // small dots for stops (very subtle)
  if (points.length >= 1) {
    const stopsGeo = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        properties: { title: p.title },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    } as any;
    map.addSource(stopsSrcId, { type: 'geojson', data: stopsGeo });
    map.addLayer({
      id: stopsLayerId,
      type: 'circle',
      source: stopsSrcId,
      paint: {
        'circle-radius': 3,
        'circle-color': '#111827',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
        'circle-opacity': 0.9,
      },
    });
  }

  // draw road-snapped route using Mapbox Directions API (fallback to straight line)
  if (points.length >= 2) {
    const srcId = 'day-route-src';
    const layerId = 'day-route-layer';
    lineIdRef.current = layerId;

    const drawGeojson = (data: any) => {
      if (map.getSource(srcId)) {
        (map.getSource(srcId) as any).setData(data);
      } else {
        map.addSource(srcId, { type: 'geojson', data });
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'line',
          source: srcId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.9 },
        });
      }
    };

    (async () => {
      try {
        const coordsStr = points.map((p) => `${p.lng},${p.lat}`).join(';');
        const accessToken = (mapboxRef.current as any).accessToken as string;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordsStr}?geometries=geojson&overview=full&access_token=${encodeURIComponent(accessToken)}`;
        const res = await fetch(url);
        const json = await res.json();
        const route = json?.routes?.[0]?.geometry;
        const geojson = route
          ? { type: 'Feature', properties: {}, geometry: route }
          : {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
          };
        drawGeojson(geojson);
      } catch {
        const fallback = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
        };
        drawGeojson(fallback);
      }
    })();
  }

  // fit to markers
  try {
    const bounds = new (mapboxRef.current as any).LngLatBounds();
    for (let i = 0; i < points.length; i++) bounds.extend([points[i].lng, points[i].lat]);
    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 13 });
    } else {
      map.fitBounds(bounds, { padding: 40, animate: true, duration: 800 });
    }
  } catch { }
}

return (
  <div className={className} style={{ height }}>
    {!token ? (
      <div className="h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
      </div>
    ) : (
      <div ref={containerRef} className="w-full h-full" />
    )}
  </div>
);
}
