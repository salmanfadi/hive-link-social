# Supabase-Only Integration (No Lovable Cloud)

This project must use **Supabase directly** for authentication, database, storage, and realtime.

## Rules

- Do not use Lovable Cloud auth/database APIs.
- Do not add fallback endpoints pointing to Lovable-hosted backends.
- Keep all auth and data calls wired to:
  - `https://amgeagtqfvlzxckptkfq.supabase.co`
- Use the existing Supabase client integrations in:
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/client.server.ts`
- Keep static auth pages (`public/login.html`, `public/signup.html`) using the same Supabase project URL and anon key.

## Login Flow Requirement

- User enters credentials on `login.html`.
- On successful sign-in, redirect to `/` (social home feed).
- If there is no session, protected app routes should send user to `/login.html` (not `/auth` or `/login`).

