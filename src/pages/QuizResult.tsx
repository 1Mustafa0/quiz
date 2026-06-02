import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, XCircle, Trophy, RotateCcw, Library, ChevronDown, ChevronUp, MessageSquare, Bookmark, Target, TrendingUp, Lightbulb, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SupportCTA from '../components/SupportCTA';
import { buildResultInsights } from '../utils/quizInsights';

interface AnswerResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  options?: string[];
  type?: 'multiple-choice' | 'true-false' | 'short-answer';
  difficulty?: 'easy' | 'medium' | 'hard';
  topic_tag?: string;
  isCorrect: boolean;
  feedback: string;
  isMarked?: boolean;
}

const difficultyStyles = {
  easy: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  hard: 'bg-red-50 text-red-700 border-red-200',
};

interface Result {
  quizId: string;
  quizTitle?: string;
  category?: string;
  feedbackMode?: 'end' | 'per-question';
  score: number;
  totalQuestions: number;
  answers: AnswerResult[];
  completedAt: any;
}

const QuizResult: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      if (!resultId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'results', resultId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setResult(docSnap.data() as Result);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `results/${resultId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [resultId]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!result) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">لم يتم العثور على النتيجة</h2>
          <p className="mt-2 text-gray-600 dark:text-slate-400">قد تكون النتيجة محذوفة أو غير متاحة لهذا الحساب.</p>
        </div>
        <Link
          to="/library"
          className="inline-flex items-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Library className="mr-2 h-5 w-5" />
          العودة للمكتبة
        </Link>
      </div>
    );
  }

  const safeTotalQuestions = Math.max(0, Number(result.totalQuestions) || 0);
  const safeScore = Math.max(0, Number(result.score) || 0);
  const safeResult = {
    ...result,
    score: safeScore,
    totalQuestions: safeTotalQuestions,
    answers: Array.isArray(result.answers) ? result.answers : [],
  };
  const percentage = safeTotalQuestions > 0 ? Math.round((safeScore / safeTotalQuestions) * 100) : 0;
  const insights = buildResultInsights(safeResult);
  
  const getFeedback = () => {
    if (percentage >= 90) return { message: 'ممتاز 🔥', color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 70) return { message: 'جيد جدًا 👏', color: 'text-blue-600', bg: 'bg-blue-50' };
    return { message: 'حاول تاني 💪', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const feedback = getFeedback();
  const canReviewMistakes = insights.incorrectAnswers.some(answer => (answer.options || []).length > 0);

  const handleReviewMistakes = () => {
    if (!resultId || !canReviewMistakes) return;
    navigate(`/review/${resultId}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 sm:p-12 rounded-3xl border border-gray-100 shadow-xl text-center space-y-6 sm:space-y-8"
      >
        <div className="relative inline-block">
          <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full border-8 border-indigo-50 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl sm:text-6xl font-extrabold text-indigo-600">{percentage}%</div>
              <div className="text-xs sm:text-gray-500 font-medium">النتيجة</div>
            </div>
          </div>
          <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 w-12 h-12 sm:w-16 sm:h-16 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className={`text-2xl sm:text-3xl font-bold ${feedback.color}`}>{feedback.message}</h2>
          <p className="text-gray-600 text-base sm:text-lg">
            لقد أجبت على <span className="font-bold text-gray-900">{safeScore}</span> من أصل <span className="font-bold text-gray-900">{safeTotalQuestions}</span> أسئلة بشكل صحيح.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          {insights.incorrectAnswers.length > 0 && (
            <button
              onClick={handleReviewMistakes}
              disabled={!canReviewMistakes}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
              title={canReviewMistakes ? 'راجع الأسئلة التي أخطأت فيها فقط' : 'هذه النتيجة قديمة ولا تحتوي على اختيارات الأسئلة'}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              راجع أخطائي
            </button>
          )}
          <Link
            to={`/play/${result.quizId}`}
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            حاول مرة أخرى
          </Link>
          <Link
            to="/library"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 shadow-md transition-all"
          >
            <Library className="w-5 h-5 mr-2" />
            العودة للمكتبة
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 font-bold mb-3">
            <TrendingUp className="w-5 h-5" />
            نقاط القوة
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            {insights.strengths.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 font-bold mb-3">
            <Target className="w-5 h-5" />
            نقاط الضعف
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            {insights.weaknesses.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-3">
            <Lightbulb className="w-5 h-5" />
            نصيحة المراجعة
          </div>
          <p className="text-sm text-gray-600 leading-6">{insights.advice}</p>
          <div className="mt-4 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">
            أكثر موضوع يحتاج مراجعة: {insights.weakTopic}
          </div>
        </div>
      </div>

      <SupportCTA message="If this quiz helped you study, you can support the project ❤️" />

      {/* Detailed Review */}
      {safeResult.feedbackMode !== 'per-question' && (
      <div className="space-y-6">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">مراجعة الإجابات</h3>
        <div className="space-y-4">
          {safeResult.answers.map((ans, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-2xl border ${ans.isCorrect ? 'border-green-100' : 'border-red-100'} shadow-sm overflow-hidden`}
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full p-4 sm:p-6 text-left flex items-start justify-between group"
              >
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className={`mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${ans.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {ans.isCorrect ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> : <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 leading-tight text-sm sm:text-base">{ans.question}</p>
                      {ans.difficulty && (
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${difficultyStyles[ans.difficulty]}`}>
                          {ans.difficulty}
                        </span>
                      )}
                      {ans.isMarked && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                          <Bookmark className="w-3 h-3 mr-1 fill-current" />
                          مُعلم للمراجعة
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs sm:text-sm gap-1 sm:gap-0">
                      <span className={ans.isCorrect ? 'text-green-600' : 'text-red-600'}>
                        إجابتك: <span className="font-bold">{ans.userAnswer || '(بدون إجابة)'}</span>
                      </span>
                      {!ans.isCorrect && (
                        <span className="text-green-600">
                          الإجابة الصحيحة: <span className="font-bold">{ans.correctAnswer}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {expandedIndex === index ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
              </button>

              <AnimatePresence>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6 pt-0"
                  >
                    <div className="bg-gray-50 rounded-xl p-4 flex items-start space-x-3">
                      <MessageSquare className="w-5 h-5 text-indigo-500 mt-1 flex-shrink-0" />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">توضيح</span>
                        {ans.topic_tag && <p className="text-xs font-bold text-gray-500">{ans.topic_tag}</p>}
                        <p className="text-gray-700 text-sm italic">{ans.feedback}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default QuizResult;
