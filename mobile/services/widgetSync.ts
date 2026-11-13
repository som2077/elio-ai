import { NativeModules, Platform } from "react-native";
import { SavedVideo } from "../types/video";

const { WidgetDataModule } = NativeModules;

export interface WidgetVideoPayload {
  id: string;
  title: string;
  platform: string;
  clean_url: string;
  original_url: string;
  creator_name?: string;
  thumbnail_url?: string;
  is_favorite: boolean;
  ai_metadata?: {
    tldw?: string;
    key_takeaways?: string[];
    read_time_seconds?: number;
  };
}

/**
 * Synchronizes user's saved & liked videos to Android Home Screen Widgets.
 * Enables:
 * 1. AI Daily Insight Widget: Displays bite-sized summaries & takeaways
 * 2. Liked Videos Carousel Widget: Cycle through liked clips with 1-tap playback
 */
export async function syncWidgetsData(videos: SavedVideo[]): Promise<boolean> {
  if (Platform.OS !== "android" || !WidgetDataModule) {
    return false;
  }

  try {
    const payload: WidgetVideoPayload[] = videos.slice(0, 50).map((v) => ({
      id: v.id,
      title: v.title || "Untitled Video Clip",
      platform: v.platform || "youtube",
      clean_url: v.clean_url || v.original_url || "",
      original_url: v.original_url || "",
      creator_name: v.creator_name || "",
      thumbnail_url: v.thumbnail_url || "",
      is_favorite: Boolean(v.is_favorite),
      ai_metadata: v.ai_metadata
        ? {
            tldw: v.ai_metadata.tldw || "",
            key_takeaways: Array.isArray(v.ai_metadata.key_takeaways)
              ? v.ai_metadata.key_takeaways
              : v.ai_metadata.key_takeaways?.english || [],
            read_time_seconds: v.ai_metadata.read_time_seconds || 120,
          }
        : undefined,
    }));

    await WidgetDataModule.setWidgetData(JSON.stringify(payload));
    return true;
  } catch (err: any) {
    console.warn("[WidgetSync] Notice:", err?.message || err);
    return false;
  }
}

/**
 * Triggers an immediate refresh on all home screen widgets
 */
export async function refreshWidgets(): Promise<void> {
  if (Platform.OS !== "android" || !WidgetDataModule) return;
  try {
    await WidgetDataModule.updateWidgets();
  } catch (err: any) {
    console.warn("[WidgetSync] Refresh notice:", err?.message || err);
  }
}
