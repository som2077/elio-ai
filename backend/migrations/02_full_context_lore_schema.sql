-- ====================================================================
-- ✦ ELIO AI - FULL CONTEXT & DEEP LORE SCHEMA MIGRATION
-- Migration: 02_full_context_lore_schema.sql
-- Run this in Supabase SQL Editor or via Supabase MCP
--
-- 1. Rich context columns to public.video_ai_metadata:
--    - core_premise (TEXT)
--    - background_lore (JSONB)
--    - entities_referenced (JSONB)
--    - fact_check_nuance (JSONB)
--    - processing_stage (VARCHAR(30))
--    - full_transcript (TEXT)
--    - transcript_language (VARCHAR(10))
--    - has_spoken_audio (BOOLEAN)
--    - context_breakdown (JSONB)
-- 2. Safe deduplication & Unique constraint on saved_videos (user_id, clean_url)
-- 3. HNSW vector index on video_transcript_chunks
-- 4. Multi-scope RPC function: match_video_chunks_v2
-- 5. pg_net asynchronous background trigger on saved_videos INSERT
-- ====================================================================

-- 1. ADD FULL CONTEXT & AUDIO INTELLIGENCE COLUMNS TO video_ai_metadata
ALTER TABLE public.video_ai_metadata
    ADD COLUMN IF NOT EXISTS full_transcript TEXT,
    ADD COLUMN IF NOT EXISTS transcript_language VARCHAR(10) DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS has_spoken_audio BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS context_breakdown JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS core_premise TEXT,
    ADD COLUMN IF NOT EXISTS background_lore JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS entities_referenced JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fact_check_nuance JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(30) DEFAULT 'queued',
    DROP COLUMN IF EXISTS tldw_hinglish;

-- Update documentation comments
COMMENT ON COLUMN public.video_ai_metadata.core_premise IS 'Underlying thesis or fundamental problem addressed in the video.';
COMMENT ON COLUMN public.video_ai_metadata.background_lore IS 'Deep contextual backstory, historical context, industry impact, and prerequisites.';
COMMENT ON COLUMN public.video_ai_metadata.entities_referenced IS 'Extracted knowledge graph of tools, repos, people, papers, books mentioned.';
COMMENT ON COLUMN public.video_ai_metadata.fact_check_nuance IS 'Fact-check verdict, hidden trade-offs, and critical nuances omitted in the video.';
COMMENT ON COLUMN public.video_ai_metadata.processing_stage IS 'Granular pipeline progress: queued | scraping_metadata | transcribing | generating_context | completed | failed | skipped';

-- 2. SAFE DEDUPLICATION AND STRICT IDEMPOTENCY ON saved_videos
WITH ranked_duplicates AS (
    SELECT 
        v.id,
        ROW_NUMBER() OVER (
            PARTITION BY v.user_id, v.clean_url 
            ORDER BY 
                (SELECT COUNT(*) FROM public.video_ai_metadata m WHERE m.video_id = v.id) DESC,
                (SELECT COUNT(*) FROM public.video_transcript_chunks c WHERE c.video_id = v.id) DESC,
                v.created_at DESC
        ) AS rank
    FROM public.saved_videos v
    WHERE (v.user_id, v.clean_url) IN (
        SELECT user_id, clean_url 
        FROM public.saved_videos 
        GROUP BY user_id, clean_url 
        HAVING COUNT(*) > 1
    )
)
DELETE FROM public.saved_videos
WHERE id IN (
    SELECT id FROM ranked_duplicates WHERE rank > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_clean_url'
  ) THEN
    ALTER TABLE public.saved_videos ADD CONSTRAINT unique_user_clean_url UNIQUE (user_id, clean_url);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

-- 3. HIGH-PERFORMANCE HNSW VECTOR INDEX (1536-dim OpenAI text-embedding-3-small)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_hnsw 
    ON public.video_transcript_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 4. MULTI-SCOPE SEMANTIC VECTOR MATCH RPC (Scoped to 1 video or cross-library)
CREATE OR REPLACE FUNCTION public.match_video_chunks_v2(
    p_user_id UUID,
    p_embedding vector(1536),
    p_video_id UUID DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.60,
    p_match_count INT DEFAULT 6
)
RETURNS TABLE (
    chunk_id UUID,
    video_id UUID,
    title TEXT,
    clean_url TEXT,
    platform VARCHAR(50),
    thumbnail_url TEXT,
    start_seconds INT,
    end_seconds INT,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.video_id,
        v.title,
        v.clean_url,
        v.platform,
        v.thumbnail_url,
        c.start_seconds,
        c.end_seconds,
        c.chunk_text,
        (1 - (c.embedding <=> p_embedding))::FLOAT AS similarity
    FROM public.video_transcript_chunks c
    JOIN public.saved_videos v ON v.id = c.video_id
    WHERE c.user_id = p_user_id
      AND (p_video_id IS NULL OR c.video_id = p_video_id)
      AND (1 - (c.embedding <=> p_embedding)) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_video_chunks_v2(UUID, vector, UUID, FLOAT, INT) TO authenticated, service_role;

-- 5. ASYNCHRONOUS DB TRIGGER VIA pg_net FOR AUTOMATIC AI PROCESSING
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

CREATE OR REPLACE FUNCTION public.trg_saved_videos_process_ai()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
BEGIN
  -- Retrieve internal Supabase credentials from vault or postgres settings
  SELECT decrypted_secret INTO v_supabase_url 
  FROM vault.decrypted_secrets WHERE name = 'INTERNAL_SUPABASE_URL';
  
  SELECT decrypted_secret INTO v_service_key 
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    v_service_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Default cloud URL fallback if setting not defined
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'http://kong:8000';
  END IF;

  -- Auto-seed pending metadata row for realtime client UI
  INSERT INTO public.video_ai_metadata (
    video_id,
    user_id,
    processing_status,
    processing_stage,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    'pending',
    'queued',
    NOW(),
    NOW()
  ) ON CONFLICT (video_id) DO NOTHING;

  -- Build edge function invocation payload
  v_payload := jsonb_build_object(
    'video_id', NEW.id,
    'user_id', NEW.user_id,
    'platform', NEW.platform,
    'clean_url', NEW.clean_url,
    'original_url', NEW.original_url,
    'title', NEW.title,
    'creator_name', NEW.creator_name,
    'user_notes', NEW.user_notes
  );

  -- Dispatch async HTTP POST to edge function (< 5ms non-blocking commit)
  IF v_service_key IS NOT NULL AND v_service_key <> '' THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/process-video-ai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'X-Trigger-Source', 'pg_net_insert'
      ),
      body := v_payload,
      timeout_milliseconds := 45000
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Suppress trigger exceptions so user's video save is never blocked
    RAISE WARNING '[Elio AI trg_saved_videos_process_ai] Trigger notice: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_saved_video_ai_process ON public.saved_videos;
CREATE TRIGGER on_saved_video_ai_process
  AFTER INSERT ON public.saved_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_saved_videos_process_ai();

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
