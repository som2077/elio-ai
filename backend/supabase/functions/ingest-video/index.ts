// Supabase Edge Function: ingest-video
// Server Ingestion & SSRF Protection Gateway for Elio AI
// Validates URLs, blocks SSRF/internal network probes, strips tracking params,
// verifies atomic user quota, and securely ingests videos into public.saved_videos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { validateAndSanitizeUrl } from "./ssrfGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IngestPayload {
  url: string;
  title?: string;
  creator_name?: string;
  thumbnail_url?: string;
  platform?: string;
  user_notes?: string;
  device_id?: string;
  source_device_name?: string;
  source_client?: "mobile_app" | "browser_extension" | "web_client";
  trigger_ai?: boolean; // defaults to true
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase server configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Authenticate Request via Bearer Token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Authenticated client to verify user identity
    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey || supabaseServiceKey,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;

    // Admin client with service role for secured DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse & Validate Payload
    const body: IngestPayload = await req.json().catch(() => ({ url: "" }));
    const rawUrl = body.url;

    if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: 'url'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Strict SSRF Protection & URL Sanitization Guard
    const ssrfResult = validateAndSanitizeUrl(rawUrl);
    if (!ssrfResult.safe) {
      return new Response(
        JSON.stringify({
          error: ssrfResult.error,
          code: "SSRF_SECURITY_VIOLATION",
          hostname: ssrfResult.hostname,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cleanUrl = ssrfResult.cleanUrl!;
    const platform = body.platform || ssrfResult.platform || "other";
    const platformVideoId = ssrfResult.platformVideoId;

    // 4. Server-Side Atomic Quota Verification
    // Tries deduct_ai_summary_quota (atomic row lock) with fallback to increment_ai_summary_usage
    let quotaAllowed = true;
    let quotaTier = "free";
    let quotaUsed = 0;

    try {
      const { data: quotaResult, error: quotaErr } = await adminClient.rpc(
        "deduct_ai_summary_quota",
        {
          p_user_id: userId,
        },
      );

      if (quotaErr) {
        // Fallback to increment_ai_summary_usage
        const { data: fallbackResult } = await adminClient.rpc(
          "increment_ai_summary_usage",
          {
            p_user_id: userId,
          },
        );
        if (fallbackResult) {
          quotaAllowed = fallbackResult.allowed !== false;
          quotaTier = fallbackResult.tier || "free";
          quotaUsed = fallbackResult.used || 0;
        }
      } else if (quotaResult) {
        quotaAllowed = quotaResult.allowed !== false;
        quotaTier = quotaResult.tier || "free";
        quotaUsed = quotaResult.used || 0;
      }
    } catch (qErr) {
      console.warn("[ingest-video] Quota check exception:", qErr);
    }

    if (!quotaAllowed) {
      return new Response(
        JSON.stringify({
          status: "quota_exceeded",
          message:
            "Free tier monthly limit of 10 AI digests reached. Upgrade to Elio Pro.",
          tier: quotaTier,
          used: quotaUsed,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Idempotent Deduplication: Check if already saved by this user
    const { data: existingVideo } = await adminClient
      .from("saved_videos")
      .select("id, clean_url, status, title, platform, created_at")
      .eq("user_id", userId)
      .eq("clean_url", cleanUrl)
      .maybeSingle();

    if (existingVideo) {
      return new Response(
        JSON.stringify({
          status: "already_saved",
          message: "Video already exists in your vault.",
          video: existingVideo,
          clean_url: cleanUrl,
          platform,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6. Ingest into public.saved_videos
    const insertPayload: Record<string, any> = {
      user_id: userId,
      platform,
      category: "video",
      original_url: rawUrl,
      clean_url: cleanUrl,
      platform_video_id: platformVideoId || null,
      title: body.title || `${platform.toUpperCase()} Video`,
      creator_name: body.creator_name || null,
      thumbnail_url: body.thumbnail_url || null,
      user_notes: body.user_notes || null,
      source_client: body.source_client || "mobile_app",
      status: "unread",
    };

    if (body.device_id) {
      insertPayload.device_id = body.device_id;
    }
    if (body.source_device_name) {
      insertPayload.source_device_name = body.source_device_name;
    }

    const { data: newVideo, error: insertError } = await adminClient
      .from("saved_videos")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !newVideo) {
      console.error("[ingest-video] Insert error:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to save video record.",
          details: insertError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 7. Seed Pending Metadata & Trigger Async Context Extraction
    await adminClient.from("video_ai_metadata").upsert(
      {
        video_id: newVideo.id,
        user_id: userId,
        processing_status: "pending",
        processing_stage: "queued",
      },
      { onConflict: "video_id" },
    );

    // Non-blocking trigger to process-video-ai edge function
    const shouldTriggerAI = body.trigger_ai !== false;
    if (shouldTriggerAI) {
      // Fire-and-forget internal invocation to keep user response < 50ms
      fetch(`${supabaseUrl}/functions/v1/process-video-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          video_id: newVideo.id,
          content: body.user_notes || undefined,
        }),
      }).catch((err) => {
        console.warn("[ingest-video] Async AI trigger notice:", err.message);
      });
    }

    // 8. Return Clean Ingestion Response
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Video securely ingested and queued for AI context extraction.",
        video: newVideo,
        clean_url: cleanUrl,
        platform,
        quota: {
          tier: quotaTier,
          used: quotaUsed,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[ingest-video] Server exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
