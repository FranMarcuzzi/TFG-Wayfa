import { NextRequest, NextResponse } from 'next/server';

// Proxy to AviationStack: expects `flight` query param (IATA like "AZ611" or ICAO)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const flight = searchParams.get('flight'); // e.g., "AZ611"

    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing AVIATIONSTACK_API_KEY in environment' },
        { status: 500 }
      );
    }

    if (!flight) {
      return NextResponse.json({ error: 'Missing query param flight' }, { status: 400 });
    }

    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(
      flight
    )}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Upstream error', details: text }, { status: 502 });
    }
    const json = await res.json();

    const item = json?.data?.[0];
    if (!item) {
      return NextResponse.json({ notFound: true });
    }

    const payload = {
      flight: item.flight?.iata || item.flight?.icao || flight,
      airline: item.airline?.name || null,
      departure: {
        airport: item.departure?.airport || null,
        scheduled: item.departure?.scheduled || null,
        estimated: item.departure?.estimated || null,
        actual: item.departure?.actual || null,
        gate: item.departure?.gate || null,
        terminal: item.departure?.terminal || null,
        timezone: item.departure?.timezone || null,
        delay: item.departure?.delay ?? null,
      },
      arrival: {
        airport: item.arrival?.airport || null,
        scheduled: item.arrival?.scheduled || null,
        estimated: item.arrival?.estimated || null,
        actual: item.arrival?.actual || null,
        gate: item.arrival?.gate || null,
        terminal: item.arrival?.terminal || null,
        timezone: item.arrival?.timezone || null,
        delay: item.arrival?.delay ?? null,
      },
      status: item.flight_status || null,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
