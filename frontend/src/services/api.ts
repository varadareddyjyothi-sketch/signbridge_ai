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

function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim();
    return trimmed.replace(/\/+$/, '');
  }

  // Local Vite dev and preview servers use the separate backend on port 8000.
  if (!import.meta.env.PROD || ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:8000';
  }

  // In production: empty string means same-origin relative calls (unified container or reverse proxy)
  return '';
}

const API_BASE = resolveApiBase();
const TOKEN_KEY = 'signbridge_auth_token';

// Preserved token for cross-origin or persistent session

function buildApiUrl(path: string): URL {
  return new URL(`${API_BASE}${path}`, window.location.origin);
}

function isKnownStaticHostingDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return ['.vercel.app', '.netlify.app', '.onrender.com'].some((suffix) => hostname.endsWith(suffix));
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string') {
          return item.msg;
        }
        return null;
      })
      .filter((message): message is string => message !== null);
    if (messages.length > 0) return messages.join('; ');
  }
  return fallback;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
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
      credentials: 'include',
      signal: controller.signal
    });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Server request timed out (10s). Please check your internet or backend connection.');
    }
    if (err?.message === 'Failed to fetch' || err instanceof TypeError) {
      const target = API_BASE || window.location.origin;
      throw new Error(
        `Cannot connect to SignBridge backend at ${target}. Please verify backend server availability and network connectivity.`
      );
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

async function safeJsonParse(response: Response, endpointDesc: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (response.status === 404) {
      if (!API_BASE && isKnownStaticHostingDomain()) {
        throw new Error(
          'SignBridge backend is not configured for this static deployment. Set VITE_API_BASE_URL to the backend service URL.'
        );
      }
      throw new Error(`API endpoint '${endpointDesc}' not found (HTTP 404).`);
    }

    if (contentType.includes('application/json')) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.detail || `${endpointDesc} failed (HTTP ${response.status})`);
    }
    throw new Error(`${endpointDesc} failed (HTTP ${response.status})`);
  }

  // If response is OK but returned HTML instead of JSON (e.g. SPA fallback on unknown route)
  if (!contentType.includes('application/json') && contentType.includes('text/html')) {
    if (!API_BASE && isKnownStaticHostingDomain()) {
      throw new Error(
        'SignBridge backend is not configured for this static deployment. Set VITE_API_BASE_URL to the backend service URL.'
      );
    }
    throw new Error(
      `Received HTML instead of JSON for '${endpointDesc}'. Ensure the backend API server is online and route is mapped.`
    );
  }

  return response.json();
}

export const api = {
  getBaseUrl(): string {
    return API_BASE;
  },

  async getHealth(): Promise<HealthStatus> {
    const res = await fetchWithTimeout(`${API_BASE}/health`);
    return safeJsonParse(res, 'Health check');
  },

  async getModelStatus(): Promise<ModelStatus> {
    const res = await fetchWithTimeout(`${API_BASE}/model/status`);
    return safeJsonParse(res, 'Model status');
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
    }
    if (landmarks && landmarks.length > 0) {
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
    const url = buildApiUrl('/history');
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
    telugu?: string;
    telugu_romanized?: string;
    hindi?: string;
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
    const url = buildApiUrl('/history');
    if (userId) url.searchParams.set('user_id', userId);

    const res = await fetchWithTimeout(url.toString(), {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to clear history: HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteHistory(id: string): Promise<{ success: boolean; deleted_id: string }> {
    const res = await fetchWithTimeout(`${API_BASE}/history/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Failed to delete record: HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to delete recognition record');
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
    const url = buildApiUrl('/translate/phrases');
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
      throw new Error(formatApiError(err.detail, `Registration failed (HTTP ${res.status})`));
    }
    const data: AuthResponse = await res.json();
    if (data.token) {
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {}
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
      throw new Error(formatApiError(err.detail, `Login failed (HTTP ${res.status})`));
    }
    const data: AuthResponse = await res.json();
    if (data.token) {
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {}
    }
    return data;
  },

  async getProfile(): Promise<UserProfile> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/me`);
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('No active session');
      }
      const error = await res.json().catch(() => ({ detail: `Failed to load profile (HTTP ${res.status})` }));
      throw new Error(formatApiError(error.detail, `Failed to load profile (HTTP ${res.status})`));
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
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    const res = await fetchWithTimeout(`${API_BASE}/auth/logout`, {
      method: 'POST'
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: `Logout failed (HTTP ${res.status})` }));
      throw new Error(formatApiError(error.detail, `Logout failed (HTTP ${res.status})`));
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
  // Multilingual Speech & Text Translation
  // =========================================================================

  async translateText(payload: {
    text: string;
    source_lang?: string;
    target_lang?: string;
  }): Promise<{
    original_text: string;
    source_lang: string;
    target_lang: string;
    translated_text: string;
    romanized_text?: string;
    english_text?: string;
    telugu_text?: string;
    hindi_text?: string;
    confidence: number;
    method: string;
  }> {
    const res = await fetchWithTimeout(`${API_BASE}/translate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: payload.text,
        source_lang: payload.source_lang || 'en',
        target_lang: payload.target_lang || 'te'
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Translation request failed (HTTP ${res.status})` }));
      throw new Error(err.detail || 'Translation request failed');
    }
    return res.json();
  },

  async transliterate(text: string, script = 'telugu'): Promise<{ original_text: string; script: string; romanized_text: string }> {
    const res = await fetchWithTimeout(`${API_BASE}/translate/transliterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, script })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Transliteration request failed (HTTP ${res.status})` }));
      throw new Error(err.detail || 'Transliteration request failed');
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
