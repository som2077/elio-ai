export type ActionItemType = 'link' | 'repo' | 'tool' | 'recipe' | 'book';

export interface ActionItem {
  type: ActionItemType;
  title: string;
  url?: string;
  subtitle?: string;
}

export interface ContextStepItem {
  time_seconds?: number;
  time_formatted?: string;
  title: string;
  detail: string;
}

export interface TranscriptSnippet {
  text: string;
  start: number; // in seconds
  duration: number; // in seconds
}

export type AIProcessingStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface VideoAIMetadata {
  id: string;
  video_id: string;
  user_id: string;
  is_educational: boolean;
  productivity_score?: number; // 0 to 100 high-signal productivity rating
  tldw: string;
  key_takeaways: string[];
  action_items: ActionItem[];
  primary_category: string;
  tags: string[];
  read_time_seconds: number;
  processing_status: AIProcessingStatus;
  full_transcript?: string;
  transcript_language?: string;
  has_spoken_audio?: boolean;
  context_breakdown?: ContextStepItem[];
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface SemanticSearchResult {
  chunk_id: string;
  video_id: string;
  title: string;
  clean_url: string;
  platform: string;
  thumbnail_url?: string;
  start_seconds: number;
  end_seconds: number;
  chunk_text: string;
  similarity: number;
}

export interface AskElioCitation {
  video_id: string;
  title: string;
  start_seconds: number;
  thumbnail_url?: string;
  platform?: string;
  clean_url?: string;
}

export interface AskElioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskElioCitation[];
  created_at: string;
}

export type SubscriptionTier = 'free' | 'pro' | 'lifetime';

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  ai_summaries_used_this_month: number;
  subscription_status: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}
