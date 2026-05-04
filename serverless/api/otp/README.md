Serverless OTP endpoints (Vercel example)

This folder provides a ready-to-deploy example for generating and verifying OTP codes using a serverless environment (Vercel, Netlify functions, etc.). It requires a Supabase `SERVICE_ROLE` key and a transactional email provider (example uses SendGrid).

Files:
- `generate.ts` - POST { email } -> generates 6-digit OTP, stores hashed code in `public.otps`, sends email via SendGrid.
- `verify.ts` - POST { email, code, newPassword? } -> verifies code; if `newPassword` is provided, updates the user's password via Supabase admin endpoint using the `SERVICE_ROLE`.

Required environment variables:
- `SUPABASE_URL` - your Supabase project URL (https://<project>.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service_role key (keep secret)
- `SENDGRID_API_KEY` - SendGrid API key (or replace with your SMTP/transactional provider)
- `EMAIL_FROM` - the From address used in emails

DB migration:
- `supabase/sql/20260503_create_otps_table.sql` - create `public.otps` table

Notes & security:
- Keep `SERVICE_ROLE` secret and only use on server-side. Do not expose to clients.
- Rate limiting is implemented superficially (3 requests/15min). Adjust as needed.
- The admin endpoints used in `verify.ts` rely on Supabase admin REST API shape; if your Supabase version or API differs, adjust the requests to use `supabase-js` admin methods in a Node environment.
- For production, replace SendGrid with your preferred provider or use Supabase's SMTP settings + a mail library.

Usage (client flow):
1. Client POST /api/otp/generate { email }
2. User receives email containing a 6-digit code
3. Client POST /api/otp/verify { email, code, newPassword }

After successful verify + password update the user can log in normally.
