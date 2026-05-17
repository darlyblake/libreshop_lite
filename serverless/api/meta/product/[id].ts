import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

function safeText(s: unknown, fallback: string) {
  const v = typeof s === 'string' ? s : '';
  return v ? v : fallback;
}

function escapeHtml(str: string) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function pickOgImage(url: string | undefined | null) {
  // Keep it deterministic: if image is already https, use it.
  // If it's from Cloudinary, we can request 1200x630 (best-effort, without depending on internal helpers).
  const u = url ? String(url) : '';
  if (!u) return 'https://libreshop.shop/icon-512.png';

  // Cloudinary style: .../upload/... . If we can insert a resize transformation, do it.
  // This is a best-effort heuristic; if it fails, the original image URL still works.
  if (u.includes('cloudinary.com') && u.includes('/upload/')) {
    return u.replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_auto,/upload/');
  }

  return u;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query?.id as string | undefined) || (req as any).query?.productId;

  if (!id) {
    return res.status(400).send('Missing product id');
  }

  try {
    // Fetch product + store in one go if possible
    const { data: product, error } = await supabase
      .from('products')
      .select(
        `id,name,description,price,compare_price,stock,images,store_id,slug,rating,review_count,created_at,store:store_id (id,name,logo_url,slug)`
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!product) return res.status(404).send('Product not found');

    const store = (product as any).store;

    const name = safeText((product as any).name, 'Produit');
    const descriptionRaw = safeText((product as any).description, 'Découvrez ce produit sur LibreShop.');
    const description = escapeHtml(descriptionRaw.slice(0, 160));

    const priceNum = Number((product as any).price || 0);
    const currency = 'XOF';
    const priceText = priceNum > 0 ? `${priceNum.toLocaleString('fr-FR')} ${currency}` : '';

    const imageUrl = pickOgImage(Array.isArray((product as any).images) ? (product as any).images[0] : (product as any).images);

    const canonicalUrl = `https://libreshop.shop/meta/product/${encodeURIComponent(id)}`;
    const shareUrl = `https://libreshop.shop/product/${encodeURIComponent(id)}`;

    const ogTitle = `${name}${priceText ? ' - ' + priceText : ''}`;
    const ogDescription = `${descriptionRaw.slice(0, 120)}${priceText ? ' • ' + priceText : ''}${store?.name ? ' • ' + store.name : ''}`;

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>${escapeHtml(ogTitle)} | LibreShop</title>

  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="LibreShop" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

  ${priceNum > 0 ? `<meta property="product:price:amount" content="${priceNum}" />
  <meta property="product:price:currency" content="${currency}" />
  <meta property="product:availability" content="${Number((product as any).stock || 0) > 0 ? 'InStock' : 'OutOfStock'}" />` : ''}

  <script type="application/ld+json">
  ${JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: descriptionRaw,
      image: [imageUrl],
      url: shareUrl,
      brand: store?.name ? { '@type': 'Brand', name: store.name } : undefined,
      offers:
        priceNum > 0
          ? {
              '@type': 'Offer',
              price: priceNum,
              priceCurrency: currency,
              availability:
                Number((product as any).stock || 0) > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
              url: shareUrl,
            }
          : undefined,
    },
    null,
    2,
  )}
  </script>

  <meta http-equiv="refresh" content="0; url=${escapeHtml(shareUrl)}" />
</head>
<body>
  <noscript>
    <p>Redirection vers le produit: <a href="${escapeHtml(shareUrl)}">${escapeHtml(name)}</a></p>
  </noscript>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e: any) {
    console.error('[meta/product] error', e);
    return res.status(500).send('Internal error');
  }
}

