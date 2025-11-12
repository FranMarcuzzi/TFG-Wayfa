import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache with TTL
// Key: `${nationality}:${destination}` -> { expiresAt: number, data: any }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CACHE_SIZE = 2000;
const cache = new Map<string, { expiresAt: number; data: any }>();

function getCache(key: string) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    cache.delete(key);
    return null;
  }
  return v.data;
}

function setCache(key: string, data: any) {
  if (cache.size > MAX_CACHE_SIZE) {
    // drop oldest entry
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

type Normalized = {
  category: 'visa-free' | 'evisa' | 'visa' | 'unknown';
  summary: string;
  details: Array<{ label: string; value: string }>;
  links: Array<{ title: string; url: string }>;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nationality = (searchParams.get('nationality') || '').toUpperCase();
  const destination = (searchParams.get('destination') || '').toUpperCase();

  if (!nationality || !destination || nationality.length !== 2 || destination.length !== 2) {
    return NextResponse.json({ error: 'nationality and destination (ISO2) required' }, { status: 400 });
  }

  const key = `${nationality}:${destination}`;
  const cached = getCache(key);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.SHERPA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing SHERPA_API_KEY' }, { status: 500 });
  }

  try {
    // Sherpa API endpoint. Keep flexible in case of account variations.
    // See: https://www.joinsherpa.com/ (docs may vary per plan)
    const sherpaBase = process.env.SHERPA_BASE_URL || 'https://requirements-api.joinsherpa.com/v2';
    const url = `${sherpaBase}/requirements?nationality=${encodeURIComponent(nationality)}&destination=${encodeURIComponent(destination)}`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // Some accounts use X-API-Key. Keep both for compatibility.
        'X-API-Key': apiKey,
      },
      // Prevent Next from caching server-side
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const payload: Normalized = {
        category: 'unknown',
        summary: 'Unavailable',
        details: [{ label: 'Upstream', value: `HTTP ${res.status}` }],
        links: [],
      };
      setCache(key, payload);
      return NextResponse.json(payload, { status: 200 });
    }

    const json = await res.json().catch(() => null);

    // Normalize Sherpa -> our schema
    const norm: Normalized = normalizeSherpa(json);

    setCache(key, norm);
    return NextResponse.json(norm);
  } catch (err: any) {
    const payload: Normalized = {
      category: 'unknown',
      summary: 'Error',
      details: [{ label: 'Error', value: err?.message || 'Unknown error' }],
      links: [],
    };
    setCache(key, payload);
    return NextResponse.json(payload, { status: 200 });
  }
}

function normalizeSherpa(data: any): Normalized {
  if (!data) {
    return { category: 'unknown', summary: 'No data', details: [], links: [] };
  }

  // Attempt to infer a top-level rule/category and short summary
  // Sherpa responses vary; we inspect common fields conservatively.
  let category: Normalized['category'] = 'unknown';
  let summary = 'Unknown';
  const details: Normalized['details'] = [];
  const links: Normalized['links'] = [];

  // Example heuristics — adjust as needed for your account’s response shape
  const rule = data.rule || data.rules?.[0] || data.requirements?.[0] || data;
  const type = (rule?.type || rule?.category || '').toString().toLowerCase();

  if (type.includes('visa-free') || type === 'visa_free' || type === 'free') category = 'visa-free';
  else if (type.includes('eta') || type.includes('e-visa') || type.includes('evisa')) category = 'evisa';
  else if (type.includes('visa')) category = 'visa';
  else category = 'unknown';

  const stay = rule?.stay || rule?.duration || rule?.allowed_stay || '';
  if (category === 'visa-free') summary = stay ? `Visa-free up to ${stay}` : 'Visa-free';
  else if (category === 'evisa') summary = 'Electronic authorization required';
  else if (category === 'visa') summary = 'Visa required';
  else summary = 'Unknown';

  // Collect details
  const docList: Array<any> = rule?.documents || rule?.requirements || [];
  for (const d of docList) {
    const label = (d?.name || d?.label || 'Requirement').toString();
    const value = (d?.description || d?.value || '').toString();
    if (label || value) details.push({ label, value });
  }

  // Links
  const linkList: Array<any> = rule?.links || data?.links || [];
  for (const l of linkList) {
    const title = (l?.title || l?.name || 'Link').toString();
    const url = (l?.url || l?.href || '').toString();
    if (url) links.push({ title, url });
  }

  return { category, summary, details, links };
}
