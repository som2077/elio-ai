-- ====================================================================
-- ✦ ELIO AI - VIDEO SPEECH & DEEP CONTEXT SCHEMA MIGRATION
-- Adds full transcript storage, spoken language, and structured context breakdown
-- ====================================================================

-- 1. Add speech and deep context columns to video_ai_metadata
ALTER TABLE public.video_ai_metadata 
    ADD COLUMN IF NOT EXISTS full_transcript TEXT,
    ADD COLUMN IF NOT EXISTS transcript_language VARCHAR(20) DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS has_spoken_audio BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS context_breakdown JSONB DEFAULT '[]'::jsonb;

-- 2. Add full-text search index on full_transcript for ultra-fast keyword searches
CREATE INDEX IF NOT EXISTS idx_video_ai_metadata_transcript_fts 
    ON public.video_ai_metadata 
    USING gin(to_tsvector('english', coalesce(full_transcript, '')));

-- 3. Update comments
COMMENT ON COLUMN public.video_ai_metadata.full_transcript IS 'Full spoken dialog/subtitles extracted from video audio or captions.';
COMMENT ON COLUMN public.video_ai_metadata.context_breakdown IS 'Timestamped chronological breakdown of topics, tutorial steps, or arguments spoken.';
COMMENT ON COLUMN public.video_ai_metadata.has_spoken_audio IS 'True if audio was transcribed using Whisper/speech model.';
