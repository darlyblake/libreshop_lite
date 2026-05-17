
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gdjqzhbfibrsdiwvfhvp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkanF6aGJmaWJyc2Rpd3ZmaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTE4ODQsImV4cCI6MjA4Nzk2Nzg4NH0.GNIhTXq_ysIU36SZEakuHEeJPcO1nxTxm3Im1RIlyPE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const productId = '08c89d5f-dfaf-4fad-9a23-4cba66bb76da';
  const { data, error } = await supabase
    .from('products')
    .update({ 
      cost_price: 460000,
      compare_price: null,
      low_stock_threshold: 5
    })
    .eq('id', productId)
    .select('*')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data.name, 'cost_price:', data.cost_price);
  }
}

test();
