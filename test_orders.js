require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
client.from('orders').select('id, status, payment_status').limit(5).then(res => console.log(res.data));
