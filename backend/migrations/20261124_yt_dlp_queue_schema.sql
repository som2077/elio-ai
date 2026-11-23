-- ====================================================================
-- ✦ ELIO AI - YT-DLP EXTRACTION QUEUE & ASYNC PIPELINE SCHEMA
-- Run this in Supabase SQL Editor or Supabase CLI migrations
-- ====================================================================

-- 1. Create extraction task enum types
DO $$ BEGIN
    CREATE TYPE public.extraction_task_type AS ENUM ('metadata', 'subtitles', 'audio_whisper', 'full_pipeline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.extraction_job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'retry');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the Extraction Queue Table
CREATE TABLE IF NOT EXISTS public.video_extraction_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.saved_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clean_url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    task_type public.extraction_task_type NOT NULL DEFAULT 'full_pipeline',
    status public.extraction_job_status NOT NULL DEFAULT 'pending',
    priority INT NOT NULL DEFAULT 5, -- 10 = Pro/User on-demand, 5 = Standard Ingest, 1 = Background Refresh
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    locked_until TIMESTAMPTZ,
    locked_by TEXT,
    payload JSONB DEFAULT '{}'::jsonb, -- e.g. { "preferred_languages": ["en", "hi"], "force_whisper": false }
    result JSONB DEFAULT '{}'::jsonb,  -- Result metadata, subtitle count, or audio stats
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid polling, priority dequeue, and video tracking
CREATE INDEX IF NOT EXISTS idx_extraction_queue_dequeue 
    ON public.video_extraction_queue(status, priority DESC, created_at ASC)
    WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_extraction_queue_video 
    ON public.video_extraction_queue(video_id);

CREATE INDEX IF NOT EXISTS idx_extraction_queue_user 
    ON public.video_extraction_queue(user_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.video_extraction_queue ENABLE ROW LEVEL SECURITY;

-- Users can view status of their own extraction jobs
DO $$ BEGIN
    CREATE POLICY "Users can view own extraction jobs"
        ON public.video_extraction_queue
        FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Service role full access
DO $$ BEGIN
    CREATE POLICY "Service role full access on extraction queue"
        ON public.video_extraction_queue
        FOR ALL
        USING (auth.role() = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Atomic Dequeue Function (Skip Locked for high-concurrency workers)
CREATE OR REPLACE FUNCTION public.dequeue_extraction_job(
    p_worker_id TEXT,
    p_lock_duration_seconds INT DEFAULT 300
)
RETURNS TABLE (
    job_id UUID,
    job_video_id UUID,
    job_user_id UUID,
    job_clean_url TEXT,
    job_platform VARCHAR(50),
    job_task_type public.extraction_task_type,
    job_payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH target_job AS (
        SELECT id
        FROM public.video_extraction_queue
        WHERE (status = 'pending' OR (status = 'retry' AND attempts < max_attempts))
          AND (locked_until IS NULL OR locked_until < NOW())
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.video_extraction_queue q
    SET 
        status = 'processing',
        locked_by = p_worker_id,
        locked_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
        started_at = COALESCE(q.started_at, NOW()),
        attempts = q.attempts + 1,
        updated_at = NOW()
    FROM target_job
    WHERE q.id = target_job.id
    RETURNING 
        q.id,
        q.video_id,
        q.user_id,
        q.clean_url,
        q.platform,
        q.task_type,
        q.payload;
END;
$$;

-- 5. Webhook Notification Trigger for Instant Processing
CREATE OR REPLACE FUNCTION public.notify_new_extraction_job()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.priority >= 8 AND NEW.status = 'pending' THEN
        PERFORM pg_notify('new_extraction_job', json_build_object(
            'job_id', NEW.id,
            'video_id', NEW.video_id,
            'task_type', NEW.task_type,
            'url', NEW.clean_url
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_new_extraction_job ON public.video_extraction_queue;
CREATE TRIGGER trg_notify_new_extraction_job
    AFTER INSERT ON public.video_extraction_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_extraction_job();
