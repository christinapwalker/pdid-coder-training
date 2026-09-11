// Cloudflare Worker: accepts a quiz-score POST from the PDID training page
// and writes it to Airtable, keeping the write-scoped Airtable token
// server-side (never exposed to the public page's source).
//
// Deploy: paste this into the Cloudflare dashboard's Worker editor.
// Requires one secret, set under Settings > Variables and Secrets:
//   AIRTABLE_TOKEN — a Personal Access Token scoped to ONLY the
//   "Deepfake Database Management" base, with data.records:read/write.

const AIRTABLE_BASE_ID = 'appFRJUsVbK1w26Co';
const AIRTABLE_TABLE_ID = 'tblSHBD9cCH4WTLMs';
const ALLOWED_ORIGINS = [
  'http://christinapwalker.com',
  'https://christinapwalker.com',
  'http://www.christinapwalker.com',
  'https://www.christinapwalker.com'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(allowedOrigin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, allowedOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400, allowedOrigin);
    }

    const { raName, module, score, total } = body || {};
    if (
      typeof raName !== 'string' || !raName.trim() ||
      typeof module !== 'string' || !module.trim() ||
      typeof score !== 'number' || !Number.isFinite(score) ||
      typeof total !== 'number' || !Number.isFinite(total)
    ) {
      return json({ error: 'Missing or invalid fields' }, 400, allowedOrigin);
    }

    const today = new Date().toISOString().slice(0, 10);

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            'RA Name': raName.trim(),
            'Module': module.trim(),
            'Score': score,
            'Total Questions': total,
            'Date Submitted': today
          }
        })
      }
    );

    if (!airtableRes.ok) {
      const detail = await airtableRes.text();
      return json({ error: 'Airtable write failed', detail }, 502, allowedOrigin);
    }

    return json({ ok: true }, 200, allowedOrigin);
  }
};

function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200, allowedOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(allowedOrigin) }
  });
}
