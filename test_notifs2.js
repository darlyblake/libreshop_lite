require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gdjqzhbfibrsdiwvfhvp.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// using service role key if available to bypass RLS
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey; 
const supabase = createClient(supabaseUrl, adminKey);

async function run() {
  const { data, error } = await supabase.rpc('create_system_notification', {
    p_user_id: 'ffb66571-b47b-444f-8097-8da9a0711837',
    p_title: 'Test',
    p_body: 'Test body',
    p_type: 'system',
    p_target_role: 'client'
  });
  console.log("RPC result:", data, error);
}
run();
