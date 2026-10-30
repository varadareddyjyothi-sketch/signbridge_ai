import React, { useState } from 'react';
import { Home, Camera, BookOpen, Database, Sparkles, LogIn, Menu, X } from 'lucide-react';
import type { HealthStatus, ModelStatus, UserProfile } from '../types';

export type AppNavTab = 'home' | 'recognition' | 'guide' | 'history';

interface NavbarProps {
  activeTab: AppNavTab | 'dashboard';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isOnline = health?.status === 'healthy';
  const isModelReady = modelStatus && modelStatus.status !== 'unavailable';

  // Normalize active tab for highlight
  const currentTabNorm: AppNavTab = 
    activeTab === 'dashboard' ? 'recognition' :
    activeTab as AppNavTab;

  const handleNavClick = (tab: AppNavTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };


  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '10px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        {/* Brand */}
        <div
          onClick={() => handleNavClick('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title="SignBridge AI Home"
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                SignBridge AI
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>ISL</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>Indian Sign Language Assistant</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => handleNavClick('home')}
            style={{
              padding: '7px 12px',
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: currentTabNorm === 'home' ? '#bfdbfe' : 'transparent',
              background: currentTabNorm === 'home' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'home' ? '#1d4ed8' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNavClick('recognition')}
            style={{
              padding: '7px 12px',
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: currentTabNorm === 'recognition' ? '#bfdbfe' : 'transparent',
              background: currentTabNorm === 'recognition' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'recognition' ? '#1d4ed8' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            <Camera size={15} />
            <span>Live Recognition</span>
          </button>

          <button
            onClick={() => handleNavClick('guide')}
            style={{
              padding: '7px 12px',
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: currentTabNorm === 'guide' ? '#bfdbfe' : 'transparent',
              background: currentTabNorm === 'guide' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'guide' ? '#1d4ed8' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={15} />
            <span>ISL Guide</span>
          </button>

          <button
            onClick={() => handleNavClick('history')}
            style={{
              padding: '7px 12px',
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: currentTabNorm === 'history' ? '#bfdbfe' : 'transparent',
              background: currentTabNorm === 'history' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'history' ? '#1d4ed8' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            <Database size={15} />
            <span>History</span>
          </button>
        </nav>

        {/* Right Section: Status & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '0.74rem'
            }}
            title={isOnline ? (isModelReady ? 'Backend and AI model active' : 'Backend online, model ready') : 'Backend offline'}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isOnline ? (isModelReady ? '#059669' : '#d97706') : '#e11d48'
            }} />
            <span style={{ color: '#475569', fontWeight: 500 }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* User Profile or Sign In */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              style={{
                padding: '5px 10px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#1d4ed8'
              }}
              title="View account profile and settings"
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentUser.display_name.charAt(0).toUpperCase()}
              </div>
              <span>{currentUser.display_name}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: 'none',
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer'
            }}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            marginTop: '10px',
            paddingTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <button
            onClick={() => handleNavClick('home')}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: currentTabNorm === 'home' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'home' ? '#1d4ed8' : '#334155',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Home size={16} />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNavClick('recognition')}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: currentTabNorm === 'recognition' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'recognition' ? '#1d4ed8' : '#334155',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Camera size={16} />
            <span>Live Recognition</span>
          </button>

          <button
            onClick={() => handleNavClick('guide')}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: currentTabNorm === 'guide' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'guide' ? '#1d4ed8' : '#334155',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <BookOpen size={16} />
            <span>ISL Guide</span>
          </button>

          <button
            onClick={() => handleNavClick('history')}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: currentTabNorm === 'history' ? '#eff6ff' : 'transparent',
              color: currentTabNorm === 'history' ? '#1d4ed8' : '#334155',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Database size={16} />
            <span>History</span>
          </button>
        </div>
      )}

      {/* Responsive CSS for Navbar */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </header>
  );
};
