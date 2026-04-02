import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, Send, LogOut, Headphones, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FocusMusicPlayer from '../components/FocusMusicPlayer';

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

const QuizPlayer: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user, setIsQuizActive } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
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
      if (!quizId) return;
      try {
        const docRef = doc(db, 'quizzes', quizId);
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
        handleFirestoreError(error, OperationType.GET, `quizzes/${quizId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, navigate]);

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

  const handleFinish = async () => {
    if (!quiz || !user) return;
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (q.type === 'short-answer') {
        if (userAnswers[i].toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
          score++;
        }
      } else {
        if (userAnswers[i] === q.correctAnswer) {
          score++;
        }
      }
    });

    try {
      const resultData = {
        quizId: quiz.id,
        userId: user.uid,
        score,
        totalQuestions: quiz.questions.length,
        answers: userAnswers.map((ans, i) => ({
          question: quiz.questions[i].questionText,
          userAnswer: ans,
          correctAnswer: quiz.questions[i].correctAnswer,
          isCorrect: quiz.questions[i].type === 'short-answer' 
            ? ans.toLowerCase().trim() === quiz.questions[i].correctAnswer.toLowerCase().trim()
            : ans === quiz.questions[i].correctAnswer,
          feedback: quiz.questions[i].feedback
        })),
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

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!quiz) return null;

  const currentQuestion = quiz.questions[currentQuestionIndex];
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
      </div>

      {/* Question Navigation Bar */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQuestionIndex(i)}
            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
              currentQuestionIndex === i
                ? 'bg-indigo-600 text-white shadow-md scale-110'
                : userAnswers[i] !== ''
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {i + 1}
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
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-lg space-y-6 sm:space-y-8"
        >
          <div className="space-y-3 sm:space-y-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wider">
              {currentQuestion.type.replace('-', ' ')}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {currentQuestion.questionText}
            </h2>
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
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">الخروج من الكويز؟</h3>
                <p className="text-gray-600">هل تريد الخروج قبل إتمام الكويز؟ لن يتم حفظ تقدمك.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  البقاء
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                >
                  الخروج
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuizPlayer;
