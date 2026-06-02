import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { History, Calendar, Award, ChevronRight, Search, Target, Flame, Medal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { calculateDailyStreak, getBadges, getResultPercentage } from '../utils/quizInsights';

interface QuizResult {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  completedAt: any;
  quizTitle?: string;
  category?: string;
}

const QuizHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'results'),
      where('userId', '==', user.uid),
      orderBy('completedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const resultsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuizResult[];

      // Fetch quiz titles for each result
      const resultsWithTitles = await Promise.all(
        resultsList.map(async (res) => {
          try {
            const quizDoc = await getDoc(doc(db, 'quizzes', res.quizId));
            return {
              ...res,
              quizTitle: quizDoc.exists() ? quizDoc.data().title : 'Unknown Quiz',
              category: res.category || (quizDoc.exists() ? quizDoc.data().category : 'General') || 'General',
            };
          } catch (error) {
            return { ...res, quizTitle: 'Unknown Quiz' };
          }
        })
      );

      setResults(resultsWithTitles);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'results');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredResults = results.filter(r => 
    r.quizTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const completedDates = results
    .map(result => result.completedAt?.toDate?.())
    .filter((date): date is Date => date instanceof Date);
  const streak = calculateDailyStreak(completedDates);
  const { badges, average } = getBadges(results, streak);
  const categoryStats = Object.values(results.reduce<Record<string, { category: string; score: number; total: number; attempts: number }>>((acc, result) => {
    const category = result.category || 'General';
    if (!acc[category]) acc[category] = { category, score: 0, total: 0, attempts: 0 };
    acc[category].score += result.score;
    acc[category].total += result.totalQuestions;
    acc[category].attempts += 1;
    return acc;
  }, {})).sort((a, b) => getResultPercentage(b.score, b.total) - getResultPercentage(a.score, a.total));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <History className="w-8 h-8 mr-3 text-indigo-600" />
            سجل الاختبارات
          </h1>
          <p className="text-gray-600">تتبع تقدمك وراجع نتائجك السابقة.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث في الاختبارات السابقة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
        />
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500">Streak يومي</p>
                <p className="text-3xl font-black text-orange-600">{streak}</p>
              </div>
              <Flame className="w-9 h-9 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500 mt-3">حل اختبارا كل يوم للحفاظ على السلسلة.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500">متوسط الإتقان</p>
                <p className="text-3xl font-black text-indigo-600">{average}%</p>
              </div>
              <Target className="w-9 h-9 text-indigo-500" />
            </div>
            <p className="text-xs text-gray-500 mt-3">محسوب من كل محاولاتك السابقة.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Medal className="w-5 h-5 text-amber-500" />
              <p className="font-bold text-gray-900">Badges</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge.title}
                  title={badge.description}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${badge.earned ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                >
                  {badge.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {categoryStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">نسبة الإتقان حسب التصنيف</h2>
            <span className="text-xs font-bold text-gray-400">Mastery</span>
          </div>
          <div className="space-y-4">
            {categoryStats.map((stat) => {
              const mastery = getResultPercentage(stat.score, stat.total);
              return (
                <div key={stat.category} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-700">{stat.category}</span>
                    <span className="text-gray-500">{mastery}% · {stat.attempts} محاولة</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${mastery}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredResults.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900">لا يوجد سجل نتائج بعد</h3>
          <p className="text-gray-500 mt-2">ابدأ بأداء اختبار لتظهر نتائجك هنا.</p>
          <button
            onClick={() => navigate('/library')}
            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all"
          >
            تصفح الاختبارات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredResults.map((result) => {
              const percentage = Math.round((result.score / result.totalQuestions) * 100);
              const date = result.completedAt?.toDate()?.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) || 'تاريخ غير معروف';

              return (
                <motion.div
                  key={result.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => navigate(`/result/${result.id}`)}
                  className="group bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-lg sm:text-2xl font-bold flex-shrink-0 ${
                      percentage >= 80 ? 'bg-green-50 text-green-600' :
                      percentage >= 50 ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {percentage}%
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {result.quizTitle}
                      </h3>
                      <div className="flex items-center text-[10px] sm:text-sm text-gray-500 mt-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        {date}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wider font-bold">الدرجة</div>
                      <div className="text-xl sm:text-2xl font-black text-gray-900">
                        {result.score} <span className="text-gray-400 text-sm sm:text-lg">/ {result.totalQuestions}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
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

export default QuizHistory;
