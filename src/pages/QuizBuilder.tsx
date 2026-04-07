import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateQuizFromContent, GeneratedQuestion } from '../services/geminiService';
import { Upload, FileText, Plus, Trash2, Save, Sparkles, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';

const QuestionEditor: React.FC<{
  question: GeneratedQuestion;
  index: number;
  onUpdate: (updated: Partial<GeneratedQuestion>) => void;
  onRemove: () => void;
}> = ({ question, index, onUpdate, onRemove }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 relative group"
    >
      <button
        onClick={onRemove}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-4 mb-4">
        <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
          {index + 1}
        </span>
        <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">
          Multiple Choice
        </span>
      </div>

      <textarea
        value={question.questionText}
        onChange={(e) => onUpdate({ questionText: e.target.value })}
        placeholder="Enter your question here..."
        className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-20"
      />

      {question.type === 'multiple-choice' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.options.map((opt, optIndex) => (
            <div key={optIndex} className="flex items-center space-x-2">
              <input
                type="radio"
                name={`correct-${index}`}
                checked={question.correctAnswer === opt && opt !== ''}
                onChange={() => onUpdate({ correctAnswer: opt })}
                className="w-4 h-4 text-indigo-600"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const newOpts = [...question.options];
                  newOpts[optIndex] = e.target.value;
                  onUpdate({ options: newOpts });
                }}
                placeholder={`Option ${optIndex + 1}`}
                className="flex-grow px-3 py-2 border border-gray-100 bg-gray-50 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div className="pt-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Feedback / Explanation</label>
        <input
          type="text"
          value={question.feedback}
          onChange={(e) => onUpdate({ feedback: e.target.value })}
          placeholder="Explain why this is the correct answer..."
          className="w-full px-4 py-2 border border-gray-100 bg-gray-50 rounded-lg text-sm italic"
        />
      </div>
    </motion.div>
  );
};

const QuizBuilder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timer, setTimer] = useState<number>(10);
  const [noTimer, setNoTimer] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(5);

  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | null>(null);
  const [manualText, setManualText] = useState('');
  const [useManualText, setUseManualText] = useState(false);

  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const handleCsvImport = () => {
    if (!csvText.trim()) return;
    
    try {
      // Handle both CRLF and LF line endings, and filter out empty lines
      const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        setError('يرجى إدخال نص يحتوي على العناوين وسؤال واحد على الأقل.');
        return;
      }

      const newQuestions: GeneratedQuestion[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        // Simple CSV split (doesn't handle commas inside quotes, but fits the user's AI prompt structure)
        const columns = lines[i].split(',').map(col => col.trim());
        if (columns.length >= 6) {
          const [questionText, opt1, opt2, opt3, opt4, correctIdxStr] = columns;
          const options = [opt1, opt2, opt3, opt4];
          const correctIdx = parseInt(correctIdxStr);
          
          if (!isNaN(correctIdx) && correctIdx >= 0 && correctIdx < 4) {
            newQuestions.push({
              type: 'multiple-choice',
              questionText,
              options,
              correctAnswer: options[correctIdx],
              feedback: '',
            });
          }
        }
      }

      if (newQuestions.length > 0) {
        setQuestions([...questions, ...newQuestions]);
        setSuccess(`تم استيراد ${newQuestions.length} أسئلة بنجاح!`);
        setShowCsvImport(false);
        setCsvText('');
      } else {
        setError('لم يتم العثور على أسئلة صالحة. تأكد من استخدام الفاصلة (,) للفصل بين الأعمدة.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء معالجة النص. يرجى التأكد من التنسيق الصحيح.');
    }
  };

  const autoSaveAndPlay = async (generated: any) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const quizData = {
        title: generated.title || 'AI Generated Quiz',
        description: generated.description || '',
        category: category || 'General',
        difficulty,
        timer,
        questions: generated.questions,
        authorUid: user.uid,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'quizzes'), quizData);
      setSuccess('صل على النبي بقا');
      setTimeout(() => {
        navigate(`/play/${docRef.id}`);
      }, 2000);
    } catch (err: any) {
      console.error('Auto-save failed:', err);
      setError('فشل حفظ الكويز تلقائياً. يرجى المحاولة يدوياً.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAll = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'مسح كل البيانات؟',
      message: 'هل أنت متأكد من مسح جميع الأسئلة والتفاصيل؟ لا يمكن التراجع عن هذا الإجراء.',
      type: 'danger',
      onConfirm: () => {
        setTitle('');
        setDescription('');
        setCategory('');
        setQuestions([]);
        setManualText('');
        setError(null);
        setSuccess(null);
      }
    });
  };

  const handleGenerateFromManualText = async () => {
    if (!manualText.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateQuizFromContent({
        content: manualText,
        numQuestions,
        language: 'detect',
        difficulty,
      });
      
      setTitle(generated.title);
      setDescription(generated.description);
      setQuestions(generated.questions);
      await autoSaveAndPlay(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (e.target) e.target.value = ''; // Reset file input
  };

  const processFile = async (file: File) => {
    setIsGenerating(true);
    setError(null);

    // Verify API health before proceeding
    try {
      const healthCheck = await fetch('/api/health').then(r => r.json()).catch(() => null);
      if (!healthCheck || healthCheck.status !== 'ok') {
        throw new Error('Backend server is not responding. Please wait a moment and try again.');
      }
    } catch (e) {
      setError('Backend server is not responding. Please wait a moment and try again.');
      setIsGenerating(false);
      return;
    }

    try {
      if (file.type.startsWith('image/')) {
        // Handle images directly with Gemini (multimodal)
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        const generated = await generateQuizFromContent({
          image: {
            data: base64Data,
            mimeType: file.type,
          },
          numQuestions,
          language: 'detect',
          difficulty,
        });

        setTitle(generated.title);
        setDescription(generated.description);
        setQuestions(generated.questions);
        await autoSaveAndPlay(generated);
      } else {
        // Handle documents via backend parsing
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          const responseText = await response.text().catch(() => '');
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.details || errorData.error || errorMessage;
          } catch (e) {
            if (responseText.includes('<!DOCTYPE html>')) {
              errorMessage = 'Server returned HTML instead of JSON. The API route might be missing or the server crashed.';
            } else if (responseText) {
              errorMessage = responseText.substring(0, 100);
            }
          }
          throw new Error(errorMessage);
        }
        
        const responseText = await response.text();
        let textData;
        try {
          textData = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse JSON response:', responseText);
          if (responseText.includes('<!DOCTYPE html>')) {
            throw new Error('Server returned HTML instead of JSON. The backend might not be running correctly.');
          }
          throw new Error('Failed to parse server response as JSON.');
        }
        const { text } = textData;
        console.log('Extracted text from server:', text?.substring(0, 100));

        if (text === '[object Object]' || !text || text.length < 10) {
          throw new Error('فشل استخراج النص من الملف. قد يكون الملف فارغاً أو عبارة عن صورة (في حالة الـ PDF). يرجى محاولة رفعه كصورة (JPG/PNG) إذا كان يحتوي على نص مصور.');
        }

        const generated = await generateQuizFromContent({
          content: text,
          numQuestions,
          language: 'detect',
          difficulty,
        });

        setTitle(generated.title);
        setDescription(generated.description);
        setQuestions(generated.questions);
        await autoSaveAndPlay(generated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        type: 'multiple-choice',
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        feedback: '',
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, updated: Partial<GeneratedQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updated };
    setQuestions(newQuestions);
  };

  const handleSaveQuiz = async () => {
    if (!user) return;
    if (!title) {
      setError('Please provide a title for your quiz');
      return;
    }
    if (questions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const quizData = {
        title,
        description,
        category,
        difficulty,
        timer,
        questions,
        authorUid: user.uid,
        createdAt: Timestamp.now(),
      };

      console.log('Saving quiz to Firestore:', quizData);
      let docRef;
      try {
        docRef = await addDoc(collection(db, 'quizzes'), quizData);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'quizzes');
      }
      
      if (docRef) {
        console.log('Quiz saved with ID:', docRef.id);
        setSuccess('Quiz saved successfully! Redirecting to your library...');
        setTimeout(() => navigate('/library'), 1500);
      }
    } catch (err: any) {
      console.error('Failed to save quiz:', err);
      setError(`Failed to save quiz: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (activeTab === null) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">How would you like to build your quiz?</h1>
          <p className="text-xl text-gray-600">Choose a method to get started.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.button
            whileHover={{ scale: 1.02, translateY: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('manual')}
            className="flex flex-col items-center p-10 bg-white rounded-3xl border-2 border-gray-100 shadow-xl hover:border-indigo-500 transition-all text-center group"
          >
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Plus className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Manual Builder</h2>
            <p className="text-gray-500 leading-relaxed">
              Create your quiz from scratch. Add questions, options, and explanations manually for full control.
            </p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, translateY: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('ai')}
            className="flex flex-col items-center p-10 bg-white rounded-3xl border-2 border-gray-100 shadow-xl hover:border-indigo-500 transition-all text-center group"
          >
            <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Sparkles className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">AI Generator</h2>
            <p className="text-gray-500 leading-relaxed">
              Upload documents (PDF, Word) or paste text. Our AI will analyze the content and generate questions for you.
            </p>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setActiveTab(null)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Go back to selection"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {activeTab === 'manual' ? 'Manual Builder' : 'AI Generator'}
            </h1>
            <p className="text-gray-600">
              {activeTab === 'manual' ? 'Create your quiz manually' : 'Generate questions using AI'}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleClearAll}
            disabled={isSaving || isGenerating}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </button>
          <button
            onClick={handleSaveQuiz}
            disabled={isSaving || isGenerating || questions.length === 0}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Save Quiz
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center text-red-600 mb-6"
          >
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {success && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center space-y-6 border border-gray-100"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">تم الاستيراد</h3>
                <p className="text-2xl text-indigo-600 font-bold">{success}</p>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                استمرار
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'manual' ? (
          <motion.div
            key="manual-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Configuration Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Biology Midterm Review"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this quiz about?"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Science"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Timer (Minutes)</label>
                      <label className="flex items-center text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noTimer}
                          onChange={(e) => {
                            setNoTimer(e.target.checked);
                            if (e.target.checked) setTimer(0);
                            else setTimer(10);
                          }}
                          className="mr-1 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        No Timer
                      </label>
                    </div>
                    <input
                      type="number"
                      value={timer}
                      disabled={noTimer}
                      onChange={(e) => setTimer(parseInt(e.target.value) || 0)}
                      className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${noTimer ? 'bg-gray-50 text-gray-400' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <div className="flex space-x-2">
                    {(['easy', 'medium', 'hard'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                          difficulty === d
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Questions ({questions.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCsvImport(true)}
                    className="inline-flex items-center px-4 py-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Import CSV
                  </button>
                  <button
                    onClick={handleAddQuestion}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </button>
                </div>
              </div>

              {/* CSV Import Modal */}
              <AnimatePresence>
                {showCsvImport && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-2xl w-full space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">استيراد أسئلة من نص CSV</h3>
                            <p className="text-sm text-gray-500">انسخ النص المولد من الذكاء الاصطناعي والصقه هنا</p>
                          </div>
                        </div>
                        <button onClick={() => setShowCsvImport(false)} className="text-gray-400 hover:text-gray-600">
                          <Plus className="w-6 h-6 rotate-45" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-blue-700 space-y-1">
                          <p className="font-bold">التنسيق المطلوب:</p>
                          <p>Question, Option1, Option2, Option3, Option4, Correct</p>
                          <p>بحيث يكون Correct رقم من 0 إلى 3</p>
                        </div>
                        
                        <textarea
                          value={csvText}
                          onChange={(e) => setCsvText(e.target.value)}
                          placeholder="Question, Option1, Option2, Option3, Option4, Correct..."
                          className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                        />
                      </div>

                      <div className="flex gap-4">
                        <button
                          onClick={() => setShowCsvImport(false)}
                          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={handleCsvImport}
                          disabled={!csvText.trim()}
                          className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
                        >
                          استيراد الآن
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="space-y-6">
                {questions.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Start adding questions manually to build your quiz.</p>
                  </div>
                )}
                {questions.map((q, index) => (
                  <QuestionEditor
                    key={index}
                    question={q}
                    index={index}
                    onUpdate={(updated) => handleUpdateQuestion(index, updated)}
                    onRemove={() => handleRemoveQuestion(index)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ai-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {/* Configuration Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Biology Midterm Review"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this quiz about?"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Science"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Timer (Minutes)</label>
                      <label className="flex items-center text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noTimer}
                          onChange={(e) => {
                            setNoTimer(e.target.checked);
                            if (e.target.checked) setTimer(0);
                            else setTimer(10);
                          }}
                          className="mr-1 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        No Timer
                      </label>
                    </div>
                    <input
                      type="number"
                      value={timer}
                      disabled={noTimer}
                      onChange={(e) => setTimer(parseInt(e.target.value) || 0)}
                      className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${noTimer ? 'bg-gray-50 text-gray-400' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <div className="flex space-x-2">
                    {(['easy', 'medium', 'hard'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                          difficulty === d
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Generator Section */}
            <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-xl font-bold text-gray-900">AI Quiz Generator</h2>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => setUseManualText(false)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!useManualText ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    File Upload
                  </button>
                  <button
                    onClick={() => setUseManualText(true)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${useManualText ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Manual Text
                  </button>
                </div>
              </div>
              
              {!useManualText ? (
                <div 
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer group ${
                    isDragging 
                      ? 'border-indigo-600 bg-indigo-50 scale-[1.02] shadow-inner' 
                      : 'border-indigo-200 bg-white hover:bg-indigo-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.docx,.pptx,.csv,.jpg,.jpeg,.png,.webp,.txt,.js,.ts,.py,.java,.cpp,.c,.html,.css"
                  />
                  {isGenerating ? (
                    <div className="flex flex-col items-center space-y-4">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="text-indigo-600 font-medium">Analyzing content and generating questions...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500">PDF, Word, Images, or CSV (Max 50MB)</p>
                      </div>
                      <div className="flex items-center space-x-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-sm text-gray-600">Questions:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={numQuestions}
                          onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Paste your text here to generate a quiz..."
                    className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-64 resize-none bg-white"
                  />
                  <div className="flex justify-end items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Questions:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={handleGenerateFromManualText}
                      disabled={isGenerating || !manualText.trim()}
                      className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      Generate Quiz
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Questions List (Review) */}
            {questions.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Questions ({questions.length})</h2>
                  <button
                    onClick={handleAddQuestion}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </button>
                </div>
                <div className="space-y-6">
                  {questions.map((q, index) => (
                    <QuestionEditor
                      key={index}
                      question={q}
                      index={index}
                      onUpdate={(updated) => handleUpdateQuestion(index, updated)}
                      onRemove={() => handleRemoveQuestion(index)}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
};

export default QuizBuilder;
