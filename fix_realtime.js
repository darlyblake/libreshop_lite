require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, adminKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications;'
  });
  console.log(data, error);
}
run();
