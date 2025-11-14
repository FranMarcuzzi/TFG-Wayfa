import { NextRequest, NextResponse } from 'next/server';

// ================== Tipos ==================

type Normalized = {
  category: 'visa-free' | 'evisa' | 'visa' | 'unknown';
  summary: string;
  details: Array<{ label: string; value: string }>;
  links: Array<{ title: string; url: string }>;
};

type BulkResult = {
  bulk: true;
  green: string[];
  blue: string[];
  yellow: string[];
  red: string[];
  version: string | null;
  language: string | null;
  generated_at: string | null;
};

// ================== Cache simple en memoria ==================

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
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

// ================== Normalizadores ==================

// v2 bulk map -> arrays
function normalizeBulkV2(data: any): BulkResult {
  const colors = data?.data?.colors || {};
  const parse = (s: any) =>
    (typeof s === 'string' ? s : '')
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x.length === 2);

  return {
    bulk: true,
    green: parse(colors.green),
    blue: parse(colors.blue),
    yellow: parse(colors.yellow),
    red: parse(colors.red),
    version: data?.meta?.version || null,
    language: data?.meta?.language || null,
    generated_at: data?.meta?.generated_at || null,
  };
}

// fallback por si algún día quieres usar otra respuesta bulk
function normalizeBulk(data: any): BulkResult {
  const parse = (s: any) =>
    (typeof s === 'string' ? s : '')
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x.length === 2);

  return {
    bulk: true,
    green: parse(data?.green),
    blue: parse(data?.blue),
    yellow: parse(data?.yellow),
    red: parse(data?.red),
    version: data?.version || null,
    language: data?.language || null,
    generated_at: data?.generated_at || null,
  };
}

// v2 visa check -> Normalized
function normalizeV2Check(json: any): Normalized {
  const data = json?.data || {};
  const visa = data?.visa_rules || {};
  const primary = visa?.primary_rule || {};
  const secondary = visa?.secondary_rule || {};

  const color = (primary.color || secondary.color || '').toString().toLowerCase();
  let category: Normalized['category'] = 'unknown';
  if (color === 'green') category = 'visa-free';
  else if (color === 'red') category = 'visa';
  else if (color === 'blue' || color === 'yellow') category = 'evisa';

  const pName = primary.name || '';
  const sName = secondary.name || '';
  const pDur = primary.duration || '';
  const sDur = secondary.duration || '';

  let summary = 'Unknown';
  if (pName && pDur && sName && sDur) summary = `${pName} / ${sName} – ${pDur}`;
  else if (pName && pDur) summary = `${pName} – ${pDur}`;
  else if (pName && sDur) summary = `${pName} / ${sName || 'Secondary'} – ${sDur}`;
  else if (pName) summary = pName;

  const details: Array<{ label: string; value: string }> = [];
  const links: Array<{ title: string; url: string }> = [];

  // Mandatory registration
  if (data?.mandatory_registration?.name) {
    details.push({
      label: 'Mandatory registration',
      value: `${data.mandatory_registration.name} (${data?.mandatory_registration?.color || ''})`,
    });
    if (data?.mandatory_registration?.link) {
      links.push({
        title: data.mandatory_registration.name,
        url: data.mandatory_registration.link,
      });
    }
  }

  // Primary/secondary
  if (pName) {
    details.push({
      label: 'Primary rule',
      value: `${pName}${pDur ? ` – ${pDur}` : ''}`,
    });
  }
  if (sName) {
    details.push({
      label: 'Secondary rule',
      value: `${sName}${sDur ? ` – ${sDur}` : ''}`,
    });
  }

  // Exception
  if (data?.exception_rule?.name) {
    details.push({ label: 'Exception', value: data.exception_rule.name });
  }

  // Links
  if (data?.destination?.embassy_url) {
    links.push({ title: 'Embassy', url: data.destination.embassy_url });
  }
  if (secondary?.link) {
    links.push({ title: 'Secondary rule link', url: secondary.link });
  }

  return { category, summary, details, links };
}

