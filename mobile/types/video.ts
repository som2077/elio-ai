import type { VideoAIMetadata } from "./ai";

export type PlatformType =
  | "youtube"
  | "instagram"
  | "twitter"
  | "facebook"
  | "reddit"
  | "linkedin"
  | "pinterest"
  | "tiktok"
  | "other";
export type ContentCategory = "video" | "short" | "reel" | "post";
export type WatchStatus = "unread" | "in_progress" | "watched" | "archived";

export interface SavedVideo {
  id: string;
  user_id: string;
  platform: PlatformType;
  category: ContentCategory;
  original_url: string;
  clean_url: string;
  platform_video_id?: string;
  title?: string;
  creator_name?: string;
  creator_avatar_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  status: WatchStatus;
  is_favorite: boolean;
  user_notes?: string;
  tags?: string[];
  source_client: string;
  device_id?: string;
  source_device_name?: string;
  remind_at?: string;
  watched_at?: string;
  ai_metadata?: VideoAIMetadata;
  productivity_score?: number;
  hook_headline?: string;
  processing_stage?: string;
  tldw_hinglish?: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  browser_type: string;
  os_name: string;
  user_agent?: string;
  last_active_at: string;
  is_revoked: boolean;
  created_at: string;
}
