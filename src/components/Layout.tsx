import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LogIn, LogOut, LayoutDashboard, PlusCircle, Library, Home as HomeIcon, AlertCircle, Shield, History, User, Brain, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, login, logout, isQuizActive } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/', icon: HomeIcon },
    { name: 'Quiz Builder', path: '/builder', icon: PlusCircle, protected: true },
    { name: 'My Quizzes', path: '/library', icon: Library, protected: true },
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div 
                onClick={() => handleNavClick('/')}
                className="flex items-center space-x-2 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-700 transition-all shadow-sm group-hover:shadow-md">
                  <Brain className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-gray-900 tracking-tight">AI Quiz Master</span>
              </div>
              <div className="hidden lg:ml-8 lg:flex lg:space-x-4">
                {navItems.map((item) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item.path)}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {user ? (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <button
                    onClick={() => handleNavClick('/profile')}
                    className="flex items-center space-x-2 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
                  >
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-200"
                      referrerPolicy="no-referrer"
                    />
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                      {user.displayName}
                    </span>
                    {role === 'admin' && (
                      <span className="hidden sm:inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => logout()}
                    className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => login()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="sm:hidden">Login</span>
                </button>
              )}
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
              className="lg:hidden border-t border-gray-100 bg-white overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navItems.map((item) => {
                  if (item.protected && !user) return null;
                  if (item.adminOnly && role !== 'admin') return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        handleNavClick(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center w-full px-4 py-3 text-base font-medium rounded-xl transition-all ${
                        isActive
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 mr-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                      {item.name}
                    </button>
                  );
                })}
                {user && (
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
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

      <main className="flex-grow">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
        >
          <div className="mb-8 text-center animate-pulse">
            <span className="text-2xl sm:text-4xl font-bold text-indigo-600 drop-shadow-sm font-amiri">
              متنساش تصل على النبي ❤😊
            </span>
          </div>
          {children}
        </motion.div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 Mostafa. All rights reserved.
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
              className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">الخروج من الكويز؟</h3>
                <p className="text-gray-600">هل تريد الخروج قبل إتمام الكويز؟ لن يتم حفظ تقدمك.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setPendingPath(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
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
