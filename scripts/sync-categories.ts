#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

// Usage:
// SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx ts-node scripts/sync-categories.ts [--delete-unknown] [--yes]

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const canonicalCategories = [
  'Électronique',
  'Informatique & Accessoires',
  'Ordinateurs portables',
  'Composants & Périphériques',
  'Téléphonie & Accessoires',
  'Tablettes & eReaders',
  'Photo & Vidéo',
  'Audio & Hi‑Fi',
  'TV & Home cinéma',
  'Gaming & Consoles',
  'Réseaux & Smart Home',
  'Mode Femme',
  'Mode Homme',
  'Enfants & Bébé',
  'Chaussures',
  'Sacs & Maroquinerie',
  'Bijoux & Accessoires',
  'Montres',
  'Beauté & Soins',
  'Santé & Parapharmacie',
  'Maison & Décoration',
  'Meubles',
  'Cuisine & Arts de la table',
  'Linge de maison',
  'Jardin & Extérieur',
  'Bricolage & Outillage',
  'Auto & Moto',
  'Sports & Loisirs',
  'Fitness & Musculation',
  'Camping & Randonnée',
  'Jouets & Jeux',
  'Puériculture',
  'Animaux & Accessoires',
  'Livres & Presse',
  'Musique & Instruments',
  'Films & Séries',
  'Papeterie & Bureau',
  'Alimentation & Épicerie',
  'Boissons & Vins',
  'Cadeaux & Occasions',
  'Art & Artisanat',
  'Industrie & Fournitures professionnelles',
  'Services & Prestations',
  'Événementiel',
  'Informatique cloud & Logiciels',
  'Éducation & Cours',
  'Télétravail & Mobilier de bureau',
  'Sécurité & Surveillance',
  'Énergie & Batteries',
  'Pièces détachées',
  'Seconde main & Vintage',
  'Éco‑responsable',
];

async function promptYesNo(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(question + ' (y/N) ', (answer) => {
      rl.close();
      const ok = String(answer || '').trim().toLowerCase();
      resolve(ok === 'y' || ok === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const deleteUnknown = args.includes('--delete-unknown');
  const autoYes = args.includes('--yes');

  console.log('Connecting to Supabase', SUPABASE_URL);

  // Fetch existing categories
  const { data: existing, error: selErr } = await supabase.from('categories').select('*');
  if (selErr) {
    console.error('Error fetching categories:', selErr);
    process.exit(1);
  }

  console.log('Existing categories (', (existing || []).length, '):');
  (existing || []).forEach((c: any) => console.log('-', c.id || '?', c.name || c.slug || ''));

  // Upsert canonical categories
  // Only include columns that are likely to exist in the `categories` table (avoid is_active if absent)
  const toUpsert = canonicalCategories.map((name) => ({ name, slug: slugify(name) }));

  console.log('\nUpserting canonical categories (will create missing, update existing by slug)...');
  const { error: upErr } = await supabase.from('categories').upsert(toUpsert, { onConflict: 'slug' });
  if (upErr) {
    console.error('Upsert error:', upErr);
    process.exit(1);
  }
  console.log('Upsert complete.');

  if (deleteUnknown) {
    const canonicalSlugs = new Set(toUpsert.map((c) => c.slug));
    const unknown = (existing || []).filter((c: any) => !canonicalSlugs.has((c.slug || slugify(c.name || '')).toString()));

    if (unknown.length === 0) {
      console.log('No unknown categories to delete.');
      return;
    }

    console.log('\nUnknown categories found:');
    unknown.forEach((c: any) => console.log('-', c.id, c.name || c.slug));

    let confirm = autoYes;
    if (!confirm) {
      confirm = await promptYesNo('Confirmer la suppression de ces catégories inconnues ?');
    }

    if (!confirm) {
      console.log('Abandon suppression. Rien n\'a été supprimé.');
      return;
    }

    const ids = unknown.map((c: any) => c.id).filter(Boolean);
    const { error: delErr } = await supabase.from('categories').delete().in('id', ids);
    if (delErr) {
      console.error('Deletion error:', delErr);
      process.exit(1);
    }
    console.log('Suppression terminée pour', ids.length, 'catégories.');
  }

  console.log('\nScript terminé. Vérifiez le tableau `categories` dans Supabase.');
}

main().catch((e) => {
  console.error('Fatal error', e);
  process.exit(1);
});
