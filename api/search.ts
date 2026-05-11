import { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProductsHybrid } from '../src/services/productSearchService';
import { checkRateLimit, setSecurityHeaders, getClientIP } from './auth-middleware';

// Simple serverless handler for /api/search on Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rate limiting
  const clientIP = getClientIP(req);
  if (!(await checkRateLimit(clientIP))) {
    setSecurityHeaders(res);
    return res.status(429).send('Too many requests');
  }

  // Set security headers
  setSecurityHeaders(res);

  try {
    const q = (req.query.q as string) || (req.body && req.body.q) || '';
    const page = Number(req.query.page || req.body?.page || 1);
    const perPage = Number(req.query.perPage || req.body?.perPage || 20);
    
    // Validate and sanitize inputs
    if (!q || q.trim().length === 0) {
      return res.status(200).json({ data: [], total: 0 });
    }
    
    if (q.length > 200) {
      return res.status(400).json({ error: 'Query too long' });
    }
    
    if (page < 1 || page > 1000) {
      return res.status(400).json({ error: 'Invalid page number' });
    }
    
    if (perPage < 1 || perPage > 100) {
      return res.status(400).json({ error: 'Invalid perPage value' });
    }

    const { data, total } = await searchProductsHybrid(q, page, perPage);
    return res.status(200).json({ data, total });
  } catch (err: any) {
    console.error('api/search error', err?.message || err);
    setSecurityHeaders(res);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
