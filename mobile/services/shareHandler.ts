import { supabase } from "./supabase";
import { PlatformType, ContentCategory, SavedVideo } from "../types/video";

// Safe AsyncStorage fallback
let AsyncStorage: any = null;
try {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {
  AsyncStorage = null;
}

const PENDING_SHARES_KEY = "@elio_pending_shares";

export interface ShareProcessResult {
  success: boolean;
  isDuplicate?: boolean;
  platform?: PlatformType;
  title?: string;
  cleanUrl?: string;
  video?: SavedVideo;
  error?: string;
}

/**
 * Extracts the first valid HTTP/HTTPS URL from any shared text.
 * Handles messy text from YouTube, Instagram, X/Twitter, TikTok, Reddit, etc.
 */
export function extractUrlFromText(rawText: string): string | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Regex to match http/https URLs
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`]+)/i;
  const match = rawText.match(urlRegex);

  if (!match || !match[0]) return null;

  let url = match[0].trim();

  // Strip trailing punctuation often appended by message text (e.g. "Check this out: https://youtu.be/xyz.")
  url = url.replace(/[.,;:!?)]+$/, "");

  return url;
}

/**
 * Cleans tracking and telemetry query parameters (?si=, ?igsh=, ?utm_*, etc.)
 * from URLs to prevent duplicate saves and ensure canonical keys.
 */
export function cleanShareUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    // List of tracking query parameters to discard
    const trackingParams = [
      "si",
      "igsh",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref_src",
      "ref_url",
      "s",
      "t",
      "feature",
    ];

    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    return parsed.toString();
  } catch {
    // If URL constructor fails, do regex cleaning
    return rawUrl
      .replace(/[?&](si|igsh|utm_[a-z]+|fbclid|ref_src)=[^&#]*/gi, "")
      .replace(/\?$/, "");
  }
}

/**
 * Detects the platform, content category, video ID, and generates metadata.
 */
export function analyzeSharedUrl(cleanUrl: string): {
  platform: PlatformType;
  category: ContentCategory;
  platformVideoId?: string;
  title: string;
  thumbnailUrl: string;
} {
  const lower = cleanUrl.toLowerCase();

  // 1. YouTube & Shorts
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    const isShort = lower.includes("/shorts/");
    let videoId: string | undefined;

    const ytMatch = cleanUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/i,
    );
    if (ytMatch && ytMatch[1]) {
      videoId = ytMatch[1];
    }

    return {
      platform: "youtube",
      category: isShort ? "short" : "video",
      platformVideoId: videoId,
      title: isShort ? "YouTube Short" : "Saved YouTube Video",
      thumbnailUrl: videoId
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 2. Instagram Reels & Posts
  if (lower.includes("instagram.com")) {
    const isReel = lower.includes("/reel/") || lower.includes("/reels/");
    return {
      platform: "instagram",
      category: isReel ? "reel" : "post",
      title: isReel ? "Instagram Reel" : "Instagram Post",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 3. Twitter / X
  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return {
      platform: "twitter",
      category: "post",
      title: "Saved X Thread / Post",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 4. TikTok
  if (lower.includes("tiktok.com")) {
    return {
      platform: "tiktok",
      category: "short",
      title: "Saved TikTok Clip",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1596558450255-7c0b7be9d56a?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 5. Reddit
  if (lower.includes("reddit.com")) {
    return {
      platform: "reddit",
      category: "post",
      title: "Reddit Discussion / Clip",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 6. LinkedIn
  if (lower.includes("linkedin.com")) {
    return {
      platform: "linkedin",
      category: "post",
      title: "LinkedIn Post / Video",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1616469829941-c7200edec809?w=600&auto=format&fit=crop&q=80",
    };
  }

  // 7. Pinterest
  if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
    return {
      platform: "pinterest",
      category: "post",
      title: "Pinterest Idea / Pin",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&auto=format&fit=crop&q=80",
    };
  }

  // Default fallback
  return {
    platform: "other",
    category: "video",
    title: "Saved Web Clip",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
  };
}

/**
 * Handles incoming shared text from social media:
 * 1. Extracts & cleans the URL
 * 2. Checks if logged in
 * 3. Checks for duplicates in Supabase
 * 4. Inserts into saved_videos
 * 5. Returns status and payload
 */
export async function processSharedContent(
  rawText: string,
  userId?: string,
): Promise<ShareProcessResult> {
  const extractedUrl = extractUrlFromText(rawText);

  if (!extractedUrl) {
    return {
      success: false,
      error: "No valid URL found in shared content.",
    };
  }

  const cleanUrl = cleanShareUrl(extractedUrl);
  const metadata = analyzeSharedUrl(cleanUrl);

  // If user is not yet logged in, save in local pending queue
  if (!userId) {
    try {
      if (AsyncStorage) {
        const existing = await AsyncStorage.getItem(PENDING_SHARES_KEY);
        const list = existing ? JSON.parse(existing) : [];
        list.push({
          rawUrl: extractedUrl,
          cleanUrl,
          metadata,
          timestamp: Date.now(),
        });
        await AsyncStorage.setItem(PENDING_SHARES_KEY, JSON.stringify(list));
      }
      return {
        success: true,
        platform: metadata.platform,
        title: metadata.title,
        cleanUrl,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  try {
    // Check if user already saved this URL
    const { data: existingVideo } = await supabase
      .from("saved_videos")
      .select("id, title, platform, status")
      .eq("user_id", userId)
      .eq("clean_url", cleanUrl)
      .maybeSingle();

    if (existingVideo) {
      return {
        success: true,
        isDuplicate: true,
        platform: (existingVideo.platform as PlatformType) || metadata.platform,
        title: existingVideo.title || metadata.title,
        cleanUrl,
      };
    }

    // Extract any accompanying text/caption sent along with the link
    const surroundingText = rawText.replace(extractedUrl, "").trim();

    // Insert new clip into saved_videos
    const newRecord = {
      user_id: userId,
      clean_url: cleanUrl,
      original_url: extractedUrl,
      platform: metadata.platform,
      category: metadata.category,
      platform_video_id: metadata.platformVideoId || null,
      title: metadata.title,
      thumbnail_url: metadata.thumbnailUrl,
      user_notes: surroundingText.length > 5 ? surroundingText : null,
      status: "unread",
      source_client: "mobile_share_sheet",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("saved_videos")
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      console.warn("[ShareHandler] Insert error:", error.message);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      isDuplicate: false,
      platform: metadata.platform,
      title: metadata.title,
      cleanUrl,
      video: inserted as SavedVideo,
    };
  } catch (err: any) {
    console.warn("[ShareHandler] Exception:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-syncs any pending shares saved while unauthenticated once user logs in.
 */
export async function flushPendingShares(userId: string): Promise<number> {
  if (!AsyncStorage || !userId) return 0;

  try {
    const raw = await AsyncStorage.getItem(PENDING_SHARES_KEY);
    if (!raw) return 0;

    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return 0;

    let syncedCount = 0;
    for (const item of list) {
      const res = await processSharedContent(item.cleanUrl, userId);
      if (res.success && !res.isDuplicate) {
        syncedCount++;
      }
    }

    // Clear queue
    await AsyncStorage.removeItem(PENDING_SHARES_KEY);
    return syncedCount;
  } catch (e) {
    console.warn("[ShareHandler] Flush pending error:", e);
    return 0;
  }
}
