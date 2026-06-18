import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { Play, Trash2, Clock, BookOpen, BarChart, Search, Filter, Plus, Pencil, Share2, CheckCircle2, Download, Loader2, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ownerOnlyError } from '../utils/owner';
import { exportQuizToPdf, getPdfQuestionAnswer, getPdfQuestionOptions, preloadQuizPdfExporter } from '../utils/quizPdf';
import { getCategoryTone, normalizeCategory, sortCategories } from '../utils/categories';

interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  feedbackMode?: 'end' | 'per-question';
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
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState<'all' | 'category' | null>(null);
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(() => new Set());
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    preloadQuizPdfExporter();
  }, []);

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

  useEffect(() => {
    const quizIds = new Set(quizzes.map((quiz) => quiz.id));
    setSelectedQuizIds((prev) => {
      const next = new Set([...prev].filter((id) => quizIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [quizzes]);

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) next.delete(quizId);
      else next.add(quizId);
      return next;
    });
  };

  const handleDelete = async (quiz: Quiz) => {
    const quizTitle = quiz.title?.trim() || 'هذا الاختبار';
    const confirmed = window.confirm(`هل أنت متأكد من حذف "${quizTitle}"؟\nلا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    setDeletingQuizId(quiz.id);
    try {
      await deleteDoc(doc(db, 'quizzes', quiz.id));
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        next.delete(quiz.id);
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${quiz.id}`);
    } finally {
      setDeletingQuizId(null);
    }
  };

  const deleteQuizBatch = async (items: Quiz[]) => {
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(db);
      items.slice(i, i + 450).forEach((quiz) => {
        batch.delete(doc(db, 'quizzes', quiz.id));
      });
      await batch.commit();
    }
  };

  const handleDeleteByCategory = async () => {
    if (selectedQuizIds.size < 2) {
      window.alert('حدد اختبارين أو أكثر أولا.');
      return;
    }

    if (filterCategory === 'All') {
      window.alert('اختر تاجا من قائمة التصنيفات أولا.');
      return;
    }

    const quizzesToDelete = quizzes.filter((quiz) => selectedQuizIds.has(quiz.id) && normalizeCategory(quiz.category) === filterCategory);
    if (quizzesToDelete.length === 0) {
      window.alert('لا توجد اختبارات محددة بهذا التاج.');
      return;
    }

    if (quizzesToDelete.length < 2) {
      window.alert('حدد اختبارين أو أكثر من نفس التاج أولا.');
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف ${quizzesToDelete.length} اختبار محدد من تاج "${filterCategory}"؟\nلا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    setBulkDeleting('category');
    try {
      await deleteQuizBatch(quizzesToDelete);
      const deletedIds = new Set(quizzesToDelete.map((quiz) => quiz.id));
      setQuizzes((prev) => prev.filter((quiz) => !deletedIds.has(quiz.id)));
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setFilterCategory('All');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quizzes/category/${filterCategory}`);
    } finally {
      setBulkDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (selectedQuizIds.size < 2) {
      window.alert('حدد اختبارين أو أكثر أولا.');
      return;
    }

    const quizzesToDelete = quizzes.filter((quiz) => selectedQuizIds.has(quiz.id));
    const confirmed = window.confirm(`هل تريد حذف كل الاختبارات المحددة؟ العدد: ${quizzesToDelete.length}\nلا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    setBulkDeleting('all');
    try {
      await deleteQuizBatch(quizzesToDelete);
      const deletedIds = new Set(quizzesToDelete.map((quiz) => quiz.id));
      setQuizzes((prev) => prev.filter((quiz) => !deletedIds.has(quiz.id)));
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'quizzes/all');
    } finally {
      setBulkDeleting(null);
    }
  };

  const handleShare = async (quizId: string) => {
    if (!user) return;
    setSharingQuizId(quizId);
    setShareMessage(null);

    try {
      const quiz = quizzes.find((item) => item.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        throw new Error('Quiz has no questions');
      }

      const shareId = `${quizId.slice(0, 8)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      await setDoc(doc(db, 'sharedQuizzes', shareId), {
        shareId,
        sourceQuizId: quiz.id,
        title: quiz.title || 'Shared Quiz',
        description: quiz.description || '',
        category: quiz.category || 'General',
        difficulty: quiz.difficulty || 'medium',
        feedbackMode: quiz.feedbackMode === 'per-question' ? 'per-question' : 'end',
        timer: Number(quiz.timer || 0),
        questions: quiz.questions,
        ownerUid: user.uid,
        createdAt: Timestamp.now(),
      });

      const shareUrl = `${window.location.origin}/exam/${shareId}`;
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
      setShareMessage(ownerOnlyError(user, 'تعذر إنشاء رابط المشاركة حاليا. حاول مرة أخرى لاحقا.', err));
    } finally {
      setSharingQuizId(null);
    }
  };
  const handleExportPdf = async (quiz: Quiz) => {
    const invalidQuestionIndex = (quiz.questions || []).findIndex(question =>
      (question?.type || 'multiple-choice') === 'multiple-choice' && getPdfQuestionOptions(question).length < 4
    );
    if (invalidQuestionIndex >= 0) {
      window.alert(`السؤال رقم ${invalidQuestionIndex + 1} لا يحتوي على 4 اختيارات محفوظة. افتح الكويز من زر Edit وأضف الاختيارات ثم حمّل PDF جديد.`);
      return;
    }

    const missingAnswerIndex = (quiz.questions || []).findIndex(question => !getPdfQuestionAnswer(question).text);
    if (missingAnswerIndex >= 0) {
      window.alert(`السؤال رقم ${missingAnswerIndex + 1} لا يحتوي على إجابة صحيحة محفوظة. افتح الكويز من زر Edit واختر الإجابة الصحيحة ثم حمّل PDF جديد.`);
      return;
    }

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
  const selectedCount = selectedQuizIds.size;
  const selectedInCategoryCount = filterCategory === 'All'
    ? 0
    : quizzes.filter((quiz) => selectedQuizIds.has(quiz.id) && normalizeCategory(quiz.category) === filterCategory).length;
  const canBulkDelete = selectedCount >= 2 && bulkDeleting === null;
  const canDeleteByCategory = canBulkDelete && filterCategory !== 'All' && selectedInCategoryCount >= 2;

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
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
        {quizzes.length > 0 && (
          <div className="space-y-2" dir="rtl" style={{ direction: 'rtl' }}>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">إجراءات</label>
            <div className="relative flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-sm text-gray-600 dark:text-slate-300">المحدد: {selectedCount}</span>
              <details className="relative">
                <summary
                  className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 [&::-webkit-details-marker]:hidden"
                  title="إجراءات المحدد"
                >
                  <MoreVertical className="h-4 w-4" />
                </summary>
                <div className="absolute left-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-right shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={handleDeleteByCategory}
                    disabled={!canDeleteByCategory}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-red-300"
                  >
                    <span>حذف من التاج</span>
                    {bulkDeleting === 'category' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={!canBulkDelete}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-red-300"
                  >
                    <span>حذف المحدد</span>
                    {bulkDeleting === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  {selectedCount < 2 && (
                    <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400 dark:border-slate-800 dark:text-slate-500">
                      حدد اختبارين أو أكثر لتفعيل الحذف.
                    </div>
                  )}
                </div>
              </details>
              </div>
          </div>
        )}
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
              const isSelected = selectedQuizIds.has(quiz.id);

              return (
                <motion.div
                  key={quiz.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-visible flex flex-col group ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100 dark:border-indigo-500/60 dark:ring-indigo-500/20' : 'border-gray-100 dark:border-slate-700'}`}
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
                      <label
                        className="inline-flex items-center justify-center p-2 text-gray-500 transition-colors bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700 hover:text-indigo-600 cursor-pointer"
                        title="Select quiz"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleQuizSelection(quiz.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                      <details className="relative">
                        <summary
                          className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg border border-gray-100 bg-white p-2 text-gray-500 transition-colors hover:text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-slate-100 [&::-webkit-details-marker]:hidden"
                          title="Quiz actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <Link
                            to={`/edit/${quiz.id}`}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(quiz)}
                            disabled={deletingQuizId === quiz.id || bulkDeleting !== null}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-red-300"
                          >
                            {deletingQuizId === quiz.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete
                          </button>
                        </div>
                      </details>
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
    </div>
  );
};

export default QuizLibrary;
