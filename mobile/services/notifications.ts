import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { SavedVideo } from "../types/video";
import { analytics } from "./analytics";
import { logger } from "../utils/logger";

const REMINDER_STORAGE_KEY = "@elio_liked_video_reminders";

// Configure how notifications are presented when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Configure notification channel for Android (required for Android 8.0+)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Video Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#8B5CF6",
  }).catch((err) => {
    logger.warn("[Notifications] Failed to set Android notification channel:", err);
  });
}

export type FreeTimeSlot = "morning" | "afternoon" | "evening" | "night";

export interface SlotCalculationResult {
  targetDate: Date;
  slotName: FreeTimeSlot;
}

export interface ElioContextNotificationPayload {
  videoId: string;
  platform?: string;
  title?: string;
  hookHeadline?: string;
  verdictBadge?: string;
  tldwSnippet?: string;
  cleanUrl?: string;
  suggestedAction?: 'open_lore' | 'ask_elio' | 'open_video';
}

/**
 * Calculates the next free time slot based on when the user likes the video:
 * - Night (10 PM - 6 AM) -> Morning (9:30 AM)
 * - Morning (6 AM - 12 PM) -> Afternoon (2:00 PM)
 * - Afternoon (12 PM - 5 PM) -> Evening (7:30 PM)
 * - Evening (5 PM - 10 PM) -> Night (10:00 PM)
 *
 * Enforces a minimum 2-hour buffer so user isn't spammed right after liking.
 */
export function getNextFreeTimeSlot(now = new Date()): SlotCalculationResult {
  const currentHour = now.getHours();
  let candidate = new Date(now);
  let slot: FreeTimeSlot;

  if (currentHour >= 22 || currentHour < 6) {
    // Night -> Morning 9:30 AM
    slot = "morning";
    if (currentHour >= 22) {
      candidate.setDate(candidate.getDate() + 1);
    }
    candidate.setHours(9, 30, 0, 0);
  } else if (currentHour >= 6 && currentHour < 12) {
    // Morning -> Afternoon 2:00 PM
    slot = "afternoon";
    candidate.setHours(14, 0, 0, 0);
  } else if (currentHour >= 12 && currentHour < 17) {
    // Afternoon -> Evening 7:30 PM
    slot = "evening";
    candidate.setHours(19, 30, 0, 0);
  } else {
    // Evening -> Night 10:00 PM
    slot = "night";
    candidate.setHours(22, 0, 0, 0);
  }

  // Minimum buffer check (at least 2 hours from now)
  const MIN_BUFFER_MS = 2 * 60 * 60 * 1000;
  if (candidate.getTime() - now.getTime() < MIN_BUFFER_MS) {
    if (slot === "morning") {
      slot = "afternoon";
      candidate.setHours(14, 0, 0, 0);
    } else if (slot === "afternoon") {
      slot = "evening";
      candidate.setHours(19, 30, 0, 0);
    } else if (slot === "evening") {
      slot = "night";
      candidate.setHours(22, 0, 0, 0);
    } else {
      slot = "morning";
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(9, 30, 0, 0);
    }
  }

  return { targetDate: candidate, slotName: slot };
}

/**
 * Returns customized notification copy based on slot, video title, and optional AI hook headline
 */
function getNotificationContentForSlot(
  slot: FreeTimeSlot,
  videoTitle?: string,
  hookHeadline?: string
): { title: string; body: string } {
  const titleText = videoTitle ? `"${videoTitle}"` : "your saved clip";
  const hookSuffix = hookHeadline ? ` ("${hookHeadline}")` : "";

  switch (slot) {
    case "morning":
      return {
        title: "☕ Morning Catch-Up",
        body: hookHeadline
          ? `Last night you saved: "${hookHeadline}". 30s digest ready for your morning coffee!`
          : `You liked ${titleText} last night but haven't watched it yet. Perfect to enjoy with your morning coffee!`,
      };
    case "afternoon":
      return {
        title: "🍱 Lunch Break Catch-Up",
        body: hookHeadline
          ? `Quick break: "${hookHeadline}". Full context & takeaways waiting in Elio!`
          : `You liked ${titleText} earlier today. Take a quick break and watch it now!`,
      };
    case "evening":
      return {
        title: "🌆 Evening Wind-Down",
        body: hookHeadline
          ? `Relax & catch up: "${hookHeadline}". Tap to explore deep lore & key insights 🎬`
          : `Your liked video is waiting: ${titleText}. The perfect time to relax and watch 🎬`,
      };
    case "night":
    default:
      return {
        title: "🌙 Bedtime Watch",
        body: hookHeadline
          ? `Before calling it a night: "${hookHeadline}" 🍿`
          : `Before calling it a night: catch the video you liked earlier: ${titleText} 🍿`,
      };
  }
}

/**
 * Dispatches an instant or fast-preview notification when video context is ready.
 * Delivers the 1-line hook preview and interactive buttons.
 */
