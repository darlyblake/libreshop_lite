#!/usr/bin/env node
/**
 * Lightweight dev API server to expose /api/search during local development.
 * Run with `npm run dev:api` in a separate terminal.
 */
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set — RPC calls will fail.');
}

const app = express();
app.use(bodyParser.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

async function getEmbedding(text) {
  if (!OPENAI_KEY) return null;
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }
  const j = await resp.json();
  return j.data[0].embedding;
}

app.all('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || req.body.q || '').toString();
    const perPage = Number(req.query.perPage || req.body.perPage || 20);
    if (!q) return res.json({ data: [], total: 0 });

    let embedding = null;
    try {
      embedding = await getEmbedding(q);
    } catch (e) {
      console.warn('Embedding failed (dev):', e.message || e);
    }

    // Call Supabase RPC endpoint
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'supabase_not_configured' });
    }

    const rpcUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/search_products_hybrid`;
    const body = { query_text: q, limit_results: perPage };
    if (embedding) body.query_embedding = embedding;

    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!rpcRes.ok) {
      const txt = await rpcRes.text();
      return res.status(rpcRes.status).json({ error: 'rpc_error', detail: txt });
    }
    const data = await rpcRes.json();
    return res.json({ data, total: data.length });
  } catch (err) {
    console.error('Dev API /api/search error', err);
    res.status(500).json({ error: String(err) });
  }
});

const port = process.env.DEV_API_PORT || 3333;
app.listen(port, () => console.log(`Dev API server listening on http://localhost:${port}`));
