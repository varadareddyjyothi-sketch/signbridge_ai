import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Camera,
  CheckCircle,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  Zap,
  Download,
  ShieldCheck
} from 'lucide-react';
import { useWebcamHands } from '../hooks/useWebcamHands';
import { api } from '../services/api';
import type { DatasetStats } from '../types';

const ISL_CLASSES = [
  { id: 'ISL_1', label: 'ISL 1 (Index Extended)', desc: 'Index extended, others curled' },
  { id: 'ISL_2', label: 'ISL 2 (Index & Middle V)', desc: 'Index and middle fingers extended' },
  { id: 'ISL_3', label: 'ISL 3 (Three Fingers)', desc: 'Index, middle, and ring extended' },
  { id: 'ISL_4', label: 'ISL 4 (Four Fingers)', desc: 'Four fingers up, thumb tucked' },
  { id: 'ISL_5', label: 'ISL 5 (Open Palm)', desc: 'All 5 fingers open and spread' },
  { id: 'ISL_OK', label: 'ISL OK / Good', desc: 'Thumb & index tip touching circle' },
  { id: 'ISL_YES_THUMBS_UP', label: 'ISL Yes (Thumbs Up)', desc: 'Fist with thumb extended upward' },
  { id: 'ISL_NO_INDEX', label: 'ISL No / Stop', desc: 'Index pointing upright firm' },
  { id: 'ISL_PEACE_VICTORY', label: 'ISL Peace / Victory', desc: 'Wide V-sign palm forward' },
  { id: 'ISL_FIST', label: 'ISL Closed Fist (S)', desc: 'All 5 fingers curled in compact fist' }
];

interface DatasetStudioProps {
  onModelRetrained?: () => void;
  initialClassId?: string;
}

