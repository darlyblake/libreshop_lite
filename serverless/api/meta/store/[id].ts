import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
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
  const u = url ? String(url) : '';
  if (!u) return 'https://libreshop.shop/icon-512.png';
  if (u.includes('cloudinary.com') && u.includes('/upload/')) {
    return u.replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_auto,/upload/');
  }
  return u;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query?.id as string | undefined) || (req as any).query?.storeId;

  if (!id) {
    return res.status(400).send('Missing store id');
  }

  try {
    const { data: store, error } = await supabase
      .from('stores')
      .select('id,name,description,logo_url,slug,city,rating,review_count')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!store) return res.status(404).send('Store not found');

    const name = safeText((store as any).name, 'Boutique');
    const descriptionRaw = safeText((store as any).description, 'Découvrez cette boutique sur LibreShop.');
    const description = escapeHtml(descriptionRaw.slice(0, 160));

    const imageUrl = pickOgImage((store as any).logo_url);

    const canonicalUrl = `https://libreshop.shop/meta/store/${encodeURIComponent(id)}`;
    const shareUrl = `https://libreshop.shop/store/${encodeURIComponent(id)}`;

    const ogTitle = `${name} | Boutique en ligne | LibreShop`;
    const ogDescription = `${descriptionRaw.slice(0, 140)}${(store as any).city ? ' • ' + (store as any).city : ''}`;

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>${escapeHtml(ogTitle)}</title>

  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <meta property="og:type" content="website" />
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

  <script type="application/ld+json">
  ${JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name,
      description: descriptionRaw,
      image: [imageUrl],
      url: shareUrl,
      address: (store as any).city ? { '@type': 'PostalAddress', addressLocality: (store as any).city, addressCountry: 'CI' } : undefined,
    },
    null,
    2,
  )}
  </script>

  <meta http-equiv="refresh" content="0; url=${escapeHtml(shareUrl)}" />
</head>
<body>
  <noscript>
    <p>Redirection vers la boutique: <a href="${escapeHtml(shareUrl)}">${escapeHtml(name)}</a></p>
  </noscript>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e: any) {
    console.error('[meta/store] error', e);
    return res.status(500).send('Internal error');
  }
}

