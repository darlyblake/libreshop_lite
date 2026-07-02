const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8').split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile) {
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function testSchema() {
  const url = `${supabaseUrl}/rest/v1/user_addresses?limit=1`;
  const res = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const text = await res.text();
  console.log(text);
}

testSchema();
