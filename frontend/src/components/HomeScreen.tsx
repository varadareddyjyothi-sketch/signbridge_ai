import React from 'react';
import { Camera, BookOpen, MessageSquare, CheckCircle2, ArrowRight, Sparkles, Globe } from 'lucide-react';
import type { ModelStatus, HealthStatus } from '../types';

interface HomeScreenProps {
  onStartCommunicating: () => void;
  onOpenQuickPhrases: () => void;
  onExploreGuide: () => void;
  modelStatus: ModelStatus | null;
  health: HealthStatus | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartCommunicating,
  onOpenQuickPhrases,
  onExploreGuide,
  modelStatus,
  health
}) => {
  const isOnline = health?.status === 'healthy';
  const isModelReady = modelStatus && modelStatus.status !== 'unavailable';
  const supportedCount = modelStatus?.classes_count || 15;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '12px 0 40px 0' }}>
      {/* Hero Card */}
      <div
        className="glass-panel"
        style={{
          padding: '40px 32px',
          textAlign: 'center',
          borderRadius: '12px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
          marginBottom: '28px'
        }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          borderRadius: '999px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <Sparkles size={14} />
          <span>Indian Sign Language (ISL) Assistance Platform</span>
        </div>

        <h1 style={{
          fontSize: '2.4rem',
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1.25,
          color: '#0f172a',
          margin: '0 auto 16px auto',
          maxWidth: '780px'
        }}>
          Transform Indian Sign Language into Clear Sentences & Speech
        </h1>

        <p style={{
          fontSize: '1.05rem',
          color: '#475569',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 28px auto'
        }}>
          SignBridge AI helps Deaf and Hard-of-Hearing individuals communicate with anyone. Translate verified signs through your camera in real time or browse 63 common phrases in English, authentic Telugu script, and Romanized Telugu.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button
            className="btn btn-primary"
            onClick={onStartCommunicating}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Camera size={18} />
            <span>Start Communicating</span>
            <ArrowRight size={16} />
          </button>

          <button
            className="btn btn-secondary"
            onClick={onOpenQuickPhrases}
            style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <MessageSquare size={17} color="#d97706" />
            <span>Quick Phrase Library (A-H)</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onExploreGuide}
            style={{ padding: '12px 18px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <BookOpen size={17} color="#2563eb" />
            <span>Learn Supported Signs</span>
          </button>
        </div>

        {/* System & Model Live Status Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          padding: '8px 16px',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOnline ? '#059669' : '#e11d48'
            }} />
            <span style={{ color: '#475569' }}>System: <strong style={{ color: '#0f172a' }}>{isOnline ? 'Online' : 'Connecting...'}</strong></span>
          </div>

          <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} color={isModelReady ? '#059669' : '#d97706'} />
            <span style={{ color: '#475569' }}>Model: <strong style={{ color: '#0f172a' }}>{isModelReady ? `${supportedCount} Active Signs Loaded` : 'Evaluation Mode'}</strong></span>
          </div>

          <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} color="#0284c7" />
            <span style={{ color: '#475569' }}>Languages: <strong style={{ color: '#0f172a' }}>English, Telugu (తెలుగు), Romanized</strong></span>
          </div>
        </div>
      </div>

      {/* 3-Step Simple Guide for New Users */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', marginBottom: '18px' }}>
          How to Use SignBridge AI in 3 Simple Steps
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Step 1 */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#2563eb',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              1
            </div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Start Your Camera</h3>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Allow camera access and place your hand or hands clearly within the frame. Left and right hands are tracked automatically.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: '#f0f9ff',
              color: '#0284c7',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              2
            </div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Perform Supported Signs</h3>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Hold a sign steady for 3 frames to stabilize. Signs automatically build into a natural sentence with grammar rules, intent, and punctuation.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: '#ecfdf5',
              color: '#059669',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              3
            </div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Speak, Copy & Save</h3>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Review the draft, edit or confirm your sentence to speak it aloud with text-to-speech, copy to clipboard, or export history to Excel (.xlsx).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
