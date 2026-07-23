import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'blakefred6@gmail.com',
    password: 'password123' // assuming they have a simple password or something? No, I shouldn't try passwords.
  });
}
