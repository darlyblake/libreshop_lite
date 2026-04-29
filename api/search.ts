import { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProductsHybrid } from '../src/services/productSearchService';

// Simple serverless handler for /api/search on Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = (req.query.q as string) || (req.body && req.body.q) || '';
    const page = Number(req.query.page || req.body?.page || 1);
    const perPage = Number(req.query.perPage || req.body?.perPage || 20);
    if (!q || q.trim().length === 0) return res.status(200).json({ data: [], total: 0 });

    const { data, total } = await searchProductsHybrid(q, page, perPage);
    return res.status(200).json({ data, total });
  } catch (err: any) {
    console.error('api/search error', err?.message || err);
    return res.status(500).json({ error: String(err) });
  }
}
