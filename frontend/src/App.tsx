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

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Check existing session on startup
  useEffect(() => {
    const token = api.getAuthToken();
    if (token) {
      api.getProfile()
        .then((profile) => setCurrentUser(profile))
        .catch(() => setCurrentUser(null));
    }
  }, []);

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
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenQuickPhrases = () => {
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreGuide = () => {
    setActiveTab('guide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePractiseSign = (signId: string, signName: string) => {
    setPracticeTargetSign({ id: signId, name: signName });
    setActiveTab('recognition');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const handleProfileUpdated = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setIsProfileModalOpen(false);
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
        {/* View 1: Home Screen */}
        {activeTab === 'home' && (
          <HomeScreen
            onStartCommunicating={handleStartCommunicating}
            onOpenQuickPhrases={handleOpenQuickPhrases}
            onExploreGuide={handleExploreGuide}
            modelStatus={modelStatus}
            health={health}
          />
        )}

        {/* View 2: Live Recognition & Sentence Builder */}
        {activeTab === 'recognition' && (
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

        {/* View 3: ISL Guide */}
        {activeTab === 'guide' && (
          <ISLGuide
            onPractiseSign={handlePractiseSign}
            activeModelClasses={modelStatus?.classes || []}
          />
        )}

        {/* View 4: Conversation History & Excel Export */}
        {activeTab === 'history' && <HistoryLog />}
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
          <div>
            <strong style={{ color: '#0f172a' }}>SignBridge AI</strong> — Indian Sign Language Communication Platform
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
