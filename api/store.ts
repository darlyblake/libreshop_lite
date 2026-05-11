import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// XSS protection: escape HTML special characters
function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Escape HTML attributes
function escapeHtmlAttr(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export default async function handler(req: any, res: any) {
  const { id } = req.query;

  // Validate ID
  if (!id) {
    return res.status(400).send('Store ID is required');
  }

  if (!isValidUUID(id)) {
    return res.status(400).send('Invalid ID format');
  }

  try {
    // Fetch store data from Supabase
    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !stores) {
      return res.status(404).send('Store not found');
    }

    const store = stores as any;
    const logoUrl = store.logo_url || store.avatar_url || 'https://libreshop.shop/icon-512.png';
    const description = store.description || 'Découvrez cette boutique sur LibreShop';
    const title = store.name || 'Boutique';
    const url = `https://libreshop.shop/api/store?id=${id}`;

    // Fetch product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', id)
      .eq('is_active', true);

    // Escape user content to prevent XSS
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description.substring(0, 200));
    const safeLogoUrl = escapeHtmlAttr(logoUrl);
    const safeAddress = escapeHtml(store.address || '');
    const safeCity = escapeHtml(store.city || '');
    const safeCountry = escapeHtml(store.country || 'Gabon');

    // Generate HTML with pre-populated meta tags
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - Boutique | LibreShop</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${safeTitle} - Boutique | LibreShop">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeLogoUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="business.business">
  <meta property="og:site_name" content="LibreShop">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle} - Boutique | LibreShop">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeLogoUrl}">
  
  <!-- Local Business Meta Tags -->
  <meta property="business:contact_data:street_address" content="${safeAddress}">
  <meta property="business:contact_data:locality" content="${safeCity}">
  <meta property="business:contact_data:country" content="${safeCountry}">
  
  <!-- Redirect to app after a short delay -->
  <meta http-equiv="refresh" content="0;url=libreshop://store/${id}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .store-logo {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 16px;
      border: 4px solid #8b5cf6;
    }
    h1 {
      margin: 0 0 8px 0;
      color: #1a1a1a;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin: 16px 0;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #8b5cf6;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    .description {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background: #8b5cf6;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${safeLogoUrl}" alt="${safeTitle}" class="store-logo">
    <h1>${safeTitle}</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${productCount || 0}</div>
        <div class="stat-label">Produits</div>
      </div>
      <div class="stat">
        <div class="stat-value">⭐</div>
        <div class="stat-label">Note</div>
      </div>
    </div>
    <p class="description">${safeDescription}</p>
    <a href="libreshop://store/${id}" class="btn">Ouvrir dans LibreShop</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.send(html);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).send('Error loading store');
  }
}
