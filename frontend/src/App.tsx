import { useState, useEffect, useCallback } from 'react';
import { Navbar, type AppNavTab } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { CameraRecognitionPanel } from './components/CameraRecognitionPanel';
import { TwoWaySpeechPanel } from './components/TwoWaySpeechPanel';
import { HistoryLog } from './components/HistoryLog';
import { ISLGuide } from './components/ISLGuide';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { api } from './services/api';
import type { HealthStatus, ModelStatus, UserProfile } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<AppNavTab>('home');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [practiceTargetSign, setPracticeTargetSign] = useState<{ id: string; name: string } | null>(null);

  // User Authentication State & Session Loading
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => Boolean(api.getAuthToken()));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Check and restore existing session on startup without logging user out on refresh
  useEffect(() => {
    const token = api.getAuthToken();
    if (token) {
      api.getProfile()
        .then((profile) => {
          setCurrentUser(profile);
          setIsAuthChecking(false);
        })
        .catch(() => {
          api.clearAuthToken();
          setCurrentUser(null);
          setIsAuthChecking(false);
        });
    } else {
      setIsAuthChecking(false);
    }
  }, []);

  // Route Guard: Unauthenticated users cannot access protected tabs
  useEffect(() => {
    if (!isAuthChecking && !currentUser && activeTab !== 'home') {
      setActiveTab('home');
      setIsAuthModalOpen(true);
    }
  }, [currentUser, activeTab, isAuthChecking]);

  // Load backend and model status
  const refreshSystemStatus = useCallback(async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }

    try {
      const m = await api.getModelStatus();
      setModelStatus(m);
    } catch {
      setModelStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshSystemStatus();
    const interval = setInterval(refreshSystemStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshSystemStatus]);

  const handleStartCommunicating = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenQuickPhrases = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreGuide = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab('guide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePractiseSign = (signId: string, signName: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setPracticeTargetSign({ id: signId, name: signName });
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    // After login, redirect users to the dashboard
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileUpdated = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setIsProfileModalOpen(false);
    // After logout, redirect users to the welcome page
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        modelStatus={modelStatus}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="container" style={{ flex: 1, padding: '24px 20px' }}>
        {/* Loading session state */}
        {isAuthChecking && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>Restoring secure session...</p>
          </div>
        )}

        {/* View 1: Welcome & Landing Screen */}
        {!isAuthChecking && activeTab === 'home' && (
          <HomeScreen
            onStartCommunicating={handleStartCommunicating}
            onOpenQuickPhrases={handleOpenQuickPhrases}
            onExploreGuide={handleExploreGuide}
            modelStatus={modelStatus}
            health={health}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {/* View 2: Live Recognition & Sentence Builder - PROTECTED MODULE */}
        {!isAuthChecking && activeTab === 'recognition' && currentUser && (
          <div>
            <CameraRecognitionPanel
              modelStatus={modelStatus}
              practiceTargetSign={practiceTargetSign}
              onClearPracticeTarget={() => setPracticeTargetSign(null)}
              onPredictionSaved={refreshSystemStatus}
            />

            {/* Two-Way Communication Bridge */}
            <TwoWaySpeechPanel />
          </div>
        )}

        {/* View 3: ISL Guide - PROTECTED MODULE */}
        {!isAuthChecking && activeTab === 'guide' && currentUser && (
          <ISLGuide
            onPractiseSign={handlePractiseSign}
            activeModelClasses={modelStatus?.classes || []}
          />
        )}

        {/* View 4: Conversation History & Excel Export - PROTECTED MODULE */}
        {!isAuthChecking && activeTab === 'history' && currentUser && <HistoryLog currentUser={currentUser} />}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* User Profile Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={handleProfileUpdated}
          onLogout={handleLogout}
        />
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          padding: '20px',
          background: '#ffffff',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: '#64748b'
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/logo.png"
              alt="SignBridge AI Logo"
              style={{ width: '22px', height: '22px', borderRadius: '5px', objectFit: 'contain' }}
            />
            <span>
              <strong style={{ color: '#0f172a' }}>SignBridge AI</strong> — Indian Sign Language Communication Platform
            </span>
          </div>
          <div>
            Powered by MediaPipe Hands & Scikit-Learn Random Forest
          </div>
          <div>
            Backend: {health ? `v${health.version} (${health.environment})` : 'Offline'}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
