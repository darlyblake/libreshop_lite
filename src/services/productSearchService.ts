import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 
                     process.env.NEXT_PUBLIC_SUPABASE_URL || 
                     process.env.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 
                     process.env.SUPABASE_KEY || 
                     process.env.SUPABASE_ANON_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const OPENAI_KEY = process.env.OPENAI_KEY || 
                   process.env.EXPO_PUBLIC_OPENAI_KEY;

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
} else {
  console.error('⚠️ Supabase credentials not found in environment for productSearchService');
}

async function getQueryEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || !text) return null;
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

export type SearchResult = {
  id: string;
  name: string;
  short_description?: string;
  combined_score: number;
};

export async function searchProductsHybrid(q: string, page = 1, perPage = 20): Promise<{ data: SearchResult[]; total: number | null }> {
  if (!q || q.trim().length === 0) return { data: [], total: 0 };

  if (!supabase) {
    console.error('searchProductsHybrid error: Supabase client is not initialized (missing environment credentials)');
    return { data: [], total: 0 };
  }

  const offset = (page - 1) * perPage;
  let emb: number[] | null = null;
  try {
    emb = await getQueryEmbedding(q);
  } catch (err) {
    console.warn('Embedding error, falling back to text-only search', err instanceof Error ? err.message : err);
  }

  // Call RPC on Supabase that combines vector kNN + full-text
  try {
    const rpcParams: any = { query_text: q, limit_results: perPage };
    if (emb) rpcParams.query_embedding = emb;

    // When using supabase-js, rpc returns data directly
    const { data, error } = await supabase.rpc('search_products_hybrid', rpcParams as any);
    if (error) throw error;
    // supabase rpc returns array of records
    const results: SearchResult[] = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      short_description: r.short_description,
      combined_score: Number(r.combined_score) || 0,
    }));

    // total unknown from RPC; return null to indicate unknown or implement a counting RPC
    return { data: results, total: results.length };
  } catch (err: any) {
    console.error('searchProductsHybrid error', err.message || err);
    return { data: [], total: 0 };
  }
}
