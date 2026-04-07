import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, XCircle, Trophy, RotateCcw, Library, ChevronDown, ChevronUp, MessageSquare, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnswerResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  feedback: string;
  isMarked?: boolean;
}

interface Result {
  quizId: string;
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
      if (!resultId) return;
      try {
        const docRef = doc(db, 'results', resultId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setResult(docSnap.data() as Result);
        } else {
          navigate('/library');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `results/${resultId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [resultId, navigate]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!result) return null;

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  
  const getFeedback = () => {
    if (percentage >= 90) return { message: 'ممتاز 🔥', color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 70) return { message: 'جيد جدًا 👏', color: 'text-blue-600', bg: 'bg-blue-50' };
    return { message: 'حاول تاني 💪', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const feedback = getFeedback();

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
            لقد أجبت على <span className="font-bold text-gray-900">{result.score}</span> من أصل <span className="font-bold text-gray-900">{result.totalQuestions}</span> أسئلة بشكل صحيح.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
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

      {/* Detailed Review */}
      <div className="space-y-6">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">مراجعة الإجابات</h3>
        <div className="space-y-4">
          {result.answers.map((ans, index) => (
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
    </div>
  );
};

export default QuizResult;
