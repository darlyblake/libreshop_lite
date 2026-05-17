
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gdjqzhbfibrsdiwvfhvp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkanF6aGJmaWJyc2Rpd3ZmaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTE4ODQsImV4cCI6MjA4Nzk2Nzg4NH0.GNIhTXq_ysIU36SZEakuHEeJPcO1nxTxm3Im1RIlyPE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .rpc('get_table_columns', { table_name: 'orders' }); // If RPC exists

  if (error) {
    // Try simple select
    const { data: cols, error: err2 } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (cols && cols.length > 0) {
      console.log('Columns:', Object.keys(cols[0]));
    } else {
      console.log('No rows found to guess columns.');
    }
  } else {
    console.log('Columns from RPC:', data);
  }
}

test();
