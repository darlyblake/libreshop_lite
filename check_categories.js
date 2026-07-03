const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gdjqzhbfibrsdiwvfhvp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkanF6aGJmaWJyc2Rpd3ZmaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTE4ODQsImV4cCI6MjA4Nzk2Nzg4NH0.GNIhTXq_ysIU36SZEakuHEeJPcO1nxTxm3Im1RIlyPE');

async function run() {
  const { data, error } = await supabase.from('categories').select('id, name, parent_id');
  if (error) console.error(error);
  else console.log(data);
}
run();
