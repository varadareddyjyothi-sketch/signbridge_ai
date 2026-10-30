import React from 'react';
import { Compass, Home, Camera, BookOpen, History } from 'lucide-react';
import type { AppNavTab } from './Navbar';

interface NotFoundPageProps {
  attemptedPath: string;
  onNavigate: (tab: AppNavTab) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ attemptedPath, onNavigate }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        padding: '32px 16px',
        textAlign: 'center'
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '40px 32px',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}
        >
          <Compass size={34} strokeWidth={2.2} />
        </div>

        <div style={{ display: 'inline-block', marginBottom: '12px' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              background: '#fee2e2',
              color: '#991b1b',
              padding: '4px 10px',
              borderRadius: '9999px'
            }}
          >
            HTTP 404 — Route Not Found
          </span>
        </div>

        <h1
          style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: '8px 0 12px 0',
            letterSpacing: '-0.02em'
          }}
        >
          Page Doesn't Exist
        </h1>

        <p style={{ color: '#64748b', fontSize: '0.96rem', lineHeight: 1.6, marginBottom: '24px' }}>
          The requested URL <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a', fontWeight: 600 }}>{attemptedPath || window.location.pathname}</code> does not match any route in SignBridge AI.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
          <button
            onClick={() => onNavigate('home')}
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.94rem'
            }}
          >
            <Home size={18} />
            Return to Home Screen
          </button>

          <button
            onClick={() => onNavigate('recognition')}
            className="btn btn-secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.94rem'
            }}
          >
            <Camera size={18} />
            Go to Live Recognition Dashboard
          </button>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 12px 0' }}>Or explore verified platform resources:</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('guide')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <BookOpen size={14} /> ISL Gesture Guide
            </button>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <button
              onClick={() => onNavigate('history')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <History size={14} /> Conversation History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
