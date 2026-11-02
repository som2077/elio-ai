-- ====================================================================
-- ✦ ELIO AI - ALLOW ALL SOCIAL PLATFORMS (Twitter, Facebook, etc.)
-- Run this in Supabase SQL Editor
-- ====================================================================

-- Change platform column from strict ENUM to flexible VARCHAR/TEXT
ALTER TABLE public.saved_videos ALTER COLUMN platform TYPE VARCHAR(50);

-- Change category column to flexible VARCHAR/TEXT
ALTER TABLE public.saved_videos ALTER COLUMN category TYPE VARCHAR(50);

-- Reload PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
