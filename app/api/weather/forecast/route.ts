import { NextRequest, NextResponse } from 'next/server';

// GET /api/weather/forecast?lat=...&lng=... OR ?q=City,Country
// Returns next 5 days (aggregated) using OpenWeather 5-day/3-hour Forecast API
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return NextResponse.json({ error: 'Missing OPENWEATHER_API_KEY' }, { status: 500 });

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const q = searchParams.get('q');

    let latNum: number | null = lat ? parseFloat(lat) : null;
    let lonNum: number | null = lng ? parseFloat(lng) : null;

    // If q provided and no lat/lng, resolve via OpenWeather Geocoding API
    if ((latNum == null || lonNum == null) && q) {
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${key}`;
      const geoRes = await fetch(geoUrl, { cache: 'no-store' });
      const geoJson = await geoRes.json();
      if (Array.isArray(geoJson) && geoJson.length > 0) {
        latNum = geoJson[0].lat;
        lonNum = geoJson[0].lon;
      }
    }

    let res: Response;
    let json: any;
    if (latNum != null && lonNum != null) {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latNum}&lon=${lonNum}&units=metric&appid=${key}`;
      res = await fetch(url, { cache: 'no-store' });
    } else if (q) {
      const urlQ = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(q)}&units=metric&appid=${key}`;
      res = await fetch(urlQ, { cache: 'no-store' });
    } else {
      return NextResponse.json({ lat: null, lng: null, daily: [] });
    }
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Upstream error', details: text }, { status: 502 });
    }
    json = await res.json();

    const list: any[] = Array.isArray(json.list) ? json.list : [];
    // Group by date (YYYY-MM-DD) in UTC
    const byDay = new Map<string, any[]>();
    for (const item of list) {
      const dt = (item.dt as number) * 1000;
      const dayKey = new Date(dt).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(item);
    }

    const days = Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, 5)
      .map(([dayKey, items]) => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        let precipSum = 0; // mm
        let windSum = 0; // m/s total
        let count = 0;
        // choose icon around midday if possible, else first
        let chosen: any = items[0];
        let bestDiff = Infinity;
        for (const it of items) {
          const t = (it.dt as number) * 1000;
          const hour = new Date(t).getUTCHours();
          const diff = Math.abs(hour - 12);
          if (diff < bestDiff) {
            bestDiff = diff;
            chosen = it;
          }
          const tmin = it.main?.temp_min;
          const tmax = it.main?.temp_max;
          if (typeof tmin === 'number' && tmin < min) min = tmin;
          if (typeof tmax === 'number' && tmax > max) max = tmax;
          const rain = (it.rain && (it.rain['3h'] ?? it.rain)) || 0;
          const snow = (it.snow && (it.snow['3h'] ?? it.snow)) || 0;
          precipSum += (typeof rain === 'number' ? rain : 0) + (typeof snow === 'number' ? snow : 0);
          const wind = it.wind?.speed;
          if (typeof wind === 'number') windSum += wind;
          count += 1;
        }
        if (!isFinite(min)) min = items[0]?.main?.temp_min ?? 0;
        if (!isFinite(max)) max = items[0]?.main?.temp_max ?? 0;
        const windAvgMs = count > 0 ? windSum / count : 0;
        const windAvgKmh = Math.round(windAvgMs * 3.6);
        const precipRounded = Math.round(precipSum); // mm total per día
        return {
          dt: Date.parse(dayKey) / 1000,
          min: Math.round(min),
          max: Math.round(max),
          icon: chosen?.weather?.[0]?.icon ?? null,
          description: chosen?.weather?.[0]?.description ?? null,
          precip: precipRounded,
          wind: windAvgKmh,
        };
      });

    return NextResponse.json({ lat: latNum, lng: lonNum, daily: days });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
