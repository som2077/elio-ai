export type PlatformType =
  | 'youtube'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'linkedin'
  | 'pinterest'
  | 'tiktok'
  | 'other';
export type ContentCategory = 'video' | 'short' | 'reel' | 'post';
export type WatchStatus = 'unread' | 'in_progress' | 'watched' | 'archived';

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
  remind_at?: string;
  watched_at?: string;
  created_at: string;
  updated_at: string;
}
