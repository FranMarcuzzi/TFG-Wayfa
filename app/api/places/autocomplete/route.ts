import { NextRequest, NextResponse } from 'next/server';

// Proxy to Google Places Autocomplete
// GET /api/places/autocomplete?q=rom
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: 'Missing GOOGLE_PLACES_API_KEY' },
        { status: 500 }
      );
    }
    if (!q || q.trim().length < 1) {
      return NextResponse.json({ predictions: [] });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      q
    )}&language=en&key=${key}`;

    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ error: json.status, predictions: [] }, { status: 502 });
    }

    const predictions = (json.predictions || []).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
      structured_formatting: p.structured_formatting,
    }));

    return NextResponse.json({ predictions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
