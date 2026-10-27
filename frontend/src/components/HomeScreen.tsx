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
  const supportedCount = modelStatus?.classes_count || 10;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 0 32px 0' }}>
      {/* Hero Welcome Card */}
      <div
        className="glass-panel"
        style={{
          padding: '40px 32px',
          textAlign: 'center',
          borderRadius: '16px',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
          marginBottom: '28px'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.35)', color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 600, marginBottom: '18px' }}>
          <Sparkles size={14} />
          <span>Indian Sign Language (ISL) Assistance Assistant</span>
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2, margin: '0 auto 16px auto', maxWidth: '820px' }}>
          Transform Indian Sign Language into Meaningful Sentences & Speech
        </h1>

        <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 28px auto' }}>
          SignBridge AI helps Deaf and Hard-of-Hearing individuals communicate with anyone. Recognize verified signs through the camera or browse 63 common phrases in English, authentic Telugu script, and Romanized Telugu.
        </p>

        {/* Primary Call to Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button
            className="btn btn-primary"
            onClick={onStartCommunicating}
            style={{
              padding: '14px 28px',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 0 24px rgba(99, 102, 241, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Camera size={20} />
            <span>Start Communicating</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="btn btn-secondary"
            onClick={onOpenQuickPhrases}
            style={{ padding: '14px 22px', fontSize: '0.98rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <MessageSquare size={18} color="#f59e0b" />
            <span>Quick Phrase Library (A-H)</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onExploreGuide}
            style={{ padding: '14px 20px', fontSize: '0.98rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <BookOpen size={18} color="#38bdf8" />
            <span>Learn Supported Signs</span>
          </button>
        </div>

        {/* System & Model Live Status Pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', padding: '10px 18px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10b981' : '#f43f5e', boxShadow: isOnline ? '0 0 8px #10b981' : 'none' }} />
            <span style={{ color: 'var(--text-secondary)' }}>System: <strong>{isOnline ? 'Online' : 'Connecting...'}</strong></span>
          </div>

          <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={13} color={isModelReady ? '#10b981' : '#f59e0b'} />
            <span style={{ color: 'var(--text-secondary)' }}>Model: <strong>{isModelReady ? `${supportedCount} Active Signs Loaded` : 'Evaluation Mode'}</strong></span>
          </div>

          <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={13} color="#67e8f9" />
            <span style={{ color: 'var(--text-secondary)' }}>Languages: <strong>English, Telugu (తెలుగు), Romanized</strong></span>
          </div>
        </div>
      </div>

      {/* 3-Step Simple Guide for New Users */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', marginBottom: '20px' }}>
          How to Use SignBridge AI in 3 Simple Steps
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Step 1 */}
          <div className="glass-panel" style={{ padding: '22px', borderRadius: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              1
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Start Your Camera</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Allow camera access and place your hand or hands clearly within the frame. Left and right hands are tracked automatically.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-panel" style={{ padding: '22px', borderRadius: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              2
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Perform Supported Signs</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Hold a sign steady for 3 frames to stabilize. Signs automatically build into a natural sentence with grammar rules, intent, and punctuation.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-panel" style={{ padding: '22px', borderRadius: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              3
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Speak, Copy & Save</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Review the draft, edit or confirm your sentence to speak it aloud with text-to-speech, copy to clipboard, or export history to Excel (.xlsx).
            </p>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Key Capabilities & Modes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: '#818cf8', marginBottom: '4px' }}>📷 Mode 1: Live Sign Recognition</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time single-hand, two-hand, and gesture recognition powered by MediaPipe and custom AI models.</span>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: '#f59e0b', marginBottom: '4px' }}>💬 Mode 2: Quick Phrase Assistance</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>63 common phrases across 8 categories (Greetings, Needs, Travel, Health, Questions) for instant communication.</span>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: '#38bdf8', marginBottom: '4px' }}>🗣️ Two-Way Communication</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Hearing partners can type or speak into the microphone to display replies in large, readable text.</span>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: '#34d399', marginBottom: '4px' }}>📊 Verified Excel Export</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Export confirmed sentence logs with source modes (Camera vs Quick Phrase) and formula sanitization.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
