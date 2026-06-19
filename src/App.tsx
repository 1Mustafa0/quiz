import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

const Home = React.lazy(() => import('./pages/Home'));

// Prefetch likely navigations (lightweight, critical routes)
const QuizBuilder = React.lazy(
  () => import(/* @vitePrefetch */ './pages/QuizBuilder')
);
const QuizPlayer = React.lazy(
  () => import(/* @vitePrefetch */ './pages/QuizPlayer')
);
const QuizResult = React.lazy(() => import(/* @vitePrefetch */ './pages/QuizResult'));
const QuizLibrary = React.lazy(() => import(/* @vitePrefetch */ './pages/QuizLibrary'));
const MindMapBuilder = React.lazy(() => import(/* @vitePrefetch */ './pages/MindMapBuilder'));
const MindMapEditor = React.lazy(() => import(/* @vitePrefetch */ './pages/MindMapEditor'));
const MindMapLibrary = React.lazy(() => import(/* @vitePrefetch */ './pages/MindMapLibrary'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Support = React.lazy(() => import('./pages/Support'));
const TodoList = React.lazy(() => import('./pages/TodoList'));
const QuizHistory = React.lazy(() => import('./pages/QuizHistory'));

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div className="py-10 text-center text-sm text-gray-500">Loading…</div>}
    >
      {children}
    </Suspense>
  );
}


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <PageSuspense>
                <Home />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/builder"
          element={
            <Layout>
              <PageSuspense>
                <QuizBuilder />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/edit/:quizId"
          element={
            <Layout>
              <PageSuspense>
                <QuizBuilder />
              </PageSuspense>
            </Layout>
          }
        />


        <Route
          path="/play/:quizId"
          element={
            <Layout>
              <PageSuspense>
                <QuizPlayer />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/exam/:shareId"
          element={
            <Layout>
              <PageSuspense>
                <QuizPlayer publicMode />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/review/:resultId"
          element={
            <Layout>
              <PageSuspense>
                <QuizPlayer reviewMode />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/result/:resultId"
          element={
            <Layout>
              <PageSuspense>
                <QuizResult />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/library"
          element={
            <Layout>
              <PageSuspense>
                <QuizLibrary />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/mindmaps"
          element={
            <Layout>
              <PageSuspense>
                <MindMapLibrary />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/mindmaps/builder"
          element={
            <Layout>
              <PageSuspense>
                <MindMapBuilder />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/mindmaps/:mindMapId"
          element={
            <Layout>
              <PageSuspense>
                <MindMapEditor />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/tasks"
          element={
            <Layout>
              <PageSuspense>
                <TodoList />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/history"
          element={
            <Layout>
              <PageSuspense>
                <QuizHistory />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/profile"
          element={
            <Layout>
              <PageSuspense>
                <Profile />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/admin"
          element={
            <Layout>
              <PageSuspense>
                <AdminDashboard />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/pricing"
          element={
            <Layout>
              <PageSuspense>
                <Pricing />
              </PageSuspense>
            </Layout>
          }
        />

        <Route
          path="/support"
          element={
            <Layout>
              <PageSuspense>
                <Support />
              </PageSuspense>
            </Layout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


