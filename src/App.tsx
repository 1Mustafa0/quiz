import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { trackVisit } from './utils/visitorTracking';
import { useLanguage } from './contexts/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import WelcomeModal from './components/WelcomeModal';
import ErrorBoundary from './components/ErrorBoundary';
import { motion } from 'motion/react';

// Lazy load pages for better performance
const pageLoaders = {
  quizBuilder: () => import('./pages/QuizBuilder'),
  quizLibrary: () => import('./pages/QuizLibrary'),
  mindMapBuilder: () => import('./pages/MindMapBuilder'),
  mindMapEditor: () => import('./pages/MindMapEditor'),
  mindMapLibrary: () => import('./pages/MindMapLibrary'),
  quizPlayer: () => import('./pages/QuizPlayer'),
  quizResult: () => import('./pages/QuizResult'),
  adminDashboard: () => import('./pages/AdminDashboard'),
  quizHistory: () => import('./pages/QuizHistory'),
  profile: () => import('./pages/Profile'),
  todoList: () => import('./pages/TodoList'),
  pricing: () => import('./pages/Pricing'),
  support: () => import('./pages/Support'),
};

type PageModule = { default: React.ComponentType<any> };

const CHUNK_RELOAD_KEY = 'ai-quiz-master-lazy-reload';

const getChunkReloaded = () => {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
  } catch {
    return false;
  }
};

const setChunkReloaded = () => {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    // The reload is still useful even if storage is blocked.
  }
};

const clearChunkReloaded = () => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage restrictions.
  }
};

const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(message);
};

const lazyWithRetry = (loader: () => Promise<PageModule>) =>
  React.lazy(() =>
    loader()
      .then((module) => {
        clearChunkReloaded();
        return module;
      })
      .catch((error) => {
        const alreadyReloaded = getChunkReloaded();
        if (isChunkLoadError(error) && !alreadyReloaded) {
          setChunkReloaded();
          window.location.reload();
          return new Promise<PageModule>(() => {});
        }

        clearChunkReloaded();
        throw error;
      })
  );

const preloadPage = (loader: () => Promise<PageModule>) => {
  loader().catch((error) => {
    console.warn('[preload] page chunk failed:', error);
  });
};

const QuizBuilder = lazyWithRetry(pageLoaders.quizBuilder);
const QuizLibrary = lazyWithRetry(pageLoaders.quizLibrary);
const MindMapBuilder = lazyWithRetry(pageLoaders.mindMapBuilder);
const MindMapEditor = lazyWithRetry(pageLoaders.mindMapEditor);
const MindMapLibrary = lazyWithRetry(pageLoaders.mindMapLibrary);
const QuizPlayer = lazyWithRetry(pageLoaders.quizPlayer);
const QuizResult = lazyWithRetry(pageLoaders.quizResult);
const AdminDashboard = lazyWithRetry(pageLoaders.adminDashboard);
const QuizHistory = lazyWithRetry(pageLoaders.quizHistory);
const Profile = lazyWithRetry(pageLoaders.profile);
const TodoList = lazyWithRetry(pageLoaders.todoList);
const Pricing = lazyWithRetry(pageLoaders.pricing);
const Support = lazyWithRetry(pageLoaders.support);

const PageLoader: React.FC = () => {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-[55vh] items-center justify-center"
    >
      <div className="flex flex-col items-center space-y-4 rounded-2xl border border-gray-100 bg-white px-8 py-7 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-indigo-600" />
          <div className="absolute inset-3 rounded-full bg-indigo-50 dark:bg-indigo-900/30" />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.loading')}</p>
      </div>
    </motion.div>
  );
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return null;
};

const RouteBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
};

const PaidFeatureRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, plan, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const hasAccess = role === 'admin' || plan === 'pro' || plan === 'premium';
  if (!hasAccess) {
    return <Navigate to="/pricing?feature=mindmaps" replace />;
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
};

export default function App() {
  const { user, role, showWelcome, setShowWelcome } = useAuth();

  useEffect(() => {
    trackVisit(user?.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;

    const warmCommonPages = () => {
      preloadPage(pageLoaders.quizLibrary);
      preloadPage(pageLoaders.quizBuilder);
      preloadPage(pageLoaders.quizHistory);
      preloadPage(pageLoaders.profile);
      if (role === 'admin') preloadPage(pageLoaders.adminDashboard);
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmCommonPages, { timeout: 4000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeout = globalThis.setTimeout(warmCommonPages, 2000);
    return () => globalThis.clearTimeout(timeout);
  }, [user, role]);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Layout>
        <WelcomeModal
          isOpen={showWelcome}
          onClose={() => setShowWelcome(false)}
          userName={user?.displayName || null}
        />
        <RouteBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/pricing"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Pricing />
                </Suspense>
              }
            />
            <Route
              path="/support"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Support />
                </Suspense>
              }
            />
            <Route
              path="/builder"
              element={
                <ProtectedRoute>
                  <QuizBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <QuizLibrary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit/:quizId"
              element={
                <ProtectedRoute>
                  <QuizBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/play/:quizId"
              element={
                <ProtectedRoute>
                  <QuizPlayer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/:resultId"
              element={
                <ProtectedRoute>
                  <QuizPlayer reviewMode />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exam/:shareId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <QuizPlayer publicMode />
                </Suspense>
              }
            />
            <Route
              path="/result/:resultId"
              element={
                <ProtectedRoute>
                  <QuizResult />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <QuizHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:uid"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TodoList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mindmaps"
              element={
                <PaidFeatureRoute>
                  <MindMapLibrary />
                </PaidFeatureRoute>
              }
            />
            <Route
              path="/mindmaps/builder"
              element={
                <PaidFeatureRoute>
                  <MindMapBuilder />
                </PaidFeatureRoute>
              }
            />
            <Route
              path="/mindmaps/editor/:docId?"
              element={
                <PaidFeatureRoute>
                  <MindMapEditor />
                </PaidFeatureRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteBoundary>
      </Layout>
    </Router>
  );
}
