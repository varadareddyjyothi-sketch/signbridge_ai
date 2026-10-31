import { useState, useEffect, useCallback } from 'react';
import { Navbar, type AppNavTab } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CameraRecognitionPanel } from './components/CameraRecognitionPanel';
import { HistoryLog } from './components/HistoryLog';
import { ISLGuide } from './components/ISLGuide';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { NotFoundPage } from './components/NotFoundPage';
import { api } from './services/api';
import type { HealthStatus, ModelStatus, UserProfile } from './types';

interface ParsedRoute {
  tab: AppNavTab;
  isNotFound: boolean;
  openAuth: boolean;
  authMode?: 'login' | 'register';
  openProfile?: boolean;
  path: string;
}

function parseCurrentRoute(): ParsedRoute {
  // Support HTML5 path (/recognition), hash routing (/#recognition or #/library), and query SPA redirects (/?p=/history)
  let rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const rawHash = window.location.hash.toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');
  const search = window.location.search;

  // Handle GitHub Pages SPA redirection trick if redirected via /?p=... or /?/path
  if (search.includes('?p=') || search.includes('&p=')) {
    const params = new URLSearchParams(search);
    const p = params.get('p');
    if (p) rawPath = p.toLowerCase().replace(/\/+$/, '') || '/';
  } else if (search.startsWith('?/')) {
    rawPath = search.slice(2).split('&')[0].toLowerCase().replace(/\/+$/, '') || '/';
  }

  // Strip query parameters from hash or path if any
  const cleanHash = rawHash.split('?')[0].replace(/^\/+/, '');
  const cleanPath = rawPath.split('?')[0].replace(/^\/+/, '');

  // Extract path segments
  const pathSegments = cleanPath.split('/').filter(Boolean);
  const hashSegments = cleanHash.split('/').filter(Boolean);

  let segments = hashSegments.length > 0 ? hashSegments : pathSegments;

  // Ignore root prefix if project is deployed under a subfolder (e.g. /signbridge_ai/..., /signbridge/..., /touch/...)
  if (segments.length > 1 && ['signbridge_ai', 'signbridge', 'touch', 'app', 'dist'].includes(segments[0])) {
    segments = segments.slice(1);
  }

  const segment = segments[0] || '';

  // 1. Home / Root
  if (!segment || ['home', 'welcome', 'main', 'index', 'index.html', 'app'].includes(segment)) {
    return { tab: 'home', isNotFound: false, openAuth: false, path: '/' };
  }

  // 2. Recognition & Touch modules (SignBridge AI - TOUCH)
  if (['recognition', 'touch', 'dashboard', 'live', 'camera', 'detect', 'detector', 'practice', 'phrases', 'quickphrases', 'translate', 'sentence', 'sentences', 'isl'].includes(segment)) {
    return { tab: 'recognition', isNotFound: false, openAuth: false, path: '/recognition' };
  }

  // 3. ISL Guide & Reference Library
  if (['guide', 'library', 'learn', 'tutorial', 'dictionary', 'vocabulary', 'alphabet', 'signs'].includes(segment)) {
    return { tab: 'guide', isNotFound: false, openAuth: false, path: '/guide' };
  }

  // 4. Conversation History & Export Logs
  if (['history', 'logs', 'records', 'export'].includes(segment)) {
    return { tab: 'history', isNotFound: false, openAuth: false, path: '/history' };
  }

  // 5. Authentication routes
  if (['login', 'signin', 'auth'].includes(segment)) {
    return { tab: 'home', isNotFound: false, openAuth: true, authMode: 'login', path: '/login' };
  }
  if (['register', 'signup', 'join'].includes(segment)) {
    return { tab: 'home', isNotFound: false, openAuth: true, authMode: 'register', path: '/register' };
  }

  // 6. User Profile
  if (['profile', 'account', 'settings'].includes(segment)) {
    return { tab: 'home', isNotFound: false, openAuth: false, openProfile: true, path: '/profile' };
  }

  // Unrecognized route -> 404 Not Found Page
  return {
    tab: 'home',
    isNotFound: true,
    openAuth: false,
    path: window.location.hash || window.location.pathname || `/${segment}`
  };
}

