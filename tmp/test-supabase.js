const { createClient } = require('@supabase/supabase-js');
(async () => {
  const url = 'https://gpktblxfkedrwmsrjxro.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3RibHhma2Vkcndtc3JqeHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTg0ODEsImV4cCI6MjA4Nzg3NDQ4MX0.uDjr1U-FyiM0CgPiw6LSgt-poFYeeBIjNy98STbTclc';
  const supabase = createClient(url, key);
  try {
    console.log('listing');
    let { data, error } = await supabase.from('categories').select('*').limit(1);
    console.log('select result', { data, error });
    console.log('try insert no slug');
    let res = await supabase.from('categories').insert({ name: 'testcat' }).select();
    console.log('insert no slug', res);
  } catch (e) {
    console.error('caught', e);
  }
})();
