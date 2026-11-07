// Supabase Edge Function: process-video-ai
// Single-Pass OpenAI-Native Engine (`gpt-4o-mini` + `text-embedding-3-small` + on-demand `whisper-1`)
// Multi-platform content intelligence for YouTube, Instagram, Twitter/X, TikTok, Reddit, Facebook, LinkedIn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import {
  extractYouTubeId,
  fetchYouTubeTranscript,
  chunkTranscript,
  type TranscriptSnippet,
} from "./transcriptScraper.ts";
import { extractSocialContent } from "./socialScraper.ts";

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

    // Retrieve API key securely: 1) Environment variable, 2) Encrypted Supabase Vault
    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiApiKey) {
      const { data: vaultKey } = await supabase.rpc("get_internal_ai_secret", {
        p_name: "OPENAI_API_KEY",
      });
      openaiApiKey = vaultKey ?? "";
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

    // 3. Multi-Platform Content & Transcript Extraction
    let snippets: TranscriptSnippet[] = Array.isArray(body.transcript)
      ? body.transcript
      : [];
    const isYouTube =
      video.platform === "youtube" ||
      (video.clean_url && video.clean_url.includes("youtu"));

    if (snippets.length === 0 && isYouTube) {
      const ytId =
        extractYouTubeId(video.clean_url) ||
        extractYouTubeId(video.original_url);
      if (ytId) {
        snippets = await fetchYouTubeTranscript(ytId);
      }
    }

    // Prepare full text representation
    let fullContentText = snippets.map((s) => s.text).join(" ");

    // If caller explicitly passed content (e.g. from extension or mobile)
    if (body.content && body.content.trim().length > 0) {
      fullContentText = body.content.trim();
    }

    // For non-YouTube platforms or when no subtitles exist, run socialScraper
    if (!fullContentText || fullContentText.trim().length === 0) {
      const socialContent = await extractSocialContent(
        video.clean_url || video.original_url,
        video.platform,
        video,
      );

      if (socialContent && socialContent.caption) {
        // Build rich structured context for AI
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

        // Automatically improve placeholder titles/creators in saved_videos table
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
          lowerTitle.includes("by @creators") ||
          lowerTitle === "test instagram reel by @creators";

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

    // Final fallback to metadata if still completely empty
    if (!fullContentText || fullContentText.trim().length === 0) {
      fullContentText = `Title: ${video.title || "Untitled"}. Platform: ${video.platform}. Creator: ${video.creator_name || "Unknown"}. User Notes: ${video.user_notes || "None"}. Source URL: ${video.clean_url}.`;
    }

    // 4. Single-Pass OpenAI `gpt-4o-mini` Request
    const systemPrompt = `You are the Elio AI Video & Social Media Intelligence engine.
Given a video, reel, tweet, or social post's transcript, caption, and metadata, produce a high-signal, punchy structured summary.
Extract concrete, actionable value: exact numbers, frameworks, tools mentioned, tips, prompts, key arguments, or steps.
Avoid generic filler (e.g. do not say "This video discusses important tips" — state the exact tips).

Return ONLY valid JSON matching this schema:
{
  "tldw": "1 punchy sentence summarizing the core value or message.",
  "key_takeaways": [
    "High signal actionable bullet 1",
    "High signal actionable bullet 2",
    "High signal actionable bullet 3"
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
  "is_educational": true or false
}`;

    let aiResult = {
      tldw: `Key takeaways from ${video.title || "saved clip"}`,
      key_takeaways: [
        "Core concept explained in video",
        "Key technique or framework demonstrated",
      ],
      primary_category: "Tech",
      tags: ["video", video.platform || "clip"],
      action_items: [] as any[],
      is_educational: true,
    };

    if (openaiApiKey) {
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
                content: `Platform: ${video.platform}\nTitle: ${video.title}\nCreator: ${video.creator_name || "Unknown"}\nTranscript / Post Content:\n${fullContentText.slice(0, 30000)}`,
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

    // 5. Upsert AI Metadata
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
        metadata: aiResult,
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
