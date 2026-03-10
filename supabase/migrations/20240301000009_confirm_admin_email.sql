-- Désactiver la confirmation email pour le développement
UPDATE auth.users SET email_confirmed_at = timezone('utc'::text, now()) WHERE email = 'darlyblake@gmail.com';