// Heurístico genérico por si la respuesta no tiene el formato de v2
function normalizeRapid(data: any): Normalized {
  if (!data) {
    return { category: 'unknown', summary: 'No data', details: [], links: [] };
  }

  let category: Normalized['category'] = 'unknown';
  let summary = 'Unknown';
  const details: Normalized['details'] = [];
  const links: Normalized['links'] = [];

  const rule =
    data.rule ||
    data.rules?.[0] ||
    data.result ||
    data.data ||
    data.requirements?.[0] ||
    data;

  const type = (
    rule?.type ||
    rule?.category ||
    rule?.status ||
    rule?.visa ||
    rule?.visaType ||
    rule?.requirement
  )
    ?.toString()
    .toLowerCase() || '';

  if (type.includes('visa-free') || type.includes('no visa') || type === 'visa_free' || type === 'free') {
    category = 'visa-free';
  } else if (type.includes('eta') || type.includes('e-visa') || type.includes('evisa') || type.includes('electronic')) {
    category = 'evisa';
  } else if (type.includes('visa')) {
    category = 'visa';
  } else {
    category = 'unknown';
  }

  const stay = rule?.stay || rule?.duration || rule?.allowed_stay || rule?.maxStay || '';
  if (category === 'visa-free') summary = stay ? `Visa-free up to ${stay}` : 'Visa-free';
  else if (category === 'evisa') summary = 'Electronic authorization required';
  else if (category === 'visa') summary = 'Visa required';
  else summary = 'Unknown';

  const docList: Array<any> = rule?.documents || rule?.requirements || rule?.documentsRequired || [];
  for (const d of docList) {
    const label = (d?.name || d?.label || 'Requirement').toString();
    const value = (d?.description || d?.value || '').toString();
    if (label || value) details.push({ label, value });
  }

  const linkList: Array<any> = rule?.links || data?.links || rule?.sources || [];
  for (const l of linkList) {
    const title = (l?.title || l?.name || 'Link').toString();
    const url = (l?.url || l?.href || '').toString();
    if (url) links.push({ title, url });
  }

  return { category, summary, details, links };
}

// ================== Handler ==================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nationality = (searchParams.get('nationality') || '').toUpperCase();
  const destination = (searchParams.get('destination') || '').toUpperCase();
  const debug = (searchParams.get('debug') || '') === '1';

  if (!nationality || nationality.length !== 2) {
    return NextResponse.json({ error: 'nationality (ISO2) required' }, { status: 400 });
  }

  const key = destination ? `${nationality}:${destination}` : `BULK:${nationality}`;
  const cached = getCache(key);
  if (cached && !debug) return NextResponse.json(cached);

  const apiKey = process.env.RAPIDAPI_KEY || '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: RAPIDAPI_KEY not set' },
      { status: 500 }
    );
  }

  const rapidHost = process.env.RAPIDAPI_VISA_HOST || 'visa-requirement.p.rapidapi.com';
  const rapidBase = process.env.RAPIDAPI_VISA_BASE || `https://${rapidHost}`;

  const commonHeaders = {
    'Accept': 'application/json',
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': rapidHost,
  } as const;

  try {
    // ========== 1) BULK MAP (no destination) ==========
    if (!destination) {
      const paths = ['/v2/visa/map', '/v1/visa/map'];
      let resOk: Response | null = null;
      let lastErr: { url: string; status: number; text?: string } | null = null;

      for (const p of paths) {
        const url = `${rapidBase}${p}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ passport: nationality }).toString(),
          cache: 'no-store',
        });
        if (r.ok) {
          resOk = r;
          break;
        } else {
          const text = await r.text().catch(() => '');
          lastErr = { url, status: r.status, text };
        }
      }

      if (!resOk) {
        const payload: BulkResult = {
          bulk: true,
          green: [],
          blue: [],
          yellow: [],
          red: [],
          version: null,
          language: null,
          generated_at: null,
        };
        // Only cache normalized empty payload; augment with debug if requested
        setCache(key, payload);
        const out = debug ? { ...payload, debug: true, raw: { error: 'No OK response from v2/v1 map', lastErr } } : payload;
        return NextResponse.json(out);
      }

      const json = await resOk.json().catch(() => null);
      let bulk: BulkResult;

      // Intentamos normalizar como v2; si falla, usamos normalizeBulk genérico
      try {
        bulk = normalizeBulkV2(json);
      } catch {
        bulk = normalizeBulk(json);
      }

      // Cache only normalized data
      setCache(key, bulk);
      const out = debug ? { ...bulk, debug: true, raw: json } : bulk;
      return NextResponse.json(out);
    }

    // ========== 2) CHECK (passport + destination) ==========
    const paths = ['/v2/visa/check', '/v1/visa/check'];
    let res: Response | null = null;
    let lastErr: { url: string; status: number; text?: string } | null = null;

    for (const p of paths) {
      const url = `${rapidBase}${p}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ passport: nationality, destination }).toString(),
        cache: 'no-store',
      });
      if (r.ok) {
        res = r;
        break;
      } else {
        const text = await r.text().catch(() => '');
        lastErr = { url, status: r.status, text };
      }
    }

    if (!res) {
      const payload: Normalized = {
        category: 'unknown',
        summary: 'Unavailable',
        details: [{ label: 'Upstream', value: 'No OK response from v2/v1 check' }],
        links: [],
      };
      setCache(key, payload);
      const out = debug ? { ...payload, debug: true, raw: { error: 'No OK response from v2/v1 check', lastErr } } : payload;
      return NextResponse.json(out, { status: 200 });
    }

    const json = await res.json().catch(() => null);

    let norm: Normalized;
    try {
      norm = normalizeV2Check(json);
    } catch {
      norm = normalizeRapid(json);
    }

    setCache(key, norm);
    const out = debug ? { ...norm, debug: true, raw: json } : norm;
    return NextResponse.json(out);
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