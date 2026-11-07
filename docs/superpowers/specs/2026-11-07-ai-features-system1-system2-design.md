# Elio AI - Complete OpenAI-Native AI Engine & Monetization Specification

**Date:** 2026-11-08  
**Architecture:** OpenAI All-in-One Engine (`gpt-4o-mini` + `text-embedding-3-small` + `whisper-1`) + Supabase `pgvector`  
**Business Model:** Cross-Platform Freemium SaaS (Stripe 97% margin on Web/Extension + RevenueCat on Mobile)  
**Status:** Approved & Finalized

---

## 1. Executive Summary & Core Philosophy

Elio AI transforms from a standard video bookmarking tool into an intelligent **"Second Brain for Video & Social Media"**.

### Key Technical Decisions:

1. **Single-Vendor Reliability (OpenAI All-in-One):**
   - Instead of managing multiple API keys across different providers, the entire AI pipeline runs on **1 single `OPENAI_API_KEY`**:
     - **Language & Reasoning:** `gpt-4o-mini` (Strict JSON Schema output, 0% formatting errors).
     - **Semantic Vector Search:** `text-embedding-3-small` (Industry standard 1536-dimensional embeddings).
     - **Speech-to-Text Fallback:** `whisper-1` (Executed **on-demand** for Reels/TikToks lacking closed captions).
2. **Cost-Efficiency & Zero Recurring Drain:**
   - **Feature 6 (Background 24/7 Crons) REMOVED:** No idle background polling or database row scanning costs.
   - **Single-Pass Inference:** Summaries, Auto-Categories, and Action Items are generated in **ONE single `gpt-4o-mini` API call** (~$0.0003 per video).
   - **Free YouTube Captions First:** YouTube transcriptions cost $0.00 (scraped directly from YouTube subtitle tracks). Whisper is only triggered on-demand when a user requests a summary for an uncaptioned Reel.

---

## 2. The 5 Core AI Features

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VIDEO SAVED (Extension / Mobile Share)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
        [YouTube Video]                       [Instagram Reel / TikTok]
               │                                         │
    Scrape Free Captions ($0)               Check if Captions exist?
               │                                         │
               │                                 No ──► On-Demand:
               │                                        Call Whisper-1
               │                                        ($0.003/reel)
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
         ┌──────────────────────────────────────────────────────┐
         │          SINGLE PASS: OpenAI `gpt-4o-mini`           │
         │   Returns Structured JSON:                           │
         │   ├── 1. 30-sec TL;DW & 3 Bullet Takeaways           │
         │   ├── 2. Auto-Category & Tags                        │
         │   └── 3. Extracted Links / Tools / Resources         │
         └──────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
         ┌──────────────────────────────────────────────────────┐
         │     OpenAI `text-embedding-3-small` (1536-dim)       │
         │     Stored in Supabase `pgvector` for Search & Chat  │
         └──────────────────────────────────────────────────────┘
```

### Feature 1: ⚡ 30-Second Video Digest & Key Takeaways

- **Presentation:** Sleek `✦ AI Digest` glowing badge on `VideoCard.tsx` and `VideoGridCard.tsx`.
- **Output:** 1-sentence TL;DW + 3 high-signal bullet points.

### Feature 2: 🏷️ Zero-Effort Smart Auto-Categorization & Tags

- **Presentation:** Automatic tag chips (`#DevOps`, `#React19`, `#Fitness`) and auto-sorting into category feeds (`Tech`, `Fitness`, `Cooking`, `Finance`, `Design`, `Productivity`).

### Feature 3: 🛠️ One-Tap Action Items & Resource Extractor

- **Presentation:** Rendered as interactive chips in `VideoDetailSheet.tsx`:
  - 🔗 Clickable GitHub repositories and referenced websites.
  - 📋 Recipe ingredient checklist with 1-tap "Copy to Clipboard".
  - 📚 Mentioned books and gear.

### Feature 4: 🔍 "Inside-the-Video" Semantic Search (Timestamp Jump)

- **Presentation:** Search bar toggle (`Title` vs `Inside-Video ✦`).
- **Behavior:** Matches concepts/spoken words and displays exact time markers (`▶ 04:15 - "Docker setup"`). 1-tap deep links directly to that second in the player.

