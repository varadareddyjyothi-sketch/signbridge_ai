import React from 'react';
import { Camera, Sparkles, ArrowRight, ShieldCheck, Globe, Smartphone, UserPlus, LogIn } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onSignIn,
  onSignUp
}) => {
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '16px 0 60px 0' }}>
      {/* Hero Welcome Card */}
      <div
        className="glass-panel"
        style={{
          padding: 'clamp(28px, 5vw, 56px) clamp(20px, 5vw, 48px)',
          textAlign: 'center',
          borderRadius: '16px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
          marginBottom: '36px'
        }}
      >
        {/* Lotus Technology Logo */}
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '22px',
              background: '#eff6ff',
              border: '2px solid #bfdbfe',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src="/logo.png"
              alt="SignBridge AI Lotus Technology Logo"
              style={{
                width: 'clamp(64px, 10vw, 88px)',
                height: 'clamp(64px, 10vw, 88px)',
                borderRadius: '16px',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>

        {/* Application Name */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '999px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}
        >
          <Sparkles size={15} style={{ flexShrink: 0 }} />
          <span>SignBridge AI</span>
        </div>

        {/* Welcome Heading */}
        <h1
          style={{
            fontSize: 'clamp(1.8rem, 4.5vw, 2.85rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            color: '#0f172a',
            margin: '0 auto 18px auto',
            maxWidth: '820px'
          }}
        >
          Bridging Communication Through AI Hand Gesture Recognition
        </h1>

        {/* Short Description */}
        <p
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            color: '#475569',
            lineHeight: 1.65,
            maxWidth: '720px',
            margin: '0 auto 32px auto'
          }}
        >
          SignBridge AI is an accessible visual bridge that translates hand gestures and Indian Sign Language into clear words and speech in real time. Designed to empower Deaf, Hard-of-Hearing, and non-signing individuals to connect naturally across English, Telugu, Romanized Telugu, and Hindi.
        </p>

        {/* Clear Get Started & Auth Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}
        >
          <button
            className="btn btn-primary"
            onClick={onGetStarted}
            style={{
              padding: '14px 32px',
              fontSize: '1.08rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              cursor: 'pointer'
            }}
          >
            <span>Get Started</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="btn btn-secondary"
            onClick={onSignIn}
            style={{
              padding: '14px 26px',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <LogIn size={17} color="#2563eb" />
            <span>Sign In</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onSignUp}
            style={{
              padding: '14px 26px',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <UserPlus size={17} color="#059669" />
            <span>Create Free Account</span>
          </button>
        </div>

        {/* Safe, Privacy-First Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#64748b',
            fontSize: '0.84rem'
          }}
        >
          <ShieldCheck size={16} color="#059669" />
          <span>Local on-device camera inference • No video frames stored on cloud servers</span>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '28px'
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Camera size={22} color="#2563eb" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Instant Hand Tracking
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Advanced 21-point 3D hand landmark detection tracks finger positions, wrist orientation, and gestures in real time using your everyday webcam.
          </p>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Globe size={22} color="#059669" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Multilingual Output
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Translate signs into authentic Telugu script, Romanized Telugu phonetics, Hindi, or English with crystal-clear audio vocalization and sentence formation.
          </p>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#faf5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Smartphone size={22} color="#7c3aed" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Cross-Device Accessibility
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Seamlessly engineered for smooth, responsive performance across smartphones, tablets, laptops, and desktop computers with front/rear camera support.
          </p>
        </div>
      </div>
    </div>
  );
};
