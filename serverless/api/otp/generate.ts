import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Environment variables required:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENDGRID_API_KEY, EMAIL_FROM

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@example.com';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    // rate limit: max 3 OTPs in last 15 minutes
    const { data: recent, error: rerr } = await supabase
      .from('otps')
      .select('id')
      .eq('email', email)
      .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .limit(1);
    if (rerr) throw rerr;
    if (recent && recent.length >= 3) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // insert OTP row
    const { error: ierr } = await supabase.from('otps').insert([{
      email,
      code_hash: hash,
      expires_at: expiresAt,
      used: false
    }]);
    if (ierr) throw ierr;

    // send email via SendGrid
    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: EMAIL_FROM },
        subject: 'Votre code de réinitialisation LibreShop',
        content: [{ type: 'text/plain', value: `Votre code: ${code}\nIl expire dans 10 minutes.` }]
      })
    });

    if (!sgRes.ok) {
      const text = await sgRes.text();
      console.error('SendGrid error:', text);
      return res.status(502).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('generate OTP error', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
