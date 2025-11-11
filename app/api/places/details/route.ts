import { NextRequest, NextResponse } from 'next/server';

// Proxy to Google Places Details to resolve place_id into coordinates
// GET /api/places/details?place_id=XXXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('place_id');
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) {
      return NextResponse.json({ error: 'Missing GOOGLE_PLACES_API_KEY' }, { status: 500 });
    }
    if (!placeId) {
      return NextResponse.json({ error: 'Missing place_id' }, { status: 400 });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=place_id,name,formatted_address,geometry&key=${key}`;

    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (json.status !== 'OK') {
      return NextResponse.json({ error: json.error_message || json.status || 'Places error' }, { status: 502 });
    }

    const r = json.result;
    const payload = {
      place_id: r.place_id,
      name: r.name,
      address: r.formatted_address,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