export async function scheduleContextReadyNotification(
  video: SavedVideo,
  payload?: ElioContextNotificationPayload
): Promise<string | null> {
  try {
    const hook = payload?.hookHeadline || video.hook_headline || video.ai_metadata?.hook?.headline;
    const verdict = payload?.verdictBadge || video.ai_metadata?.fact_check_nuance?.verdict_badge;
    const platformLabel = (video.platform || "Video").toUpperCase();

    const title = verdict
      ? `✨ Elio Context [${verdict}] • ${platformLabel}`
      : `✨ Elio Context • ${platformLabel}`;

    const body = hook
      ? `"${hook}" — 30-sec TL;DW & Deep Lore ready.`
      : video.title
      ? `Context ready for "${video.title}". Tap to view key takeaways.`
      : "Full video context is ready in your vault.";

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          videoId: video.id,
          type: "full_context_ready",
          targetTab: "lore",
          cleanUrl: video.clean_url,
          hookHeadline: hook,
          title: video.title,
        },
      },
      trigger: null, // deliver immediately
    });

    logger.log(
      `[Notifications] Dispatched Context Ready notification for video ${video.id}: ${title}`
    );

    return notificationId;
  } catch (error) {
    logger.warn("[Notifications] Failed to schedule context ready notification:", error);
    return null;
  }
}

/**
 * Schedules a smart free-time reminder for a video that was liked but not watched.
 * Works 100% locally on the device (no Firebase/FCM required).
 */
export async function scheduleLikedVideoReminder(
  video: SavedVideo,
  overrideSeconds?: number,
  hookHeadline?: string
): Promise<string | null> {
  try {
    // First cancel any existing reminder for this video
    await cancelLikedVideoReminder(video.id);

    const activeHook =
      hookHeadline ||
      video.hook_headline ||
      video.ai_metadata?.hook?.headline;

    const { targetDate, slotName } = getNextFreeTimeSlot();
    const content = getNotificationContentForSlot(slotName, video.title, activeHook);

    // Support overrideSeconds for development testing (e.g. 10s test)
    const trigger: any = overrideSeconds
      ? { seconds: overrideSeconds }
      : { date: targetDate };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: {
          videoId: video.id,
          type: "liked_not_watched",
          slot: slotName,
          title: video.title,
          hookHeadline: activeHook,
        },
      },
      trigger,
    });

    // Save reminder ID mapped to videoId in AsyncStorage
    const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    const map = stored ? JSON.parse(stored) : {};
    map[video.id] = notificationId;
    await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(map));

    logger.log(
      `[Notifications] Scheduled local reminder for video ${video.id} at slot "${slotName}" (${
        overrideSeconds ? overrideSeconds + "s" : targetDate.toLocaleTimeString()
      })`
    );

    // Track in Mixpanel
    analytics.trackVideoLiked(
      video,
      slotName,
      overrideSeconds
        ? new Date(Date.now() + overrideSeconds * 1000).toISOString()
        : targetDate.toISOString()
    );

    return notificationId;
  } catch (error) {
    logger.warn("[Notifications] Failed to schedule reminder:", error);
    return null;
  }
}

/**
 * Triggers an immediate test notification scheduled 5 seconds from now.
 * Use this to verify that notifications, sound, and foreground/background display work.
 */
export async function sendTestNotificationNow(
  video?: SavedVideo | null
): Promise<string | null> {
  try {
    const videoTitle = video?.title || "Test Video Clip";
    const { slotName } = getNextFreeTimeSlot();
    const content = getNotificationContentForSlot(slotName, videoTitle);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${content.title} (5s Test)`,
        body: content.body,
        sound: true,
        data: {
          videoId: video?.id || "test-id",
          type: "liked_not_watched",
          slot: slotName,
          title: videoTitle,
        },
      },
      trigger: { seconds: 5 },
    });

    logger.log(
      `[Notifications] Test notification scheduled to pop in 5 seconds (ID: ${notificationId})`
    );

    if (video) {
      analytics.trackVideoLiked(video, slotName, "test_5s");
    }

    return notificationId;
  } catch (error) {
    logger.warn("[Notifications] Failed to schedule test notification:", error);
    return null;
  }
}

/**
 * Cancels any pending reminder for a video (called when video is watched, unliked, or deleted).
 */
export async function cancelLikedVideoReminder(videoId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    if (!stored) return;

    const map = JSON.parse(stored);
    const notificationId = map[videoId];

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      delete map[videoId];
      await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(map));
      logger.log(
        `[Notifications] Cancelled scheduled reminder for video ${videoId} (Notification ID: ${notificationId})`
      );
    }
  } catch (error) {
    logger.warn(
      `[Notifications] Failed to cancel reminder for video ${videoId}:`,
      error
    );
  }
}

/**
 * Registers device for push notifications and stores token in Supabase.
 * Gracefully handles missing Firebase setup so app/local notifications never break.
 */
export async function registerForPushNotificationsAsync(userId: string) {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.log("[Notifications] Push notification permissions not granted by user.");
      return null;
    }

    // Try obtaining Expo push token first
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenData.data;
    } catch {
      // Fallback: try raw device push token (only works if Firebase google-services.json exists)
      try {
        const rawTokenData = await Notifications.getDevicePushTokenAsync();
        token = rawTokenData.data;
      } catch {
        // Firebase not yet initialized on Android (e.g. google-services.json pending)
        logger.info(
          "[Notifications] Remote FCM/Firebase push token skipped (FirebaseApp not configured yet). Local scheduled notifications remain 100% active."
        );
      }
    }

    // Save token to Supabase device_tokens table if available
    if (token && userId) {
      await supabase.from("device_tokens").upsert(
        {
          user_id: userId,
          fcm_token: token,
          device_type: Platform.OS === "ios" ? "ios" : "android",
          device_name: `${Platform.OS} device`,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" }
      );
    }
  } catch (e: any) {
    logger.info(
      "[Notifications] Push token registration notice:",
      e?.message || "Skipped"
    );
  }

  return token;
}
