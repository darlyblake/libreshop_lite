import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Environment variables required:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { email, code, newPassword } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'email and code required' });

  try {
    const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
    // find matching unused OTP not expired
    const { data: rows, error: qerr } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('code_hash', hash)
      .eq('used', false)
      .lte('expires_at', new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString());

    if (qerr) throw qerr;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const otp = rows[0];
    // mark used
    const { error: uerr } = await supabase.from('otps').update({ used: true }).eq('id', otp.id);
    if (uerr) console.warn('Failed marking otp used', uerr);

    if (!newPassword) {
      return res.status(200).json({ ok: true, message: 'verified' });
    }

    // If newPassword provided, attempt to find user and update password using admin API via REST
    // Find user via admin endpoint
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE
      }
    });
    if (!usersRes.ok) {
      const text = await usersRes.text();
      console.error('admin users fetch failed', text);
      return res.status(502).json({ error: 'Failed to fetch user' });
    }
    const users = await usersRes.json();
    const user = Array.isArray(users) ? users[0] : users;
    if (!user || !user.id) return res.status(404).json({ error: 'User not found' });

    // Update password
    const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error('admin update failed', text);
      return res.status(502).json({ error: 'Failed to update password' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('verify OTP error', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
