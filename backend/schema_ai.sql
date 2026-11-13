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
    ADD COLUMN IF NOT EXISTS background_lore JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS entities_referenced JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fact_check_nuance JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(30) DEFAULT 'queued',
    DROP COLUMN IF EXISTS tldw_hinglish;

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

-- 5. ROW LEVEL SECURITY (RLS) POLICIES & ACCESS HARDENING
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_ai_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Revoke direct write access on sensitive tables from client roles
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.video_ai_metadata FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.video_transcript_chunks FROM anon, authenticated;

-- Policies for user_subscriptions (SELECT only for owner)
DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full control subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role full control subscriptions" ON public.user_subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Policies for video_ai_metadata (Strict SELECT only for owner; mutations through service_role)
DROP POLICY IF EXISTS "Users can manage own video AI metadata" ON public.video_ai_metadata;
DROP POLICY IF EXISTS "Users can read own video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Users can read own video AI metadata" ON public.video_ai_metadata
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

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

-- 7. RPC: INCREMENT / DEDUCT MONTHLY AI USAGE WITH ROW-LEVEL LOCKING
CREATE OR REPLACE FUNCTION public.deduct_ai_summary_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
    v_new_count INT;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: User ID mismatch';
    END IF;

    -- Row-level lock prevents race conditions and concurrent quota bypass
    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-seed free tier user subscription
        INSERT INTO public.user_subscriptions (
            user_id,
            tier,
            ai_summaries_used_this_month,
            subscription_status,
            created_at,
            updated_at
        )
        VALUES (p_user_id, 'free', 1, 'active', NOW(), NOW())
        RETURNING * INTO v_sub;

        RETURN jsonb_build_object(
            'allowed', true,
            'tier', 'free',
            'used', 1,
            'remaining', 9,
            'monthlyLimit', 10
        );
    END IF;

    -- Pro and Lifetime subscribers have unlimited summaries
    IF v_sub.tier IN ('pro', 'lifetime') THEN
        UPDATE public.user_subscriptions
        SET ai_summaries_used_this_month = ai_summaries_used_this_month + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object(
            'allowed', true,
            'tier', v_sub.tier,
            'used', v_sub.ai_summaries_used_this_month + 1,
            'remaining', -1,
            'monthlyLimit', -1
        );
    END IF;

    -- Free tier quota check (10 per month)
    IF v_sub.ai_summaries_used_this_month >= 10 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'tier', 'free',
            'used', v_sub.ai_summaries_used_this_month,
            'remaining', 0,
            'monthlyLimit', 10,
            'error', 'monthly_limit_reached'
        );
    END IF;

    -- Increment quota under row lock
    UPDATE public.user_subscriptions
    SET ai_summaries_used_this_month = ai_summaries_used_this_month + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING ai_summaries_used_this_month INTO v_new_count;

    RETURN jsonb_build_object(
        'allowed', true,
        'tier', 'free',
        'used', v_new_count,
        'remaining', 10 - v_new_count,
        'monthlyLimit', 10
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_ai_summary_quota(UUID) TO authenticated, service_role;

-- Backward-compatible alias for increment_ai_summary_usage
CREATE OR REPLACE FUNCTION public.increment_ai_summary_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.deduct_ai_summary_quota(p_user_id);
END;
$$;

-- 7B. RPC: BACKEND-DRIVEN PRE-COMPUTED FEED VIEWMODEL
CREATE OR REPLACE FUNCTION public.get_user_feed_v1(
    p_user_id UUID,
    p_platform TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_videos JSONB := '[]'::jsonb;
    v_total_count INT := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized user access';
    END IF;

    -- Compute total matching count
    SELECT COUNT(*)::INT INTO v_total_count
    FROM public.saved_videos v
    WHERE v.user_id = p_user_id
      AND (p_platform IS NULL OR p_platform = 'all' OR v.platform = LOWER(p_platform))
      AND (
          p_status IS NULL OR p_status = 'all' OR
          (p_status = 'favorite' AND v.is_favorite = true) OR
          (p_status <> 'favorite' AND v.status = p_status)
      );

    -- Fetch videos joined with video_ai_metadata
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'user_id', v.user_id,
                'platform', v.platform,
                'category', v.category,
                'original_url', v.original_url,
                'clean_url', v.clean_url,
                'platform_video_id', v.platform_video_id,
                'title', v.title,
                'creator_name', v.creator_name,
                'creator_avatar_url', v.creator_avatar_url,
                'thumbnail_url', v.thumbnail_url,
                'duration_seconds', v.duration_seconds,
                'status', v.status,
                'is_favorite', v.is_favorite,
                'user_notes', v.user_notes,
                'tags', v.tags,
                'source_client', v.source_client,
                'device_id', v.device_id,
                'source_device_name', v.source_device_name,
                'remind_at', v.remind_at,
                'watched_at', v.watched_at,
                'created_at', v.created_at,
                'updated_at', v.updated_at,
                'ai_metadata', CASE WHEN a.id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', a.id,
                        'video_id', a.video_id,
                        'user_id', a.user_id,
                        'is_educational', a.is_educational,
                        'tldw', a.tldw,
                        'tldw_hinglish', a.tldw_hinglish,
                        'core_premise', a.core_premise,
                        'background_lore', a.background_lore,
                        'entities_referenced', a.entities_referenced,
                        'fact_check_nuance', a.fact_check_nuance,
                        'key_takeaways', a.key_takeaways,
                        'action_items', a.action_items,
                        'primary_category', a.primary_category,
                        'tags', a.tags,
                        'read_time_seconds', a.read_time_seconds,
                        'full_transcript', a.full_transcript,
                        'transcript_language', a.transcript_language,
                        'has_spoken_audio', a.has_spoken_audio,
                        'context_breakdown', a.context_breakdown,
                        'processing_status', a.processing_status,
                        'processing_stage', a.processing_stage,
                        'error_message', a.error_message,
                        'created_at', a.created_at,
                        'updated_at', a.updated_at
                    )
                ELSE NULL END
            )
            ORDER BY v.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_videos
    FROM (
        SELECT *
        FROM public.saved_videos
        WHERE user_id = p_user_id
          AND (p_platform IS NULL OR p_platform = 'all' OR platform = LOWER(p_platform))
          AND (
              p_status IS NULL OR p_status = 'all' OR
              (p_status = 'favorite' AND is_favorite = true) OR
              (p_status <> 'favorite' AND status = p_status)
          )
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) v
    LEFT JOIN public.video_ai_metadata a ON a.video_id = v.id;

    RETURN jsonb_build_object(
        'videos', v_videos,
        'totalCount', v_total_count,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_feed_v1(UUID, TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 7C. RPC: PRE-COMPUTED INSIGHTS VIEWMODEL
CREATE OR REPLACE FUNCTION public.get_user_insights_v1(
    p_user_id UUID,
    p_time_range TEXT DEFAULT '7d'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_days INT;
    v_cutoff TIMESTAMPTZ;
    v_total_saved INT := 0;
    v_watched INT := 0;
    v_in_queue INT := 0;
    v_favorites INT := 0;
    v_completion_rate INT := 0;
    v_daily_points JSONB := '[]'::jsonb;
    v_platform_stats JSONB := '[]'::jsonb;
    v_heatmap_matrix JSONB := '[]'::jsonb;
    v_active_streak INT := 0;
    v_best_streak INT := 0;
    v_sub RECORD;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized user access';
    END IF;

    IF p_time_range = '14d' THEN
        v_days := 14;
    ELSIF p_time_range = '30d' THEN
        v_days := 30;
    ELSIF p_time_range = 'all' THEN
        v_days := 365;
    ELSE
        v_days := 7;
    END IF;

    v_cutoff := NOW() - (v_days || ' days')::INTERVAL;

    -- Aggregate metrics for user in range
    SELECT
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE status = 'watched')::INT,
        COUNT(*) FILTER (WHERE status = 'unread' OR status IS NULL)::INT,
        COUNT(*) FILTER (WHERE is_favorite = true)::INT
    INTO
        v_total_saved,
        v_watched,
        v_in_queue,
        v_favorites
    FROM public.saved_videos
    WHERE user_id = p_user_id
      AND (p_time_range = 'all' OR created_at >= v_cutoff);

    IF v_total_saved > 0 THEN
        v_completion_rate := ROUND((v_watched::FLOAT / v_total_saved::FLOAT) * 100)::INT;
    ELSE
        v_completion_rate := 0;
    END IF;

    -- Daily points (for the last v_days)
    WITH date_series AS (
        SELECT generate_series(
            (CURRENT_DATE - (v_days - 1) * INTERVAL '1 day')::DATE,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE AS d
    ),
    daily_aggregates AS (
        SELECT
            ds.d,
            to_char(ds.d, 'YYYY-MM-DD') AS date_key,
            to_char(ds.d, CASE WHEN v_days = 7 THEN 'Dy' ELSE 'DD Mon' END) AS display_date,
            COALESCE(COUNT(v.id) FILTER (WHERE (v.created_at AT TIME ZONE 'UTC')::DATE = ds.d), 0)::INT AS saved_count,
            COALESCE(COUNT(v.id) FILTER (WHERE v.status = 'watched' AND (COALESCE(v.watched_at, v.updated_at, v.created_at) AT TIME ZONE 'UTC')::DATE = ds.d), 0)::INT AS watched_count
        FROM date_series ds
        LEFT JOIN public.saved_videos v ON v.user_id = p_user_id AND (
            (v.created_at AT TIME ZONE 'UTC')::DATE = ds.d OR
            (v.status = 'watched' AND (COALESCE(v.watched_at, v.updated_at, v.created_at) AT TIME ZONE 'UTC')::DATE = ds.d)
        )
        GROUP BY ds.d
        ORDER BY ds.d ASC
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'dateKey', date_key,
            'displayDate', display_date,
            'saved', saved_count,
            'watched', watched_count
        )
    ) INTO v_daily_points
    FROM daily_aggregates;

    -- Platform breakdown stats
    WITH platform_counts AS (
        SELECT
            LOWER(CASE WHEN platform = 'twitter' THEN 'x' ELSE platform END) AS p_key,
            COUNT(*)::INT AS p_count
        FROM public.saved_videos
        WHERE user_id = p_user_id
          AND (p_time_range = 'all' OR created_at >= v_cutoff)
          AND platform IS NOT NULL
        GROUP BY 1
    ),
    platform_total AS (
        SELECT COALESCE(SUM(p_count), 0)::INT AS total FROM platform_counts
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'key', pc.p_key,
                'count', pc.p_count,
                'pct', CASE WHEN pt.total > 0 THEN ROUND((pc.p_count::FLOAT / pt.total::FLOAT) * 100)::INT ELSE 0 END,
                'label', CASE
                    WHEN pc.p_key = 'youtube' THEN 'YouTube'
                    WHEN pc.p_key = 'instagram' THEN 'Instagram'
                    WHEN pc.p_key = 'x' OR pc.p_key = 'twitter' THEN 'Twitter / 𝕏'
                    WHEN pc.p_key = 'tiktok' THEN 'TikTok'
                    WHEN pc.p_key = 'reddit' THEN 'Reddit'
                    WHEN pc.p_key = 'linkedin' THEN 'LinkedIn'
                    ELSE INITCAP(pc.p_key)
                END,
                'color', CASE
                    WHEN pc.p_key = 'youtube' THEN '#FF0000'
                    WHEN pc.p_key = 'instagram' THEN '#E1306C'
                    WHEN pc.p_key = 'x' OR pc.p_key = 'twitter' THEN '#FFFFFF'
                    WHEN pc.p_key = 'tiktok' THEN '#00F2FE'
                    WHEN pc.p_key = 'reddit' THEN '#FF4500'
                    WHEN pc.p_key = 'linkedin' THEN '#0A66C2'
                    ELSE '#8E8E93'
                END
            ) ORDER BY pc.p_count DESC
        ),
        '[]'::jsonb
    ) INTO v_platform_stats
    FROM platform_counts pc, platform_total pt;

    -- 28-day Heatmap Matrix (4 weeks)
    WITH heatmap_dates AS (
        SELECT generate_series(
            (CURRENT_DATE - INTERVAL '27 days')::DATE,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE AS d
    ),
    heatmap_counts AS (
        SELECT
            hd.d,
            to_char(hd.d, 'YYYY-MM-DD') AS date_key,
            COALESCE(COUNT(v.id), 0)::INT AS activity_count
        FROM heatmap_dates hd
        LEFT JOIN public.saved_videos v ON v.user_id = p_user_id AND (v.created_at AT TIME ZONE 'UTC')::DATE = hd.d
        GROUP BY hd.d
        ORDER BY hd.d ASC
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'dateKey', date_key,
            'count', activity_count,
            'level', CASE
                WHEN activity_count = 0 THEN 0
                WHEN activity_count <= 2 THEN 1
                WHEN activity_count <= 4 THEN 2
                WHEN activity_count <= 7 THEN 3
                ELSE 4
            END
        )
    ) INTO v_heatmap_matrix
    FROM heatmap_counts;

    -- Streaks calculation
    WITH distinct_activity_days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::DATE AS act_date
        FROM public.saved_videos
        WHERE user_id = p_user_id
        ORDER BY act_date DESC
    ),
    streak_groups AS (
        SELECT
            act_date,
            act_date - (ROW_NUMBER() OVER (ORDER BY act_date DESC))::INT * INTERVAL '1 day' AS grp
        FROM distinct_activity_days
    ),
    streak_lengths AS (
        SELECT
            grp,
            COUNT(*)::INT AS streak_len,
            MAX(act_date) AS max_date
        FROM streak_groups
        GROUP BY grp
    )
    SELECT
        COALESCE(MAX(streak_len), 0)::INT,
        COALESCE(MAX(CASE WHEN max_date >= CURRENT_DATE - INTERVAL '1 day' THEN streak_len ELSE 0 END), 0)::INT
    INTO v_best_streak, v_active_streak
    FROM streak_lengths;

    -- Subscription quota lookup
    SELECT * INTO v_sub FROM public.user_subscriptions WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'metrics', jsonb_build_object(
            'totalSaved', v_total_saved,
            'watched', v_watched,
            'inQueue', v_in_queue,
            'favorites', v_favorites,
            'completionRate', v_completion_rate
        ),
        'dailyPoints', COALESCE(v_daily_points, '[]'::jsonb),
        'platformStats', COALESCE(v_platform_stats, '[]'::jsonb),
        'heatmapMatrix', COALESCE(v_heatmap_matrix, '[]'::jsonb),
        'streaks', jsonb_build_object(
            'currentStreak', v_active_streak,
            'bestStreak', v_best_streak
        ),
        'subscription', jsonb_build_object(
            'tier', COALESCE(v_sub.tier, 'free'),
            'usedThisMonth', COALESCE(v_sub.ai_summaries_used_this_month, 0),
            'monthlyLimit', CASE WHEN v_sub.tier IN ('pro', 'lifetime') THEN -1 ELSE 10 END
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_insights_v1(UUID, TEXT) TO authenticated, service_role;

-- 7D. RPC: AUTHENTICATED STATE MUTATION DISPATCHER
CREATE OR REPLACE FUNCTION public.dispatch_video_action(
    p_user_id UUID,
    p_action_type TEXT,
    p_video_id UUID,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_video RECORD;
    v_new_status TEXT;
    v_new_fav BOOLEAN;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: User ID mismatch';
    END IF;

    -- Verify video belongs to user
    SELECT * INTO v_video 
    FROM public.saved_videos 
    WHERE id = p_video_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Video not found or access denied');
    END IF;

    CASE p_action_type
        WHEN 'toggle_status' THEN
            IF p_payload ? 'status' THEN
                v_new_status := p_payload->>'status';
            ELSE
                v_new_status := CASE WHEN v_video.status = 'unread' THEN 'watched' ELSE 'unread' END;
            END IF;

            UPDATE public.saved_videos
            SET status = v_new_status,
                watched_at = CASE WHEN v_new_status = 'watched' THEN NOW() ELSE NULL END,
                updated_at = NOW()
            WHERE id = p_video_id AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'toggle_status',
                'video_id', p_video_id,
                'status', v_new_status
            );

        WHEN 'toggle_favorite' THEN
            IF p_payload ? 'is_favorite' THEN
                v_new_fav := (p_payload->>'is_favorite')::BOOLEAN;
            ELSE
                v_new_fav := NOT COALESCE(v_video.is_favorite, false);
            END IF;

            UPDATE public.saved_videos
            SET is_favorite = v_new_fav,
                updated_at = NOW()
            WHERE id = p_video_id AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'toggle_favorite',
                'video_id', p_video_id,
                'is_favorite', v_new_fav
            );

        WHEN 'delete' THEN
            DELETE FROM public.saved_videos
            WHERE id = p_video_id AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'delete',
                'video_id', p_video_id
            );

        WHEN 'update_notes' THEN
            UPDATE public.saved_videos
            SET user_notes = p_payload->>'notes',
                updated_at = NOW()
            WHERE id = p_video_id AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'update_notes',
                'video_id', p_video_id,
                'user_notes', p_payload->>'notes'
            );

        WHEN 'update_title' THEN
            UPDATE public.saved_videos
            SET title = p_payload->>'title',
                updated_at = NOW()
            WHERE id = p_video_id AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'update_title',
                'video_id', p_video_id,
                'title', p_payload->>'title'
            );

        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Unsupported action type: ' || p_action_type);
    END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_video_action(UUID, TEXT, UUID, JSONB) TO authenticated, service_role;

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
