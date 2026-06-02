import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogIn, LogOut, PlusCircle, Library, Home as HomeIcon, AlertCircle, Shield, History, User, Brain, Menu, X, CheckSquare, Sun, Moon, Loader2, PlayCircle, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const QUIZ_PROGRESS_PREFIX = 'ai-quiz-master-progress';
const QUIZ_PROGRESS_EVENT = 'ai-quiz-master-progress-updated';

interface SavedProgressSummary {
  key: string;
  mode: 'quiz' | 'public';
  id: string;
  path: string;
  answeredCount: number;
  questionCount: number;
  updatedAt: number;
}

const getSavedProgressSummaries = (userId?: string | null): SavedProgressSummary[] => {
  if (typeof window === 'undefined') return [];

  const summaries: SavedProgressSummary[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${QUIZ_PROGRESS_PREFIX}:`)) continue;

    const [owner, mode, ...idParts] = key.slice(QUIZ_PROGRESS_PREFIX.length + 1).split(':');
    const id = idParts.join(':');
    if (!id || (userId ? owner !== userId : owner !== 'guest')) continue;
    if (mode !== 'quiz' && mode !== 'public') continue;

    try {
      const progress = JSON.parse(localStorage.getItem(key) || '{}') as {
        userAnswers?: string[];
        questionCount?: number;
        updatedAt?: number;
      };
      const questionCount = Math.max(0, Number(progress.questionCount) || 0);
      const userAnswers = Array.isArray(progress.userAnswers) ? progress.userAnswers : [];
      const answeredCount = userAnswers.filter(answer => String(answer || '').trim()).length;
      if (questionCount <= 0 || answeredCount <= 0) continue;

      summaries.push({
        key,
        mode,
        id,
        path: mode === 'public' ? `/exam/${id}` : `/play/${id}`,
        answeredCount,
        questionCount,
        updatedAt: Number(progress.updatedAt) || 0,
      });
    } catch {
      localStorage.removeItem(key);
    }
  }

  return summaries.sort((left, right) => right.updatedAt - left.updatedAt);
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, plan, login, logout, isQuizActive, loginLoading, loginError } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, direction, toggleLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedProgress, setSavedProgress] = useState<SavedProgressSummary | null>(null);

  const navItems = [
    { labelKey: 'nav.home' as const, path: '/', icon: HomeIcon },
    { labelKey: 'nav.quizBuilder' as const, path: '/builder', icon: PlusCircle, protected: true },
    { labelKey: 'nav.myQuizzes' as const, path: '/library', icon: Library, protected: true },
    { labelKey: 'nav.mindMaps' as const, path: '/mindmaps', icon: Brain, protected: true, paidFeature: true },
    { labelKey: 'nav.tasks' as const, path: '/tasks', icon: CheckSquare, protected: true },
    { labelKey: 'nav.history' as const, path: '/history', icon: History, protected: true },
    { labelKey: 'nav.profile' as const, path: '/profile', icon: User, protected: true },
    { labelKey: 'nav.admin' as const, path: '/admin', icon: Shield, protected: true, adminOnly: true },
  ];

  const hasPaidAccess = role === 'admin' || plan === 'pro' || plan === 'premium';

  useEffect(() => {
    const refreshSavedProgress = () => {
      const [latest] = getSavedProgressSummaries(user?.uid);
      setSavedProgress(latest || null);
    };

    refreshSavedProgress();
    window.addEventListener('storage', refreshSavedProgress);
    window.addEventListener('focus', refreshSavedProgress);
    window.addEventListener(QUIZ_PROGRESS_EVENT, refreshSavedProgress);
    return () => {
      window.removeEventListener('storage', refreshSavedProgress);
      window.removeEventListener('focus', refreshSavedProgress);
      window.removeEventListener(QUIZ_PROGRESS_EVENT, refreshSavedProgress);
    };
  }, [user?.uid, location.pathname]);

  const handleNavClick = (path: string, paidFeature = false) => {
    const targetPath = paidFeature && !hasPaidAccess ? '/pricing?feature=mindmaps' : path;
    if (isQuizActive && location.pathname !== path) {
      setPendingPath(targetPath);
    } else {
      navigate(targetPath);
    }
  };

  const confirmExit = () => {
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
    }
  };

  const handleLogin = () => {
    void login().catch(() => {
      // AuthContext stores the user-facing error in loginError.
    });
  };

  const shouldShowProgressAlert = Boolean(
    user &&
    savedProgress &&
    location.pathname !== savedProgress.path &&
    !location.pathname.startsWith('/result/')
  );

  const dismissSavedProgress = () => {
    if (!savedProgress) return;
    localStorage.removeItem(savedProgress.key);
    setSavedProgress(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-300" dir={direction}>
      <nav role="navigation" aria-label="Main navigation" className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                onClick={() => handleNavClick('/')}
                className="group flex flex-shrink-0 cursor-pointer items-center gap-2"
              >
                <motion.div
                  whileHover={{ y: -1, rotate: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-sm transition-all group-hover:bg-indigo-700 group-hover:shadow-md"
                >
                  <Brain className="h-5 w-5 text-white" />
                </motion.div>
                <span className="hidden whitespace-nowrap text-lg font-bold tracking-tight text-gray-900 dark:text-white xl:block">AI Quiz Master</span>
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto xl:flex custom-scrollbar">
                {navItems.map((item) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <motion.button
                      key={item.labelKey}
                      onClick={() => handleNavClick(item.path, Boolean(item.paidFeature))}
                      aria-current={isActive ? 'page' : undefined}
                      whileTap={{ scale: 0.97 }}
                      title={t(item.labelKey)}
                      className={`relative inline-flex h-10 flex-shrink-0 items-center overflow-hidden rounded-lg px-2.5 text-sm font-medium transition-colors 2xl:px-3 ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="desktop-active-nav"
                          className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/40"
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                        />
                      )}
                      <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden 2xl:inline">{t(item.labelKey)}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                title={isDark ? t('theme.light') : t('theme.dark')}
              >
                {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleLanguage}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white sm:px-3"
                title={t('common.language')}
              >
                <Languages className="h-4 w-4" />
                <span>{language === 'ar' ? 'EN' : 'ع'}</span>
              </button>

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => handleNavClick('/profile')}
                    className="flex max-w-[12rem] items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                      alt="Profile"
                      className="h-8 w-8 flex-shrink-0 rounded-full border border-gray-200 dark:border-slate-600"
                      referrerPolicy="no-referrer"
                    />
                    <span className="hidden max-w-24 truncate text-sm font-medium text-gray-700 dark:text-slate-300 2xl:block">
                      {user.displayName}
                    </span>
                    {role === 'admin' && (
                      <span className="hidden rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 2xl:inline-block">
                        {t('nav.admin')}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => logout()}
                    className="hidden h-10 items-center rounded-lg px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white sm:inline-flex 2xl:px-3"
                    title={t('auth.logout')}
                  >
                    <LogOut className="h-4 w-4 2xl:me-2" />
                    <span className="hidden 2xl:inline">{t('auth.logout')}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  aria-busy={loginLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  {loginLoading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <LogIn className="w-4 h-4 me-2" />}
                  <span className="hidden sm:inline">{loginLoading ? t('auth.signingIn') : t('auth.signIn')}</span>
                  <span className="sm:hidden">{loginLoading ? '...' : t('auth.login')}</span>
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="xl:hidden p-2 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="xl:hidden border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navItems.map((item, index) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <motion.button
                      key={item.labelKey}
                      onClick={() => {
                        handleNavClick(item.path, Boolean(item.paidFeature));
                        setIsMobileMenuOpen(false);
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.18 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center w-full px-4 py-3 text-base font-medium rounded-xl transition-all ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 me-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`} />
                      {t(item.labelKey)}
                    </motion.button>
                  );
                })}
                {user && (
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <LogOut className="w-5 h-5 me-4" />
                    {t('auth.logout')}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {shouldShowProgressAlert && savedProgress && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
            dir={direction}
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {t('progress.saved', { answered: savedProgress.answeredCount, total: savedProgress.questionCount })}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={() => handleNavClick(savedProgress.path)}
                  className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
                >
                  <PlayCircle className="me-2 h-4 w-4" />
                  {t('progress.resume')}
                </button>
                <button
                  onClick={dismissSavedProgress}
                  className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-b border-indigo-100 bg-indigo-50/80 px-4 py-2 text-center text-sm font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300" dir={direction}>
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>{t('footer.prayer')}</span>
        </span>
      </div>

      <AnimatePresence>
        {loginError && !user && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span className="whitespace-pre-line" dir="auto">{loginError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-slate-400 text-sm space-y-2">
          <p>© 2026 Mostafa. All rights reserved.</p>
          <p>
            {t('footer.contact')}{' '}
            <a
              href="mailto:mstfyalswdany913@gmail.com"
              className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              dir="ltr"
            >
              mstfyalswdany913@gmail.com
            </a>
          </p>
        </div>
      </footer>

      {/* Global Exit Confirmation Modal */}
      <AnimatePresence>
        {pendingPath && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.exitTitle')}</h3>
                <p className="text-gray-600 dark:text-slate-400">{t('quiz.exitMessage')}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setPendingPath(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  {t('quiz.stay')}
                </button>
                <button
                  onClick={confirmExit}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                >
                  {t('quiz.exit')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
