-- ====================================================================
-- ✦ ELIO AI - SECURITY HARDENING & BACKEND-DRIVEN RPC ARCHITECTURE
-- Migration: 03_security_hardening_rpc.sql
-- Run this in Supabase SQL Editor
--
-- Deliverables:
-- 1. deduct_ai_summary_quota(p_user_id UUID): Atomic row-level lock (FOR UPDATE)
-- 2. get_user_feed_v1(p_user_id, p_platform, p_status, p_limit, p_offset): Pre-computed, pre-filtered FeedViewModel
-- 3. get_user_insights_v1(p_user_id, p_time_range): Pre-computed InsightsViewModel (KPIs, daily activity, platform stats, streaks, 28-day heatmap)
-- 4. dispatch_video_action(p_user_id, p_action_type, p_video_id, p_payload): Authenticated state mutations with auth.uid() enforcement
-- 5. Revocation of direct client write access on user_subscriptions and video_ai_metadata
-- ====================================================================

-- 1. ATOMIC AI QUOTA DEDUCTION WITH ROW-LEVEL LOCKING
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
    -- Strict security: Caller must match requested user_id unless service_role
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

-- 2. BACKEND-DRIVEN PRE-COMPUTED FEED VIEWMODEL RPC
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

-- 3. PRE-COMPUTED INSIGHTS VIEWMODEL RPC
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

-- 4. AUTHENTICATED STATE MUTATION DISPATCHER
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

        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Unsupported action type: ' || p_action_type);
    END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_video_action(UUID, TEXT, UUID, JSONB) TO authenticated, service_role;

-- 5. REVOKE DIRECT CLIENT WRITE ACCESS ON SENSITIVE TABLES
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.video_ai_metadata FROM anon, authenticated;

-- Ensure RLS is active
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_ai_metadata ENABLE ROW LEVEL SECURITY;

-- Drop unsafe write policies
DROP POLICY IF EXISTS "Users can manage own video AI metadata" ON public.video_ai_metadata;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- Strict SELECT-only policies for authenticated owners
DROP POLICY IF EXISTS "Users can read own video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Users can read own video AI metadata" ON public.video_ai_metadata
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Service role retains full administrative control
DROP POLICY IF EXISTS "Service role full control subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role full control subscriptions" ON public.user_subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full control video AI metadata" ON public.video_ai_metadata;
CREATE POLICY "Service role full control video AI metadata" ON public.video_ai_metadata
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
