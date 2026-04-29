# Anonymous Meme Vault

Premium Next.js app for anonymous meme template uploads, tagging, fuzzy search, and downloads.

## Features
- Anonymous upload (file picker + clipboard paste via `Ctrl+V` / `Cmd+V`)
- Tagging and typo-tolerant fuzzy search
- Anonymous download links with per-template download counters
- IP-based rate limiting and strict file validation
- Supabase Postgres + Storage backend

## Quick Start
1. Install deps:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
   Use keys from Supabase `Project Settings -> API Keys`:
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key
   - `SUPABASE_SECRET_KEY` = Secret key (server only)
3. Run app:
   ```bash
   npm run dev
   ```

## Database
Run the SQL in `supabase/migrations/0001_init_meme_templates.sql` in your Supabase SQL editor.

## Security Notes
- Use `SUPABASE_SECRET_KEY` only on the server.
- Keep bucket private and download via signed URLs.
- Set a strong `IP_HASH_SALT` before production.

## Performance Notes
- For fastest image loading, set `SUPABASE_BUCKET_PUBLIC=true` and make the storage bucket public.
- If you keep the bucket private, the app uses cached signed URLs automatically.

## Launch Checklist
- Confirm bucket name in Supabase exactly matches `SUPABASE_STORAGE_BUCKET`.
- Keep only production secrets in deployment environment variables (never commit `.env`).
- Ensure Upstash Redis is configured for production cache/rate limiting.
- Run `npm run build` before deploy and deploy with `npm run start`.
- Remove any old dev caches once after deploy by restarting the server.
