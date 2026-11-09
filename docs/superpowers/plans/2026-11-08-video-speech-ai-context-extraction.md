# Video Speech & Deep Context AI Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Verification Commands:** `cd mobile && npx tsc --noEmit` & `cd extension && npm run build`

**Goal:** Enable Elio AI to fully extract, understand, and display the exact speech, instructions, tutorial steps, and deep context spoken inside saved videos (YouTube, Instagram Reels, TikTok, Twitter/X, Facebook) so users get 100% of the video's value without generic filler.

**Architecture:** A 4-tier speech-to-intelligence pipeline:

1. **Speech & Captions Extraction Tier:** YouTube Multi-Language & InnerTube Captions Scraper + Direct Audio Extractor + Fast Whisper/Gemini Audio Transcription for uncaptioned Reels & TikToks.
2. **AI Synthesis Tier:** Deep Context Prompt Engine (`gpt-4o-mini`) extracting Executive Summary, Chronological Step-by-Step Spoken Breakdown, Concrete Tools/Commands, and Action Items.
3. **Vector Semantic Grounding Tier:** Timestamped transcript chunks (`video_transcript_chunks`) embedded into Supabase `pgvector` for "Ask Elio" and semantic recall.
4. **Mobile Experience Tier:** Rich "Spoken Dialog & Transcript" viewer with timestamp seek, keyword search, language detection badges, and one-tap copy inside `VideoDetailSheet.tsx`.

**Tech Stack:** React Native (Expo SDK 51, TypeScript), Supabase (PostgreSQL, `pgvector`, Deno Edge Functions), OpenAI API (`gpt-4o-mini`, `text-embedding-3-small`, `whisper-1`) / Groq Whisper (`whisper-large-v3-turbo`), Chrome Extension (Manifest V3).

