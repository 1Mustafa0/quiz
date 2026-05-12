import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogIn, LogOut, PlusCircle, Library, Home as HomeIcon, AlertCircle, Shield, History, User, Brain, Menu, X, CheckSquare, Sun, Moon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, login, logout, isQuizActive, loginLoading, loginError } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/', icon: HomeIcon },
    { name: 'Quiz Builder', path: '/builder', icon: PlusCircle, protected: true },
    { name: 'My Quizzes', path: '/library', icon: Library, protected: true },
    { name: 'Mind Maps', path: '/mindmaps', icon: Brain, protected: true },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare, protected: true },
    { name: 'History', path: '/history', icon: History, protected: true },
    { name: 'Profile', path: '/profile', icon: User, protected: true },
    { name: 'Admin', path: '/admin', icon: Shield, protected: true, adminOnly: true },
  ];

  const handleNavClick = (path: string) => {
    if (isQuizActive && location.pathname !== path) {
      setPendingPath(path);
    } else {
      navigate(path);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
      <nav role="navigation" aria-label="Main navigation" className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div
                onClick={() => handleNavClick('/')}
                className="flex items-center space-x-2 cursor-pointer group"
              >
                <motion.div
                  whileHover={{ y: -1, rotate: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-700 transition-all shadow-sm group-hover:shadow-md"
                >
                  <Brain className="text-white w-6 h-6" />
                </motion.div>
                <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">AI Quiz Master</span>
              </div>
              <div className="hidden lg:ml-8 lg:flex lg:space-x-4">
                {navItems.map((item) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <motion.button
                      key={item.name}
                      onClick={() => handleNavClick(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                      whileTap={{ scale: 0.97 }}
                      className={`relative inline-flex items-center overflow-hidden px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="desktop-active-nav"
                          className="absolute inset-0 rounded-xl bg-indigo-50 dark:bg-indigo-900/40"
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                        />
                      )}
                      <span className="relative inline-flex items-center">
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
              </button>

              {user ? (
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <button
                    onClick={() => handleNavClick('/profile')}
                    className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                  >
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-200 dark:border-slate-600"
                      referrerPolicy="no-referrer"
                    />
                    <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-slate-300">
                      {user.displayName}
                    </span>
                    {role === 'admin' && (
                      <span className="hidden sm:inline-block bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => logout()}
                    className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  aria-busy={loginLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  {loginLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  <span className="hidden sm:inline">{loginLoading ? 'Signing in...' : 'Sign In'}</span>
                  <span className="sm:hidden">{loginLoading ? '...' : 'Login'}</span>
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
              className="lg:hidden border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navItems.map((item, index) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <motion.button
                      key={item.name}
                      onClick={() => {
                        handleNavClick(item.path);
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
                      <item.icon className={`w-5 h-5 mr-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`} />
                      {item.name}
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
                    <LogOut className="w-5 h-5 mr-4" />
                    Logout
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="border-b border-indigo-100 bg-indigo-50/80 px-4 py-2 text-center text-sm font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300" dir="rtl">
        <span className="inline-flex items-center justify-center gap-2">
          <span className="text-base leading-none">😊</span>
          <span>متنساش تصلّي على النبي</span>
          <span className="text-indigo-500">♥</span>
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
            للتواصل:{' '}
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">الخروج من الكويز؟</h3>
                <p className="text-gray-600 dark:text-slate-400">هل تريد الخروج قبل إتمام الكويز؟ لن يتم حفظ تقدمك.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setPendingPath(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  البقاء
                </button>
                <button
                  onClick={confirmExit}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                >
                  الخروج
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
