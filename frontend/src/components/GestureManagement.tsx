import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  PlusCircle,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import type { GestureVocabularyEntry, ModelVersionEntry } from '../types';

interface GestureManagementProps {
  onNavigateToStudio?: (selectedClassId?: string) => void;
  onNavigateToCollect?: (selectedClassId: string) => void;
  onModelUpdated?: () => void;
}

export const GestureManagement: React.FC<GestureManagementProps> = ({
  onNavigateToStudio,
  onNavigateToCollect,
  onModelUpdated
}) => {
  const handleCollectNav = onNavigateToCollect || onNavigateToStudio;
  const [gestures, setGestures] = useState<GestureVocabularyEntry[]>([]);
  const [modelVersions, setModelVersions] = useState<ModelVersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState<string>('v1.0.0');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readinessFilter, setReadinessFilter] = useState<string>('all');

  // New Gesture Form Modal/Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formTelugu, setFormTelugu] = useState<string>('');
  const [formRomanized, setFormRomanized] = useState<string>('');
  const [formType, setFormType] = useState<'static' | 'dynamic' | 'verified_isl'>('static');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSentenceEn, setFormSentenceEn] = useState<string>('');
  const [formSentenceTe, setFormSentenceTe] = useState<string>('');
  const [formSentenceRo, setFormSentenceRo] = useState<string>('');

  // Load vocabulary & model versions
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vocabData, versionsData] = await Promise.all([
        api.getVocabulary(),
        api.getModelVersions().catch(() => ({ total_versions: 0, active_version: 'v1.0.0', versions: [] }))
      ]);
      setGestures(vocabData.gestures);
      setModelVersions(versionsData.versions);
      setActiveVersion(versionsData.active_version);
    } catch (err: any) {
      console.warn('Failed to load vocabulary:', err);
      setStatusMessage({ text: `Failed to load vocabulary: ${err.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Gesture
  const handleCreateGesture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim()) {
      setStatusMessage({ text: 'Gesture ID and English Name are required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createGesture({
        id: formId.trim().toUpperCase().replace(/\s+/g, '_'),
        name: formName.trim(),
        telugu: formTelugu.trim(),
        telugu_romanized: formRomanized.trim(),
        gesture_type: formType,
        description: formDescription.trim(),
        example_sentence_en: formSentenceEn.trim(),
        example_sentence_te: formSentenceTe.trim(),
        example_sentence_ro: formSentenceRo.trim()
      });

      setStatusMessage({ text: res.message, type: 'success' });
      setIsAddModalOpen(false);
      // Reset form
      setFormId('');
      setFormName('');
      setFormTelugu('');
      setFormRomanized('');
      setFormDescription('');
      setFormSentenceEn('');
      setFormSentenceTe('');
      setFormSentenceRo('');
      await loadData();
    } catch (err: any) {
      setStatusMessage({ text: `Creation failed: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Gesture
  const handleDeleteGesture = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete custom gesture '${id}' from vocabulary?`)) {
      return;
    }

    try {
      const res = await api.deleteGesture(id);
      setStatusMessage({ text: res.message, type: 'success' });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ text: `Deletion failed: ${err.message}`, type: 'error' });
    }
  };

  // Handle Rollback / Activate Model Version
  const handleActivateVersion = async (targetVer: string) => {
    if (!window.confirm(`Rollback and activate model version '${targetVer}'?`)) {
      return;
    }

    setIsActivating(true);
    try {
      const res = await api.activateModelVersion(targetVer);
      setStatusMessage({
        text: `${res.message} Active classes: ${res.classes_count}.`,
        type: 'success'
      });
      await loadData();
      onModelUpdated?.();
    } catch (err: any) {
      setStatusMessage({ text: `Version activation failed: ${err.message}`, type: 'error' });
    } finally {
      setIsActivating(false);
    }
  };

  // Trigger Retraining
  const handleRetrain = async () => {
    setIsRetraining(true);
    setStatusMessage({ text: 'Training custom Random Forest model and registering new version...', type: 'info' });
    try {
      const res = await api.triggerRetrain();
      setStatusMessage({
        text: `Retraining completed! Registered version ${res.test_accuracy ? `with ${(res.test_accuracy * 100).toFixed(1)}% test accuracy.` : '.'}`,
        type: 'success'
      });
      await loadData();
      onModelUpdated?.();
    } catch (err: any) {
      setStatusMessage({ text: `Retraining error: ${err.message}`, type: 'error' });
    } finally {
      setIsRetraining(false);
    }
  };

  // Filtered Gestures
  const filteredGestures = gestures.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.telugu && g.telugu.includes(searchQuery)) ||
      (g.telugu_romanized && g.telugu_romanized.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'all' || g.gesture_type === typeFilter;
    const matchesReadiness = readinessFilter === 'all' || g.readiness === readinessFilter;

    return matchesSearch && matchesType && matchesReadiness;
  });

  return (
    <div style={{ padding: '10px 0 40px 0' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#818cf8" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Manage Gestures & Multilingual Vocabulary</h2>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Dynamically expand gestures, configure English & Telugu script translations, collect samples, and manage model versions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => window.open(api.getExportDatasetUrl(), '_blank')}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            <PlusCircle size={15} />
            <span>Add New Gesture</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleRetrain}
            disabled={isRetraining}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={isRetraining ? 'animate-spin' : ''} />
            <span>{isRetraining ? 'Training...' : 'Retrain Model'}</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background:
              statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : statusMessage.type === 'error'
                ? 'rgba(244, 63, 94, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
            color:
              statusMessage.type === 'success'
                ? '#34d399'
                : statusMessage.type === 'error'
                ? '#fb7185'
                : '#c7d2fe',
            border: `1px solid ${
              statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.3)'
                : statusMessage.type === 'error'
                ? 'rgba(244, 63, 94, 0.3)'
                : 'rgba(99, 102, 241, 0.3)'
            }`
          }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle size={18} />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <RefreshCw size={18} className="animate-spin" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Model Versions History & Rollback Card */}
      {modelVersions.length > 0 && (
        <div className="glass-panel" style={{ padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={16} color="#818cf8" />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700 }}>Model Version History & Rollback Registry</h3>
            </div>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
              Active Model: {activeVersion}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {modelVersions.map((ver) => (
              <div
                key={ver.version}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: ver.version === activeVersion ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: ver.version === activeVersion ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>{ver.version}</strong>
                    {ver.version === activeVersion ? (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Active</span>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleActivateVersion(ver.version)}
                        disabled={isActivating}
                        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                      >
                        Rollback
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Accuracy: <strong style={{ color: '#34d399' }}>{(ver.test_accuracy * 100).toFixed(1)}%</strong> | Classes: {ver.classes_count}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Samples: {ver.total_samples} | {new Date(ver.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search English, Telugu, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.84rem'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#111827',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.78rem'
              }}
            >
              <option value="all">All Types</option>
              <option value="verified_isl">Verified ISL</option>
              <option value="static">Static Gestures</option>
              <option value="dynamic">Dynamic Sequences</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Status:</span>
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#111827',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.78rem'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active_trained">Active & Trained</option>
              <option value="ready_to_train">Ready to Train (&gt;=15)</option>
              <option value="needs_data">Needs Data (&lt;15)</option>
              <option value="pretrained_supported">Pretrained MediaPipe</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vocabulary Cards Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          <div>Loading gesture vocabulary...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredGestures.map((item) => (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: item.readiness === 'active_trained'
                  ? '3px solid #10b981'
                  : item.readiness === 'ready_to_train'
                  ? '3px solid #6366f1'
                  : item.readiness === 'pretrained_supported'
                  ? '3px solid #38bdf8'
                  : '3px solid #f59e0b'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>{item.name}</h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ID: {item.id}</span>
                  </div>

                  <span
                    className={`badge ${
                      item.readiness === 'active_trained'
                        ? 'badge-success'
                        : item.readiness === 'ready_to_train'
                        ? 'badge-primary'
                        : item.readiness === 'pretrained_supported'
                        ? 'badge-neutral'
                        : 'badge-warning'
                    }`}
                    style={{ fontSize: '0.68rem' }}
                  >
                    {item.readiness === 'active_trained' && 'Active Trained'}
                    {item.readiness === 'ready_to_train' && 'Ready to Train'}
                    {item.readiness === 'pretrained_supported' && 'Pretrained'}
                    {item.readiness === 'needs_data' && 'Needs Data'}
                  </span>
                </div>

                {/* Multilingual Representations */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Telugu Script:</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', fontFamily: "'Noto Sans Telugu', 'Gautami', sans-serif" }}>
                      {item.telugu || '—'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Romanized Telugu:</span>
                    <div style={{ fontSize: '0.84rem', color: '#c7d2fe', fontWeight: 500 }}>
                      {item.telugu_romanized || '—'}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '10px' }}>
                  {item.description || 'No description provided.'}
                </p>

                {/* Readiness & Sample Count Information */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span>Type: <strong style={{ color: '#ffffff' }}>{item.gesture_type.replace('_', ' ')}</strong></span>
                  <span>Dataset: <strong style={{ color: '#34d399' }}>{item.sample_count || 0} samples</strong></span>
                </div>

                <div style={{ fontSize: '0.74rem', color: item.readiness === 'needs_data' ? '#fcd34d' : 'var(--text-secondary)', marginBottom: '12px' }}>
                  {item.readiness_description}
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleCollectNav?.(item.id)}
                  style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                >
                  <span>Collect Samples</span>
                  <ArrowRight size={12} />
                </button>

                {item.is_deletable && (
                  <button
                    onClick={() => handleDeleteGesture(item.id)}
                    style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: '4px' }}
                    title="Delete custom gesture"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Gesture Modal */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#818cf8" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Register New Custom Gesture</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateGesture} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Unique Gesture ID (Uppercase):
                </label>
                <input
                  type="text"
                  placeholder="e.g., ISL_NAMASTE or GESTURE_HELLO"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.84rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    English Display Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Namaste / Greeting"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.84rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Gesture Type:
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#111827',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.84rem'
                    }}
                  >
                    <option value="static">Static Gesture (Single Hand)</option>
                    <option value="verified_isl">Verified ISL Sign</option>
                    <option value="dynamic">Dynamic Sequence (Motion)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Telugu Script Translation:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., నమస్కారం"
                    value={formTelugu}
                    onChange={(e) => setFormTelugu(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#38bdf8',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Romanized Telugu:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Namaskaram"
                    value={formRomanized}
                    onChange={(e) => setFormRomanized(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.84rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Hand Shape & Kinematic Description:
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe finger position, orientation, and cues..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.84rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registering...' : 'Save to Vocabulary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
