import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q'); // e.g., "Rome,IT" or just "Rome"

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OPENWEATHER_API_KEY in environment' },
        { status: 500 }
      );
    }

    if (!q) {
      return NextResponse.json({ error: 'Missing query param q' }, { status: 400 });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      q
    )}&appid=${apiKey}&units=metric`;

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
