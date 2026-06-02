import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, Send, LogOut, Headphones, Pause, Play, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FocusMusicPlayer from '../components/FocusMusicPlayer';
import ConfirmModal from '../components/ConfirmModal';
import { useLanguage } from '../contexts/LanguageContext';

interface Question {
  type?: 'multiple-choice' | 'true-false' | 'short-answer';
  id?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic_tag?: string;
  question?: string;
  optionsMap?: Record<'A' | 'B' | 'C' | 'D', string>;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  questionText?: string;
  options?: string[] | Record<string, string>;
  correctAnswer?: string;
  feedback?: string;
}

interface Quiz {
  id: string;
  title: string;
  category?: string;
  feedbackMode?: 'end' | 'per-question';
  questions: Question[];
  timer: number;
}

interface LocalResult {
  score: number;
  totalQuestions: number;
  feedbackMode?: Quiz['feedbackMode'];
  answers: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    options?: string[];
    type?: Question['type'];
    isCorrect: boolean;
    feedback: string;
    difficulty?: Question['difficulty'];
    topic_tag?: string;
    isMarked: boolean;
  }[];
}

interface SavedQuizProgress {
  currentQuestionIndex: number;
  userAnswers: string[];
  markedQuestions: number[];
  timeLeft: number;
  questionCount: number;
  updatedAt: number;
}

interface SavedQuizMistakes {
  questionKeys: string[];
  questionCount: number;
  updatedAt: number;
}

const optionLetters = ['A', 'B', 'C', 'D'] as const;
const QUIZ_PROGRESS_PREFIX = 'ai-quiz-master-progress';
const QUIZ_PROGRESS_EVENT = 'ai-quiz-master-progress-updated';
const QUIZ_MISTAKES_PREFIX = 'ai-quiz-master-last-mistakes';

const normalizeQuestionOptions = (question: Question) => {
  const source = question?.optionsMap || question?.options;
  if (Array.isArray(source)) return source.filter(Boolean);
  if (source && typeof source === 'object') {
    return optionLetters.map(letter => String((source as Record<string, string>)[letter] || '')).filter(Boolean);
  }
  return [];
};

const getQuestionType = (question: Question): NonNullable<Question['type']> =>
  question?.type || 'multiple-choice';

const getQuestionText = (question: Question) =>
  String(question?.question || question?.questionText || 'Question text is unavailable.').trim();

const getQuestionExplanation = (question: Question) =>
  String(question?.explanation || question?.feedback || '').trim();

const getQuestionCorrectAnswer = (question: Question) => {
  const options = normalizeQuestionOptions(question);
  const correctOption = question?.correct_option;
  if (correctOption) {
    const index = optionLetters.indexOf(correctOption);
    if (index >= 0 && options[index]) return options[index];
  }
  return String(question?.correctAnswer || '').trim();
};

const getQuestionMistakeKey = (question: Question) => {
  const questionText = getQuestionText(question).toLowerCase();
  const correctAnswer = getQuestionCorrectAnswer(question).toLowerCase();
  return `${questionText}::${correctAnswer}`;
};

const getDifficultyBadge = (difficulty?: Question['difficulty']) => {
  if (!difficulty) return null;
  const value = difficulty;
  const styles = {
    easy: 'bg-green-50 text-green-700 border-green-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    hard: 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = {
    easy: 'Easy - Recall',
    medium: 'Medium - Analysis',
    hard: 'Hard - Application',
  };
  return { value, className: styles[value], label: labels[value] };
};

const removeUndefinedFields = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefinedFields(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefinedFields(entryValue)])
    ) as T;
  }

  return value;
};

const getProgressKey = (params: {
  userId?: string;
  quizId?: string;
  shareId?: string;
  resultId?: string;
  publicMode: boolean;
  reviewMode: boolean;
}) => {
  if (params.reviewMode) return '';
  const owner = params.userId || 'guest';
  const id = params.publicMode ? params.shareId : params.quizId;
  return id ? `${QUIZ_PROGRESS_PREFIX}:${owner}:${params.publicMode ? 'public' : 'quiz'}:${id}` : '';
};

