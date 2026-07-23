import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; // we only have anon key, but we can try to update if we have RLS

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixImages() {
  // First, get all products to see the damage
  const { data: products, error } = await supabase.from('products').select('id, name, images');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  for (const p of products) {
    if (p.images && p.images.length > 0) {
      const fixedImages = p.images.filter(img => !img.startsWith('blob:'));
      if (fixedImages.length !== p.images.length) {
        console.log(`Fixing product ${p.name} (${p.id}): removing blob URLs`);
        // We're using anon key, so we might not be able to update if RLS blocks it for anon role
        const { error: updateErr } = await supabase.from('products').update({ images: fixedImages }).eq('id', p.id);
        if (updateErr) {
          console.error(`Failed to update ${p.name}:`, updateErr.message);
        } else {
          console.log(`Successfully updated ${p.name}`);
        }
      }
    }
  }
}

fixImages();
