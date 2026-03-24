const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Categories count:', data.length);
    if (data.length > 0) {
      console.log('Sample category:', data[0]);
    }
  }
}
test();
