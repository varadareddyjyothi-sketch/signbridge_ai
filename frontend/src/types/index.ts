/**
 * SignBridge AI - TypeScript Interfaces
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface PredictionResult {
  detected: boolean;
  label: string | null;
  english_meaning: string | null;
  telugu?: string | null;
  telugu_romanized?: string | null;
  confidence: number | null;
  status: 'accepted' | 'uncertain_rejected' | 'no_hand' | 'model_unavailable' | 'error';
  is_verified_isl: boolean;
  gesture_type?: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture';
  hands_detected?: number;
  model_version?: string;
  all_probabilities: Record<string, number> | null;
  rejection_threshold_used: number;
  timestamp: string;
}

export interface HistoryItem {
  id: string;
  user_id?: string | null;
  predicted_label: string;
  english_meaning: string;
  telugu?: string;
  telugu_romanized?: string;
  confidence?: number | null;
  recognition_mode: string;
  created_at: string;
  storage_source: 'supabase' | 'local_sqlite';
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  storage_mode: 'supabase' | 'local_sqlite';
  cloud_connected: boolean;
}

export interface HealthStatus {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  model_status: 'unavailable' | 'experimental' | 'trained' | 'evaluated' | string;
  model_classes_count: number;
  storage_mode: 'supabase' | 'local_sqlite' | string;
  supabase_configured: boolean;
  timestamp: string;
}

export interface ModelStatus {
  status: 'unavailable' | 'experimental' | 'trained' | 'evaluated' | string;
  model_name?: string;
  active_version?: string;
  classes: string[];
  classes_count: number;
  feature_dimension: number;
  confidence_rejection_threshold: number;
  test_accuracy?: number;
  total_samples?: number;
  training_timestamp?: string;
  known_limitations: string[];
  retrain_command?: string;
}

export interface DatasetStats {
  dataset_exists: boolean;
  total_samples: number;
  class_counts: Record<string, number>;
  classes: string[];
  dataset_path: string;
}

export interface GestureVocabularyEntry {
  id: string;
  name: string;
  telugu: string;
  telugu_romanized: string;
  gesture_type: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture' | 'two_hand';
  category?: string;
  description?: string;
  example_sentence_en?: string;
  example_sentence_te?: string;
  example_sentence_ro?: string;
  is_deletable?: boolean;
  sample_count?: number;
  is_in_active_model?: boolean;
  is_pretrained_supported?: boolean;
  readiness?: 'active_trained' | 'pretrained_supported' | 'ready_to_train' | 'needs_data';
  readiness_description?: string;
  created_at?: string;
}

export interface ModelVersionEntry {
  version: string;
  model_filename: string;
  metadata_filename: string;
  test_accuracy: number;
  total_samples: number;
  classes: string[];
  classes_count: number;
  created_at: string;
  is_active: boolean;
  note?: string;
}

export interface MeaningBreakdownItem {
  token: string;
  supported: boolean;
  gloss: string;
  role: string;
  english: string;
  telugu: string;
  telugu_romanized: string;
}

export interface DisambiguationOption {
  label: string;
  english: string;
  telugu: string;
  telugu_romanized: string;
}

export interface SentenceTranslationResult {
  tokens: string[];
  english: string;
  telugu: string;
  telugu_romanized: string;
  sentence_intent?: string;
  punctuation?: string;
  is_idiomatic_match: boolean;
  meaning_breakdown?: MeaningBreakdownItem[];
  source_mode?: 'camera_recognition' | 'quick_phrase';
  disambiguation_options?: DisambiguationOption[];
}

export interface QuickPhraseCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface QuickPhraseItem {
  id: string;
  category: string;
  english: string;
  telugu: string;
  telugu_romanized: string;
  is_emergency: boolean;
  verified: boolean;
  notes?: string;
  source_mode: 'quick_phrase';
}

export interface QuickPhraseListResponse {
  categories: QuickPhraseCategory[];
  phrases: QuickPhraseItem[];
  total: number;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  preferred_language: 'en' | 'te' | 'ro' | string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  message: string;
}

export interface SentenceHistoryEntry {
  id: string;
  user_id?: string | null;
  original_signs: string;
  confirmed_sentence: string;
  english_output?: string | null;
  telugu_output?: string | null;
  romanized_output?: string | null;
  selected_language: string;
  recognition_mode: string;
  source_mode?: 'camera_recognition' | 'quick_phrase' | string;
  created_at: string;
  storage_source?: 'supabase' | 'local_sqlite' | string;
}

export interface SentenceHistoryResponse {
  items: SentenceHistoryEntry[];
  total: number;
  storage_mode: 'supabase' | 'local_sqlite' | string;
  cloud_connected: boolean;
}



