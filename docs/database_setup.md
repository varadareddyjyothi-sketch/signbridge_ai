# SignBridge AI — Database Configuration & Migration Guide

SignBridge AI supports dual-mode persistence:
1. **Supabase Cloud (PostgreSQL with RLS & Auth)**
2. **Local Embedded SQLite (Zero-configuration fallback)**

---

## 1. Setting up Supabase Cloud

If you have a Supabase account:

1. Create a new project in the [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** tab in your Supabase dashboard.
3. Copy the contents of [`supabase/migrations/20261026_init_signbridge_schema.sql`](file:///c:/Users/varad/OneDrive/Pictures/Screenshots/last%20project/supabase/migrations/20261026_init_signbridge_schema.sql) and execute the script.
4. Retrieve your **Project URL** and **Publishable/Anon API Key** from `Project Settings > API`.
5. Update your root `.env` file:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key
   ```
6. Update your `frontend/.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key
   ```
7. Restart the backend:
   ```powershell
   .\venv\Scripts\uvicorn backend.app.main:app --reload
   ```

---

## 2. Row Level Security (RLS) Policies

The migration automatically creates strict RLS policies:
- `Users can view own recognition history`: `auth.uid() = user_id OR (user_id IS NULL AND auth.role() = 'anon')`
- `Users can insert recognition history`: permits insert with corresponding user ID.
- `Users can delete own recognition history`: restricts deletion strictly to records owned by the authenticated caller.

---

## 3. Local SQLite Fallback

If you don't have Supabase credentials or are developing offline:
- Leave `SUPABASE_URL` empty in `.env`.
- SignBridge AI will automatically initialize and write records to `backend/app/database/signbridge_local.db`.
- The dashboard will display `Storage: SQLite Local` in the navigation bar.
- No paid services, Docker, or external database setup is required.