export const DatasetStudio: React.FC<DatasetStudioProps> = ({ onModelRetrained, initialClassId }) => {
  const {
    videoRef,
    canvasRef,
    isCameraActive,
    isHandDetected,
    handedness,
    normalizedFeatures,
    startCamera,
    stopCamera
  } = useWebcamHands();

  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; label: string; desc: string; telugu?: string }>>(ISL_CLASSES);
  const [selectedClass, setSelectedClass] = useState<string>(initialClassId || ISL_CLASSES[0].id);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Sync initialClassId if provided
  useEffect(() => {
    if (initialClassId) {
      setSelectedClass(initialClassId);
    }
  }, [initialClassId]);

  // Load dataset stats and dynamic vocabulary
  const fetchStats = useCallback(async () => {
    try {
      const [statsData, vocabData] = await Promise.all([
        api.getDatasetStats(),
        api.getVocabulary().catch(() => null)
      ]);
      setStats(statsData);

      if (vocabData && vocabData.gestures && vocabData.gestures.length > 0) {
        setAvailableClasses(
          vocabData.gestures.map((g) => ({
            id: g.id,
            label: `${g.name} (${g.id})`,
            desc: g.description || g.telugu || '',
            telugu: g.telugu
          }))
        );
      }
    } catch (err: any) {
      console.warn('Failed to load dataset stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Validate dataset integrity
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await api.validateDataset();
      setValidationResult(res);
      setStatusMessage({
        text: `Validation: ${res.message} ${res.recommendation}`,
        type: res.is_valid ? 'success' : 'error'
      });
    } catch (err: any) {
      setStatusMessage({ text: `Validation failed: ${err.message}`, type: 'error' });
    } finally {
      setIsValidating(false);
    }
  };

  // Export dataset CSV
  const handleExport = () => {
    window.open(api.getExportDatasetUrl(), '_blank');
  };

  // Capture single sample
  const handleCaptureSample = async () => {
    if (!isHandDetected || !normalizedFeatures) {
      setStatusMessage({ text: 'No hand detected! Place hand in camera view.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await api.saveDatasetSample({
        label: selectedClass,
        features: normalizedFeatures,
        handedness,
        session_id: 'web_studio_session'
      });
      setStatusMessage({ text: `Recorded sample for ${selectedClass}!`, type: 'success' });
      await fetchStats();
    } catch (err: any) {
      setStatusMessage({ text: `Failed to save sample: ${err.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Burst capture 5 samples with interval
  const handleBurstCapture = async () => {
    if (!isHandDetected || !normalizedFeatures) {
      setStatusMessage({ text: 'No hand detected! Place hand in camera view.', type: 'error' });
      return;
    }

    setIsSaving(true);
    let captured = 0;
    try {
      for (let i = 0; i < 5; i++) {
        if (!normalizedFeatures) break;
        await api.saveDatasetSample({
          label: selectedClass,
          features: normalizedFeatures,
          handedness,
          session_id: 'burst_session'
        });
        captured++;
        await new Promise((r) => setTimeout(r, 180));
      }
      setStatusMessage({ text: `Burst captured ${captured} samples for ${selectedClass}!`, type: 'success' });
      await fetchStats();
    } catch (err: any) {
      setStatusMessage({ text: `Burst capture error: ${err.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Retrain model
  const handleRetrain = async () => {
    setIsRetraining(true);
    setStatusMessage({ text: 'Training Random Forest model on updated dataset...', type: 'info' });
    try {
      const res = await api.triggerRetrain();
      setStatusMessage({
        text: `Retraining completed! Test Accuracy: ${((res.test_accuracy || 0) * 100).toFixed(1)}%`,
        type: 'success'
      });
      onModelRetrained?.();
    } catch (err: any) {
      setStatusMessage({ text: `Retraining error: ${err.message}`, type: 'error' });
    } finally {
      setIsRetraining(false);
    }
  };

  return (
    <div style={{ padding: '10px 0 30px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#6366f1" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Dataset Collection Studio</h2>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Collect real landmark samples from your webcam and retrain the Random Forest model on-demand.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleValidate}
            disabled={isValidating}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <ShieldCheck size={15} />
            <span>{isValidating ? 'Validating...' : 'Validate Dataset'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleExport}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={handleRetrain}
            disabled={isRetraining}
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={isRetraining ? 'animate-spin' : ''} />
            <span>{isRetraining ? 'Training...' : 'Retrain Random Forest'}</span>
          </button>
        </div>
      </div>

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
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {validationResult && (
        <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '0.84rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Samples: </span>
            <strong style={{ color: '#ffffff' }}>{validationResult.total_samples}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>Classes: </span>
            <strong style={{ color: '#ffffff' }}>{validationResult.classes_count}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>Min Class Count: </span>
            <strong style={{ color: '#ffffff' }}>{validationResult.min_samples_per_class}</strong>
          </div>
          <span className={`badge ${validationResult.is_valid ? 'badge-success' : 'badge-warning'}`}>
            Status: {validationResult.status}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 1fr)', gap: '24px' }}>
        {/* Left: Camera & Capture Controls */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Collector Camera Feed</span>
            <span className={`badge ${isHandDetected ? 'badge-success' : 'badge-neutral'}`}>
              {isHandDetected ? `Hand Detected (${handedness})` : 'No Hand'}
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              background: '#030712',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px'
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                opacity: isCameraActive ? 1 : 0
              }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />

            {!isCameraActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}
              >
                <button className="btn btn-primary" onClick={startCamera}>
                  <Camera size={16} />
                  <span>Start Camera for Collection</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {isCameraActive && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleCaptureSample}
                  disabled={!isHandDetected || isSaving}
                  style={{ flex: 1 }}
                >
                  <PlusCircle size={16} />
                  <span>Capture 1 Sample</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleBurstCapture}
                  disabled={!isHandDetected || isSaving}
                  style={{ flex: 1 }}
                >
                  <Zap size={16} />
                  <span>Burst (5 Samples)</span>
                </button>

                <button className="btn btn-danger" onClick={stopCamera}>
                  <span>Stop Camera</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Target Class Selector & Sample Counts */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Select Gesture Class to Collect</h3>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
              Total Dataset: {stats?.total_samples || 0} samples
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto', paddingRight: '4px' }}>
            {availableClasses.map((cls) => {
              const count = stats?.class_counts?.[cls.id] || 0;
              const isSelected = selectedClass === cls.id;

              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.92rem', color: isSelected ? '#ffffff' : 'var(--text-primary)', fontWeight: 600 }}>
                      {cls.label} {cls.telugu ? <span style={{ color: '#38bdf8', fontSize: '0.8rem', marginLeft: '6px' }}>{cls.telugu}</span> : null}
                    </h4>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {cls.desc}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      className={`badge ${count >= 50 ? 'badge-success' : count >= 10 ? 'badge-primary' : 'badge-warning'}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {count} samples
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
