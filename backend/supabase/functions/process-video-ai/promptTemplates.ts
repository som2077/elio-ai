// Prompt Templates & Few-Shot Architectures for Elio AI Context Engine
// Multi-Language (EN + Hinglish) Deep Video Lore, Fact-Checking & Entity Extraction

import type { FullVideoContextResult } from "./types.ts";

/**
 * Builds the comprehensive system prompt for the single-pass Deep Context & Lore Engine.
 */
export function buildFullContextSystemPrompt(isSilentOrVisual: boolean = false): string {
  if (isSilentOrVisual) {
    return `You are the Elio AI Video Intelligence & Context Engine.
The user has saved a video clip that is SILENT, MUSIC-ONLY, or has NO SPOKEN DIALOG.
Your job is to synthesize the "Full Context" (pura context samjhana) primarily from the creator's caption, title, on-screen text/notes, hashtags, and visual context.

Extract maximum concrete value: frameworks, recipes, workout routines, tools, concepts, or tutorials being demonstrated visually.

Return ONLY a valid JSON object matching this schema:
{
  "tldw": "1-2 punchy sentences in clean English summarizing the visual demonstration.",
  "tldw_hinglish": "1-2 punchy sentences in natural conversational Roman Hinglish (e.g., 'Yeh reel basically dikhati hai ki...')",
  "core_premise": "The underlying problem, aesthetic, or technique demonstrated visually.",
  "key_takeaways": [
    "Concrete actionable takeaway 1",
    "Concrete actionable takeaway 2",
    "Concrete actionable takeaway 3"
  ],
  "background_lore": {
    "backstory": "Context on this visual trend, recipe origin, or creator style.",
    "why_it_matters": "Why people use or practice this visual technique.",
    "assumed_prerequisites": ["Basic tools or ingredients assumed"]
  },
  "entities_referenced": [
    {
      "name": "Tool, ingredient, software, or person",
      "category": "tool" | "repo" | "framework" | "person" | "company" | "paper" | "concept",
      "one_liner": "Brief description of the entity",
      "url_or_search_term": "URL or search query"
    }
  ],
  "fact_check_nuance": {
    "verdict": "verified_accurate" | "mostly_accurate_with_nuance" | "misleading_oversimplification" | "opinion_hot_take" | "sponsored_promo",
    "verdict_badge": "Short badge e.g. '✅ Visually Demonstrated' or '⚠️ Form Warning'",
    "explanation": "Assessment of whether visual demo is practical, realistic, or exaggerated for views.",
    "missing_nuances": ["Practical hurdles not shown in the aesthetic reel"],
    "hidden_costs_or_prereqs": ["Specialized equipment or software needed"]
  },
  "context_breakdown": [
    {
      "time_seconds": 0,
      "time_formatted": "00:00",
      "title": "Visual Phase / Step",
      "detail": "What is shown or demonstrated in this phase."
    }
  ],
  "action_items": [
    {
      "type": "tool" | "repo" | "link" | "recipe" | "book",
      "title": "Clear concise label",
      "url": "https://... or empty if none",
      "subtitle": "Brief note"
    }
  ],
  "suggested_followups": [
    "Follow-up question 1 for Ask Elio",
    "Follow-up question 2 for Ask Elio",
    "Follow-up question 3 for Ask Elio"
  ],
  "primary_category": "One of: Tech | Coding | Fitness | Cooking | Finance | Design | Productivity | Entertainment | Other",
  "tags": ["3 to 5 lowercase tags without #"],
  "is_educational": true,
  "productivity_score": 75,
  "read_time_seconds": 30,
  "silent_or_visual_only": true
}

STRICT RULES:
1. Output valid JSON only. No markdown fences around JSON, no commentary.
2. In Hinglish, keep technical, workout, or recipe terms in English while conversational verbs and connective phrases are in Hindi.
3. If the video is purely humorous or entertainment, set is_educational: false and explain the comedic premise and cultural meme lore.`;
  }

  return `You are the Elio AI Video Intelligence & Deep Context Engine.
Your objective is to provide the "Full Context" (pura context samjhana) of a video clip saved by the user from YouTube, Instagram Reels, TikTok, or Twitter/X.
Short clips only show the surface. You must uncover the underlying premise, deep background lore, industry debate, practical takeaways, fact checks, and key entities.

STRICT CONSTRAINTS & GUIDELINES:
1. OUTPUT: Return strictly valid JSON adhering to the schema below. No markdown fences, no conversational preamble.
2. DUAL-LANGUAGE:
   - Provide "tldw" in punchy, articulate English.
   - Provide "tldw_hinglish" in natural conversational Roman Hinglish (e.g. "Creator ka main point yeh hai ki...").
   - In Hinglish, NEVER translate technical jargon into formal Hindi (keep "React hook", "P/E ratio", "Deadlift form", "Server Action" in English).
3. FACT-CHECK & REALITY CHECK: Short viral clips often exaggerate for virality. In "fact_check_nuance", evaluate whether the claim is solid, missing crucial caveats, or clickbait hype.
4. ACTIONABLE VALUE: Extract concrete numbers, frameworks, libraries, exact terminal commands, or steps. No generic filler (e.g. never say "This video discusses important tips" — state the exact tips).
5. ENTITY GRAPH: Extract tools, repos, papers, people, or products mentioned with brief 1-line explanations.
6. TIMESTAMPED BREAKDOWN: Align "context_breakdown" milestones with the actual seconds of the transcript.

SCHEMA DEFINITION (JSON):
{
  "tldw": "1-2 punchy sentences in clean English summarizing the core value.",
  "tldw_hinglish": "1-2 punchy sentences in natural conversational Roman Hinglish.",
  "core_premise": "The fundamental problem, thesis, or dilemma addressed in the video.",
  "key_takeaways": [
    "Concrete actionable takeaway 1",
    "Concrete actionable takeaway 2",
    "Concrete actionable takeaway 3"
  ],
  "background_lore": {
    "backstory": "Origin story, historical context, or previous debate leading up to this clip.",
    "why_it_matters": "Macro significance or impact on industry/daily life.",
    "assumed_prerequisites": ["What knowledge or setup the video assumed"]
  },
  "entities_referenced": [
    {
      "name": "Tool, library, paper, or person",
      "category": "tool" | "repo" | "framework" | "person" | "company" | "paper" | "concept",
      "one_liner": "Brief description of the entity",
      "url_or_search_term": "URL or search query"
    }
  ],
  "fact_check_nuance": {
    "verdict": "verified_accurate" | "mostly_accurate_with_nuance" | "misleading_oversimplification" | "opinion_hot_take" | "sponsored_promo",
    "verdict_badge": "e.g. '✅ Verified Accurate' | '⚠️ Needs Nuance' | '🚨 Misleading Hype'",
    "explanation": "2-3 sentences evaluating the accuracy and practicality of the claims.",
    "missing_nuances": ["Critical trade-offs or constraints omitted in the clip"],
    "hidden_costs_or_prereqs": ["Hidden expenses, setup friction, or paid tiers"]
  },
  "context_breakdown": [
    {
      "time_seconds": 12,
      "time_formatted": "00:12",
      "title": "Topic or Step Label",
      "detail": "What was explained or demonstrated in this section."
    }
  ],
  "action_items": [
    {
      "type": "repo" | "tool" | "link" | "recipe" | "book",
      "title": "Clear concise label",
      "url": "https://... or empty if none",
      "subtitle": "Brief note e.g. 'Recommended in clip'"
    }
  ],
  "suggested_followups": [
    "Follow-up question 1 for Ask Elio",
    "Follow-up question 2 for Ask Elio",
    "Follow-up question 3 for Ask Elio"
  ],
  "primary_category": "One of: Tech | Coding | Fitness | Cooking | Finance | Design | Productivity | Entertainment | Other",
  "tags": ["3 to 5 lowercase tags without #"],
  "is_educational": true,
  "productivity_score": 85,
  "read_time_seconds": 30,
  "silent_or_visual_only": false
}`;
}

