#!/usr/bin/env node
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Simple backfill script for product embeddings using OpenAI embeddings API
// Run with: npx ts-node scripts/backfill-embeddings.ts

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env');
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI embedding error: ${res.status} ${txt}`);
  }
  const j = await res.json();
  return j.data[0].embedding as number[];
}

function docText(p: any) {
  return [p.name, p.short_description, (p.tags || []).join(' '), (p.synonyms || []).join(' '), p.reference || '']
    .filter(Boolean)
    .join(' - ');
}

async function backfill() {
  console.log('Starting embedding backfill (batch size =', BATCH_SIZE, ')');
  let count = 0;

  while (true) {
    const { data: products, error } = await supabase
      .from('products')
      .select('id,name,short_description,tags,synonyms,reference')
      .is('embedding', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Supabase select error', error);
      process.exit(1);
    }
    if (!products || products.length === 0) break;

    for (const p of products) {
      try {
        const text = docText(p);
        const emb = await getEmbedding(text);
        const { error: upErr } = await supabase.from('products').update({ embedding: emb }).eq('id', p.id);
        if (upErr) {
          console.error('Update error for id', p.id, upErr);
        } else {
          count++;
          if (count % 10 === 0) process.stdout.write(`.${count}`);
        }
      } catch (err: any) {
        console.error('Embedding error for id', p.id, err.message || err);
      }
    }
  }
  console.log('\nBackfill complete. Embeddings written for', count, 'products');
}

backfill().catch((e) => { console.error('Fatal error', e); process.exit(1); });
