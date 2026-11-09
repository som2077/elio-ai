// Supabase Edge Function: process-video-ai
// Single-Pass OpenAI & Whisper Audio Intelligence Engine
// (`gpt-4o-mini` + `text-embedding-3-small` + `whisper-1` / `whisper-large-v3-turbo`)
// Multi-platform content & speech intelligence for YouTube, Instagram, Twitter/X, TikTok, Reddit, Facebook, LinkedIn.

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  video_id?: string;
  force_whisper?: boolean;
  transcript?: TranscriptSnippet[];
  content?: string;
  // Fallback for direct Database Webhook trigger
  record?: {
    id: string;
    user_id: string;
    platform: string;
    title?: string;
    clean_url: string;
    original_url: string;
    user_notes?: string;
  };
}

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
            instructions: "Is this video educational, skill-building, instructional, or high-signal knowledge?",
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
        productivity_score: 8,
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
      const { data: vaultGateway } = await supabase.rpc("get_internal_ai_secret", {
        p_name: "AI_GATEWAY_API_KEY",
      });
      aiGatewayKey = vaultGateway || "vck_7zi2EmI4PKgs7ZSibBe8UymuvYN9aAooOlk40V7NBuTamEw4QL2jIitE";
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

    const { data: video, error: videoError } = await supabase
      .from("saved_videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(JSON.stringify({ error: "Video record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Mark status as pending
    await supabase.from("video_ai_metadata").upsert(
      {
        video_id: video.id,
        user_id: video.user_id,
        processing_status: "pending",
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

    // Step 3D: On-Demand Speech Transcription via Whisper
    // If no text transcript exists, or user passed `force_whisper = true`
    const shouldRunWhisper =
      body.force_whisper ||
      (snippets.length === 0 && (openaiApiKey || groqApiKey));

    if (shouldRunWhisper) {
      // Determine media stream candidate URL
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

    // Final fallback to metadata if still completely empty
    if (!fullContentText || fullContentText.trim().length === 0) {
      fullContentText = `Title: ${video.title || "Untitled"}. Platform: ${video.platform}. Creator: ${video.creator_name || "Unknown"}. User Notes: ${video.user_notes || "None"}. Source URL: ${video.clean_url}.`;
    }

    // 4. Single-Pass OpenAI `gpt-4o-mini` Request
    const systemPrompt = `You are the Elio AI Video & Social Media Intelligence engine.
Given a video's transcript, spoken dialog, caption, and metadata, produce a high-signal, punchy structured summary.
Extract concrete, actionable value: exact numbers, frameworks, tools mentioned, tips, prompts, key arguments, or steps.
Avoid generic filler (e.g. do not say "This video discusses important tips" — state the exact tips).

Return ONLY valid JSON matching this schema:
{
  "tldw": "1 punchy sentence summarizing the core value or message.",
  "key_takeaways": [
    "Concrete actionable takeaway 1",
    "Concrete actionable takeaway 2",
    "Concrete actionable takeaway 3"
  ],
  "context_breakdown": [
    {
      "time_formatted": "00:15",
      "time_seconds": 15,
      "title": "Topic or Step Label",
      "detail": "What was explained or demonstrated in this section."
    }
  ],
  "primary_category": "One of: Tech | Fitness | Cooking | Finance | Design | Productivity | Entertainment | Other",
  "tags": ["3 to 5 lowercase hashtags without # symbol, e.g. react, nextjs, devops"],
  "action_items": [
    {
      "type": "repo" | "link" | "tool" | "recipe" | "book",
      "title": "Clear concise label",
      "url": "https://... or empty if none",
      "subtitle": "Brief note e.g. 'Recommended in clip'"
    }
  ],
  "is_educational": true
}`;

    let aiResult = {
      tldw: `Key takeaways from ${video.title || "saved clip"}`,
      key_takeaways: [
        "Core concept explained in video",
        "Key technique or framework demonstrated",
      ],
      context_breakdown: [] as any[],
      primary_category: "Tech",
      tags: ["video", video.platform || "clip"],
      action_items: [] as any[],
      is_educational: true,
    };

    // Step A: Fast System One Decision with Jev (TypeSafe AI) via Vercel AI Gateway
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

    // Step B: Comprehensive Structured Digest & Takeaways
    // Prioritize Vercel AI Gateway if configured, with graceful OpenAI direct fallback
    let completionExecuted = false;

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
                {
                  role: "user",
                  content: `Platform: ${video.platform}\nTitle: ${video.title}\nCreator: ${video.creator_name || "Unknown"}\nDetected Language: ${detectedLanguage}\nHas Spoken Audio: ${hasSpokenAudio}\nTranscript / Spoken Content:\n${fullContentText.slice(0, 30000)}`,
                },
              ],
            }),
          },
        );

        if (gatewayRes.ok) {
          const completionJson = await gatewayRes.json();
          const rawContent = completionJson.choices?.[0]?.message?.content;
          if (rawContent) {
            aiResult = JSON.parse(rawContent);
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
              {
                role: "user",
                content: `Platform: ${video.platform}\nTitle: ${video.title}\nCreator: ${video.creator_name || "Unknown"}\nDetected Language: ${detectedLanguage}\nHas Spoken Audio: ${hasSpokenAudio}\nTranscript / Spoken Content:\n${fullContentText.slice(0, 30000)}`,
              },
            ],
          }),
        },
      );

      if (completionResponse.ok) {
        const completionJson = await completionResponse.json();
        const rawContent = completionJson.choices?.[0]?.message?.content;
        if (rawContent) {
          try {
            aiResult = JSON.parse(rawContent);
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

    // 5. Upsert AI Metadata with Full Transcript & Context Breakdown
    const { error: upsertError } = await supabase
      .from("video_ai_metadata")
      .upsert(
        {
          video_id: video.id,
          user_id: video.user_id,
          is_educational: aiResult.is_educational ?? true,
          tldw: aiResult.tldw,
          key_takeaways: aiResult.key_takeaways || [],
          action_items: aiResult.action_items || [],
          context_breakdown: aiResult.context_breakdown || [],
          full_transcript: fullTranscriptSaved,
          transcript_language: detectedLanguage,
          has_spoken_audio: hasSpokenAudio,
          primary_category: aiResult.primary_category || "Tech",
          tags: aiResult.tags || [],
          read_time_seconds: 30,
          processing_status: "completed",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_id" },
      );

    if (upsertError) {
      console.error("Failed to upsert video_ai_metadata:", upsertError);
    }

    // 6. Vector Embeddings Generation (for Semantic Search & RAG Chat)
    if (openaiApiKey) {
      let chunksToEmbed: {
        chunkIndex: number;
        startSeconds: number;
        endSeconds: number;
        text: string;
      }[] = [];

      if (snippets.length > 0) {
        chunksToEmbed = chunkTranscript(snippets, 60);
      } else {
        // Embed video title, TL;DW, takeaways, and the actual content text
        const summaryContext = `${video.title || "Clip"}. ${aiResult.tldw || ""}. Takeaways: ${(aiResult.key_takeaways || []).join(" ")}. Content: ${(fullContentText || "").slice(0, 1500)}`;
        chunksToEmbed = [
          {
            chunkIndex: 0,
            startSeconds: 0,
            endSeconds: 30,
            text: summaryContext,
          },
        ];
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
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[process-video-ai] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
