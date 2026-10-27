import React from 'react';
import { Home, Camera, BookOpen, Database, Sparkles, LogIn, Wrench } from 'lucide-react';
import type { HealthStatus, ModelStatus, UserProfile } from '../types';

export type AppNavTab = 'home' | 'recognition' | 'guide' | 'history' | 'admin';

interface NavbarProps {
  activeTab: AppNavTab | 'dashboard' | 'studio' | 'gestures';
  setActiveTab: (tab: AppNavTab) => void;
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

  // Normalize active tab for highlight
  const currentTabNorm: AppNavTab = 
    activeTab === 'dashboard' ? 'recognition' :
    activeTab === 'studio' || activeTab === 'gestures' ? 'admin' :
    activeTab as AppNavTab;

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Brand */}
        <div
          onClick={() => setActiveTab('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          title="SignBridge AI Home"
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SignBridge AI
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>ISL</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Indian Sign Language Communication Assistant</p>
          </div>
        </div>

        {/* Clean, Simple Main Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${currentTabNorm === 'home' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('home')}
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <button
            className={`btn ${currentTabNorm === 'recognition' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('recognition')}
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Camera size={15} />
            <span>Live Recognition</span>
          </button>

          <button
            className={`btn ${currentTabNorm === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('guide')}
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={15} />
            <span>ISL Guide</span>
          </button>

          <button
            className={`btn ${currentTabNorm === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Database size={15} />
            <span>History</span>
          </button>

          <button
            className={`btn ${currentTabNorm === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('admin')}
            style={{ padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.85 }}
            title="Dataset collection, gesture management, and model diagnostics"
          >
            <Wrench size={14} />
            <span>Admin / Tools</span>
          </button>
        </nav>

        {/* Right Section: Status & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.72rem'
            }}
            title={isOnline ? (isModelReady ? 'Backend and AI model active' : 'Backend online, model ready') : 'Backend offline'}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isOnline ? (isModelReady ? '#10b981' : '#f59e0b') : '#f43f5e',
              boxShadow: isOnline ? '0 0 6px #10b981' : 'none'
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {isOnline ? 'System Online' : 'Offline'}
            </span>
          </div>

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
              style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogIn size={15} />
              <span>Login / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
