const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStoreCreation() {
  try {
    const email = 'test_store_creator_' + Date.now() + '@example.com';
    const password = 'Password123!';
    
    // 1. Sign up user
    console.log('Signing up user:', email);
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: 'Test Seller', role: 'seller' } }
    });
    
    if (authErr) {
      console.log('Auth Error:', authErr);
      return;
    }
    
    const user = authData.user;
    if (!user) {
      console.log('Signup successful but user object is empty (needs email confirmation?)');
      // If email confirmation is enabled, we can't easily sign in. Let's try to insert into users anyway.
    }
    
    const userId = user ? user.id : authData.session?.user?.id;
    if (!userId) {
      console.log('Could not get user ID from auth response', authData);
      return;
    }
    
    console.log('Auth User ID:', userId);

    // 2. Insert into public.users
    console.log('Inserting into public.users...');
    const { error: userInsertErr } = await supabase.from('users').insert({
      id: userId,
      email: email,
      full_name: 'Test Seller',
      role: 'seller'
    });
    
    if (userInsertErr) {
      console.log('User Insert Error (might already exist or RLS issue):', userInsertErr);
      // RLS might block insert if auth.uid() != id. Since we just signed up, if we have a session, we're authenticated.
      // But if email confirmation is required, we don't have a session!
    }

    // Attempt to log in to get a session
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInErr) {
      console.log('SignIn Error (Confirm Email?):', signInErr.message);
      // We can't proceed with RLS if not authenticated
      return;
    }

    // Now authenticated. Let's make sure public.users has the row
    await supabase.from('users').upsert({
      id: userId,
      email: email,
      full_name: 'Test Seller',
      role: 'seller'
    });

    // 3. Fetch plans & create store
    const { data: plans } = await supabase.from('plans').select('*');
    const trial = plans?.find(p => p.price === 0 && p.trial_days && p.status === 'active');
    
    const storePayload = {
      user_id: userId,
      name: 'Test Store Flow Agent',
      slug: 'test-store-flow-' + Math.floor(Math.random() * 100000),
      description: 'A test store to verify flow',
      category: 'electronique',
      email: email,
      phone: '+22500000000',
      address: 'Test Address',
    };
    
    const { data: countries } = await supabase.from('countries').select('*').limit(1);
    if (countries && countries.length > 0) {
      storePayload.country_id = countries[0].id;
      const { data: cities } = await supabase.from('cities').select('*').eq('country_id', countries[0].id).limit(1);
      if (cities && cities.length > 0) {
        storePayload.city_id = cities[0].id;
      }
    }
    
    console.log('Creating store completely authenticated...');
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .insert({
        ...storePayload,
        status: 'active',
        subscription_plan: trial ? trial.name : 'trial',
        subscription_start: new Date().toISOString(),
        subscription_status: 'trial',
        product_limit: trial ? trial.product_limit : 10,
        visible: true,
      })
      .select('*')
      .single();
      
    if (storeErr) {
      console.log('Store Creation Error:', storeErr);
    } else {
      console.log('\n==== STORE SUCCESSFULLY CREATED ====');
      console.log('Store ID:', store.id);
      console.log('Store Slug:', store.slug);
      console.log('====================================\n');
      
      console.log('Cleaning up...');
      await supabase.from('stores').delete().eq('id', store.id);
      console.log('Cleanup done.');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testStoreCreation();
