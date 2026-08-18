require('dotenv').config();
async function run() {
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/bar_photos?limit=1`, {
    headers: {
      'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
    }
  });
  console.log(await res.json());
}
run();
