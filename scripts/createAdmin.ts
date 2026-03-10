import { authService } from '../src/lib/supabase';

// Simple script to create the first admin user.
// Usage: npx ts-node scripts/createAdmin.ts
// Make sure your environment variables (SUPABASE URL/KEY) are set correctly.

async function main() {
  try {
    const email = 'darlyblake@gmail.com';
    const password = 'Mouembanza@8';
    const fullName = 'darlyblake';

    console.log('Creating admin user...');
    const result = await authService.signUp(email, password, fullName, 'admin');
    console.log('Sign up response:', result);
    console.log('✅ Admin user creation initiated. Check your Supabase dashboard to verify.');
  } catch (err: any) {
    console.error('Failed to create admin user:', err.message || err);
    process.exit(1);
  }
}

main();
