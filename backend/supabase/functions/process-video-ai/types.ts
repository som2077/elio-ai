// Supabase Edge Function types for process-video-ai
// Full Context & Intelligence Engine Data Contracts

export interface ActionItem {
  type: "repo" | "link" | "tool" | "recipe" | "book";
  title: string;
  url?: string;
  subtitle?: string;
}

export interface ContextBreakdownItem {
  time_seconds: number;
  time_formatted: string;
  title: string;
  detail: string;
}

export interface EntityReferenced {
  name: string;
  category: "tool" | "repo" | "framework" | "person" | "company" | "paper" | "concept";
  one_liner: string;
  url_or_search_term?: string;
}

export interface BackgroundLore {
  backstory: string;
  why_it_matters: string;
  assumed_prerequisites: string[];
}

export interface FactCheckNuance {
  verdict:
    | "verified_accurate"
    | "mostly_accurate_with_nuance"
    | "misleading_oversimplification"
    | "opinion_hot_take"
    | "sponsored_promo";
  verdict_badge: string;
  explanation: string;
  missing_nuances: string[];
  hidden_costs_or_prereqs: string[];
}

export interface FullVideoContextResult {
  tldw: string;
  core_premise?: string;
  key_takeaways: string[];
  background_lore?: BackgroundLore;
  entities_referenced?: EntityReferenced[];
  fact_check_nuance?: FactCheckNuance;
  context_breakdown?: ContextBreakdownItem[];
  action_items?: ActionItem[];
  suggested_followups?: string[];
  primary_category: string;
  tags: string[];
  is_educational: boolean;
  productivity_score?: number;
  read_time_seconds?: number;
  silent_or_visual_only?: boolean;
}

export type ProcessingStage =
  | "queued"
  | "scraping_metadata"
  | "transcribing"
  | "generating_context"
  | "completed"
  | "failed"
  | "skipped";

export interface RequestPayload {
  video_id?: string;
  force_whisper?: boolean;
  transcript?: Array<{ text: string; start: number; duration: number }>;
  content?: string;
  record?: {
    id: string;
    user_id: string;
    platform: string;
    title?: string;
    clean_url: string;
    original_url: string;
    user_notes?: string;
  };
}
