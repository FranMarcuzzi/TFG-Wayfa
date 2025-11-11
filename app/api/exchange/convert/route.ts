import { NextRequest, NextResponse } from 'next/server';

// GET /api/exchange/convert?from=ARS&to=USD&amount=123.45
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = (searchParams.get('from') || '').toUpperCase();
    const to = (searchParams.get('to') || '').toUpperCase();
    const amountStr = searchParams.get('amount') || '0';
    const amount = parseFloat(amountStr);
    if (!from || !to || !isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    const key = process.env.EXCHANGERATE_HOST_API_KEY;
    const base = 'https://api.exchangerate.host/convert';
    const url = `${base}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(
      String(amount)
    )}${key ? `&apikey=${encodeURIComponent(key)}` : ''}`;

    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || !json || (json.success === false)) {
      return NextResponse.json({ error: 'FX error', details: json }, { status: 502 });
    }

    const rate = typeof json.info?.rate === 'number' ? json.info.rate : null;
    const result = typeof json.result === 'number' ? json.result : null;
    return NextResponse.json({ rate, result, query: { from, to, amount } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
