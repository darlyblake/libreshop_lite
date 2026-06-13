require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
client.rpc('get_store_orders_metadata', { p_store_id: 'e6a88b54-7389-408c-b08d-30477efed7da' }).then(res => console.log(res.data));
