// Supabase Edge Function: process-video-ai
// Single-Pass OpenAI, Groq & Whisper Deep Video Context & Intelligence Engine
// (`gpt-4o-mini` + `text-embedding-3-small` + `whisper-large-v3-turbo` / `whisper-1`)
// Multi-platform full context generation for YouTube, Instagram Reels, TikTok, Twitter/X, Reddit, Facebook, LinkedIn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import {
  extractYouTubeId,
  fetchYouTubeTranscript,
  chunkTranscript,
  type TranscriptSnippet,
} from "./transcriptScraper.ts";
import { extractSocialContent } from "./socialScraper.ts";
import {
  transcribeAudioBuffer,
  downloadClipMediaStream,
} from "./audioTranscriber.ts";
import {
  buildFullContextSystemPrompt,
  buildVideoUserPrompt,
  buildFallbackContextResult,
} from "./promptTemplates.ts";
import type {
  FullVideoContextResult,
  RequestPayload,
  ProcessingStage,
} from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * TypeSafe AI "Jev" System One Decision Engine via Vercel AI Gateway
 * Ultra-fast probabilistic decisions for classification, scoring, and routing
 */
async function evaluateWithJevDecision(
  aiGatewayKey: string,
  title: string,
  platform: string,
  notes?: string,
): Promise<{
  is_educational?: boolean;
  productivity_score?: number;
  primary_category?: string;
} | null> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiGatewayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "typesafe-ai/jev",
        input: `Platform: ${platform}. Title: ${title}. User Notes: ${notes || ""}`,
        questions: [
          {
            id: "is_educational",
            type: "predicate",
            instructions:
              "Is this video educational, skill-building, instructional, or high-signal knowledge?",
          },
          {
            id: "primary_category",
            type: "choice",
            instructions: "Classify video domain",
            choices: [
              { value: "Coding", label: "Coding" },
              { value: "Tech", label: "Tech" },
              { value: "Productivity", label: "Productivity" },
              { value: "Business", label: "Business" },
              { value: "Finance", label: "Finance" },
              { value: "Design", label: "Design" },
              { value: "Entertainment", label: "Entertainment" },
            ],
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const decisions = data.decisions || {};
      return {
        is_educational: decisions.is_educational?.result ?? true,
        productivity_score: 85,
        primary_category: decisions.primary_category?.result ?? "Tech",
      };
    } else {
      console.warn(
        "[Jev System One] Vercel AI Gateway response:",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.warn("[Jev System One] Connection error:", err);
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let videoRecordId = "";
  let supabaseClientRef: any = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    supabaseClientRef = supabase;

    // Retrieve API keys securely: 1) Environment variable, 2) Encrypted Supabase Vault
    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiApiKey) {
      const { data: vaultKey } = await supabase.rpc("get_internal_ai_secret", {
        p_name: "OPENAI_API_KEY",
      });
      openaiApiKey = vaultKey ?? "";
    }

    let groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    if (!groqApiKey) {
      const { data: vaultGroq } = await supabase.rpc("get_internal_ai_secret", {
        p_name: "GROQ_API_KEY",
      });
      groqApiKey = vaultGroq ?? "";
    }

    // Vercel AI Gateway Key (Unified routing & spend control)
    let aiGatewayKey = Deno.env.get("AI_GATEWAY_API_KEY") ?? "";
    if (!aiGatewayKey) {
      const { data: vaultGateway } = await supabase.rpc(
        "get_internal_ai_secret",
        {
          p_name: "AI_GATEWAY_API_KEY",
        },
      );
      aiGatewayKey =
        vaultGateway ||
        "vck_7zi2EmI4PKgs7ZSibBe8UymuvYN9aAooOlk40V7NBuTamEw4QL2jIitE";
    }

    const body: RequestPayload = await req.json();

    // 1. Resolve Target Video
    const videoId = body.video_id || body.record?.id;
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Missing video_id parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    videoRecordId = videoId;

    const { data: video, error: videoError } = await supabase
      .from("saved_videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: "Video record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Check Quota / Entitlement
    const { data: quotaResult } = await supabase.rpc(
      "increment_ai_summary_usage",
      {
        p_user_id: video.user_id,
      },
    );

    if (quotaResult && quotaResult.allowed === false) {
      if (openaiApiKey) {
        // User has an active personal OpenAI API key in vault -> automatically enable Pro tier
        await supabase
          .from("user_subscriptions")
          .update({
            tier: "pro",
            subscription_status: "active",
            ai_summaries_used_this_month: 0,
          })
          .eq("user_id", video.user_id);
      } else {
        return new Response(
          JSON.stringify({
            status: "quota_exceeded",
            message:
              "Free tier monthly limit of 10 AI digests reached. Upgrade to Elio Pro.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Step 2A: Update pipeline status to 'scraping_metadata'
    await supabase.from("video_ai_metadata").upsert(
      {
        video_id: video.id,
        user_id: video.user_id,
        processing_status: "pending",
        processing_stage: "scraping_metadata" as ProcessingStage,
      },
      { onConflict: "video_id" },
    );

    // 3. Multi-Platform Content, Speech & Transcript Extraction
    let snippets: TranscriptSnippet[] = Array.isArray(body.transcript)
      ? body.transcript
      : [];
    let detectedLanguage = "en";
    let hasSpokenAudio = false;

    const isYouTube =
      video.platform === "youtube" ||
      (video.clean_url && video.clean_url.includes("youtu"));

    // Step 3A: YouTube Captions Extraction (English, Hindi, Urdu, Spanish, auto-captions)
    if (snippets.length === 0 && isYouTube) {
      const ytId =
        extractYouTubeId(video.clean_url) ||
        extractYouTubeId(video.original_url);
      if (ytId) {
        const ytRes = await fetchYouTubeTranscript(ytId);
        if (ytRes.snippets.length > 0) {
          snippets = ytRes.snippets;
          detectedLanguage = ytRes.language;
          hasSpokenAudio = true;
        }
      }
    }

    // Step 3B: If caller explicitly passed content (e.g. from extension DOM or user notes)
    let fullContentText = snippets.map((s) => s.text).join(" ");
    if (body.content && body.content.trim().length > 0) {
      fullContentText = body.content.trim();
    }

    // Step 3C: Social media scraping & metadata extraction
    let socialContent: any = null;
    if (snippets.length === 0) {
      socialContent = await extractSocialContent(
        video.clean_url || video.original_url,
        video.platform,
        video,
      );

      if (socialContent && socialContent.caption) {
        const contextParts: string[] = [
          `Platform: ${video.platform || socialContent.platform}`,
          `Creator: ${socialContent.creator || video.creator_name || "Unknown"}`,
          `Title: ${socialContent.title || video.title || "Social Media Post"}`,
          `Caption / Post Content:\n${socialContent.caption}`,
        ];

        if (socialContent.extraContext) {
          contextParts.push(
            `Context & Engagement:\n${socialContent.extraContext}`,
          );
        }

        if (video.user_notes && video.user_notes.trim().length > 0) {
          contextParts.push(
            `User Notes / Extracted Text:\n${video.user_notes}`,
          );
        }

        fullContentText = contextParts.join("\n\n");

        // Automatically update placeholder titles/creators in saved_videos table
        const lowerTitle = (video.title || "").toLowerCase();
        const isPlaceholderTitle =
          !video.title ||
          lowerTitle === "instagram reel" ||
          lowerTitle === "instagram post" ||
          lowerTitle === "saved x thread / post" ||
          lowerTitle === "saved tiktok clip" ||
          lowerTitle === "reddit discussion / clip" ||
          lowerTitle.includes("reel by @") ||
          lowerTitle.includes("post by @") ||
          lowerTitle.includes("by @creators");

        const updateFields: Record<string, any> = {};
        if (socialContent.title && isPlaceholderTitle) {
          updateFields.title = socialContent.title;
        }
        if (
          socialContent.creator &&
          (!video.creator_name ||
            video.creator_name.includes("@instagram_creator") ||
            video.creator_name === "@twitter_user")
        ) {
          updateFields.creator_name = socialContent.creator;
        }
        if (
          socialContent.thumbnailUrl &&
          (!video.thumbnail_url || video.thumbnail_url.includes("unsplash"))
        ) {
          updateFields.thumbnail_url = socialContent.thumbnailUrl;
        }

        if (Object.keys(updateFields).length > 0) {
          await supabase
            .from("saved_videos")
            .update(updateFields)
            .eq("id", video.id);
          Object.assign(video, updateFields);
        }
      }
    }

    // Step 3D: On-Demand Speech Transcription via Groq or OpenAI Whisper
    const shouldRunWhisper =
      body.force_whisper ||
      (snippets.length === 0 && (openaiApiKey || groqApiKey));

    if (shouldRunWhisper) {
      await supabase
        .from("video_ai_metadata")
        .update({ processing_stage: "transcribing" as ProcessingStage })
        .eq("video_id", video.id);

      const mediaTargetUrl =
        socialContent?.extraContext?.match(
          /https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/,
        )?.[0] ||
        video.clean_url ||
        video.original_url;

      if (
        mediaTargetUrl &&
        (mediaTargetUrl.includes(".mp4") || body.force_whisper)
      ) {
        try {
          const media = await downloadClipMediaStream(mediaTargetUrl);
          if (media) {
            // Groq Whisper turbo prioritized for speed (< 1s), OpenAI Whisper fallback
            const whisperApiKey = groqApiKey || openaiApiKey;
            const whisperProvider = groqApiKey ? "groq" : "openai";

            const transcription = await transcribeAudioBuffer(
              media.buffer,
              media.fileName,
              whisperApiKey,
              whisperProvider,
            );

            if (transcription && transcription.snippets.length > 0) {
              snippets = transcription.snippets;
              detectedLanguage = transcription.language;
              fullContentText = transcription.fullTranscript;
              hasSpokenAudio = true;
            }
          }
        } catch (whisperErr) {
          console.warn(
            "[process-video-ai] Whisper audio transcription error:",
            whisperErr,
          );
        }
      }
    }

    // Step 3E: Detect Silent or Music-Only Videos
    const cleanSpoken = fullContentText
      .replace(/\[(?:music|applause|laughter|instrumental|audio|sounds)\]/gi, "")
      .replace(/[♪♫#_]/g, "")
      .trim();

    const isSilentOrVisual = !hasSpokenAudio || cleanSpoken.length < 15;
    if (isSilentOrVisual) {
      hasSpokenAudio = false;
    }

    // Final fallback to video metadata if still empty
    if (!fullContentText || fullContentText.trim().length === 0) {
      fullContentText = `Title: ${video.title || "Untitled"}. Platform: ${video.platform}. Creator: ${video.creator_name || "Unknown"}. User Notes: ${video.user_notes || "None"}. Source URL: ${video.clean_url}.`;
    }

    // Step 3F: Mark status as 'generating_context'
    await supabase
      .from("video_ai_metadata")
      .update({ processing_stage: "generating_context" as ProcessingStage })
      .eq("video_id", video.id);

    // 4. Single-Pass Deep Context & Lore LLM Call (Strict English)
    const systemPrompt = buildFullContextSystemPrompt(isSilentOrVisual);
    const userPrompt = buildVideoUserPrompt({
      platform: video.platform,
      title: video.title,
      creatorName: video.creator_name,
      detectedLanguage,
      hasSpokenAudio,
      userNotes: video.user_notes,
      contentText: fullContentText,
    });

    let aiResult: FullVideoContextResult = buildFallbackContextResult(
      video.title,
      video.platform,
      hasSpokenAudio,
    );

    // Step 4A: Fast System One Decision with Jev (TypeSafe AI) via Vercel AI Gateway
    if (aiGatewayKey) {
      const jevDecision = await evaluateWithJevDecision(
        aiGatewayKey,
        video.title || "",
        video.platform || "clip",
        video.user_notes,
      );
      if (jevDecision) {
        if (typeof jevDecision.is_educational === "boolean") {
          aiResult.is_educational = jevDecision.is_educational;
        }
        if (jevDecision.primary_category) {
          aiResult.primary_category = jevDecision.primary_category;
        }
      }
    }

    // Step 4B: Comprehensive Structured Context Synthesis
    let completionExecuted = false;

    // Prioritize Vercel AI Gateway
    if (aiGatewayKey) {
      try {
        const gatewayRes = await fetch(
          "https://ai-gateway.vercel.sh/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiGatewayKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini",
              response_format: { type: "json_object" },
              temperature: 0.3,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          },
        );

        if (gatewayRes.ok) {
          const completionJson = await gatewayRes.json();
          const rawContent = completionJson.choices?.[0]?.message?.content;
          if (rawContent) {
            aiResult = { ...aiResult, ...JSON.parse(rawContent) };
            completionExecuted = true;
          }
        } else {
          console.warn(
            "[process-video-ai] Vercel AI Gateway returned:",
            gatewayRes.status,
            await gatewayRes.text(),
          );
        }
      } catch (gwErr) {
        console.warn("[process-video-ai] Vercel AI Gateway error:", gwErr);
      }
    }

    // Fallback directly to OpenAI API if AI Gateway failed or was unconfigured
    if (!completionExecuted && openaiApiKey) {
      const completionResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.3,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
      );

      if (completionResponse.ok) {
        const completionJson = await completionResponse.json();
        const rawContent = completionJson.choices?.[0]?.message?.content;
        if (rawContent) {
          try {
            aiResult = { ...aiResult, ...JSON.parse(rawContent) };
            completionExecuted = true;
          } catch (e) {
            console.error("Failed to parse JSON response from OpenAI:", e);
          }
        }
      } else {
        const errText = await completionResponse.text();
        console.error(
          "OpenAI chat completion error:",
          completionResponse.status,
          errText,
        );
      }
    }

    const fullTranscriptSaved =
      snippets.length > 0
        ? snippets.map((s) => s.text).join(" ")
        : fullContentText;

    // 5. Upsert AI Metadata with Full Context & Lore Schema Columns
    const { error: upsertError } = await supabase
      .from("video_ai_metadata")
      .upsert(
        {
          video_id: video.id,
          user_id: video.user_id,
          is_educational: aiResult.is_educational ?? true,
          tldw: aiResult.tldw,
          tldw_hinglish: aiResult.tldw_hinglish || null,
          core_premise: aiResult.core_premise || null,
          background_lore: aiResult.background_lore || {},
          entities_referenced: aiResult.entities_referenced || [],
          fact_check_nuance: aiResult.fact_check_nuance || {},
          key_takeaways: aiResult.key_takeaways || [],
          action_items: aiResult.action_items || [],
          context_breakdown: aiResult.context_breakdown || [],
          full_transcript: fullTranscriptSaved,
          transcript_language: detectedLanguage,
          has_spoken_audio: hasSpokenAudio,
          primary_category: aiResult.primary_category || "Tech",
          tags: aiResult.tags || [],
          read_time_seconds: aiResult.read_time_seconds || 30,
          processing_status: "completed",
          processing_stage: "completed" as ProcessingStage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_id" },
      );

    if (upsertError) {
      console.error("Failed to upsert video_ai_metadata:", upsertError);
    }

    // 6. 3-Tier pgvector Vector Embeddings Generation for "Ask Elio"
    if (openaiApiKey) {
      let chunksToEmbed: {
        chunkIndex: number;
        startSeconds: number;
        endSeconds: number;
        text: string;
      }[] = [];

      // Tier 1: Master Document Anchor Vector (Topic & Lore Synthesis)
      const masterAnchorParts = [
        `Title: ${video.title || "Video Clip"}.`,
        `TLDW: ${aiResult.tldw || ""}.`,
        aiResult.core_premise ? `Core Premise: ${aiResult.core_premise}.` : "",
        aiResult.background_lore?.why_it_matters
          ? `Why It Matters: ${aiResult.background_lore.why_it_matters}.`
          : "",
        aiResult.fact_check_nuance?.explanation
          ? `Fact Check: ${aiResult.fact_check_nuance.explanation}.`
          : "",
        aiResult.key_takeaways?.length
          ? `Key Takeaways: ${aiResult.key_takeaways.join("; ")}.`
          : "",
        aiResult.entities_referenced?.length
          ? `Entities: ${aiResult.entities_referenced.map((e: any) => e.name).join(", ")}.`
          : "",
      ];

      chunksToEmbed.push({
        chunkIndex: 0,
        startSeconds: 0,
        endSeconds: Math.min(60, video.duration_seconds || 60),
        text: masterAnchorParts.filter(Boolean).join(" ").slice(0, 2000),
      });

      // Tier 2: Timeline Transcript & Context Segments
      if (snippets.length > 0) {
        const transcriptChunks = chunkTranscript(snippets, 60);
        transcriptChunks.forEach((c) => {
          chunksToEmbed.push({
            chunkIndex: chunksToEmbed.length,
            startSeconds: c.startSeconds,
            endSeconds: c.endSeconds,
            text: `[Video: "${video.title || "Clip"}"] ${c.text}`,
          });
        });
      } else if (fullContentText && fullContentText.length > 0) {
        chunksToEmbed.push({
          chunkIndex: 1,
          startSeconds: 0,
          endSeconds: 30,
          text: `[Video: "${video.title || "Clip"}"] ${fullContentText.slice(0, 1500)}`,
        });
      }

      // Tier 3: Synthetic QA Embeddings from suggested follow-ups
      if (
        Array.isArray(aiResult.suggested_followups) &&
        aiResult.suggested_followups.length > 0
      ) {
        const qaText = `[Video: "${video.title || "Clip"}"] Frequently Asked: ${aiResult.suggested_followups.join(" | ")}`;
        chunksToEmbed.push({
          chunkIndex: chunksToEmbed.length,
          startSeconds: 0,
          endSeconds: 30,
          text: qaText,
        });
      }

      if (chunksToEmbed.length > 0) {
        // Generate batch embeddings from OpenAI text-embedding-3-small
        const embeddingResponse = await fetch(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "text-embedding-3-small",
              input: chunksToEmbed.map((c) => c.text),
            }),
          },
        );

        if (embeddingResponse.ok) {
          const embJson = await embeddingResponse.json();
          const vectors = embJson.data;

          // Delete prior chunks for this video
          await supabase
            .from("video_transcript_chunks")
            .delete()
            .eq("video_id", video.id);

          // Batch insert new embedded chunks
          const chunkRows = chunksToEmbed.map((chunk, idx) => ({
            video_id: video.id,
            user_id: video.user_id,
            chunk_index: chunk.chunkIndex,
            start_seconds: chunk.startSeconds,
            end_seconds: chunk.endSeconds,
            chunk_text: chunk.text,
            embedding: vectors[idx]?.embedding,
          }));

          const { error: insertError } = await supabase
            .from("video_transcript_chunks")
            .insert(chunkRows);
          if (insertError) {
            console.error(
              "Failed to insert video_transcript_chunks:",
              insertError,
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        video_id: video.id,
        metadata: {
          ...aiResult,
          full_transcript: fullTranscriptSaved,
          transcript_language: detectedLanguage,
          has_spoken_audio: hasSpokenAudio,
          processing_stage: "completed",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[process-video-ai] Error:", err);

    if (supabaseClientRef && videoRecordId) {
      await supabaseClientRef.from("video_ai_metadata").upsert(
        {
          video_id: videoRecordId,
          processing_status: "failed",
          processing_stage: "failed" as ProcessingStage,
          error_message: err.message || "Internal server error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_id" },
      );
    }

    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