### Feature 5: 💬 "Ask Elio" — Chat with Your Saved Library

- **Presentation:** Dedicated conversational modal/tab in the mobile app.
- **Behavior:** RAG assistant answering questions using only the user's saved bookmarks with citations.

---

## 3. Monetization & Revenue Architecture

Elio AI follows a **Freemium SaaS Model** with a strict **No-Banner-Ads Policy** to preserve brand trust and maximize user conversion.

### A. Free vs Pro Tiers

| Feature                            |  Free Tier   | Elio Pro ($4.99/mo or $39.99/yr) |
| :--------------------------------- | :----------: | :------------------------------: |
| Video Saves & Sync                 |  Unlimited   |            Unlimited             |
| Cloud Sync (PC <-> Mobile)         |    ✅ Yes    |              ✅ Yes              |
| AI Digests (TL;DW)                 | 10 per month |          **Unlimited**           |
| Inside-Video Semantic Search       |    ❌ No     |          **Unlimited**           |
| "Ask Elio" Library Chat            |    ❌ No     |          **Unlimited**           |
| Reel Audio Transcription (Whisper) |   3 trials   |          **Unlimited**           |
| Action Items / Links Extractor     |    ❌ No     |          **Unlimited**           |

### B. High-Profit Unit Economics

- **User Subscription:** $4.99/month
- **OpenAI API Cost (per heavy user):** ~$0.50 - $0.70/month
- **Payment Processing (Stripe on Web):** $0.35 (2.9% + 30¢)
- **Net Profit Margin:** **~80% - 85% ($3.90+ net profit per subscriber/month)**

### C. Extension-Specific Revenue Channels

1. **Direct Web Stripe Checkout (97% Keep Rate):**
   - Users upgrade directly from the Extension popup or in-page YouTube button via Stripe Checkout. You keep 97% of funds (avoiding Apple/Google's 15-30% mobile tax).
   - Subscription is tied to the user's Supabase account; scanning the mobile QR code immediately unlocks Pro on the phone as well.
2. **In-Page YouTube Quick Summary Button:**
   - Extension injects a clean `✦ Elio Summary` button directly below YouTube videos.
   - Prompts free users to upgrade when their monthly free limit is reached.
3. **Smart Affiliate Recommendations:**
   - Non-intrusive affiliate tags on extracted books (Amazon) and software tools (SaaS referral programs).

---

## 4. Updated Database Schema (`backend/schema_ai.sql`)

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. User Subscription / Pro Status Table
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
    CONSTRAINT unique_user_sub UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sub ON public.user_subscriptions(user_id);

-- 3. Consolidated Video AI Metadata Table
CREATE TABLE IF NOT EXISTS public.video_ai_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.saved_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_educational BOOLEAN DEFAULT true,
    tldw TEXT,
    key_takeaways TEXT[] DEFAULT '{}',
    action_items JSONB DEFAULT '[]'::jsonb,
    primary_category TEXT,
    tags TEXT[] DEFAULT '{}',
    read_time_seconds INT DEFAULT 30,
    processing_status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_video_ai UNIQUE (video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_ai_user ON public.video_ai_metadata(user_id);

-- 4. Video Transcript Chunks (1536 Dimensions for OpenAI text-embedding-3-small)
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

CREATE INDEX IF NOT EXISTS idx_chunks_video ON public.video_transcript_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user ON public.video_transcript_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.video_transcript_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. Cosine Similarity Search RPC (OpenAI 1536-dim)
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
        1 - (c.embedding <=> p_embedding) AS similarity
    FROM public.video_transcript_chunks c
    JOIN public.saved_videos v ON v.id = c.video_id
    WHERE c.user_id = p_user_id
      AND 1 - (c.embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;
```

---

## 5. Configuration & Secrets

Add the following to Supabase Edge Function Secrets:

```env
# Single OpenAI API Key (Handles gpt-4o-mini, text-embedding-3-small, whisper-1)
OPENAI_API_KEY="sk-proj-..."

# Supabase Internal
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
```
