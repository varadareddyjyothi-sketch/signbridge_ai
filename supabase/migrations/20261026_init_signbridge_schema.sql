-- ==============================================================================
-- SignBridge AI - Supabase Database Migration
-- Tables: profiles, recognition_history
-- Features: Foreign keys, Indexes, Row Level Security (RLS) & Policies
-- ==============================================================================

-- 1. Create Profiles Table (links with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create Recognition History Table
CREATE TABLE IF NOT EXISTS public.recognition_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable for anonymous/demo sessions
    predicted_label TEXT NOT NULL,
    english_meaning TEXT NOT NULL,
    confidence NUMERIC(5, 4), -- e.g. 0.9825
    recognition_mode TEXT NOT NULL DEFAULT 'static_isl',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_recognition_history_user_id ON public.recognition_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recognition_history_created_at ON public.recognition_history(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_history ENABLE ROW LEVEL SECURITY;

-- 5. Profiles RLS Policies:
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- 6. Recognition History RLS Policies:
-- Authenticated users can view their own history; anonymous can view unassigned demo history
CREATE POLICY "Users can view own recognition history"
    ON public.recognition_history
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND auth.role() = 'anon')
    );

-- Authenticated users can insert their own recognition history; anon can insert demo records
CREATE POLICY "Users can insert recognition history"
    ON public.recognition_history
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR (user_id IS NULL AND auth.role() = 'anon')
    );

-- Users can delete their own history records
CREATE POLICY "Users can delete own recognition history"
    ON public.recognition_history
    FOR DELETE
    USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND auth.role() = 'anon')
    );

-- 7. Trigger to auto-create public.profiles upon auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, created_at)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', timezone('utc'::text, now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
