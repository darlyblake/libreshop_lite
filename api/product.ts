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

// Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export default async function handler(req: any, res: any) {
  const { id } = req.query;

  // Validate ID
  if (!id) {
    return res.status(400).send('Product ID is required');
  }

  if (!isValidUUID(id)) {
    return res.status(400).send('Invalid ID format');
  }

  try {
    // Fetch product data from Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !products) {
      return res.status(404).send('Product not found');
    }

    const product = products as any;
    const imageUrl = product.images && product.images.length > 0 ? product.images[0] : 'https://libreshop.shop/icon-512.png';
    const priceFormatted = product.price ? `${product.price.toLocaleString()} FCFA` : '';
    const description = product.description || 'Découvrez ce produit sur LibreShop';
    const title = product.name || 'Produit';
    const url = `https://libreshop.shop/api/product?id=${id}`;

    // Escape user content to prevent XSS
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description.substring(0, 200));
    const safePrice = escapeHtml(priceFormatted);
    const safeImageUrl = escapeHtmlAttr(imageUrl);

    // Generate HTML with pre-populated meta tags
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - ${safePrice} | LibreShop</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${safeTitle} - ${safePrice} | LibreShop">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="LibreShop">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle} - ${safePrice} | LibreShop">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImageUrl}">
  
  <!-- Product Meta Tags -->
  <meta property="product:price:amount" content="${product.price || 0}">
  <meta property="product:price:currency" content="XOF">
  <meta property="product:availability" content="${product.stock > 0 ? 'InStock' : 'OutOfStock'}">
  
  <!-- Redirect to app after a short delay -->
  <meta http-equiv="refresh" content="0;url=libreshop://product/${id}">
  
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
    .product-image {
      width: 100%;
      max-width: 400px;
      height: auto;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 8px 0;
      color: #1a1a1a;
    }
    .price {
      font-size: 24px;
      font-weight: bold;
      color: #8b5cf6;
      margin-bottom: 16px;
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
    <img src="${safeImageUrl}" alt="${safeTitle}" class="product-image">
    <h1>${safeTitle}</h1>
    <div class="price">${safePrice}</div>
    <p class="description">${safeDescription}</p>
    <a href="libreshop://product/${id}" class="btn">Ouvrir dans LibreShop</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.send(html);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).send('Error loading product');
  }
}
