#!/usr/bin/env node

/**
 * Script de génération/optimisation du sitemap avec support pour sitemaps indexés
 * (utile si vous avez 50K+ URLs)
 * 
 * Usage: node scripts/generate-sitemap-advanced.js
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const sitemapIndexPath = path.join(publicDir, 'sitemap-index.xml');

// Routes statiques avec priorités pour SEO
const STATIC_ROUTES = [
  { url: '/', priority: 1.0, changefreq: 'daily', lastmod: new Date().toISOString().split('T')[0] },
  { url: '/about', priority: 0.9, changefreq: 'monthly' },
  { url: '/landing', priority: 0.85, changefreq: 'weekly' },
  { url: '/features', priority: 0.80, changefreq: 'weekly' },
  { url: '/pricing', priority: 0.80, changefreq: 'weekly' },
  { url: '/stores', priority: 0.80, changefreq: 'daily' },
  { url: '/products', priority: 0.80, changefreq: 'daily' },
  { url: '/search', priority: 0.75, changefreq: 'weekly' },
  { url: '/wishlist', priority: 0.70, changefreq: 'weekly' },
  { url: '/cart', priority: 0.70, changefreq: 'weekly' },
  { url: '/checkout', priority: 0.70, changefreq: 'weekly' },
  { url: '/account', priority: 0.75, changefreq: 'weekly' },
  { url: '/contact', priority: 0.50, changefreq: 'monthly' },
  { url: '/faq', priority: 0.50, changefreq: 'monthly' },
];

// Format une URL pour le sitemap
function formatUrlEntry(url, priority = 0.7, changefreq = 'weekly', lastmod = null) {
  const lastModStr = lastmod 
    ? `    <lastmod>${lastmod}</lastmod>\n`
    : `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;

  return `  <url>
    <loc>https://libreshop.shop${url}</loc>
    <priority>${priority.toFixed(2)}</priority>
    <changefreq>${changefreq}</changefreq>
${lastModStr}  </url>`;
}

// Récupérer les URLs dynamiques depuis Supabase
async function fetchDynamicUrls() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  SUPABASE_URL ou SUPABASE_KEY manquants. URLs dynamiques non incluses.');
    return { products: [], stores: [] };
  }

  try {
    // Récupérer produits actifs (limité à 5000 pour performance)
    const productsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,id,updated_at&is_active=eq.true&order=rating.desc&limit=5000`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!productsRes.ok) {
      throw new Error(`Produits: ${productsRes.status}`);
    }

    const products = await productsRes.json();

    // Récupérer stores actifs (limité à 2000)
    const storesRes = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=slug,id,updated_at&is_active=eq.true&order=rating.desc&limit=2000`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    const stores = storesRes.ok ? await storesRes.json() : [];

    console.log(`✅ Données Supabase chargées: ${products.length} produits, ${stores.length} stores`);
    return { products, stores };
  } catch (err) {
    console.error(`❌ Erreur Supabase: ${err.message}`);
    return { products: [], stores: [] };
  }
}

// Générer le sitemap
async function generateSitemap() {
  console.log('🔄 Génération du sitemap...');

  // Charger URLs dynamiques
  const { products, stores } = await fetchDynamicUrls();

  // Construire liste complète
  const allUrls = [...STATIC_ROUTES];

  // Ajouter produits
  products.forEach((p) => {
    if (p.slug || p.id) {
      allUrls.push({
        url: `/product/${p.slug || p.id}`,
        priority: 0.75,
        changefreq: 'weekly',
        lastmod: p.updated_at ? p.updated_at.split('T')[0] : null,
      });
    }
  });

  // Ajouter stores
  stores.forEach((s) => {
    if (s.slug || s.id) {
      allUrls.push({
        url: `/store/${s.slug || s.id}`,
        priority: 0.80,
        changefreq: 'daily',
        lastmod: s.updated_at ? s.updated_at.split('T')[0] : null,
      });
    }
  });

  console.log(`📝 Total URLs à générer: ${allUrls.length}`);

  // Générer le contenu du sitemap
  let sitemapContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemapContent += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  allUrls.forEach((entry) => {
    sitemapContent += formatUrlEntry(entry.url, entry.priority, entry.changefreq, entry.lastmod) + '\n';
  });

  sitemapContent += '</urlset>';

  // Écrire le fichier
  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log(`✅ Sitemap généré: ${sitemapPath} (${allUrls.length} URLs)`);

  // Mettre à jour robots.txt
  const robotsPath = path.join(publicDir, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    let robotsContent = fs.readFileSync(robotsPath, 'utf8');
    if (!robotsContent.includes('Sitemap:')) {
      robotsContent += '\nSitemap: https://libreshop.shop/sitemap.xml\n';
      fs.writeFileSync(robotsPath, robotsContent, 'utf8');
      console.log(`✅ robots.txt mis à jour`);
    }
  }
}

// Exécuter
generateSitemap().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