export function App() {
  const [routeState, setRouteState] = useState<ParsedRoute>(() => parseCurrentRoute());
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [practiceTargetSign, setPracticeTargetSign] = useState<{ id: string; name: string } | null>(null);
  const [authRestoreError, setAuthRestoreError] = useState<string | null>(null);

  // User Authentication State & Session Loading
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => routeState.openAuth);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>(
    () => routeState.authMode || 'login'
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(() => Boolean(routeState.openProfile));
  const [pendingRedirectTab, setPendingRedirectTab] = useState<AppNavTab | null>(null);

  const activeTab = routeState.tab;
  const isNotFound = routeState.isNotFound;

  // Navigate helper with browser History API synchronization
  const navigate = useCallback((tab: AppNavTab) => {
    const targetPath = tab === 'home' ? '/' : `/${tab}`;
    try {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    } catch {
      // Fallback to hash if pushState fails in certain sandboxed environments
      window.location.hash = `#/${tab}`;
    }

    setRouteState({
      tab,
      isNotFound: false,
      openAuth: false,
      path: targetPath
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen to browser Back / Forward buttons and Hash changes
  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseCurrentRoute();
      setRouteState(parsed);
      setIsAuthModalOpen(parsed.openAuth);
      if (parsed.openAuth) {
        setAuthModalInitialMode(parsed.authMode || 'login');
      }
      if (parsed.openProfile) {
        setIsProfileModalOpen(true);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Check and restore existing session on startup without logging user out on refresh
  useEffect(() => {
    api.getProfile()
      .then((profile) => {
        setCurrentUser(profile);
        setAuthRestoreError(null);
      })
      .catch((error: unknown) => {
        setCurrentUser(null);
        if (!(error instanceof Error) || error.message !== 'No active session') {
          setAuthRestoreError(error instanceof Error ? error.message : 'Unable to restore the session.');
        }
      })
      .finally(() => setIsAuthChecking(false));
  }, []);

  // Route Guard: Unauthenticated users attempting to access protected tabs are prompted to authenticate
  useEffect(() => {
    if (!isAuthChecking && !currentUser && activeTab !== 'home' && !isNotFound) {
      setPendingRedirectTab(activeTab);
      setAuthModalInitialMode('login');
      navigate('home');
      setIsAuthModalOpen(true);
    }
  }, [currentUser, activeTab, isAuthChecking, isNotFound, navigate]);

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
      setPendingRedirectTab('recognition');
      setIsAuthModalOpen(true);
      return;
    }
    navigate('recognition');
  };

  const handleOpenQuickPhrases = () => {
    if (!currentUser) {
      setPendingRedirectTab('recognition');
      setIsAuthModalOpen(true);
      return;
    }
    navigate('recognition');
  };

  const handleExploreGuide = () => {
    if (!currentUser) {
      setPendingRedirectTab('guide');
      setIsAuthModalOpen(true);
      return;
    }
    navigate('guide');
  };

  const handlePractiseSign = (signId: string, signName: string) => {
    if (!currentUser) {
      setPendingRedirectTab('recognition');
      setIsAuthModalOpen(true);
      return;
    }
    setPracticeTargetSign({ id: signId, name: signName });
    navigate('recognition');
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setAuthRestoreError(null);
    setIsAuthModalOpen(false);
    const destination = pendingRedirectTab || 'home';
    setPendingRedirectTab(null);
    navigate(destination);
  };

  const handleProfileUpdated = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async (): Promise<void> => {
    await api.logout();
    setCurrentUser(null);
    setIsProfileModalOpen(false);
    navigate('home');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigate}
        health={health}
        modelStatus={modelStatus}
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthModalInitialMode('login');
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="container" style={{ flex: 1, padding: '24px 20px' }}>
        {authRestoreError && (
          <div
            role="alert"
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              color: '#be123c'
            }}
          >
            Could not restore your sign-in session: {authRestoreError}
          </div>
        )}

        {/* Loading session state */}
        {isAuthChecking && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>Restoring secure session...</p>
          </div>
        )}

        {/* 404 Route Not Found View */}
        {!isAuthChecking && isNotFound && (
          <NotFoundPage
            attemptedPath={routeState.path}
            onNavigate={navigate}
          />
        )}

        {/* View 1: Welcome Page for unauthenticated visitors / Home Screen for authenticated users */}
        {!isAuthChecking && !isNotFound && activeTab === 'home' && (
          currentUser ? (
            <HomeScreen
              onStartCommunicating={handleStartCommunicating}
              onOpenQuickPhrases={handleOpenQuickPhrases}
              onExploreGuide={handleExploreGuide}
              modelStatus={modelStatus}
              health={health}
              currentUser={currentUser}
              onOpenAuth={() => {
                setAuthModalInitialMode('login');
                setIsAuthModalOpen(true);
              }}
            />
          ) : (
            <WelcomeScreen
              onGetStarted={() => {
                setAuthModalInitialMode('register');
                setIsAuthModalOpen(true);
              }}
              onSignIn={() => {
                setAuthModalInitialMode('login');
                setIsAuthModalOpen(true);
              }}
              onSignUp={() => {
                setAuthModalInitialMode('register');
                setIsAuthModalOpen(true);
              }}
            />
          )
        )}

        {/* View 2: Live Recognition & Sentence Builder - PROTECTED MODULE */}
        {!isAuthChecking && !isNotFound && activeTab === 'recognition' && currentUser && (
            <CameraRecognitionPanel
              modelStatus={modelStatus}
              practiceTargetSign={practiceTargetSign}
              onClearPracticeTarget={() => setPracticeTargetSign(null)}
              onPredictionSaved={refreshSystemStatus}
            />
        )}

        {/* View 3: ISL Guide - PROTECTED MODULE */}
        {!isAuthChecking && !isNotFound && activeTab === 'guide' && currentUser && (
          <ISLGuide
            onPractiseSign={handlePractiseSign}
            activeModelClasses={modelStatus?.classes || []}
          />
        )}

        {/* View 4: Conversation History & Excel Export - PROTECTED MODULE */}
        {!isAuthChecking && !isNotFound && activeTab === 'history' && currentUser && <HistoryLog currentUser={currentUser} />}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingRedirectTab(null);
        }}
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
