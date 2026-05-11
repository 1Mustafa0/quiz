import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Play, Trash2, Clock, BookOpen, BarChart, Search, Filter, Plus, Pencil, Share2, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';
import { ownerOnlyError } from '../utils/owner';
import { exportQuizToPdf } from '../utils/quizPdf';
import { getCategoryTone, normalizeCategory, sortCategories } from '../utils/categories';

interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  questions: any[];
  timer: number;
  createdAt: any;
}

const QuizLibrary: React.FC = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [sharingQuizId, setSharingQuizId] = useState<string | null>(null);
  const [exportingQuizId, setExportingQuizId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!user) return;

    // First, get total count
    const countQuery = query(
      collection(db, 'quizzes'),
      where('authorUid', '==', user.uid)
    );

    const unsubscribeCount = onSnapshot(countQuery, (snapshot) => {
      setTotalQuizzes(snapshot.size);
    });

    // Then, get paginated data
    const q = query(
      collection(db, 'quizzes'),
      where('authorUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      // limit(itemsPerPage)  // Only load 12 items per page
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quizList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quiz[];
      setQuizzes(quizList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
    });

    return () => {
      unsubscribe();
      unsubscribeCount();
    };
  }, [user]);

  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!quizToDelete) return;
    try {
      await deleteDoc(doc(db, 'quizzes', quizToDelete));
      setQuizToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${quizToDelete}`);
    }
  };

  const handleShare = async (quizId: string) => {
    if (!user) return;
    setSharingQuizId(quizId);
    setShareMessage(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/share-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ quizId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create share link');

      const shareUrl = `${window.location.origin}${data.url}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('تم نسخ رابط الامتحان. يمكن فتحه بدون تسجيل دخول.');
      } catch {
        window.prompt('انسخ رابط الامتحان:', shareUrl);
        setShareMessage('تم إنشاء رابط الامتحان.');
      }
      setTimeout(() => setShareMessage(null), 5000);
    } catch (err: any) {
      console.error('[QuizLibrary] share link failed:', err);
      setShareMessage(ownerOnlyError(user, 'تعذر إنشاء رابط المشاركة حالياً. حاول مرة أخرى لاحقاً.', err));
    } finally {
      setSharingQuizId(null);
    }
  };

  const handleExportPdf = async (quiz: Quiz) => {
    setExportingQuizId(quiz.id);
    try {
      const downloaded = await exportQuizToPdf(quiz);
      if (!downloaded) {
        window.alert('تعذر تحميل ملف PDF حالياً. حاول مرة أخرى.');
      }
    } finally {
      setExportingQuizId(null);
    }
  };

  const categoryCounts = useMemo(() => {
    return quizzes.reduce<Record<string, number>>((acc, quiz) => {
      const quizCategory = normalizeCategory(quiz.category);
      if (!quizCategory) return acc;
      acc[quizCategory] = (acc[quizCategory] || 0) + 1;
      return acc;
    }, {});
  }, [quizzes]);

  const categories = ['All', ...sortCategories(Object.keys(categoryCounts))];
  const difficulties = ['All', 'easy', 'medium', 'hard'];

  const filteredQuizzes = quizzes.filter(q => {
    const quizCategory = normalizeCategory(q.category);
    const searchableText = `${q.title || ''} ${q.description || ''} ${quizCategory}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || quizCategory === filterCategory;
    const matchesDifficulty = filterDifficulty === 'All' || q.difficulty === filterDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Quiz Library</h1>
          <p className="text-gray-600 dark:text-slate-400">Manage, edit, and play your generated quizzes with ease.</p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <span>{filteredQuizzes.length}</span>
            <span className="h-1 w-1 rounded-full bg-indigo-400" />
            <span>{filterCategory !== 'All' ? filterCategory : 'All categories'}</span>
            <span className="h-1 w-1 rounded-full bg-indigo-400" />
            <span>{filterDifficulty !== 'All' ? filterDifficulty : 'All difficulties'}</span>
          </div>
        </div>
        <Link
          to="/builder"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Quiz
        </Link>
      </div>

      <AnimatePresence>
        {shareMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="whitespace-pre-line" dir="auto">{shareMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search quizzes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Category</label>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-grow px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c === 'All' ? `All categories (${quizzes.length})` : `${c} (${categoryCounts[c] || 0})`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Difficulty</label>
          <div className="flex items-center gap-2">
            <BarChart className="w-5 h-5 text-gray-400" />
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="flex-grow px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              {difficulties.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Quiz Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900">No quizzes found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or create a new quiz.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredQuizzes.map((quiz) => {
              const quizCategory = normalizeCategory(quiz.category);

              return (
                <motion.div
                  key={quiz.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group"
                >
                <div className="p-6 flex-grow space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0 mr-2">
                      {quizCategory && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getCategoryTone(quizCategory)}`} dir="auto">
                          {quizCategory}
                        </span>
                      )}
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-1">{quiz.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/edit/${quiz.id}`}
                        className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700"
                        title="Edit quiz"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setQuizToDelete(quiz.id)}
                        className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-red-500 transition-colors bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700"
                        title="Delete quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 dark:text-slate-300 text-sm line-clamp-2 min-h-[2.5rem]">
                    {quiz.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{quiz.timer}m</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>{quiz.questions.length} questions</span>
                    </div>
                    <div className="flex items-center gap-2 capitalize">
                      <BarChart className="w-4 h-4" />
                      <span>{quiz.difficulty}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 space-y-3">
                  <Link
                    to={`/play/${quiz.id}`}
                    className="w-full inline-flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm transition-all group-hover:scale-[1.02]"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Quiz
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleShare(quiz.id)}
                    disabled={sharingQuizId === quiz.id}
                    className="w-full inline-flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl font-semibold border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {sharingQuizId === quiz.id ? 'Creating link...' : 'Share Exam Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportPdf(quiz)}
                    disabled={exportingQuizId === quiz.id}
                    className="w-full inline-flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl font-semibold border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {exportingQuizId === quiz.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {exportingQuizId === quiz.id ? 'Downloading...' : 'Download PDF'}
                  </button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleDelete}
        title="حذف الكويز؟"
        message="هل أنت متأكد من حذف هذا الكويز؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  );
};

export default QuizLibrary;
