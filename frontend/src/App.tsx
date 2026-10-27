import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { CameraRecognitionPanel } from './components/CameraRecognitionPanel';
import { TwoWaySpeechPanel } from './components/TwoWaySpeechPanel';
import { DatasetStudio } from './components/DatasetStudio';
import { GestureManagement } from './components/GestureManagement';
import { HistoryLog } from './components/HistoryLog';
import { ISLGuide } from './components/ISLGuide';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { api } from './services/api';
import type { HealthStatus, ModelStatus, UserProfile } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'studio' | 'history' | 'guide' | 'gestures'>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [showHero, setShowHero] = useState<boolean>(true);
  const [selectedStudioClassId, setSelectedStudioClassId] = useState<string | null>(null);
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

  const handleNavigateToCollect = (classId: string) => {
    setSelectedStudioClassId(classId);
    setActiveTab('studio');
  };

  const handlePractiseSign = (signId: string, signName: string) => {
    setPracticeTargetSign({ id: signId, name: signName });
    setActiveTab('dashboard');
    setShowHero(false);
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
        {activeTab === 'dashboard' && (
          <div>
            {showHero && (
              <LandingHero
                onStartClick={() => setShowHero(false)}
                classesCount={modelStatus?.classes_count || 10}
              />
            )}

            <div style={{ marginTop: showHero ? '10px' : '0' }}>
              <CameraRecognitionPanel
                modelStatus={modelStatus}
                practiceTargetSign={practiceTargetSign}
                onClearPracticeTarget={() => setPracticeTargetSign(null)}
                onPredictionSaved={refreshSystemStatus}
                onNavigateToStudio={() => setActiveTab('studio')}
                onNavigateToManageGestures={() => setActiveTab('gestures')}
              />

              {/* Two-Way Audio Bridge */}
              <TwoWaySpeechPanel />
            </div>
          </div>
        )}

        {activeTab === 'gestures' && (
          <GestureManagement
            onNavigateToCollect={handleNavigateToCollect}
            onModelUpdated={refreshSystemStatus}
          />
        )}

        {activeTab === 'studio' && (
          <DatasetStudio
            initialClassId={selectedStudioClassId || undefined}
            onModelRetrained={refreshSystemStatus}
          />
        )}

        {activeTab === 'history' && <HistoryLog />}

        {activeTab === 'guide' && (
          <ISLGuide
            onPractiseSign={handlePractiseSign}
            activeModelClasses={modelStatus?.classes || []}
          />
        )}
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
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 20px',
          background: 'rgba(3, 7, 18, 0.7)',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)'
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>SignBridge AI</strong> — Indian Sign Language Bridge
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
