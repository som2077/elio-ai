-- ====================================================================
-- ✦ ELIO AI - COMPLETE DATABASE SCHEMA & AUTH QR EXTENSION LINKING
-- Run this in Supabase SQL Editor
-- ====================================================================

-- 1. SAVED VIDEOS TABLE (If not already created)
CREATE TABLE IF NOT EXISTS public.saved_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'video',
    original_url TEXT NOT NULL,
    clean_url TEXT NOT NULL,
    platform_video_id TEXT,
    title TEXT,
    creator_name TEXT,
    creator_avatar_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INT,
    status VARCHAR(20) DEFAULT 'unread',
    is_favorite BOOLEAN DEFAULT false,
    user_notes TEXT,
    tags TEXT[] DEFAULT '{}',
    source_client VARCHAR(30) DEFAULT 'browser_extension',
    device_id UUID,
    source_device_name TEXT,
    remind_at TIMESTAMPTZ,
    watched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure new columns exist on saved_videos even if table already existed
ALTER TABLE public.saved_videos ADD COLUMN IF NOT EXISTS device_id UUID;
ALTER TABLE public.saved_videos ADD COLUMN IF NOT EXISTS source_device_name TEXT;

-- Indices for saved_videos
CREATE INDEX IF NOT EXISTS idx_saved_videos_user_status ON public.saved_videos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_saved_videos_clean_url ON public.saved_videos(user_id, clean_url);
CREATE INDEX IF NOT EXISTS idx_saved_videos_created ON public.saved_videos(created_at DESC);

-- 2. QR AUTH SESSIONS TABLE (Cross-Device Mobile <-> Extension Linking)
CREATE TABLE IF NOT EXISTS public.qr_auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_token TEXT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'expired'
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    auth_payload JSONB, -- { access_token, refresh_token, user_id, email }
    device_metadata JSONB, -- { device_id, device_name, browser_type, os_name }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Ensure device_metadata column exists even if table already existed
ALTER TABLE public.qr_auth_sessions ADD COLUMN IF NOT EXISTS device_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_qr_auth_sessions_token ON public.qr_auth_sessions(qr_token);

-- 3. LINKED DEVICES REGISTRY (Multi-Device Management & Revocation)
CREATE TABLE IF NOT EXISTS public.linked_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    device_name TEXT NOT NULL,
    browser_type VARCHAR(50) NOT NULL,
    os_name VARCHAR(50) NOT NULL,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_devices_user ON public.linked_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_devices_lookup ON public.linked_devices(user_id, device_id);

-- 4. ENABLE SUPABASE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'qr_auth_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_auth_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'saved_videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_videos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'linked_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.linked_devices;
  END IF;
END $$;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.saved_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_devices ENABLE ROW LEVEL SECURITY;

-- Policies for saved_videos
DROP POLICY IF EXISTS "Users can only access their own saved videos" ON public.saved_videos;
CREATE POLICY "Users can only access their own saved videos" ON public.saved_videos
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public insert to saved_videos" ON public.saved_videos;
DROP POLICY IF EXISTS "Allow extension insert with valid user_id" ON public.saved_videos;
CREATE POLICY "Allow extension insert with valid user_id" ON public.saved_videos
    FOR INSERT TO public
    WITH CHECK (user_id IS NOT NULL);

-- Policies for linked_devices
DROP POLICY IF EXISTS "Users can manage their own linked devices" ON public.linked_devices;
CREATE POLICY "Users can manage their own linked devices" ON public.linked_devices
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public read linked devices" ON public.linked_devices;
CREATE POLICY "Allow public read linked devices" ON public.linked_devices
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Allow public upsert linked devices" ON public.linked_devices;
CREATE POLICY "Allow public upsert linked devices" ON public.linked_devices
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update linked devices" ON public.linked_devices;
CREATE POLICY "Allow public update linked devices" ON public.linked_devices
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- Policies for qr_auth_sessions (Public access so extension anon can read/write and mobile auth can approve)
DROP POLICY IF EXISTS "Allow anon insert qr session" ON public.qr_auth_sessions;
DROP POLICY IF EXISTS "Allow insert qr session" ON public.qr_auth_sessions;
CREATE POLICY "Allow insert qr session" ON public.qr_auth_sessions
    FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read qr session" ON public.qr_auth_sessions;
DROP POLICY IF EXISTS "Allow read qr session" ON public.qr_auth_sessions;
CREATE POLICY "Allow read qr session" ON public.qr_auth_sessions
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow auth update qr session" ON public.qr_auth_sessions;
DROP POLICY IF EXISTS "Allow update qr session" ON public.qr_auth_sessions;
CREATE POLICY "Allow update qr session" ON public.qr_auth_sessions
    FOR UPDATE TO public USING (true) WITH CHECK (true);

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
