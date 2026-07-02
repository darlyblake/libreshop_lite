const fs = require('fs');

// Extract supabase URL and ANON KEY from codebase
const envFile = fs.readFileSync('.env', 'utf8').split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile) {
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

if (!supabaseUrl || !supabaseKey) {
  console.log("Could not find credentials in .env");
  process.exit(1);
}

async function testRpc() {
  const url = `${supabaseUrl}/rest/v1/rpc/update_user_profile_versioned`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_updates: { phone: "123" }
    })
  });
  
  const text = await res.text();
  console.log(`STATUS: ${res.status}`);
  console.log(`BODY: ${text}`);
}

testRpc();
