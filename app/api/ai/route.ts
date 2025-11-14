import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { q, locale } = await req.json().catch(() => ({ q: '', locale: 'en' }));
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const system = `You are a helpful travel assistant. Answer briefly, practical, and safe. Use the user's language: ${locale || 'en'}. Keep responses under 10 lines. Prefer plain-text bullet points with '-'. Do NOT use any markdown formatting (no **bold**, no backticks, no headings). Avoid hallucinations; if uncertain, say it briefly.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(q || '').slice(0, 2000) },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return NextResponse.json({ error: 'upstream', details: text }, { status: 502 });
    }
    const json = await r.json();
    let content: string = json?.choices?.[0]?.message?.content || '';
    // Sanitize: strip markdown emphasis/backticks/headings
    content = content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`+/g, '')
      .replace(/^#{1,6}\s*/gm, '')
      .trim();
    return NextResponse.json({ answer: content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
