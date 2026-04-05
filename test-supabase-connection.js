
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gdjqzhbfibrsdiwvfhvp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkanF6aGJmaWJyc2Rpd3ZmaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTE4ODQsImV4cCI6MjA4Nzk2Nzg4NH0.GNIhTXq_ysIU36SZEakuHEeJPcO1nxTxm3Im1RIlyPE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      console.error('Supabase error:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('Connection successful! Data:', data);
    }

    const { data: banners, error: bannerErr } = await supabase.from('home_banners').select('id').limit(1);
    if (bannerErr) {
      console.warn('Banners table issue (might not exist):', bannerErr.message);
    } else {
      console.log('Banners table accessible.');
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testConnection();
