import { supabase } from "./supabase";
import type {
  VideoAIMetadata,
  SemanticSearchResult,
  AskElioMessage,
  AskElioCitation,
  UserSubscription,
} from "../types/ai";
import type { SavedVideo } from "../types/video";

// In-memory cache for ultra-fast instant UI rendering
const memoryCache: Record<string, VideoAIMetadata> = {};

/**
 * Universal safe AsyncStorage accessor with in-memory fallback
 */
async function getStorageItem(key: string): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore
  }
}

/**
 * Fetches AI metadata for a specific video with multi-tier caching (Memory -> Storage -> Supabase)
 */
export async function fetchVideoAIMetadata(
  videoId: string,
): Promise<VideoAIMetadata | null> {
  if (!videoId) return null;

  // 1. Memory Cache
  if (memoryCache[videoId]) {
    return memoryCache[videoId];
  }

  // 2. Persistent Storage Cache
  try {
    const cached = await getStorageItem(`@elio_ai_meta_${videoId}`);
    if (cached) {
      const parsed: VideoAIMetadata = JSON.parse(cached);
      memoryCache[videoId] = parsed;
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }

  // 3. Supabase Database Lookup
  try {
    const { data, error } = await supabase
      .from("video_ai_metadata")
      .select("*")
      .eq("video_id", videoId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const metadata: VideoAIMetadata = {
      id: data.id,
      video_id: data.video_id,
      user_id: data.user_id,
      is_educational: data.is_educational ?? true,
      tldw: data.tldw || "AI summary ready.",
      key_takeaways: Array.isArray(data.key_takeaways)
        ? data.key_takeaways
        : [],
      action_items: Array.isArray(data.action_items) ? data.action_items : [],
      primary_category: data.primary_category || "Tech",
      tags: Array.isArray(data.tags) ? data.tags : [],
      read_time_seconds: data.read_time_seconds || 30,
      processing_status: data.processing_status || "completed",
      error_message: data.error_message,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    memoryCache[videoId] = metadata;
    setStorageItem(`@elio_ai_meta_${videoId}`, JSON.stringify(metadata));
    return metadata;
  } catch (err) {
    console.warn(
      `[aiService] Error fetching AI metadata for video ${videoId}:`,
      err,
    );
    return null;
  }
}

/**
 * Triggers on-demand AI processing for a saved video
 */
export async function generateVideoAIOnDemand(
  video: SavedVideo,
  forceWhisper = false,
): Promise<{ success: boolean; data?: VideoAIMetadata; error?: string }> {
  if (!video?.id) {
    return { success: false, error: "Invalid video identifier" };
  }
  try {
    const { data, error } = await supabase.functions.invoke(
      "process-video-ai",
      {
        body: {
          video_id: video.id,
          force_whisper: forceWhisper,
          content: video.user_notes || undefined,
        },
      },
    );

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.status === "quota_exceeded") {
      return {
        success: false,
        error: "Monthly free AI limit reached (10/10). Upgrade to Elio Pro.",
      };
    }

    if (data?.metadata) {
      const metadata: VideoAIMetadata = {
        id: `gen_${video.id}`,
        video_id: video.id,
        user_id: video.user_id,
        is_educational: data.metadata.is_educational ?? true,
        tldw: data.metadata.tldw,
        key_takeaways: data.metadata.key_takeaways || [],
        action_items: data.metadata.action_items || [],
        primary_category: data.metadata.primary_category || "Tech",
        tags: data.metadata.tags || [],
        read_time_seconds: 30,
        processing_status: "completed",
        created_at: new Date().toISOString(),
      };

      memoryCache[video.id] = metadata;
      setStorageItem(`@elio_ai_meta_${video.id}`, JSON.stringify(metadata));
      return { success: true, data: metadata };
    }

    // Refresh from database
    const fresh = await fetchVideoAIMetadata(video.id);
    return { success: Boolean(fresh), data: fresh || undefined };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to generate AI summary.",
    };
  }
}

/**
 * Semantic Vector Search mapping concepts to exact inside-video timestamps
 */
export async function searchInsideVideosSemantic(
  query: string,
): Promise<SemanticSearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const { data, error } = await supabase.functions.invoke(
      "chat-saved-library",
      {
        body: {
          prompt: query,
          action: "search",
        },
      },
    );

    if (error || !data?.results) {
      console.warn("[aiService] Semantic search error:", error);
      return [];
    }

    return (data.results as any[]).map((r) => ({
      chunk_id: r.chunk_id || r.id,
      video_id: r.video_id,
      title: r.title || "Saved Video",
      clean_url: r.clean_url || "",
      platform: r.platform || "other",
      thumbnail_url: r.thumbnail_url,
      start_seconds: r.start_seconds || 0,
      end_seconds: r.end_seconds || 60,
      chunk_text: r.chunk_text || "",
      similarity: r.similarity || 0,
    }));
  } catch (err) {
    console.warn("[aiService] Failed inside-video search:", err);
    return [];
  }
}

/**
 * Sends a prompt to "Ask Elio" personal library RAG assistant
 */
export async function askElioChat(
  prompt: string,
  history: AskElioMessage[] = [],
): Promise<{ answer: string; citations: AskElioCitation[] }> {
  const sanitizedPrompt = typeof prompt === "string" ? prompt.trim().slice(0, 2000) : "";
  if (!sanitizedPrompt) {
    return { answer: "Please ask a question about your saved videos.", citations: [] };
  }

  try {
    const formattedHistory = history.slice(-6).map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 1000) : "",
    }));

    const { data, error } = await supabase.functions.invoke(
      "chat-saved-library",
      {
        body: {
          prompt: sanitizedPrompt,
          action: "chat",
          history: formattedHistory,
        },
      },
    );

    if (error) {
      return {
        answer:
          "I couldn't reach the AI engine right now. Please check your network connection.",
        citations: [],
      };
    }

    return {
      answer: data?.answer || "No response received.",
      citations: Array.isArray(data?.citations) ? data.citations : [],
    };
  } catch (err: any) {
    return {
      answer: "An error occurred while analyzing your library.",
      citations: [],
    };
  }
}

/**
 * Fetches user subscription tier and monthly AI usage
 */
export async function getUserSubscription(): Promise<UserSubscription | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return {
        id: "default",
        user_id: user.id,
        tier: "free",
        ai_summaries_used_this_month: 0,
        subscription_status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as UserSubscription;
  } catch {
    return null;
  }
}
