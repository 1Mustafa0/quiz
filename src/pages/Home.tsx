import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  Sparkles, Brain, Library, ArrowRight, Upload,
  Cpu, Play, FileText, Globe, Zap, Star,
  BookOpen, GitBranch, Trophy, Clock, TrendingUp,
  PlusCircle, ChevronRight, BarChart2, CheckSquare, History
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';

interface RecentQuiz {
  id: string;
  title: string;
  category: string;
  questions: any[];
  createdAt: any;
}

interface RecentMap {
  id: string;
  title: string;
  topic: string;
  category: string;
  createdAt: any;
}

interface DashboardStats {
  quizzesCreated: number;
  mindMapsCreated: number;
  quizzesTaken: number;
  averageScore: number;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' } as const,
  transition: { duration: 0.55, delay },
});

const fadeScale = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.92 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, margin: '-60px' } as const,
  transition: { duration: 0.5, delay },
});

/* ─── Dashboard for logged-in users ─── */
const UserDashboard: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ quizzesCreated: 0, mindMapsCreated: 0, quizzesTaken: 0, averageScore: 0 });
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>([]);
  const [recentMaps, setRecentMaps] = useState<RecentMap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let unsubs: (() => void)[] = [];

    // Recent quizzes
    const qQuizzes = query(
      collection(db, 'quizzes'),
      where('authorUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(4)
    );
    unsubs.push(onSnapshot(qQuizzes, snap => {
      setRecentQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentQuiz)));
      setStats(s => ({ ...s, quizzesCreated: snap.size >= 4 ? snap.size : snap.size }));
      setLoading(false);
    }));

    // Recent mind maps
    const qMaps = query(
      collection(db, 'mindmaps'),
      where('authorUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(4)
    );
    unsubs.push(onSnapshot(qMaps, snap => {
      setRecentMaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentMap)));
      setStats(s => ({ ...s, mindMapsCreated: snap.size }));
    }));

    // Quiz results for stats
    const qResults = query(
      collection(db, 'results'),
      where('userId', '==', user.uid),
      orderBy('completedAt', 'desc'),
      limit(50)
    );
    unsubs.push(onSnapshot(qResults, snap => {
      const results = snap.docs.map(d => d.data());
      const taken = results.length;
      const avg = taken > 0
        ? Math.round(results.reduce((sum, r) => sum + (r.score / (r.totalQuestions || 1)) * 100, 0) / taken)
        : 0;
      setStats(s => ({ ...s, quizzesTaken: taken, averageScore: avg }));
    }));

    return () => unsubs.forEach(u => u());
  }, [user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحباً' : 'مساء الخير';
  const firstName = user?.displayName?.split(' ')[0] || 'بطل';

  const statCards = [
    { label: 'كويز تم إنشاؤه', value: stats.quizzesCreated, icon: BookOpen, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'خريطة ذهنية', value: stats.mindMapsCreated, icon: GitBranch, color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: 'كويز تم حله', value: stats.quizzesTaken, icon: Trophy, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'متوسط النتيجة', value: stats.averageScore ? `${stats.averageScore}%` : '—', icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  ];

  const quickActions = [
    { label: 'كويز جديد', desc: 'ارفع ملف أو أدخل نصاً', icon: Sparkles, path: '/builder', gradient: 'from-indigo-500 to-purple-600' },
    { label: 'خريطة ذهنية', desc: 'أنشئ خريطة بالذكاء الاصطناعي', icon: Brain, path: '/mindmaps/builder', gradient: 'from-violet-500 to-fuchsia-600' },
    { label: 'مهامي', desc: 'تتبع قائمة المهام', icon: CheckSquare, path: '/tasks', gradient: 'from-teal-500 to-cyan-600' },
    { label: 'سجل النتائج', desc: 'راجع أداءك السابق', icon: History, path: '/history', gradient: 'from-rose-500 to-pink-600' },
  ];

  return (
    <div className="space-y-10 pb-16">
      {/* Welcome Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`}
                alt="avatar"
                className="w-12 h-12 rounded-2xl border-2 border-white/40 shadow-lg"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="text-indigo-200 text-sm font-medium">{greeting} 👋</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold">{firstName}!</h1>
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-indigo-100 text-sm max-w-md"
            >
              لوحة التحكم الخاصة بك — كل شيء في مكان واحد
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex gap-3"
          >
            <Link
              to="/builder"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 shadow-lg transition-all hover:-translate-y-0.5 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              كويز جديد
            </Link>
            <Link
              to="/mindmaps/builder"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white/15 text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all hover:-translate-y-0.5 text-sm"
            >
              <Brain className="w-4 h-4" />
              خريطة ذهنية
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * i, ease: 'easeOut' }}
            className={`${card.bg} rounded-2xl p-5 border border-white/60 dark:border-slate-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
          >
            <div className={`w-10 h-10 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center mb-3 shadow-sm`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {loading ? <span className="inline-block w-8 h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" /> : card.value}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-medium">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <motion.h2 {...fadeUp(0)} className="text-xl font-bold text-gray-900 dark:text-white mb-4">إجراءات سريعة</motion.h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              {...fadeScale(0.08 * i)}
              onClick={() => navigate(action.path)}
              className="group text-right p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer w-full"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <div className="font-bold text-gray-900 dark:text-white text-sm">{action.label}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{action.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Quizzes */}
        <motion.div {...fadeUp(0)} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">آخر الكويزات</h3>
            </div>
            <Link to="/library" className="text-indigo-500 hover:text-indigo-700 text-sm font-semibold flex items-center gap-1 transition-colors">
              الكل <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : recentQuizzes.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <BookOpen className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-slate-500 text-sm">لا توجد كويزات بعد</p>
                <Link to="/builder" className="mt-3 inline-flex items-center gap-1 text-indigo-500 text-sm font-semibold hover:text-indigo-700 transition-colors">
                  <PlusCircle className="w-4 h-4" /> أنشئ كويزاً الآن
                </Link>
              </div>
            ) : (
              recentQuizzes.map((quiz, i) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.07 * i }}
                  className="px-6 py-4 flex items-center gap-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/play/${quiz.id}`)}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{quiz.title}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {quiz.questions?.length || 0} سؤال · {quiz.category}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Mind Maps */}
        <motion.div {...fadeUp(0.1)} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-violet-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">آخر الخرائط الذهنية</h3>
            </div>
            <Link to="/mindmaps" className="text-violet-500 hover:text-violet-700 text-sm font-semibold flex items-center gap-1 transition-colors">
              الكل <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : recentMaps.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <GitBranch className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-slate-500 text-sm">لا توجد خرائط بعد</p>
                <Link to="/mindmaps/builder" className="mt-3 inline-flex items-center gap-1 text-violet-500 text-sm font-semibold hover:text-violet-700 transition-colors">
                  <PlusCircle className="w-4 h-4" /> أنشئ خريطة الآن
                </Link>
              </div>
            ) : (
              recentMaps.map((map, i) => (
                <motion.div
                  key={map.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.07 * i }}
                  className="px-6 py-4 flex items-center gap-3 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors cursor-pointer group"
                  onClick={() => navigate('/mindmaps')}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{map.title || map.topic}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{map.category}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ─── Landing page for guests ─── */
const LandingPage: React.FC<{ login: () => void }> = ({ login }) => {
  const navigate = useNavigate();

  const mainFeatures = [
    {
      title: 'AI Quiz Builder',
      description: 'Upload a PDF, Word doc, or image and let Gemini AI analyze the content and generate professional quiz questions in seconds.',
      icon: Sparkles,
      gradient: 'from-indigo-500 to-purple-600',
      bg: 'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
      path: '/builder',
    },
    {
      title: 'Mind Map Builder',
      description: 'Generate interactive AI-powered mind maps from any topic. Beautiful radial SVG visuals with zoom and pan support.',
      icon: Brain,
      gradient: 'from-violet-500 to-fuchsia-600',
      bg: 'from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20',
      path: '/mindmaps/builder',
    },
    {
      title: 'Quiz Library',
      description: 'Browse, play, and track your results. All your quizzes in one place with detailed performance statistics.',
      icon: Library,
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      path: '/library',
    },
  ];

  const steps = [
    { number: '1', title: 'Upload Content', description: 'Upload a PDF, Word doc, or image — or paste text directly into the editor.', icon: Upload },
    { number: '2', title: 'AI Analyzes', description: 'Gemini AI reads your content and generates accurate, varied questions automatically.', icon: Cpu },
    { number: '3', title: 'Play & Share', description: 'Start your quiz instantly, track your score, and share it with anyone.', icon: Play },
  ];

  const capabilities = [
    { label: 'Multilingual', icon: Globe, desc: 'Supports Arabic, English, and 50+ other languages' },
    { label: 'CSV Import', icon: FileText, desc: 'Import bulk questions from a simple CSV file' },
    { label: 'Fast & Smart', icon: Zap, desc: 'Generates a full quiz in under 30 seconds' },
    { label: 'Completely Free', icon: Star, desc: 'All features available with no limits or subscriptions' },
  ];

  return (
    <div className="space-y-20 pb-20 -mt-4">

      {/* Personal Touch Banner */}
      <div className="text-center py-2 animate-pulse">
        <span className="text-xl sm:text-3xl font-bold text-indigo-500 dark:text-indigo-400 drop-shadow-sm font-amiri">
          متنساش تصل على النبي ❤😊
        </span>
      </div>

      {/* Hero Section */}
      <section className="relative text-center space-y-8 max-w-5xl mx-auto overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-r from-indigo-200/40 to-purple-200/40 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium border border-indigo-100 dark:border-indigo-800"
        >
          <Sparkles className="w-4 h-4" />
          Powered by Gemini AI
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="relative text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight"
        >
          Transform Your Content into{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Interactive Quizzes
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="relative text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
        >
          The smartest tool for students and teachers. Upload any file and let AI instantly
          generate a professional quiz — or build mind maps with just a few words.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="relative flex flex-col sm:flex-row justify-center items-center gap-4 pt-2"
        >
          <button
            onClick={() => login()}
            className="group inline-flex items-center gap-2 px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:shadow-2xl transition-all transform hover:-translate-y-1"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-2xl text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <Library className="w-5 h-5" />
            Browse Quizzes
          </Link>
        </motion.div>
      </section>

      {/* Main Features */}
      <section className="space-y-8">
        <motion.div {...fadeUp()} className="text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            Everything You Need in One Place
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Three powerful AI-driven tools to supercharge your learning experience
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mainFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              {...fadeScale(0.12 * (index + 1))}
              onClick={() => login()}
              className={`relative group cursor-pointer p-8 bg-gradient-to-br ${feature.bg} rounded-3xl border border-white/80 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden`}
            >
              <div className={`absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-300`} />
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed text-sm">{feature.description}</p>
              <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm group-hover:gap-3 transition-all">
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-10">
        <motion.div {...fadeUp()} className="text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            How It Works
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">
            Three simple steps to create a professional quiz
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              {...fadeUp(0.15 * (index + 1))}
              className="relative text-center space-y-4 p-8 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
            >
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 z-10">
                  <ArrowRight className="w-6 h-6 text-indigo-200 dark:text-indigo-800" />
                </div>
              )}
              <div className="relative inline-flex mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30">
                  <step.icon className="w-9 h-9 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-purple-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
              <p className="text-gray-500 dark:text-slate-400 leading-relaxed text-sm max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="space-y-6">
        <motion.div {...fadeUp()} className="text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
            More Features
          </h2>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {capabilities.map((cap, index) => (
            <motion.div
              key={cap.label}
              {...fadeScale(0.1 * index)}
              className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-center group hover:-translate-y-1 cursor-default"
            >
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <cap.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{cap.label}</h4>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <motion.section
        {...fadeUp()}
        className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-12 text-center text-white space-y-8 overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold">Ready to Level Up Your Learning?</h2>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">
            Join now and start creating smart quizzes and mind maps from any educational content
          </p>
        </div>

        <div className="relative flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => login()}
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-600 font-bold text-lg rounded-2xl hover:bg-indigo-50 shadow-2xl transition-all hover:-translate-y-1"
          >
            <Sparkles className="w-5 h-5" />
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex justify-center gap-12 pt-2">
          <div className="text-center">
            <div className="text-3xl font-black">50+</div>
            <div className="text-indigo-200 text-sm mt-1">Languages</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black">30s</div>
            <div className="text-indigo-200 text-sm mt-1">To Generate a Quiz</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black">100%</div>
            <div className="text-indigo-200 text-sm mt-1">Free</div>
          </div>
        </div>
      </motion.section>

    </div>
  );
};

/* ─── Main Export ─── */
const Home: React.FC = () => {
  const { user, login } = useAuth();

  if (user) {
    return <UserDashboard user={user} />;
  }

  return <LandingPage login={login} />;
};

export default Home;