/**
 * Builds the user prompt from video metadata, transcript snippets, and notes.
 */
export function buildVideoUserPrompt(params: {
  platform: string;
  title: string;
  creatorName?: string;
  detectedLanguage?: string;
  hasSpokenAudio: boolean;
  userNotes?: string;
  contentText: string;
}): string {
  const parts: string[] = [
    `Platform: ${params.platform}`,
    `Title: ${params.title || "Saved Video Clip"}`,
    `Creator: ${params.creatorName || "Unknown Creator"}`,
    `Spoken Audio Detected: ${params.hasSpokenAudio}`,
    `Audio/Content Language: ${params.detectedLanguage || "en"}`,
  ];

  if (params.userNotes && params.userNotes.trim().length > 0) {
    parts.push(`User Notes / Extracted Text:\n${params.userNotes}`);
  }

  parts.push(
    `Content / Transcript Snippets:\n${params.contentText.slice(0, 32000)}`,
  );

  return parts.join("\n\n");
}

/**
 * Generates an intelligent default fallback result when LLM call fails or times out.
 */
export function buildFallbackContextResult(
  title: string,
  platform: string,
  hasSpokenAudio: boolean,
): FullVideoContextResult {
  return {
    tldw: `Key highlights and insights from ${title || "saved clip"}.`,
    tldw_hinglish: `${title || "Saved video"} ke main points aur context.`,
    core_premise: `Analysis and practical takeaways from this ${platform} video.`,
    key_takeaways: [
      "Core concept explained in the video",
      "Key technique or framework demonstrated",
      "Practical takeaway for implementation",
    ],
    background_lore: {
      backstory: "Video saved from social feed for contextual reference.",
      why_it_matters: "Useful knowledge resource preserved in your second brain.",
      assumed_prerequisites: ["General topic familiarity"],
    },
    entities_referenced: [],
    fact_check_nuance: {
      verdict: "mostly_accurate_with_nuance",
      verdict_badge: "ℹ️ Review Suggested",
      explanation: "Auto-extracted from clip metadata. Refer to full video for complete context.",
      missing_nuances: ["Full context requires reviewing original clip."],
      hidden_costs_or_prereqs: [],
    },
    context_breakdown: [],
    action_items: [],
    suggested_followups: [
      "Can you summarize this video in more detail?",
      "What are the main tools or concepts mentioned?",
      "How can I apply this in practice?",
    ],
    primary_category: "Tech",
    tags: [platform.toLowerCase(), "clip", "saved"],
    is_educational: true,
    productivity_score: 70,
    read_time_seconds: 30,
    silent_or_visual_only: !hasSpokenAudio,
  };
}
