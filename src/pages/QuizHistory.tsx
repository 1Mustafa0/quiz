import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { History, Calendar, Award, ChevronRight, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface QuizResult {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  completedAt: any;
  quizTitle?: string;
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
              quizTitle: quizDoc.exists() ? quizDoc.data().title : 'Unknown Quiz'
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
              const date = result.completedAt?.toDate().toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

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
