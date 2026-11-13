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

export type ProcessingStage =
  | 'queued'
  | 'transcribing'
  | 'generating_context'
  | 'completed'
  | 'failed'
  | 'fallback_notes';

export type VerdictType =
  | 'verified_accurate'
  | 'mostly_accurate_with_nuance'
  | 'misleading_oversimplification'
  | 'opinion_hot_take'
  | 'sponsored_promo';

export interface FactCheckNuance {
  verdict: VerdictType | string;
  verdict_badge: string;
  explanation: string;
  missing_nuances?: string[];
  hidden_costs_or_prereqs?: string[];
}

export interface BackgroundLore {
  backstory: string;
  why_it_matters: string;
  assumed_prerequisites?: string[];
}

export type EntityCategory =
  | 'tool'
  | 'repo'
  | 'framework'
  | 'person'
  | 'company'
  | 'paper'
  | 'concept';

export interface EntityReferenced {
  name: string;
  category: EntityCategory | string;
  one_liner: string;
  url_or_search_term?: string;
}

export interface HookInfo {
  headline: string;
  read_time_seconds?: number;
  primary_category?: string;
  tags?: string[];
  intent?: 'educational' | 'news_debate' | 'opinion' | 'sponsored' | 'entertainment' | string;
}

export interface CorePremiseThesis {
  tldw_en?: string;
  problem_addressed?: string;
  main_solution_or_claim?: string;
}

export interface VideoAIMetadata {
  id: string;
  video_id: string;
  user_id: string;
  is_educational: boolean;
  productivity_score?: number; // 0 to 100 high-signal productivity rating
  tldw: string;
  tldw_en?: string;
  hook?: HookInfo;
  core_premise?: string | CorePremiseThesis;
  key_takeaways: string[];
  background_lore?: BackgroundLore;
  fact_check_nuance?: FactCheckNuance;
  entities_referenced?: EntityReferenced[];
  action_items: ActionItem[];
  primary_category: string;
  tags: string[];
  read_time_seconds: number;
  processing_status: AIProcessingStatus;
  processing_stage?: ProcessingStage;
  full_transcript?: string;
  transcript_language?: string;
  has_spoken_audio?: boolean;
  context_breakdown?: ContextStepItem[];
  suggested_followups?: string[];
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
