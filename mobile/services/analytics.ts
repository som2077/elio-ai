import { Mixpanel } from "mixpanel-react-native";
import { SavedVideo } from "../types/video";
import { logger } from "../utils/logger";

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || "";

class AnalyticsService {
  private instance: Mixpanel | null = null;
  private isInitialized = false;

  /**
   * Initializes Mixpanel instance safely.
   * If token is not provided (e.g. dev mode without token), it warns without crashing.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (!MIXPANEL_TOKEN || MIXPANEL_TOKEN === "your-mixpanel-token-here") {
      logger.info(
        "[Mixpanel Analytics] No EXPO_PUBLIC_MIXPANEL_TOKEN configured. Analytics will run in no-op mode."
      );
      return;
    }

    try {
      this.instance = new Mixpanel(MIXPANEL_TOKEN, false);
      await this.instance.init();
      this.isInitialized = true;
      logger.log("[Mixpanel Analytics] Initialized successfully");
    } catch (error) {
      logger.warn("[Mixpanel Analytics] Initialization notice:", error);
    }
  }

  /**
   * Links events to a specific authenticated user
   */
  async identify(userId: string, userDetails?: { email?: string; name?: string }) {
    if (!this.instance || !userId) return;
    try {
      await this.instance.identify(userId);
      if (userDetails) {
        const people = this.instance.getPeople();
        if (userDetails.email) people.set("$email", userDetails.email);
        if (userDetails.name) people.set("$name", userDetails.name);
      }
    } catch (err) {
      logger.warn("[Mixpanel Analytics] Identify notice:", err);
    }
  }

  /**
   * Clears distinct ID and resets user session
   */
  async reset() {
    if (!this.instance) return;
    try {
      this.instance.reset();
    } catch (err) {
      logger.warn("[Mixpanel Analytics] Reset notice:", err);
    }
  }

  /**
   * General event tracking helper
   */
  track(eventName: string, properties: Record<string, any> = {}) {
    if (!this.instance) {
      if (__DEV__) {
        logger.debug(`[Mixpanel Track (DEV Mock)]: ${eventName}`, properties);
      }
      return;
    }
    try {
      this.instance.track(eventName, properties);
    } catch (err) {
      logger.warn(`[Mixpanel Analytics] Track notice for ${eventName}:`, err);
    }
  }

  /**
   * Track when a video is liked / favorited
   */
  trackVideoLiked(
    video: SavedVideo,
    scheduledSlot?: string,
    scheduledTime?: string
  ) {
    this.track("Video Liked", {
      video_id: video.id,
      title: video.title || "Untitled Video",
      platform: video.platform,
      category: video.category,
      was_watched: video.status === "watched",
      duration_seconds: video.duration_seconds || 0,
      scheduled_reminder_slot: scheduledSlot || "none",
      scheduled_reminder_time: scheduledTime || null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track when a video is unliked / unfavorited
   */
  trackVideoUnliked(videoId: string) {
    this.track("Video Unliked", {
      video_id: videoId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track when a video is watched or opened
   */
  trackVideoWatched(
    video: SavedVideo,
    source: "app_status" | "player_play" | "notification" = "app_status"
  ) {
    this.track("Video Watched", {
      video_id: video.id,
      title: video.title || "Untitled Video",
      platform: video.platform,
      category: video.category,
      watch_source: source,
      duration_seconds: video.duration_seconds || 0,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track when a user taps a "liked but not watched" reminder notification
   */
  trackNotificationClicked(videoId: string, slot?: string) {
    this.track("Notification Clicked", {
      notification_type: "liked_not_watched",
      video_id: videoId,
      slot: slot || "unknown",
      timestamp: new Date().toISOString(),
    });
  }
}

export const analytics = new AnalyticsService();
