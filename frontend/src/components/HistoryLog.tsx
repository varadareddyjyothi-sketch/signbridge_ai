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
    <div style={{ padding: '6px 0 32px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Recognition & Sentence History
            </h2>
          </div>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
            Log of your confirmed sentences and verified gesture recognitions with Excel export.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Export to Excel Button */}
          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: '7px 14px',
              fontSize: '0.84rem',
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#047857',
              fontWeight: 600
            }}
            title="Download complete sentence and recognition history as a styled Excel workbook (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Generating .xlsx...' : 'Export to Excel (.xlsx)'}</span>
          </button>

          {/* Storage Badge */}
          <div
            className="badge badge-neutral"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '0.75rem' }}
          >
            {currentStorageMode === 'supabase' ? (
              <>
                <ShieldCheck size={13} color="#059669" />
                <span>Cloud (Supabase)</span>
              </>
            ) : (
              <>
                <HardDrive size={13} color="#d97706" />
                <span>Local (SQLite)</span>
              </>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={loadHistory}
            disabled={isLoading}
            style={{ padding: '7px 12px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {((activeTab === 'sentences' && sentences.length > 0) || (activeTab === 'gestures' && gestures.length > 0)) && (
            <button
              className="btn btn-danger"
              onClick={handleClear}
              disabled={isClearing}
              style={{ padding: '7px 12px', fontSize: '0.82rem' }}
            >
              <Trash2 size={14} />
              <span>Clear {activeTab === 'sentences' ? 'Sentences' : 'Detections'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('sentences')}
          className={`btn ${activeTab === 'sentences' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem' }}
        >
          <Languages size={14} />
          <span>Confirmed Sentences ({sentences.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('gestures')}
          className={`btn ${activeTab === 'gestures' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem' }}
        >
          <Layers size={14} />
          <span>Gesture Detections ({gestures.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          <p>Loading history records...</p>
        </div>
      ) : activeTab === 'sentences' ? (
        /* Confirmed Sentences View */
        sentences.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Languages size={24} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>No Confirmed Sentences Yet</h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
              Build and confirm sentences in the "Build Your Sentence" workspace to save them here and export to Excel.
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
                {sentences.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s' }}
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
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#e11d48' }}
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
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Clock size={24} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>No Gesture Detections Yet</h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '340px', margin: '0 auto' }}>
              Signs recognized through the camera will appear here.
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
                </tr>
              </thead>
              <tbody>
                {gestures.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s' }}
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