**Spec:** [`VIDEO_SYNC_TOOL_DESIGN.md`](file:///home/som2077/Desktop/Clipper/VIDEO_SYNC_TOOL_DESIGN.md) & [`docs/superpowers/specs/2026-11-07-ai-features-system1-system2-design.md`](file:///home/som2077/Desktop/Clipper/docs/superpowers/specs/2026-11-07-ai-features-system1-system2-design.md)

---

## Global Constraints

- **Zero Public Secret Leakage:** OpenAI and Groq API keys remain strictly in Supabase Edge Function environment or encrypted Vault (`get_internal_ai_secret`).
- **Vector Dimension:** pgvector embedding dimension is strictly `1536` (`vector(1536)`).
- **Cost & Latency Optimization:** Free captions scraped first ($0 cost, 100ms latency); audio transcription (Whisper/Groq) invoked on-demand or for speech-heavy Reels/Shorts where no text captions exist.
- **Multilingual Support:** Must support English, Hindi, Urdu, Hinglish, Spanish, and auto-translated tracks.
- **TypeScript Strictness:** Zero type errors across mobile (`cd mobile && npx tsc --noEmit`).

---

## Root Cause Analysis: Why Spoken Context Was Not Being Extracted

| Issue                                  | Root Cause                                                                                                                                                    | Impact                                                         | Fix                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **1. Uncaptioned Reels & TikToks**     | `socialScraper.ts` only extracts HTML `<meta property="og:description">`. Most Reels have captions like _"Wait till the end! 😂"_ or _"Link in bio"_.         | 0% of spoken words extracted. AI only gets generic post title. | Direct video audio stream extraction + Whisper Speech-to-Text API.                                                      |
| **2. Missing Whisper Implementation**  | `process-video-ai/index.ts` accepts `force_whisper` in its request body, but the Whisper API call was never actually written.                                 | Even when requested, audio is never transcribed.               | Implement robust Whisper audio transcription function with retry and fallback.                                          |
| **3. YouTube Caption Failures**        | `transcriptScraper.ts` only scrapes `captionTracks` matching `"en"` from raw desktop HTML. Does not handle Hindi/Urdu, YouTube Shorts, or consent challenges. | High failure rate on international & mobile YouTube links.     | Multi-language fallback (hi, ur, en, auto) + YouTube InnerTube API endpoint.                                            |
| **4. Missing Spoken Transcript in UI** | `video_ai_metadata` table only has `tldw` and `key_takeaways`. Full transcript and timestamped dialog are never stored or shown to the user.                  | User cannot read what was actually spoken in the video.        | Add `full_transcript`, `context_breakdown`, and `spoken_language` columns + Interactive Transcript Viewer in mobile UI. |

---

## Task Decomposition

### Task 1: Database Schema Expansion for Full Spoken Context

**Files:**

- Modify: `backend/schema_ai.sql`
- Create: `backend/migrations/20261108_video_speech_context.sql`
- Modify: `mobile/types/ai.ts`

- [ ] **Step 1.1:** Add `full_transcript` (TEXT), `transcript_language` (VARCHAR(20)), `context_breakdown` (JSONB), and `has_spoken_audio` (BOOLEAN) columns to `video_ai_metadata` table.
- [ ] **Step 1.2:** Update TypeScript interfaces in `mobile/types/ai.ts` (`VideoAIMetadata`, `ContextStepItem`, `TranscriptSnippet`).
- [ ] **Step 1.3:** Verify TypeScript types across the mobile codebase (`npx tsc --noEmit`).

---

### Task 2: Robust Multi-Language YouTube & Social Caption Scraper

**Files:**

- Modify: `backend/supabase/functions/process-video-ai/transcriptScraper.ts`
- Modify: `backend/supabase/functions/process-video-ai/socialScraper.ts`

- [ ] **Step 2.1:** Upgrade `fetchYouTubeTranscript` in `transcriptScraper.ts`:
  - Support multi-language track detection: `["en", "hi", "ur", "es", "auto"]`.
  - Add YouTube InnerTube Android/iOS client API payload fallback when desktop HTML `captionTracks` regex returns null.
  - Correctly decode XML/VTT entities and timestamps.
- [ ] **Step 2.2:** Upgrade `extractSocialContent` in `socialScraper.ts`:
  - For TikTok: Parse WebVTT subtitle track URLs from `subtitlesList` when available.
  - For Instagram: Extract direct media `.mp4` video URL from JSON / Graph meta tags so audio stream can be downloaded.
  - Extract creator speech/voiceover flags when tagged in metadata.

---

### Task 3: Backend Whisper & Audio Transcription Pipeline

**Files:**

- Create: `backend/supabase/functions/process-video-ai/audioTranscriber.ts`
- Modify: `backend/supabase/functions/process-video-ai/index.ts`

- [ ] **Step 3.1:** Implement `audioTranscriber.ts` in Deno:
  - Download or stream video audio track (under 25MB).
  - Call OpenAI Whisper (`https://api.openai.com/v1/audio/transcriptions`, model: `whisper-1`) or Groq Whisper (`whisper-large-v3-turbo` for 10x speed).
  - Return formatted snippets: `{ text: string, start: number, duration: number }[]` with detected language.
- [ ] **Step 3.2:** Wire speech pipeline in `process-video-ai/index.ts`:
  - If text transcript from Step 2 is empty and video is a Reel/TikTok/Short, trigger `transcribeVideoAudio(videoUrl)`.
  - Pass full spoken transcript to `gpt-4o-mini`.
- [ ] **Step 3.3:** Upgrade `gpt-4o-mini` prompt to generate:
  - `tldw`: 1 punchy executive sentence.
  - `key_takeaways`: 3-5 concrete facts, numbers, tools, or tips mentioned.
  - `context_breakdown`: Array of timestamped sections: `[{ time: "00:15", title: "Problem Explained", detail: "..." }, { time: "01:20", title: "Solution & Code", detail: "..." }]`.
  - `action_items`: Repos, tools, books, recipes mentioned with exact names.
- [ ] **Step 3.4:** Store `full_transcript`, `transcript_language`, `context_breakdown` in `video_ai_metadata` and chunk into `video_transcript_chunks` with embeddings.

---

### Task 4: Mobile AI Service & State Optimization

**Files:**

- Modify: `mobile/services/aiService.ts`

- [ ] **Step 4.1:** Update `fetchVideoAIMetadata` and `generateVideoAIOnDemand` to parse and cache `full_transcript`, `transcript_language`, `context_breakdown`, and `has_spoken_audio`.
- [ ] **Step 4.2:** Add `fetchVideoTranscriptChunks(videoId: string)` to fetch timestamped snippets for inside-video jumping.
- [ ] **Step 4.3:** Add caching for transcripts in local storage (`@elio_transcript_${videoId}`).

---

### Task 5: Mobile UI - Spoken Dialog & Deep Context Viewer

**Files:**

- Modify: `mobile/components/VideoDetailSheet.tsx`

- [ ] **Step 5.1:** Redesign the **AI Digest Tab** in `VideoDetailSheet.tsx`:
  - **Spoken Audio Status Badge:** `🎙️ Spoken Words Transcribed (Hindi / English)` or `📝 Captions Extracted`.
  - **Executive TL;DW Capsule:** Frosted card with specular rim.
  - **Chronological Spoken Breakdown:** Visual timeline showing timestamp cards (`[00:45] Step 1: Install Dependencies`). Tapping opens the video at that second!
  - **Expandable Full Transcript Panel:** Full spoken dialog with search bar to find any word spoken in the video, with instant copy button.
- [ ] **Step 5.2:** Add "Re-transcribe with High-Accuracy Audio" button if user wants deep Whisper transcription on an uncaptioned clip.

---

### Task 6: Mobile "Ask Elio" & Feed Context Upgrades

**Files:**

- Modify: `mobile/components/AskElioModal.tsx`
- Modify: `mobile/components/VideoCard.tsx`

- [ ] **Step 6.1:** Update `AskElioModal.tsx` prompt handling:
  - When user asks "What did the creator say about X in the video?", Ask Elio quotes the exact spoken line and highlights the timestamp.
- [ ] **Step 6.2:** Add speech indicator badge on `VideoCard.tsx` when a video has speech transcribed.

---

### Task 7: End-to-End Verification & Real Video Test

**Files:**

- Run: `cd mobile && npx tsc --noEmit`
- Run: Automated test script or curl invocation against `process-video-ai`.

- [ ] **Step 7.1:** Verify mobile app compiles with 0 TypeScript errors.
- [ ] **Step 7.2:** Test with:
  1. A YouTube video with English captions.
  2. A YouTube video in Hindi/Urdu.
  3. An Instagram Reel / Short without text captions.
- [ ] **Step 7.3:** Confirm full context, spoken dialog, and key takeaways render cleanly in mobile UI.
