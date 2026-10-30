import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  Clock,
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  Languages,
  Layers,
  Copy,
  Check,
  Volume2,
  AlertCircle,
  CheckCircle2,
  User,
  X,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import { ttsService } from '../services/speech';
import type { HistoryItem, SentenceHistoryEntry, UserProfile } from '../types';

interface HistoryLogProps {
  currentUser?: UserProfile | null;
}

export const HistoryLog: React.FC<HistoryLogProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'sentences' | 'gestures'>('sentences');

  // Confirmed Sentences state
  const [sentences, setSentences] = useState<SentenceHistoryEntry[]>([]);
  const [sentenceStorageMode, setSentenceStorageMode] = useState<string>('local_sqlite');

  // Gesture frames state
  const [gestures, setGestures] = useState<HistoryItem[]>([]);
  const [gestureStorageMode, setGestureStorageMode] = useState<string>('local_sqlite');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Status feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => {
        setFeedback((prev) => (prev?.message === message ? null : prev));
      }, 3500);
    }
  };

  const loadHistory = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      const [sentRes, gestRes] = await Promise.allSettled([
        api.getSentenceHistory(100),
        api.getHistory(undefined, 100)
      ]);

      let hasSuccess = false;
      let errorMsg = '';

      if (sentRes.status === 'fulfilled') {
        setSentences(sentRes.value.items);
        setSentenceStorageMode(sentRes.value.storage_mode);
        hasSuccess = true;
      } else {
        errorMsg = sentRes.reason?.message || 'Failed to fetch sentence history';
      }

      if (gestRes.status === 'fulfilled') {
        setGestures(gestRes.value.items);
        setGestureStorageMode(gestRes.value.storage_mode);
        hasSuccess = true;
      } else {
        if (!errorMsg) errorMsg = gestRes.reason?.message || 'Failed to fetch recognition history';
      }

      if (hasSuccess) {
        if (isManualRefresh) {
          showFeedback('success', 'History successfully refreshed with the latest database records.');
        }
      } else {
        showFeedback('error', errorMsg || 'Unable to load history. Please verify backend connection.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to communicate with history service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload history whenever active tab mounts or authenticated user changes
  useEffect(() => {
    loadHistory(false);
  }, [loadHistory, currentUser?.id]);

  // Clear current tab
  const handleClearCurrentTab = async () => {
    const isSentences = activeTab === 'sentences';
    const msg = isSentences
      ? 'Are you sure you want to permanently clear all your confirmed sentence records from the database?'
      : 'Are you sure you want to permanently clear all your gesture detection records from the database?';

    if (!window.confirm(msg)) return;

    setIsClearing(true);
    try {
      if (isSentences) {
        const res = await api.clearSentenceHistory();
        setSentences([]);
        showFeedback('success', `Cleared ${res.deleted_count} sentence records from persistent storage.`);
      } else {
        const res = await api.clearHistory();
        setGestures([]);
        showFeedback('success', `Cleared ${res.deleted_count} gesture detection records from persistent storage.`);
      }
    } catch (err: any) {
      showFeedback('error', `Failed to clear history: ${err.message || 'Database error'}`);
    } finally {
      setIsClearing(false);
    }
  };

  // Clear all history (both sentences and detections)
  const handleClearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL history records (both sentences and gesture detections)? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const [sentClear, gestClear] = await Promise.all([
        api.clearSentenceHistory(),
        api.clearHistory()
      ]);
      setSentences([]);
      setGestures([]);
      const totalDeleted = (sentClear.deleted_count || 0) + (gestClear.deleted_count || 0);
      showFeedback('success', `Permanently deleted all history records (${totalDeleted} total entries removed).`);
    } catch (err: any) {
      showFeedback('error', `Failed to clear all history: ${err.message || 'Database error'}`);
    } finally {
      setIsClearing(false);
    }
  };

  // Delete individual sentence
  const handleDeleteSingleSentence = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this confirmed sentence record from the database?')) {
      return;
    }
    setDeletingId(recordId);
    try {
      await api.deleteSentence(recordId);
      setSentences((prev) => prev.filter((item) => item.id !== recordId));
      showFeedback('success', 'Sentence record deleted successfully.');
    } catch (err: any) {
      showFeedback('error', `Failed to delete sentence record: ${err.message || 'Error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Delete individual gesture detection
  const handleDeleteSingleGesture = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this gesture recognition record from the database?')) {
      return;
    }
    setDeletingId(recordId);
    try {
      await api.deleteHistory(recordId);
      setGestures((prev) => prev.filter((item) => item.id !== recordId));
      showFeedback('success', 'Gesture recognition record deleted successfully.');
    } catch (err: any) {
      showFeedback('error', `Failed to delete recognition record: ${err.message || 'Error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await api.downloadExcelExport();
      showFeedback('success', 'Excel workbook downloaded successfully.');
    } catch (err: any) {
      showFeedback('error', `Export failed: ${err.message || 'Network error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string, lang: 'en' | 'te' = 'en') => {
    ttsService.speak(text, lang);
  };

  const currentStorageMode = activeTab === 'sentences' ? sentenceStorageMode : gestureStorageMode;
  const currentTabCount = activeTab === 'sentences' ? sentences.length : gestures.length;
  const totalCount = sentences.length + gestures.length;

  const filteredSentences = useMemo(() => {
    if (!searchQuery.trim()) return sentences;
    const q = searchQuery.toLowerCase();
    return sentences.filter((s) =>
      s.confirmed_sentence.toLowerCase().includes(q) ||
      s.original_signs.toLowerCase().includes(q) ||
      (s.telugu_output && s.telugu_output.toLowerCase().includes(q)) ||
      (s.romanized_output && s.romanized_output.toLowerCase().includes(q))
    );
  }, [sentences, searchQuery]);

  const filteredGestures = useMemo(() => {
    if (!searchQuery.trim()) return gestures;
    const q = searchQuery.toLowerCase();
    return gestures.filter((g) =>
      g.predicted_label.toLowerCase().includes(q) ||
      g.english_meaning.toLowerCase().includes(q)
    );
  }, [gestures, searchQuery]);

  return (
    <div style={{ padding: '6px 0 32px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Recognition & Activity History
            </h2>
          </div>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
            Inspect, refresh, export, and manage your verified sign recognitions and confirmed sentence records.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* User Isolation Scope Badge */}
          <div
            className="badge badge-neutral"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', fontSize: '0.76rem', background: '#f1f5f9' }}
            title={currentUser ? `Scoped to authenticated account: ${currentUser.email}` : 'Scoped to current local guest session'}
          >
            <User size={13} color="#475569" />
            <span>{currentUser ? currentUser.display_name : 'Guest Session (Local)'}</span>
          </div>

          {/* Storage Badge */}
          <div
            className="badge badge-neutral"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', fontSize: '0.76rem' }}
          >
            {currentStorageMode === 'mongodb' ? (
              <>
                <ShieldCheck size={13} color="#059669" />
                <span>Cloud (MongoDB Atlas)</span>
              </>
            ) : (
              <>
                <HardDrive size={13} color="#d97706" />
                <span>Local (SQLite)</span>
              </>
            )}
          </div>

          {/* Export to Excel Button */}
          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: '7px 13px',
              fontSize: '0.82rem',
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#047857',
              fontWeight: 600
            }}
            title="Download complete activity history as a styled Excel workbook (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Generating...' : 'Export (.xlsx)'}</span>
          </button>

          {/* Refresh Button */}
          <button
            className="btn btn-secondary"
            onClick={() => loadHistory(true)}
            disabled={isLoading}
            style={{ padding: '7px 12px', fontSize: '0.82rem' }}
            title="Fetch the latest database records"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Clear Current Tab Button */}
          {currentTabCount > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleClearCurrentTab}
              disabled={isClearing || isLoading}
              style={{ padding: '7px 12px', fontSize: '0.82rem', color: '#b91c1c', borderColor: '#fecaca' }}
              title={`Clear records from the current ${activeTab === 'sentences' ? 'sentences' : 'gestures'} tab`}
            >
              <Trash2 size={14} />
              <span>Clear {activeTab === 'sentences' ? 'Sentences' : 'Detections'}</span>
            </button>
          )}

          {/* Clear All History Button */}
          {totalCount > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleClearAllHistory}
              disabled={isClearing || isLoading}
              style={{ padding: '7px 12px', fontSize: '0.82rem' }}
              title="Permanently delete all activity history (both sentences and detections)"
            >
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* User Feedback Notification Banner */}
      {feedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#166534' : '#991b1b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation Tabs & Search Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('sentences')}
            className={`btn ${activeTab === 'sentences' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.84rem' }}
          >
            <Languages size={14} />
            <span>Confirmed Sentences ({filteredSentences.length}{searchQuery ? ` of ${sentences.length}` : ''})</span>
          </button>
          <button
            onClick={() => setActiveTab('gestures')}
            className={`btn ${activeTab === 'gestures' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.84rem' }}
          >
            <Layers size={14} />
            <span>Gesture Detections ({filteredGestures.length}{searchQuery ? ` of ${gestures.length}` : ''})</span>
          </button>
        </div>

        {/* Real-time Search Box */}
        <div style={{ position: 'relative', minWidth: '220px', maxWidth: '320px', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'sentences' ? "Filter sentences or signs..." : "Filter gesture labels or meanings..."}
            style={{
              width: '100%',
              paddingLeft: '32px',
              paddingRight: searchQuery ? '28px' : '10px',
              paddingTop: '6px',
              paddingBottom: '6px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '7px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
              title="Clear search filter"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table / State Container */}
      {isLoading ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#2563eb' }} />
          <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Fetching records from database...</p>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Checking {currentStorageMode === 'mongodb' ? 'MongoDB Atlas cloud' : 'local SQLite storage'}</span>
        </div>
      ) : activeTab === 'sentences' ? (
        /* Confirmed Sentences View */
        filteredSentences.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Languages size={24} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              {searchQuery ? 'No Matching Sentences Found' : 'No Confirmed Sentences Yet'}
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
              {searchQuery ? `No sentences match "${searchQuery}". Clear your search query to see all records.` : 'When you confirm sentences in the communication workspace, they will be securely stored in MongoDB and included in your Excel export.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Original Signs</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Confirmed Sentence</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Telugu Script (తెలుగు)</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Romanized Telugu</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSentences.map((row) => {
                  const isDeleting = deletingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {new Date(row.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                          {row.original_signs}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 600, fontSize: '0.92rem' }}>
                        {row.confirmed_sentence}
                      </td>
                      <td style={{ padding: '12px 16px', color: row.telugu_output ? '#0284c7' : '#94a3b8', fontWeight: row.telugu_output ? 600 : 400, fontFamily: '"Anek Telugu", "Noto Sans Telugu", sans-serif' }}>
                        {row.telugu_output || <span style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>Translation unavailable</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontStyle: 'italic', fontSize: '0.82rem' }}>
                        {row.romanized_output || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleCopy(row.confirmed_sentence, row.id)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Copy confirmed sentence"
                          >
                            {copiedId === row.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleSpeak(row.confirmed_sentence, 'en')}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Speak sentence"
                          >
                            <Volume2 size={13} color="#2563eb" />
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDeleteSingleSentence(row.id)}
                            disabled={isDeleting}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#e11d48' }}
                            title="Delete this sentence record permanently"
                          >
                            <Trash2 size={13} className={isDeleting ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Raw Gesture Detections View */
        filteredGestures.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Clock size={24} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              {searchQuery ? 'No Matching Gesture Detections' : 'No Gesture Detections Yet'}
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '340px', margin: '0 auto' }}>
              {searchQuery ? `No gestures match "${searchQuery}". Clear your search query to see all records.` : 'Signs recognized through the camera will automatically be recorded in MongoDB Atlas.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Time</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Sign Label</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Meaning</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Confidence</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Storage Source</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGestures.map((row) => {
                  const isDeleting = deletingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                          {row.predicted_label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 600 }}>
                        {row.english_meaning}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {row.confidence !== null && row.confidence !== undefined ? (
                          <span style={{ color: '#059669', fontWeight: 700 }}>
                            {Math.round(row.confidence * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                          {row.storage_source === 'mongodb' ? 'Cloud (MongoDB)' : 'Local SQLite'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDeleteSingleGesture(row.id)}
                            disabled={isDeleting}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#e11d48' }}
                            title="Delete this recognition record permanently"
                          >
                            <Trash2 size={13} className={isDeleting ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};
