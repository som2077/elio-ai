// Supabase Edge Function: notify-video-saved
// Triggered via Database Webhook when a new row is inserted into `saved_videos`
// Sends high-priority FCM notification to the user's active device tokens.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

interface WebhookPayload {
  type: "INSERT";
  table: "saved_videos";
  record: {
    id: string;
    user_id: string;
    platform: "youtube" | "instagram" | "tiktok" | "other";
    category: string;
    title?: string;
    creator_name?: string;
    thumbnail_url?: string;
    original_url: string;
    clean_url: string;
  };
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload: WebhookPayload = await req.json();
    const video = payload.record;

    if (!video || !video.user_id) {
      return new Response(JSON.stringify({ error: "Missing record data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check if user enabled instant notifications
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("instant_notification_enabled")
      .eq("id", video.user_id)
      .single();

    if (profile && profile.instant_notification_enabled === false) {
      return new Response(
        JSON.stringify({ status: "skipped_by_user_preference" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 2. Fetch all registered device tokens for the user
    const { data: tokens, error: tokenError } = await supabase
      .from("device_tokens")
      .select("fcm_token")
      .eq("user_id", video.user_id);

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_active_tokens_found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const platformEmojiMap: Record<string, string> = {
      youtube: "🔴 YouTube",
      instagram: "🟣 Instagram",
      tiktok: "🎵 TikTok",
      twitter: "𝕏 Twitter",
      reddit: "🟠 Reddit",
      threads: "🧵 Threads",
      pinterest: "📌 Pinterest",
      facebook: "🔵 Facebook",
      snapchat: "👻 Snapchat",
    };
    const platformEmoji =
      platformEmojiMap[video.platform] || `🎬 ${video.platform || "Video"}`;
    const notificationTitle = `${platformEmoji} Video Saved!`;
    const notificationBody = video.title
      ? `${video.creator_name ? video.creator_name + ": " : ""}"${video.title}" - Tap to review later`
      : `New video from ${video.creator_name || video.platform} saved to your inbox!`;

    // 3. Send notification to FCM (or Expo Push API)
    const notifications = tokens.map(async (t) => {
      if (!fcmServerKey) return null;
      return fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: t.fcm_token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
            sound: "default",
          },
          data: {
            video_id: video.id,
            platform: video.platform,
            url: video.clean_url,
            thumbnail_url: video.thumbnail_url || "",
          },
          priority: "high",
        }),
      });
    });

    await Promise.all(notifications);

    return new Response(
      JSON.stringify({
        status: "notifications_dispatched",
        count: tokens.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
