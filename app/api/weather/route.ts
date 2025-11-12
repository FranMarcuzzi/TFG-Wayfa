import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q'); // e.g., "Rome,IT" or just "Rome"
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OPENWEATHER_API_KEY in environment' },
        { status: 500 }
      );
    }

    let url = '';
    if (lat && lng) {
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&appid=${apiKey}&units=metric`;
    } else if (q) {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${apiKey}&units=metric`;
    } else {
      return NextResponse.json({ error: 'Missing lat/lng or q' }, { status: 400 });
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Upstream error', details: text }, { status: 502 });
    }
    const data = await res.json();

    // normalize minimal payload
    const payload = {
      name: data.name,
      country: data.sys?.country,
      temp: Math.round(data.main?.temp ?? 0),
      description: data.weather?.[0]?.description ?? null,
      icon: data.weather?.[0]?.icon ?? null,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
