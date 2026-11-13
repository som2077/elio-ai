-- ====================================================================
-- ✦ ELIO AI - COMPLETE AI ENGINE DATABASE SCHEMA & PGVECTOR MIGRATION
-- Run this in Supabase SQL Editor
-- ====================================================================

-- 1. ENABLE PGVECTOR EXTENSION
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. USER SUBSCRIPTIONS & ENTITLEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'lifetime'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    ai_summaries_used_this_month INT DEFAULT 0,
    subscription_status VARCHAR(20) DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON public.user_subscriptions(user_id, tier);

-- 3. VIDEO AI METADATA TABLE (Single-Pass Summaries, Lore, Entities, Fact-Check, Takeaways, Tags, Action Items)
CREATE TABLE IF NOT EXISTS public.video_ai_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.saved_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_educational BOOLEAN DEFAULT true,
    tldw TEXT,
    tldw_hinglish TEXT,
    core_premise TEXT,
    background_lore JSONB DEFAULT '{}'::jsonb,
    entities_referenced JSONB DEFAULT '[]'::jsonb,
    fact_check_nuance JSONB DEFAULT '{}'::jsonb,
    key_takeaways TEXT[] DEFAULT '{}',
    action_items JSONB DEFAULT '[]'::jsonb, -- [{ "type": "repo" | "link" | "tool" | "recipe" | "book", "title": string, "url"?: string, "subtitle"?: string }]
    primary_category TEXT,
    tags TEXT[] DEFAULT '{}',
    read_time_seconds INT DEFAULT 30,
    full_transcript TEXT,
    transcript_language VARCHAR(20) DEFAULT 'en',
    has_spoken_audio BOOLEAN DEFAULT false,
    context_breakdown JSONB DEFAULT '[]'::jsonb,
    processing_status VARCHAR(20) DEFAULT 'completed', -- 'pending' | 'completed' | 'failed' | 'skipped'
    processing_stage VARCHAR(30) DEFAULT 'queued',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_video_ai_metadata UNIQUE (video_id)
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.video_ai_metadata
    ADD COLUMN IF NOT EXISTS core_premise TEXT,
    ADD COLUMN IF NOT EXISTS tldw_hinglish TEXT,
    ADD COLUMN IF NOT EXISTS background_lore JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS entities_referenced JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fact_check_nuance JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(30) DEFAULT 'queued';

CREATE INDEX IF NOT EXISTS idx_video_ai_metadata_user ON public.video_ai_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_video_ai_metadata_video ON public.video_ai_metadata(video_id);
CREATE INDEX IF NOT EXISTS idx_video_ai_metadata_category ON public.video_ai_metadata(user_id, primary_category);

-- 4. VIDEO TRANSCRIPT CHUNKS & 1536-DIM VECTOR EMBEDDINGS (OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS public.video_transcript_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.saved_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    start_seconds INT NOT NULL,
    end_seconds INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- 1536 dimensions for OpenAI text-embedding-3-small
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video ON public.video_transcript_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user ON public.video_transcript_chunks(user_id);

-- High-performance HNSW index for OpenAI text-embedding-3-small
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_hnsw 
    ON public.video_transcript_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_ai_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Policies for user_subscriptions
DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full control subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role full control subscriptions" ON public.user_subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Policies for video_ai_metadata
DROP POLICY IF EXISTS "Users can read own video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Users can read own video AI metadata" ON public.video_ai_metadata
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Users can manage own video AI metadata" ON public.video_ai_metadata
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full control video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Service role full control video AI metadata" ON public.video_ai_metadata
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Policies for video_transcript_chunks
DROP POLICY IF EXISTS "Users can read own transcript chunks" ON public.video_transcript_chunks;
CREATE POLICY "Users can read own transcript chunks" ON public.video_transcript_chunks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full control transcript chunks" ON public.video_transcript_chunks;
CREATE POLICY "Service role full control transcript chunks" ON public.video_transcript_chunks
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. RPC: COSINE SIMILARITY SEARCH ACROSS USER'S SAVED VIDEO CHUNKS
CREATE OR REPLACE FUNCTION public.match_video_chunks(
    p_user_id UUID,
    p_embedding vector(1536),
    p_match_threshold FLOAT DEFAULT 0.65,
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
      AND (1 - (c.embedding <=> p_embedding)) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;

-- 6B. RPC: MULTI-SCOPE MATCH (Single Video or Cross-Library 'Ask Elio' Search)
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

-- 7. RPC: INCREMENT MONTHLY AI USAGE WITH AUTOMATIC FREE-TIER RESET
CREATE OR REPLACE FUNCTION public.increment_ai_summary_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub record;
    v_new_count INT;
BEGIN
    -- Check if subscription record exists
    SELECT * INTO v_sub FROM public.user_subscriptions WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        -- Auto-seed free tier user subscription
        INSERT INTO public.user_subscriptions (user_id, tier, ai_summaries_used_this_month)
        VALUES (p_user_id, 'free', 1)
        RETURNING * INTO v_sub;
        
        RETURN jsonb_build_object('tier', 'free', 'used', 1, 'allowed', true);
    END IF;

    -- Pro or lifetime members have unlimited quota
    IF v_sub.tier IN ('pro', 'lifetime') THEN
        UPDATE public.user_subscriptions 
        SET ai_summaries_used_this_month = ai_summaries_used_this_month + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        RETURN jsonb_build_object('tier', v_sub.tier, 'used', v_sub.ai_summaries_used_this_month + 1, 'allowed', true);
    END IF;

    -- Free tier quota check (10 per month)
    IF v_sub.ai_summaries_used_this_month >= 10 THEN
        RETURN jsonb_build_object('tier', 'free', 'used', v_sub.ai_summaries_used_this_month, 'allowed', false);
    END IF;

    -- Increment free usage
    UPDATE public.user_subscriptions 
    SET ai_summaries_used_this_month = ai_summaries_used_this_month + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING ai_summaries_used_this_month INTO v_new_count;

    RETURN jsonb_build_object('tier', 'free', 'used', v_new_count, 'allowed', true);
END;
$$;

-- 8. ENABLE REALTIME ON VIDEO AI METADATA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'video_ai_metadata'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_ai_metadata;
  END IF;
END $$;

-- 9. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- 10. ENCRYPTED SECRETS VAULT ACCESS (FOR EDGE FUNCTIONS)
-- Access restricted strictly to service_role to prevent secret leakage
CREATE OR REPLACE FUNCTION public.get_internal_ai_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_secret 
    FROM vault.decrypted_secrets 
    WHERE name = p_name;
    
    RETURN v_secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_internal_ai_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_internal_ai_secret(text) TO service_role, postgres;

-- 11. ENSURE UNIQUE CONSTRAINT ON SAVED_VIDEOS (IDEMPOTENT SAVES)
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

-- 12. ASYNCHRONOUS DB TRIGGER VIA pg_net FOR AUTOMATIC AI PROCESSING
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

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'http://kong:8000';
  END IF;

  -- Auto-seed pending metadata row for immediate UI realtime indicator
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
    RAISE WARNING '[Elio AI trg_saved_videos_process_ai] Trigger notice: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_saved_video_ai_process ON public.saved_videos;
CREATE TRIGGER on_saved_video_ai_process
  AFTER INSERT ON public.saved_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_saved_videos_process_ai();
