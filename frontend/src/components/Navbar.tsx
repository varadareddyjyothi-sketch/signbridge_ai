import React from 'react';
import { Camera, Database, Cpu, BookOpen, Layers, Sparkles, LogIn } from 'lucide-react';
import type { HealthStatus, ModelStatus, UserProfile } from '../types';

interface NavbarProps {
  activeTab: 'dashboard' | 'studio' | 'history' | 'guide' | 'gestures';
  setActiveTab: (tab: 'dashboard' | 'studio' | 'history' | 'guide' | 'gestures') => void;
  health: HealthStatus | null;
  modelStatus: ModelStatus | null;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  health,
  modelStatus,
  currentUser,
  onOpenAuth,
  onOpenProfile
}) => {
  const isOnline = health?.status === 'healthy';
  const isModelReady = modelStatus && modelStatus.status !== 'unavailable';

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '14px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SignBridge AI
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>ISL MVP</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Indian Sign Language Recognition Bridge</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Camera size={16} />
            <span>Live Recognition</span>
          </button>

          <button
            className={`btn ${activeTab === 'gestures' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('gestures')}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Sparkles size={16} />
            <span>Manage Gestures</span>
          </button>

          <button
            className={`btn ${activeTab === 'studio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('studio')}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Layers size={16} />
            <span>Dataset Studio</span>
          </button>

          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Database size={16} />
            <span>History</span>
          </button>

          <button
            className={`btn ${activeTab === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('guide')}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <BookOpen size={16} />
            <span>ISL Guide</span>
          </button>
        </nav>

        {/* Right Section: Auth & Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* User Auth Button */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)'
              }}
              title="View account profile and export settings"
            >
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: '#6366f1',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentUser.display_name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, color: '#e0e7ff' }}>{currentUser.display_name}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogIn size={14} />
              <span>Sign In / Register</span>
            </button>
          )}

          {/* Backend Status */}
          <div className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`pulse-dot ${isOnline ? 'online' : 'offline'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Model Status */}
          <div className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={12} color={isModelReady ? '#10b981' : '#f59e0b'} />
            <span>{isModelReady ? `RF Model (${modelStatus?.classes_count || 0})` : 'Model Pending'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
