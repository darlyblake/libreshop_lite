require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await client.from('orders').update({ payment_status: 'pending' }).eq('status', 'pending').eq('payment_status', 'paid');
  console.log("Updated rows:", data, "Error:", error);
})();
