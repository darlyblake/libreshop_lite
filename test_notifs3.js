require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gdjqzhbfibrsdiwvfhvp.supabase.co';
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
if (!adminKey) { console.error("No service role key"); process.exit(1); }
const supabase = createClient(supabaseUrl, adminKey);

async function run() {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10);
  console.log("Recent notifs:", data ? data.map(n => n.title) : null, error);
}
run();
