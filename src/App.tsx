import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import QuizBuilder from './pages/QuizBuilder';
import QuizLibrary from './pages/QuizLibrary';
import QuizPlayer from './pages/QuizPlayer';
import QuizResult from './pages/QuizResult';
import AdminDashboard from './pages/AdminDashboard';
import QuizHistory from './pages/QuizHistory';
import Profile from './pages/Profile';
import TodoList from './pages/TodoList';
import WelcomeModal from './components/WelcomeModal';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const { user, showWelcome, setShowWelcome } = useAuth();

  return (
    <Router>
      <Layout>
        <WelcomeModal 
          isOpen={showWelcome} 
          onClose={() => setShowWelcome(false)} 
          userName={user?.displayName || null}
        />
        <Routes>
            <Route path="/" element={<Home />} />
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
              path="/play/:quizId"
              element={
                <ProtectedRoute>
                  <QuizPlayer />
                </ProtectedRoute>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
  );
}
