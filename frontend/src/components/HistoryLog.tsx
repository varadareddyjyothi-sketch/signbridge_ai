import React, { useState, useEffect, useCallback } from 'react';
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
  Volume2
} from 'lucide-react';
import { api } from '../services/api';
import { ttsService } from '../services/speech';
import type { HistoryItem, SentenceHistoryEntry } from '../types';

export const HistoryLog: React.FC = () => {
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sentRes, gestRes] = await Promise.allSettled([
        api.getSentenceHistory(50),
        api.getHistory(undefined, 50)
      ]);

      if (sentRes.status === 'fulfilled') {
        setSentences(sentRes.value.items);
        setSentenceStorageMode(sentRes.value.storage_mode);
      }
      if (gestRes.status === 'fulfilled') {
        setGestures(gestRes.value.items);
        setGestureStorageMode(gestRes.value.storage_mode);
      }
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    const isSentences = activeTab === 'sentences';
    const msg = isSentences
      ? 'Are you sure you want to clear your confirmed sentence history?'
      : 'Are you sure you want to clear your raw recognition history?';

    if (!window.confirm(msg)) return;

    setIsClearing(true);
    try {
      if (isSentences) {
        await api.clearSentenceHistory();
        setSentences([]);
      } else {
        await api.clearHistory();
        setGestures([]);
      }
    } catch (err) {
      console.warn('Error clearing history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await api.downloadExcelExport();
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Network error'}`);
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

  const handleDeleteSingleSentence = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this saved sentence record?')) return;
    try {
      await api.deleteSentence(recordId);
      setSentences((prev) => prev.filter((item) => item.id !== recordId));
    } catch (err: any) {
      alert(`Failed to delete record: ${err.message || 'Error'}`);
    }
  };

  const currentStorageMode = activeTab === 'sentences' ? sentenceStorageMode : gestureStorageMode;

  return (
    <div style={{ padding: '10px 0 30px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={22} color="#818cf8" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Recognition & Sentence History</h2>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Secure log of your confirmed sentences and verified gesture recognitions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Export to Excel Button */}
          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: '8px 14px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontWeight: 600
            }}
            title="Download complete sentence and recognition history as a styled Excel workbook (.xlsx)"
          >
            <FileSpreadsheet size={16} />
            <span>{isExporting ? 'Generating .xlsx...' : 'Export to Excel (.xlsx)'}</span>
          </button>

          {/* Storage Badge */}
          <div
            className="badge badge-neutral"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
          >
            {currentStorageMode === 'supabase' ? (
              <>
                <ShieldCheck size={14} color="#10b981" />
                <span>Cloud (Supabase)</span>
              </>
            ) : (
              <>
                <HardDrive size={14} color="#f59e0b" />
                <span>Local (SQLite)</span>
              </>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={loadHistory}
            disabled={isLoading}
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {((activeTab === 'sentences' && sentences.length > 0) || (activeTab === 'gestures' && gestures.length > 0)) && (
            <button
              className="btn btn-danger"
              onClick={handleClear}
              disabled={isClearing}
              style={{ padding: '8px 14px' }}
            >
              <Trash2 size={14} />
              <span>Clear {activeTab === 'sentences' ? 'Sentences' : 'Detections'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('sentences')}
          className={`btn ${activeTab === 'sentences' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Languages size={15} />
          <span>Confirmed Sentences ({sentences.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('gestures')}
          className={`btn ${activeTab === 'gestures' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Layers size={15} />
          <span>Gesture Detections ({gestures.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          <p>Loading history records...</p>
        </div>
      ) : activeTab === 'sentences' ? (
        /* Confirmed Sentences View */
        sentences.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Languages size={28} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>No Confirmed Sentences Yet</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
              Build and confirm sentences in the "Build Your Sentence" workspace to save them here and export to Excel.
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Original Signs</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Confirmed Sentence</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Telugu Script (తెలుగు)</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Romanized Telugu</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sentences.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {new Date(row.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                        {row.original_signs}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                      {row.confirmed_sentence}
                    </td>
                    <td style={{ padding: '14px 18px', color: row.telugu_output ? '#67e8f9' : 'var(--text-muted)', fontWeight: row.telugu_output ? 600 : 400, fontFamily: '"Anek Telugu", "Noto Sans Telugu", sans-serif' }}>
                      {row.telugu_output || <span style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>Translation unavailable</span>}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#c7d2fe', fontStyle: 'italic', fontSize: '0.82rem' }}>
                      {row.romanized_output || '—'}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleCopy(row.confirmed_sentence, row.id)}
                          style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                          title="Copy confirmed sentence"
                        >
                          {copiedId === row.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleSpeak(row.confirmed_sentence, 'en')}
                          style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                          title="Speak sentence"
                        >
                          <Volume2 size={13} color="#818cf8" />
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDeleteSingleSentence(row.id)}
                          style={{ padding: '5px 8px', fontSize: '0.75rem', color: '#f87171' }}
                          title="Delete this sentence record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Raw Gesture Detections View */
        gestures.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Clock size={28} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>No Gesture Detections Yet</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto' }}>
              Signs recognized through the camera will appear here.
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Time</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Sign Label</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Meaning</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Confidence</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Storage Source</th>
                </tr>
              </thead>
              <tbody>
                {gestures.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                        {row.predicted_label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>
                      {row.english_meaning}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {row.confidence !== null && row.confidence !== undefined ? (
                        <span style={{ color: '#34d399', fontWeight: 700 }}>
                          {Math.round(row.confidence * 100)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {row.storage_source === 'supabase' ? 'Cloud' : 'Local SQLite'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};
