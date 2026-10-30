import React from 'react';
import { Camera, Volume2, ShieldCheck, Cpu, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface LandingHeroProps {
  onStartClick: () => void;
  classesCount: number;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStartClick, classesCount }) => {
  return (
    <section style={{ padding: '40px 0 20px 0' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 40px auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '18px' }}>
          <Sparkles size={14} color="#a5b4fc" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c7d2fe' }}>
            Empowering Accessible Communication Across India
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', lineHeight: 1.15, marginBottom: '18px', fontWeight: 800 }}>
          Bridging the Divide Between{' '}
          <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 50%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Indian Sign Language
          </span>{' '}
          and Spoken Words
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>
          Real-time static sign recognition using client-side MediaPipe landmark extraction, our custom-trained 
          Random Forest classifier ({classesCount} verified ISL handshape classes), automatic speech synthesis, 
          and two-way communication transcription.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onStartClick} style={{ padding: '12px 26px', fontSize: '1rem' }}>
            <Camera size={18} />
            <span>Launch Live Recognition</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Feature Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <Camera size={22} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Private Edge Hand Tracking</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            MediaPipe extracts 21 hand landmarks directly in your browser. Continuous raw video is never transmitted to any external server.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <Cpu size={22} color="#22d3ee" />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Trained ML Classifier</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Translation- and scale-invariant 63-dimensional feature vectors evaluated with uncertainty rejection to eliminate false positives.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <Volume2 size={22} color="#34d399" />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Speech Synthesis & Transcribe</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Speaks recognized signs out loud for hearing non-signers, and transcribes spoken speech into clear high-contrast text for ISL users.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <ShieldCheck size={22} color="#fbbf24" />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>MongoDB Atlas Cloud + Local SQLite</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Dual-mode persistence: resilient MongoDB Atlas cloud document database with indexed collections and zero-configuration local SQLite fallback.
          </p>
        </div>
      </div>

      {/* Honest Limitations Banner */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', color: '#fcd34d', marginBottom: '4px' }}>
              Engineering Notice & Scope Transparency
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Hand detection is not full sign recognition, and static hand-shape classification is not complete ISL grammar translation. 
              This MVP recognizes <strong>verified static single-hand ISL shapes</strong> (numbers 1-5, affirmations, peace, fist, OK). 
              Dynamic continuous gestures and two-handed multi-word sentences are part of the long-term research roadmap.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
