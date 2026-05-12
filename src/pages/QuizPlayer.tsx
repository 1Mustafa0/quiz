import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, Send, LogOut, Headphones, Pause, Play, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FocusMusicPlayer from '../components/FocusMusicPlayer';
import ConfirmModal from '../components/ConfirmModal';

interface Question {
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  questionText: string;
  options: string[];
  correctAnswer: string;
  feedback: string;
}

interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  timer: number;
}

interface LocalResult {
  score: number;
  totalQuestions: number;
  answers: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    feedback: string;
    isMarked: boolean;
  }[];
}

interface QuizPlayerProps {
  publicMode?: boolean;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ publicMode = false }) => {
  const { quizId, shareId } = useParams<{ quizId?: string; shareId?: string }>();
  const { user, setIsQuizActive } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [publicResult, setPublicResult] = useState<LocalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      if (e.key === 'ArrowRight') {
        if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(prev => prev - 1);
        }
      } else if (e.key === ' ') {
        // Only toggle pause if not typing in an input
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          setIsTimerPaused(prev => !prev);
        }
      } else if (e.key.toLowerCase() === 'm') {
        if (document.activeElement?.tagName !== 'INPUT') {
          toggleMarkQuestion(currentQuestionIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIndex, quiz, isFinished]);

  useEffect(() => {
    setIsQuizActive(true);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      setIsQuizActive(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setIsQuizActive]);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (publicMode && !shareId) return;
      if (!publicMode && !quizId) return;
      try {
        if (publicMode) {
          const docRef = doc(db, 'sharedQuizzes', shareId!);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            throw new Error('Shared quiz not found');
          }
          const sharedQuiz = { id: docSnap.id, ...docSnap.data() } as Quiz;
          setQuiz(sharedQuiz);
          setUserAnswers(new Array(sharedQuiz.questions.length).fill(''));
          setTimeLeft((sharedQuiz.timer || 0) * 60);
          return;
        }

        const docRef = doc(db, 'quizzes', quizId!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Quiz;
          setQuiz({ id: docSnap.id, ...data });
          setUserAnswers(new Array(data.questions.length).fill(''));
          setTimeLeft(data.timer * 60);
        } else {
          navigate('/library');
        }
      } catch (error) {
        if (publicMode) {
          console.error('[public quiz]', error);
          navigate('/');
        } else {
          handleFirestoreError(error, OperationType.GET, `quizzes/${quizId}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, shareId, navigate, publicMode]);

  useEffect(() => {
    if (timeLeft > 0 && !isFinished && !isTimerPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, isFinished, isTimerPaused]);

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const toggleMarkQuestion = (index: number) => {
    setMarkedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const calculateResult = (): LocalResult | null => {
    if (!quiz) return null;
    let score = 0;
    const answers = quiz.questions.map((q, i) => {
      const userAnswer = userAnswers[i] || '';
      let isCorrect = false;
      if (q.type === 'short-answer') {
        isCorrect = userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
      } else {
        isCorrect = userAnswer === q.correctAnswer;
      }
      if (isCorrect) score++;
      return {
        question: q.questionText,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        feedback: q.feedback,
        isMarked: markedQuestions.has(i),
      };
    });

    return { score, totalQuestions: quiz.questions.length, answers };
  };

  const handleFinish = async () => {
    if (!quiz) return;
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const result = calculateResult();
    if (!result) return;

    if (publicMode) {
      setPublicResult(result);
      return;
    }

    if (!user) return;

    try {
      const resultData = {
        quizId: quiz.id,
        userId: user.uid,
        score: result.score,
        totalQuestions: result.totalQuestions,
        answers: result.answers,
        completedAt: Timestamp.now(),
      };

      const resultDoc = await addDoc(collection(db, 'results'), resultData);
      navigate(`/result/${resultDoc.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'results');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const restartPublicExam = () => {
    if (!quiz) return;
    setPublicResult(null);
    setIsFinished(false);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Array(quiz.questions.length).fill(''));
    setMarkedQuestions(new Set());
    setTimeLeft((quiz.timer || 0) * 60);
    setIsTimerPaused(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <h2 className="text-xl font-bold text-gray-900">عذراً، لم يتم العثور على أسئلة لهذا الكويز.</h2>
      <button onClick={() => navigate('/library')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl">العودة للمكتبة</button>
    </div>
  );

  if (publicResult) {
    const percent = Math.round((publicResult.score / publicResult.totalQuestions) * 100);
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg text-center space-y-4">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${percent >= 60 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">{quiz.title}</h1>
            <p className="text-gray-500 mt-2">نتيجة الامتحان</p>
          </div>
          <div className="text-5xl font-black text-indigo-600">{publicResult.score}/{publicResult.totalQuestions}</div>
          <p className="text-lg font-semibold text-gray-700">{percent}%</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <button onClick={restartPublicExam} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
              إعادة الامتحان
            </button>
            <button onClick={() => navigate('/')} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              العودة للرئيسية
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {publicResult.answers.map((answer, index) => (
            <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                {answer.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" /> : <XCircle className="w-5 h-5 text-red-500 mt-1" />}
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-gray-900">س{index + 1}. {answer.question}</h3>
                  <p className="text-sm text-gray-600">إجابتك: <span className="font-semibold">{answer.userAnswer || 'بدون إجابة'}</span></p>
                  {!answer.isCorrect && <p className="text-sm text-green-700">الإجابة الصحيحة: <span className="font-semibold">{answer.correctAnswer}</span></p>}
                  {answer.feedback && <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">{answer.feedback}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">تعذر عرض هذا السؤال</h2>
          <p className="mt-2 text-gray-600 dark:text-slate-400">يبدو أن بيانات الكويز غير مكتملة أو تغيرت أثناء الامتحان.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={restartPublicExam}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => navigate(publicMode ? '/' : '/library')}
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }
  
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative">
      {/* Focus Music Player */}
      <FocusMusicPlayer />

      {/* Header & Timer */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm sticky top-[4.5rem] sm:top-20 z-40">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-900 line-clamp-1 max-w-[120px] sm:max-w-none">{quiz.title}</h1>
            <p className="text-[10px] sm:text-sm text-gray-500">السؤال {currentQuestionIndex + 1} من {quiz.questions.length}</p>
          </div>
        </div>
        {quiz.timer > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className={`p-2 rounded-xl transition-all ${isTimerPaused ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
              title={isTimerPaused ? 'استئناف الوقت' : 'إيقاف مؤقت'}
            >
              {isTimerPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <div className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-mono font-bold text-sm sm:text-lg ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
              {formatTime(timeLeft)}
            </div>
          </div>
        )}
      </div>

      {/* Question Navigation Bar */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQuestionIndex(i)}
            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all relative ${
              currentQuestionIndex === i
                ? 'bg-indigo-600 text-white shadow-md scale-110'
                : (userAnswers[i] !== undefined && userAnswers[i] !== '')
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {i + 1}
            {markedQuestions.has(i) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-lg space-y-6 sm:space-y-8 relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-3 sm:space-y-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wider">
                {currentQuestion.type.replace('-', ' ')}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                {currentQuestion.questionText}
              </h2>
            </div>
            <button
              onClick={() => toggleMarkQuestion(currentQuestionIndex)}
              className={`p-2 rounded-xl transition-all ${
                markedQuestions.has(currentQuestionIndex)
                  ? 'bg-amber-100 text-amber-600 shadow-inner'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
              title="تعليم السؤال للمراجعة (M)"
            >
              <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 ${markedQuestions.has(currentQuestionIndex) ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {currentQuestion.type === 'multiple-choice' && (
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    className={`w-full p-4 sm:p-6 text-left rounded-2xl border-2 transition-all flex items-center justify-between group ${
                      userAnswers[currentQuestionIndex] === opt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-medium text-sm sm:text-base">{opt}</span>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      userAnswers[currentQuestionIndex] === opt
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-200 group-hover:border-indigo-300'
                    }`}>
                      {userAnswers[currentQuestionIndex] === opt && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'true-false' && (
              <div className="flex flex-col sm:flex-row gap-4">
                {['True', 'False'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className={`flex-1 p-8 text-center rounded-2xl border-2 transition-all font-bold text-xl ${
                      userAnswers[currentQuestionIndex] === opt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'short-answer' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={userAnswers[currentQuestionIndex]}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full p-4 sm:p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl text-base sm:text-lg font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-[10px] sm:text-xs text-gray-400 italic px-2 text-right">الأسئلة ذات الإجابة القصيرة لا تتأثر بحالة الأحرف (كبيرة/صغيرة).</p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-lg">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="flex items-center px-6 py-3 text-sm font-bold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronRight className="w-5 h-5 ml-2" />
          السابق
        </button>

        {currentQuestionIndex === quiz.questions.length - 1 ? (
          <button
            onClick={handleFinish}
            className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            إنهاء الكويز
            <Send className="w-5 h-5 mr-2" />
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
            className="flex items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95"
          >
            التالي
            <ChevronLeft className="w-5 h-5 mr-2" />
          </button>
        )}
      </div>

      {/* Exit Confirmation Modal */}
      <ConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => navigate(publicMode ? '/' : '/library')}
        title="الخروج من الكويز؟"
        message="هل تريد الخروج قبل إتمام الكويز؟ لن يتم حفظ تقدمك."
        confirmText="الخروج"
        cancelText="البقاء"
        type="danger"
      />
    </div>
  );
};

export default QuizPlayer;