const getMistakesKey = (params: {
  userId?: string;
  quizId?: string;
  shareId?: string;
  publicMode: boolean;
  reviewMode: boolean;
}) => {
  if (params.reviewMode) return '';
  const owner = params.userId || 'guest';
  const id = params.publicMode ? params.shareId : params.quizId;
  return id ? `${QUIZ_MISTAKES_PREFIX}:${owner}:${params.publicMode ? 'public' : 'quiz'}:${id}` : '';
};

const loadSavedProgress = (key: string, questionCount: number): SavedQuizProgress | null => {
  if (!key || typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as SavedQuizProgress | null;
    if (!parsed || parsed.questionCount !== questionCount || !Array.isArray(parsed.userAnswers)) return null;
    return {
      currentQuestionIndex: Math.min(Math.max(0, Number(parsed.currentQuestionIndex) || 0), Math.max(0, questionCount - 1)),
      userAnswers: Array.from({ length: questionCount }, (_, index) => String(parsed.userAnswers[index] || '')),
      markedQuestions: Array.isArray(parsed.markedQuestions)
        ? parsed.markedQuestions.filter(index => Number.isInteger(index) && index >= 0 && index < questionCount)
        : [],
      timeLeft: Math.max(0, Number(parsed.timeLeft) || 0),
      questionCount,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const loadSavedMistakes = (key: string, questionCount: number): Set<string> => {
  if (!key || typeof window === 'undefined') return new Set();

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as SavedQuizMistakes | null;
    if (!parsed || parsed.questionCount !== questionCount || !Array.isArray(parsed.questionKeys)) return new Set();
    return new Set(parsed.questionKeys.filter(Boolean).map(String));
  } catch {
    localStorage.removeItem(key);
    return new Set();
  }
};

const saveLastMistakes = (key: string, questionCount: number, questionKeys: string[]) => {
  if (!key || typeof window === 'undefined') return;

  try {
    const mistakes: SavedQuizMistakes = {
      questionKeys,
      questionCount,
      updatedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(mistakes));
  } catch (error) {
    console.warn('[quiz mistakes] could not save last mistakes:', error);
  }
};

const clearSavedProgress = (key: string) => {
  if (!key || typeof window === 'undefined') return;
  localStorage.removeItem(key);
  window.dispatchEvent(new Event(QUIZ_PROGRESS_EVENT));
};

interface QuizPlayerProps {
  publicMode?: boolean;
  reviewMode?: boolean;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ publicMode = false, reviewMode = false }) => {
  const { quizId, shareId, resultId } = useParams<{ quizId?: string; shareId?: string; resultId?: string }>();
  const { user, setIsQuizActive } = useAuth();
  const { direction, t } = useLanguage();
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
  const [visibleExplanations, setVisibleExplanations] = useState<Set<number>>(new Set());
  const [revealedFeedback, setRevealedFeedback] = useState<Set<number>>(new Set());
  const [previousMistakeKeys, setPreviousMistakeKeys] = useState<Set<string>>(new Set());
  const [progressReady, setProgressReady] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressKey = getProgressKey({ userId: user?.uid, quizId, shareId, resultId, publicMode, reviewMode });
  const mistakesKey = getMistakesKey({ userId: user?.uid, quizId, shareId, publicMode, reviewMode });

  const applyInitialProgress = (questions: Question[], defaultTimeLeft: number) => {
    const savedProgress = loadSavedProgress(progressKey, questions.length);
    setPreviousMistakeKeys(loadSavedMistakes(mistakesKey, questions.length));
    setUserAnswers(savedProgress?.userAnswers || new Array(questions.length).fill(''));
    setCurrentQuestionIndex(savedProgress?.currentQuestionIndex || 0);
    setMarkedQuestions(new Set(savedProgress?.markedQuestions || []));
    setTimeLeft(savedProgress && savedProgress.timeLeft > 0 ? savedProgress.timeLeft : defaultTimeLeft);
    setProgressReady(true);
  };

  const saveProgressNow = () => {
    if (!progressKey || !quiz || isFinished || reviewMode) return;
    try {
      const progress: SavedQuizProgress = {
        currentQuestionIndex,
        userAnswers: Array.from({ length: quiz.questions.length }, (_, index) => userAnswers[index] || ''),
        markedQuestions: Array.from(markedQuestions),
        timeLeft,
        questionCount: quiz.questions.length,
        updatedAt: Date.now(),
      };
      localStorage.setItem(progressKey, JSON.stringify(progress));
      window.dispatchEvent(new Event(QUIZ_PROGRESS_EVENT));
    } catch (error) {
      console.warn('[quiz progress] could not save progress:', error);
    }
  };

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
      saveProgressNow();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      setIsQuizActive(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setIsQuizActive, saveProgressNow]);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (publicMode && !shareId) return;
      if (reviewMode && !resultId) return;
      if (!publicMode && !reviewMode && !quizId) return;
      setProgressReady(false);
      try {
        if (reviewMode) {
          const resultRef = doc(db, 'results', resultId!);
          const resultSnap = await getDoc(resultRef);
          if (!resultSnap.exists()) {
            throw new Error('Result not found');
          }

          const resultData = resultSnap.data() as any;
          const wrongQuestions = (resultData.answers || [])
            .filter((answer: any) => !answer.isCorrect && Array.isArray(answer.options) && answer.options.length > 0)
            .map((answer: any) => ({
              type: answer.type || 'multiple-choice',
              questionText: answer.question,
              options: answer.options,
              correctAnswer: answer.correctAnswer,
              feedback: answer.feedback || '',
              difficulty: answer.difficulty,
              topic_tag: answer.topic_tag,
            }));

          if (!wrongQuestions.length) {
            navigate(`/result/${resultId}`);
            return;
          }

          const reviewQuiz: Quiz = {
            id: resultData.quizId || resultId!,
            title: t('quiz.reviewTitle', { title: resultData.quizTitle || 'Quiz' }),
            category: resultData.category || 'Review',
            feedbackMode: 'per-question',
            timer: 0,
            questions: wrongQuestions,
          };

          setQuiz(reviewQuiz);
          setUserAnswers(new Array(wrongQuestions.length).fill(''));
          setPreviousMistakeKeys(new Set());
          setTimeLeft(0);
          setProgressReady(true);
          return;
        }

        if (publicMode) {
          const docRef = doc(db, 'sharedQuizzes', shareId!);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            throw new Error('Shared quiz not found');
          }
          const sharedQuiz = { id: docSnap.id, ...docSnap.data() } as Quiz;
          const safeQuestions = Array.isArray(sharedQuiz.questions) ? sharedQuiz.questions : [];
          setQuiz({ ...sharedQuiz, questions: safeQuestions });
          applyInitialProgress(safeQuestions, (sharedQuiz.timer || 0) * 60);
          return;
        }

        const docRef = doc(db, 'quizzes', quizId!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Quiz;
          const safeQuestions = Array.isArray(data.questions) ? data.questions : [];
          setQuiz({ id: docSnap.id, ...data, questions: safeQuestions });
          applyInitialProgress(safeQuestions, (data.timer || 0) * 60);
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
  }, [quizId, shareId, resultId, navigate, publicMode, reviewMode]);

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

  useEffect(() => {
    if (!progressReady || !quiz || isFinished || reviewMode) return;
    saveProgressNow();
  }, [progressReady, quiz, currentQuestionIndex, userAnswers, markedQuestions, timeLeft, isFinished, reviewMode]);

  const handleAnswer = (answer: string) => {
    if (quiz?.feedbackMode === 'per-question' && revealedFeedback.has(currentQuestionIndex)) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
    if (quiz?.feedbackMode === 'per-question' && getQuestionType(quiz.questions[currentQuestionIndex]) !== 'short-answer') {
      setRevealedFeedback(prev => new Set(prev).add(currentQuestionIndex));
    }
  };

  const revealCurrentFeedback = () => {
    if (!userAnswers[currentQuestionIndex]?.trim()) return;
    setRevealedFeedback(prev => new Set(prev).add(currentQuestionIndex));
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
      const correctAnswer = getQuestionCorrectAnswer(q);
      if (getQuestionType(q) === 'short-answer') {
        isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      } else {
        isCorrect = Boolean(correctAnswer) && userAnswer === correctAnswer;
      }
      if (isCorrect) score++;
      return {
        question: getQuestionText(q),
        userAnswer,
        correctAnswer,
        options: normalizeQuestionOptions(q),
        type: getQuestionType(q),
        isCorrect,
        feedback: getQuestionExplanation(q),
        difficulty: q.difficulty,
        topic_tag: q.topic_tag,
        isMarked: markedQuestions.has(i),
      };
    });

    return { score, totalQuestions: quiz.questions.length, feedbackMode: quiz.feedbackMode || 'end', answers };
  };

  const saveMistakesFromResult = (result: LocalResult) => {
    if (!quiz || reviewMode) return;
    const wrongQuestionKeys = result.answers
      .map((answer, index) => (!answer.isCorrect ? getQuestionMistakeKey(quiz.questions[index]) : ''))
      .filter(Boolean);
    saveLastMistakes(mistakesKey, quiz.questions.length, wrongQuestionKeys);
    setPreviousMistakeKeys(new Set(wrongQuestionKeys));
  };

  const handleFinish = async () => {
    if (!quiz) return;
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const result = calculateResult();
    if (!result) return;
    saveMistakesFromResult(result);

    if (publicMode) {
      clearSavedProgress(progressKey);
      setPublicResult(result);
      return;
    }

    if (!user) return;

    try {
      const resultData = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        category: quiz.category || 'General',
        userId: user.uid,
        score: result.score,
        totalQuestions: result.totalQuestions,
        feedbackMode: result.feedbackMode,
        answers: result.answers,
        completedAt: Timestamp.now(),
      };

      const resultDoc = await addDoc(collection(db, 'results'), removeUndefinedFields(resultData));
      clearSavedProgress(progressKey);
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
    clearSavedProgress(progressKey);
    setPublicResult(null);
    setIsFinished(false);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Array(quiz.questions.length).fill(''));
    setMarkedQuestions(new Set());
    setRevealedFeedback(new Set());
    setTimeLeft((quiz.timer || 0) * 60);
    setIsTimerPaused(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4" dir={direction}>
      <AlertCircle className="w-12 h-12 text-red-500" />
      <h2 className="text-xl font-bold text-gray-900">{t('quiz.noQuestions')}</h2>
      <button onClick={() => navigate('/library')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl">{t('quiz.backToLibrary')}</button>
    </div>
  );

  if (publicResult) {
    const percent = Math.round((publicResult.score / publicResult.totalQuestions) * 100);
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20" dir={direction}>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg text-center space-y-4">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${percent >= 60 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">{quiz.title}</h1>
            <p className="text-gray-500 mt-2">{t('quiz.result')}</p>
          </div>
          <div className="text-5xl font-black text-indigo-600">{publicResult.score}/{publicResult.totalQuestions}</div>
          <p className="text-lg font-semibold text-gray-700">{percent}%</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <button onClick={restartPublicExam} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
              {t('quiz.restartExam')}
            </button>
            <button onClick={() => navigate('/')} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              {t('quiz.backHome')}
            </button>
          </div>
        </div>

        {publicResult.feedbackMode !== 'per-question' && (
        <div className="space-y-4">
          {publicResult.answers.map((answer, index) => (
            <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                {answer.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" /> : <XCircle className="w-5 h-5 text-red-500 mt-1" />}
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-gray-900">{index + 1}. {answer.question}</h3>
                  <p className="text-sm text-gray-600">{t('quiz.yourAnswer')} <span className="font-semibold">{answer.userAnswer || t('quiz.noAnswer')}</span></p>
                  {!answer.isCorrect && <p className="text-sm text-green-700">{t('quiz.correctAnswer')} <span className="font-semibold">{answer.correctAnswer}</span></p>}
                  {answer.feedback && <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">{answer.feedback}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center" dir={direction}>
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.unavailableTitle')}</h2>
          <p className="mt-2 text-gray-600 dark:text-slate-400">{t('quiz.unavailableMessage')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={restartPublicExam}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            {t('quiz.retry')}
          </button>
          <button
            onClick={() => navigate(publicMode ? '/' : '/library')}
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }
  
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  const currentOptions = normalizeQuestionOptions(currentQuestion);
  const currentExplanation = getQuestionExplanation(currentQuestion);
  const currentTopic = String(currentQuestion?.topic_tag || '').trim();
  const currentDifficultyBadge = getDifficultyBadge(currentQuestion?.difficulty);
  const currentType = getQuestionType(currentQuestion);
  const hasAnsweredCurrent = Boolean(userAnswers[currentQuestionIndex]);
  const usesPerQuestionFeedback = quiz.feedbackMode === 'per-question';
  const showImmediateFeedback = usesPerQuestionFeedback && revealedFeedback.has(currentQuestionIndex) && hasAnsweredCurrent;
  const currentCorrectAnswer = getQuestionCorrectAnswer(currentQuestion);
  const currentUserAnswer = userAnswers[currentQuestionIndex] || '';
  const currentIsCorrect = currentType === 'short-answer'
    ? currentUserAnswer.toLowerCase().trim() === currentCorrectAnswer.toLowerCase().trim()
    : Boolean(currentCorrectAnswer) && currentUserAnswer === currentCorrectAnswer;
  const showCurrentExplanation = visibleExplanations.has(currentQuestionIndex);
  const currentWasPreviouslyWrong = previousMistakeKeys.has(getQuestionMistakeKey(currentQuestion));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative" dir={direction}>
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
            <p className="text-[10px] sm:text-sm text-gray-500">{t('quiz.questionCount', { current: currentQuestionIndex + 1, total: quiz.questions.length })}</p>
          </div>
        </div>
        {quiz.timer > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className={`p-2 rounded-xl transition-all ${isTimerPaused ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
              title={isTimerPaused ? t('quiz.resumeTime') : t('quiz.pause')}
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
        {quiz.questions.map((question, i) => (
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
            {previousMistakeKeys.has(getQuestionMistakeKey(question)) && (
              <div
                className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full border-2 border-white bg-red-500 shadow-sm"
                title="Ø£Ø®Ø·Ø£Øª ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ø³Ø¤Ø§Ù„ ÙÙŠ Ø¢Ø®Ø± Ù…Ø­Ø§ÙˆÙ„Ø©"
              />
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
            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wider">
                  {currentType.replace('-', ' ')}
                </span>
                {currentWasPreviouslyWrong && (
                  <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-bold text-red-600 sm:text-xs">
                    Ø£Ø®Ø·Ø£Øª ÙÙŠÙ‡ Ø³Ø§Ø¨Ù‚Ø§Ù‹
                  </span>
                )}
                {currentDifficultyBadge && (
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${currentDifficultyBadge.className}`}>
                    {currentDifficultyBadge.label}
                  </span>
                )}
              </div>
              <h2 className="break-words text-start text-xl sm:text-2xl font-bold text-gray-900 leading-tight" dir="auto">
                {getQuestionText(currentQuestion)}
              </h2>
            </div>
            <button
              onClick={() => toggleMarkQuestion(currentQuestionIndex)}
              className={`p-2 rounded-xl transition-all ${
                markedQuestions.has(currentQuestionIndex)
                  ? 'bg-amber-100 text-amber-600 shadow-inner'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
              title={t('quiz.markReview')}
            >
              <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 ${markedQuestions.has(currentQuestionIndex) ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {currentType === 'multiple-choice' && (
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {currentOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    disabled={showImmediateFeedback}
                    className={`w-full p-4 sm:p-6 text-start rounded-2xl border-2 transition-all flex items-center justify-between gap-3 group ${
                      showImmediateFeedback && opt === currentCorrectAnswer
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                        : showImmediateFeedback && userAnswers[currentQuestionIndex] === opt && opt !== currentCorrectAnswer
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-md'
                        : userAnswers[currentQuestionIndex] === opt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3 font-medium text-sm sm:text-base">
                      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-black text-gray-500">
                        {optionLetters[i] || i + 1}
                      </span>
                      <span className="min-w-0 break-words" dir="auto">{opt}</span>
                    </span>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
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

            {currentType === 'true-false' && (
              <div className="flex flex-col sm:flex-row gap-4">
                {['True', 'False'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={showImmediateFeedback}
                    className={`flex-1 p-8 text-center rounded-2xl border-2 transition-all font-bold text-xl ${
                      showImmediateFeedback && opt === currentCorrectAnswer
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                        : showImmediateFeedback && userAnswers[currentQuestionIndex] === opt && opt !== currentCorrectAnswer
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-md'
                        : userAnswers[currentQuestionIndex] === opt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {currentType === 'short-answer' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={userAnswers[currentQuestionIndex]}
                  onChange={(e) => handleAnswer(e.target.value)}
                  disabled={showImmediateFeedback}
                  placeholder="Type your answer here..."
                  className="w-full p-4 sm:p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl text-base sm:text-lg font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                {usesPerQuestionFeedback && !showImmediateFeedback && (
                  <button
                    type="button"
                    onClick={revealCurrentFeedback}
                    disabled={!userAnswers[currentQuestionIndex]?.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('quiz.submitAnswer')}
                  </button>
                )}
                <p className="text-[10px] sm:text-xs text-gray-400 italic px-2 text-start">{t('quiz.shortAnswerHint')}</p>
              </div>
            )}
          </div>

          {showImmediateFeedback && (
            <div className={`rounded-2xl border p-4 text-sm font-bold ${
              currentIsCorrect
                ? 'border-green-100 bg-green-50 text-green-700'
                : 'border-red-100 bg-red-50 text-red-700'
            }`}>
              {currentIsCorrect ? t('quiz.correct') : t('quiz.wrong', { answer: currentCorrectAnswer || t('quiz.notSpecified') })}
            </div>
          )}

          {usesPerQuestionFeedback && showImmediateFeedback && currentExplanation && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              {currentTopic && (
                <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                  {currentTopic}
                </div>
              )}
              <p className="break-words" dir="auto">{currentExplanation}</p>
            </div>
          )}

          {!usesPerQuestionFeedback && hasAnsweredCurrent && currentExplanation && (
            <div className="space-y-3 border-t border-gray-100 pt-5">
              <button
                onClick={() => setVisibleExplanations(prev => {
                  const next = new Set(prev);
                  if (next.has(currentQuestionIndex)) next.delete(currentQuestionIndex);
                  else next.add(currentQuestionIndex);
                  return next;
                })}
                className="inline-flex items-center rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {t('quiz.explain')}
              </button>
              <AnimatePresence>
                {showCurrentExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"
                  >
                    {currentTopic && (
                      <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                        {currentTopic}
                      </div>
                    )}
                    <p className="break-words" dir="auto">{currentExplanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-lg">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="flex items-center px-6 py-3 text-sm font-bold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronRight className="w-5 h-5 me-2" />
          {t('quiz.previous')}
        </button>

        {currentQuestionIndex === quiz.questions.length - 1 ? (
          <button
            onClick={handleFinish}
            className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            {t('quiz.finish')}
            <Send className="w-5 h-5 ms-2" />
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
            className="flex items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95"
          >
            {t('quiz.next')}
            <ChevronLeft className="w-5 h-5 ms-2" />
          </button>
        )}
      </div>

      {/* Exit Confirmation Modal */}
      <ConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => {
          saveProgressNow();
          navigate(publicMode ? '/' : '/library');
        }}
        title={t('quiz.exitTitle')}
        message={t('quiz.exitMessage')}
        confirmText={t('quiz.exit')}
        cancelText={t('quiz.stay')}
        type="danger"
      />
    </div>
  );
};

export default QuizPlayer;
