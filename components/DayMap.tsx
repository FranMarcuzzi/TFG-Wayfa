"use client";

import { useEffect, useMemo, useRef } from "react";

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
}

export function DayMap({ activities, className, height = 260 }: DayMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineIdRef = useRef<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const points = useMemo(() => {
    const pts: { id: string; title: string; lat: number; lng: number }[] = [];
    for (const a of activities || []) {
      // prefer explicit lat/lng on the record
      const lat = (a as any).lat ?? (a as any).latitude ?? null;
      const lng = (a as any).lng ?? (a as any).longitude ?? null;
      if (typeof lat === "number" && typeof lng === "number") {
        pts.push({ id: a.id, title: a.title || "Stop", lat, lng });
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
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1.5,
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
      } catch {}
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, [token]);

  useEffect(() => {
    renderMarkersAndRoute();
  }, [points]);

  function renderMarkersAndRoute() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded?.()) return;

    // clear old markers
    try {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    } catch {}

    // remove old route
    if (lineIdRef.current && map.getLayer(lineIdRef.current)) {
      try { map.removeLayer(lineIdRef.current); } catch {}
    }
    if (lineIdRef.current && map.getSource(lineIdRef.current)) {
      try { map.removeSource(lineIdRef.current); } catch {}
    }
    lineIdRef.current = null;

    if (!points || points.length === 0) return;

    // add markers
    const bounds = new (map as any).boxZoom? map.getBounds().constructor() : null;
    const mbBounds = new (map as any)._bounds.constructor();
    const fitBounds: any = new (map as any)._bounds.constructor();

    const b = new (map as any)._bounds.constructor();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const el = document.createElement("div");
      el.className = "rounded-full bg-gray-900 text-white text-[11px] leading-none px-2 py-1 shadow";
      el.textContent = String(i + 1);

      const marker = new (mapboxRef.current as any).Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // draw polyline
    if (points.length >= 2) {
      const lineId = `route-${Date.now()}`;
      lineIdRef.current = lineId;
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: points.map((p) => [p.lng, p.lat]),
            },
          },
        ],
      } as any;

      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: "geojson", data: geojson });
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: lineId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.85 },
        });
      }
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
    } catch {}
  }

  return (
    <div className={className} style={{ height }}>
      {!token ? (
        <div className="h-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
          Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
}
