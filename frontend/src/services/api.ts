/**
 * SignBridge AI - API Client Service
 * Interacts with FastAPI backend with structured typing and error recovery.
 */

import type {
  HealthStatus,
  ModelStatus,
  PredictionResult,
  HistoryResponse,
  HistoryItem,
  DatasetStats,
  LandmarkPoint,
  GestureVocabularyEntry,
  ModelVersionEntry,
  SentenceTranslationResult,
  UserProfile,
  AuthResponse,
  SentenceHistoryEntry,
  SentenceHistoryResponse,
  QuickPhraseCategory,
  QuickPhraseListResponse
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'signbridge_auth_token';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export const api = {
  getBaseUrl(): string {
    return API_BASE;
  },

  async getHealth(): Promise<HealthStatus> {
    const res = await fetchWithTimeout(`${API_BASE}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getModelStatus(): Promise<ModelStatus> {
    const res = await fetchWithTimeout(`${API_BASE}/model/status`);
    if (!res.ok) {
      throw new Error(`Model status check failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  async predict(
    landmarks: LandmarkPoint[] | null,
    handedness = 'Right',
    features: number[] | null = null,
    confidenceThreshold?: number
  ): Promise<PredictionResult> {
    const payload: Record<string, any> = {
      handedness
    };

    if (features && features.length === 63) {
      payload.features = features;
    } else if (landmarks) {
      payload.landmarks = landmarks;
    }

    if (confidenceThreshold !== undefined) {
      payload.confidence_threshold = confidenceThreshold;
    }

    const res = await fetchWithTimeout(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 4000);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Prediction failed');
    }

    return res.json();
  },

  async predictTwoHand(
    leftLandmarks: LandmarkPoint[],
    rightLandmarks: LandmarkPoint[],
    confidenceThreshold?: number
  ): Promise<PredictionResult> {
    const payload: Record<string, any> = {
      left_landmarks: leftLandmarks,
      right_landmarks: rightLandmarks
    };
    if (confidenceThreshold !== undefined) {
      payload.confidence_threshold = confidenceThreshold;
    }

    const res = await fetchWithTimeout(`${API_BASE}/predict/two-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 4000);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Two-hand prediction failed');
    }

    return res.json();
  },

  async getHistory(userId?: string, limit = 50): Promise<HistoryResponse> {
    const url = new URL(`${API_BASE}/history`);
    if (userId) url.searchParams.set('user_id', userId);
    url.searchParams.set('limit', String(limit));

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async saveHistory(entry: {
    predicted_label: string;
    english_meaning: string;
    confidence?: number;
    recognition_mode?: string;
    user_id?: string;
  }): Promise<HistoryItem> {
    const res = await fetchWithTimeout(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      throw new Error(`Failed to save history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async clearHistory(userId?: string): Promise<{ success: boolean; deleted_count: number }> {
    const url = new URL(`${API_BASE}/history`);
    if (userId) url.searchParams.set('user_id', userId);

    const res = await fetchWithTimeout(url.toString(), {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to clear history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getDatasetStats(): Promise<DatasetStats> {
    const res = await fetchWithTimeout(`${API_BASE}/dataset/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch dataset stats: HTTP ${res.status}`);
    }
    return res.json();
  },

  async saveDatasetSample(sample: {
    label: string;
    features: number[];
    handedness?: string;
    session_id?: string;
  }): Promise<{ success: boolean }> {
    const res = await fetchWithTimeout(`${API_BASE}/dataset/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample)
    });
    if (!res.ok) {
      throw new Error(`Failed to save dataset sample: HTTP ${res.status}`);
    }
    return res.json();
  },

  async triggerRetrain(): Promise<{ success: boolean; message: string; test_accuracy?: number }> {
    const res = await fetchWithTimeout(`${API_BASE}/dataset/train`, {
      method: 'POST'
    }, 30000); // 30s timeout for training
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Retraining failed' }));
      throw new Error(err.detail || 'Retraining failed');
    }
    return res.json();
  },

  getExportDatasetUrl(): string {
    return `${API_BASE}/dataset/export`;
  },

  async validateDataset(): Promise<{
    is_valid: boolean;
    status: string;
    message: string;
    total_samples: number;
    classes_count: number;
    class_counts: Record<string, number>;
    min_samples_per_class: number;
    max_samples_per_class: number;
    corrupted_rows: number;
    recommendation: string;
  }> {
    const res = await fetchWithTimeout(`${API_BASE}/dataset/validate`);
    if (!res.ok) {
      throw new Error(`Failed to validate dataset: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getVocabulary(): Promise<{ total_gestures: number; active_classes_count: number; gestures: GestureVocabularyEntry[] }> {
    const res = await fetchWithTimeout(`${API_BASE}/vocabulary`);
    if (!res.ok) {
      throw new Error(`Failed to load vocabulary: HTTP ${res.status}`);
    }
    return res.json();
  },

  async createGesture(entry: Partial<GestureVocabularyEntry>): Promise<{ success: boolean; message: string; gesture: GestureVocabularyEntry }> {
    const res = await fetchWithTimeout(`${API_BASE}/vocabulary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to create gesture');
    }
    return res.json();
  },

  async deleteGesture(gestureId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithTimeout(`${API_BASE}/vocabulary/${gestureId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to delete gesture');
    }
    return res.json();
  },

  async getModelVersions(): Promise<{ total_versions: number; active_version: string; versions: ModelVersionEntry[] }> {
    const res = await fetchWithTimeout(`${API_BASE}/models/versions`);
    if (!res.ok) {
      throw new Error(`Failed to load model versions: HTTP ${res.status}`);
    }
    return res.json();
  },

  async activateModelVersion(version: string): Promise<{ success: boolean; message: string; activated_version: string; classes_count?: number }> {
    const res = await fetchWithTimeout(`${API_BASE}/models/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to activate model version');
    }
    return res.json();
  },

  async translateSentence(tokens: string[]): Promise<SentenceTranslationResult> {
    const res = await fetchWithTimeout(`${API_BASE}/translate/sentence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens })
    });
    if (!res.ok) {
      throw new Error(`Sentence translation failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getQuickPhraseCategories(): Promise<QuickPhraseCategory[]> {
    const res = await fetchWithTimeout(`${API_BASE}/translate/categories`);
    if (!res.ok) {
      throw new Error(`Failed to fetch phrase categories: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getQuickPhrases(category?: string, search?: string): Promise<QuickPhraseListResponse> {
    const url = new URL(`${API_BASE}/translate/phrases`);
    if (category && category !== 'all') {
      url.searchParams.set('category', category);
    }
    if (search && search.trim()) {
      url.searchParams.set('search', search.trim());
    }
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch quick phrases: HTTP ${res.status}`);
    }
    return res.json();
  },

  // =========================================================================
  // Authentication & Profile Services
  // =========================================================================

  getAuthToken(): string | null {
    return getStoredToken();
  },

  setAuthToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Ignore localStorage errors
    }
  },

  clearAuthToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore localStorage errors
    }
  },

  async register(
    email: string,
    password: string,
    displayName: string,
    preferredLanguage = 'en'
  ): Promise<AuthResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
        preferred_language: preferredLanguage
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Registration failed (HTTP ${res.status})` }));
      throw new Error(err.detail || 'Registration failed');
    }
    const data: AuthResponse = await res.json();
    if (data.token) {
      this.setAuthToken(data.token);
    }
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Login failed (HTTP ${res.status})` }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data: AuthResponse = await res.json();
    if (data.token) {
      this.setAuthToken(data.token);
    }
    return data;
  },

  async getProfile(): Promise<UserProfile> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/me`);
    if (!res.ok) {
      if (res.status === 401) {
        this.clearAuthToken();
      }
      throw new Error(`Failed to load profile: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateProfile(updates: { display_name?: string; preferred_language?: string }): Promise<UserProfile> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Failed to update profile (HTTP ${res.status})` }));
      throw new Error(err.detail || 'Failed to update profile');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    try {
      await fetchWithTimeout(`${API_BASE}/auth/logout`, {
        method: 'POST'
      });
    } catch {
      // Best effort remote logout
    } finally {
      this.clearAuthToken();
    }
  },

  async requestPasswordRecovery(email: string): Promise<{ message: string; simulated?: boolean }> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Password recovery request failed' }));
      throw new Error(err.detail || 'Password recovery request failed');
    }
    return res.json();
  },

  // =========================================================================
  // Confirmed Sentence History Services
  // =========================================================================

  async saveConfirmedSentence(entry: {
    original_signs: string[] | string;
    confirmed_sentence: string;
    english_output?: string;
    telugu_output?: string;
    romanized_output?: string;
    selected_language?: string;
    recognition_mode?: string;
    source_mode?: 'camera_recognition' | 'quick_phrase' | string;
  }): Promise<SentenceHistoryEntry> {
    const res = await fetchWithTimeout(`${API_BASE}/history/sentence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Failed to save sentence: HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to save confirmed sentence');
    }
    return res.json();
  },

  async getSentenceHistory(limit = 50): Promise<SentenceHistoryResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/history/sentence?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch sentence history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async clearSentenceHistory(): Promise<{ success: boolean; deleted_count: number }> {
    const res = await fetchWithTimeout(`${API_BASE}/history/sentence`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to clear sentence history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteSentence(id: string): Promise<{ success: boolean; deleted_id: string }> {
    const res = await fetchWithTimeout(`${API_BASE}/history/sentence/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to delete sentence record: HTTP ${res.status}`);
    }
    return res.json();
  },

  // =========================================================================
  // Excel (.xlsx) Export Services
  // =========================================================================

  getExcelExportUrl(): string {
    return `${API_BASE}/history/export/excel`;
  },

  async downloadExcelExport(): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE}/history/export/excel`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Download failed with HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to download Excel file');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `SignBridgeAI_History_${dateStr}.xlsx`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
