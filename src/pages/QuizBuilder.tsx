import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { GeneratedQuestion } from '../services/geminiService';
import { Upload, FileText, Plus, Trash2, Save, Sparkles, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Pencil, MessageSquarePlus, ChevronDown, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';
import CategorySelect from '../components/CategorySelect';
import ExtractedTextPreview from '../components/ExtractedTextPreview';
import { ownerOnlyError } from '../utils/owner';
import { exportQuizToPdf } from '../utils/quizPdf';
import { normalizeCategory } from '../utils/categories';
import { formatExtractedTextPreview } from '../utils/extractedText';

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // Server upload limit
const ACCEPTED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff',
  '.txt', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.md', '.json',
].join(',');

interface ExtractionMeta {
  fileName: string;
  method: string;
  usedOcr: boolean;
  length: number;
  returnedLength: number;
}

const EXTRACTION_LABELS: Record<string, string> = {
  'pdf-parser': 'PDF text parser',
  'gemini-ocr-pdf': 'Gemini OCR for scanned PDF',
  'gemini-ocr-pdf-images': 'Gemini OCR for rendered PDF pages',
  'gemini-ocr-image': 'Gemini OCR for image',
  'gemini-ocr-office-images': 'Gemini OCR for embedded Office images',
  'local-paddleocr-image': 'PaddleOCR for image',
  'local-paddleocr-pdf-images': 'PaddleOCR for rendered PDF pages',
  'local-paddleocr-office-images': 'PaddleOCR for embedded Office images',
  'local-tesseractjs-image': 'Tesseract.js OCR for image',
  'local-tesseractjs-pdf-images': 'Tesseract.js OCR for rendered PDF pages',
  'local-tesseractjs-office-images': 'Tesseract.js OCR for embedded Office images',
  'mixed-ocr-pdf-images': 'Mixed OCR engines for rendered PDF pages',
  'mixed-ocr-office-images': 'Mixed OCR engines for embedded Office images',
  'local-ocr-failed': 'Local OCR could not read enough text',
  'gemini-vision-direct': 'Gemini image understanding',
  'mammoth-docx': 'Word document parser',
  'office-parser': 'Office document parser',
  'csv-parser': 'CSV parser',
  'plain-text': 'Plain text',
  'utf8-fallback': 'Text fallback',
};

const QUIZ_GENERATION_ERROR =
  'تعذر إنشاء الكويز حالياً. جرّب ملفاً أوضح أو نصاً أقصر، ثم حاول مرة أخرى.';
const FILE_EXTRACTION_ERROR =
  'تعذر استخراج نص كاف من الملف. جرّب ملفاً نصياً أو صورة أوضح، ثم حاول مرة أخرى.';
const SAVE_QUIZ_ERROR =
  'تعذر حفظ الكويز حالياً. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.';
const SERVER_UNAVAILABLE_ERROR =
  'الخادم غير متاح حالياً. انتظر لحظة ثم حاول مرة أخرى.';

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const getExtractionLabel = (method: string) => EXTRACTION_LABELS[method] || method || 'Unknown extraction';

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
  const { quizId } = useParams<{ quizId?: string }>();
  const isEditing = !!quizId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timer, setTimer] = useState<number>(10);
  const [noTimer, setNoTimer] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(isEditing);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [autoQuestions, setAutoQuestions] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [extractedMeta, setExtractedMeta] = useState<ExtractionMeta | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);

  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | null>(isEditing ? 'manual' : null);

  // Load existing quiz when editing
  useEffect(() => {
    if (!quizId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'quizzes', quizId));
        if (!snap.exists()) { navigate('/library'); return; }
        const data = snap.data();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory(data.category ? normalizeCategory(data.category) : '');
        setDifficulty(data.difficulty || 'medium');
        setTimer(data.timer ?? 10);
        setNoTimer(data.timer === 0);
        setQuestions(data.questions || []);
      } catch (e) {
        setError('فشل تحميل بيانات الكويز.');
      } finally {
        setLoadingQuiz(false);
      }
    };
    load();
  }, [quizId]);

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
    if (!user) {
      setError('يجب تسجيل الدخول أولاً لحفظ الكويز.');
      return;
    }

    setIsSaving(true);
    try {
      const generatedCategory = normalizeCategory(category);
      const quizData = {
        title: generated.title || 'AI Generated Quiz',
        description: (generated.description || '').substring(0, 900),
        category: generatedCategory,
        difficulty,
        timer,
        questions: generated.questions,
        authorUid: user.uid,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'quizzes'), quizData);
      setSuccess('تم إنشاء الكويز بنجاح! جاري الانتقال للعب...');
      setTimeout(() => {
        navigate(`/play/${docRef.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Auto-save failed:', err);
      const isPermission = err?.message?.includes('permission') || err?.code === 'permission-denied';
      if (isPermission) {
        setError(ownerOnlyError(user, 'لا تملك صلاحية الحفظ حالياً. يمكنك مشاهدة الأسئلة أدناه والحفظ اليدوي لاحقاً.', err));
      } else {
        setError(ownerOnlyError(user, `${SAVE_QUIZ_ERROR} يمكنك الضغط على "Save Quiz" للحفظ اليدوي.`, err));
      }
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
        setExtractedText('');
        setExtractedMeta(null);
        setShowExtractedText(false);
        setError(null);
        setSuccess(null);
      }
    });
  };

  const handleGenerateFromManualText = async () => {
    const cleanManualText = manualText.trim();
    if (!cleanManualText) return;
    setIsGenerating(true);
    setError(null);
    setExtractedText(cleanManualText);
    setExtractedMeta({
      fileName: 'Manual text',
      method: 'plain-text',
      usedOcr: false,
      length: cleanManualText.length,
      returnedLength: cleanManualText.length,
    });
    setShowExtractedText(cleanManualText.length <= 5000);
    try {
      const generated = await generateQuizOnServer({
        content: cleanManualText,
        numQuestions: autoQuestions ? 0 : numQuestions,
        language: 'detect',
        difficulty,
        notes: notes.trim() || undefined,
      });
      
      setTitle(generated.title);
      setDescription(generated.description);
      setQuestions(generated.questions);
      await autoSaveAndPlay(generated);
    } catch (err) {
      console.error('[QuizBuilder] manual generation failed:', err);
      setError(ownerOnlyError(user, QUIZ_GENERATION_ERROR, err));
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

  const parseFileOnServer = async (file: File): Promise<{ text: string; extraction?: any }> => {
    const formData = new FormData();
    formData.append('file', file);
    const headers = new Headers();
    if (user) {
      headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    }

    const response = await fetch('/api/parse-file', {
      method: 'POST',
      headers,
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
          errorMessage = responseText.substring(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON response:', responseText);
      if (responseText.includes('<!DOCTYPE html>')) {
        throw new Error('Server returned HTML instead of JSON. The backend might not be running correctly.');
      }
      throw new Error('Failed to parse server response as JSON.');
    }
  };

  const generateQuizOnServer = async (payload: {
    content?: string;
    image?: {
      data: string;
      mimeType: string;
    };
    numQuestions: number;
    language: string;
    difficulty: 'easy' | 'medium' | 'hard';
    notes?: string;
  }) => {
    if (!user) {
      throw new Error('User must be authenticated to generate quizzes.');
    }

    const token = await user.getIdToken();
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `Server returned ${response.status}`);
    }
    return data;
  };

  const generateQuizFromExtractedText = async (file: File, text: string, extraction?: any) => {
    const cleanText = typeof text === 'string' ? text.trim() : '';
    console.log('Extracted text from server:', cleanText.substring(0, 100));

    if (cleanText === '[object Object]' || cleanText.length < 10) {
      throw new Error('فشل استخراج نص كاف من الملف. قد يكون الملف فارغًا أو محميًا أو يحتوي على صور غير واضحة.');
    }

    const formattedText = formatExtractedTextPreview(cleanText) || cleanText;

    setExtractedText(formattedText);
    setExtractedMeta({
      fileName: file.name,
      method: extraction?.method || 'unknown',
      usedOcr: Boolean(extraction?.usedOcr),
      length: Number(extraction?.length || cleanText.length),
      returnedLength: Number(extraction?.returnedLength || formattedText.length),
    });
    setShowExtractedText(true);

    const generated = await generateQuizOnServer({
      content: formattedText,
      numQuestions: autoQuestions ? 0 : numQuestions,
      language: 'detect',
      difficulty,
      notes: notes.trim() || undefined,
    });

    setTitle(generated.title);
    setDescription(generated.description);
    setQuestions(generated.questions);
    await autoSaveAndPlay(generated);
  };

  const processFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`File is too large. Maximum upload size is ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setExtractedText('');
    setExtractedMeta(null);
    setShowExtractedText(false);

    // Verify API health before proceeding
    try {
      const healthCheck = await fetch('/api/health').then(r => r.json()).catch(() => null);
      if (!healthCheck || healthCheck.status !== 'ok') {
        throw new Error('Backend server is not responding.');
      }
    } catch (e) {
      setError(ownerOnlyError(user, SERVER_UNAVAILABLE_ERROR, e));
      setIsGenerating(false);
      return;
    }

    try {
      try {
        const parsed = await parseFileOnServer(file);
        await generateQuizFromExtractedText(file, parsed.text, parsed.extraction);
      } catch (parseErr) {
        const isImageFile = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImageFile) {
          throw parseErr;
        }

        console.warn('[image OCR] Server OCR failed, using direct Gemini image generation:', parseErr instanceof Error ? parseErr.message : parseErr);
        setExtractedText('');
        setExtractedMeta({
          fileName: file.name,
          method: 'gemini-vision-direct',
          usedOcr: false,
          length: 0,
          returnedLength: 0,
        });
        setShowExtractedText(false);

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
        const generated = await generateQuizOnServer({
          image: {
            data: base64Data,
            mimeType: file.type,
          },
          numQuestions: autoQuestions ? 0 : numQuestions,
          language: 'detect',
          difficulty,
          notes: notes.trim() || undefined,
        });

        setTitle(generated.title);
        setDescription(generated.description);
        setQuestions(generated.questions);
        await autoSaveAndPlay(generated);
      }
    } catch (err) {
      console.error('[QuizBuilder] file generation failed:', err);
      const detail = err instanceof Error ? err.message : String(err);
      const publicMessage = /extract|parse|file|ocr|pdf|office|server|backend/i.test(detail)
        ? FILE_EXTRACTION_ERROR
        : QUIZ_GENERATION_ERROR;
      setError(ownerOnlyError(user, publicMessage, err));
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
      const quizCategory = normalizeCategory(category);
      if (isEditing && quizId) {
        // Update existing quiz
        await updateDoc(doc(db, 'quizzes', quizId), {
          title,
          description,
          category: quizCategory,
          difficulty,
          timer,
          questions,
          updatedAt: Timestamp.now(),
        });
        setSuccess('تم حفظ التعديلات بنجاح!');
        setTimeout(() => navigate('/library'), 1500);
      } else {
        // Create new quiz
        const quizData = {
          title,
          description,
          category: quizCategory,
          difficulty,
          timer,
          questions,
          authorUid: user.uid,
          createdAt: Timestamp.now(),
        };

        await addDoc(collection(db, 'quizzes'), quizData);
        setSuccess('تم حفظ الكويز بنجاح! جاري الانتقال...');
        setTimeout(() => navigate('/library'), 1500);
      }
    } catch (err: any) {
      console.error('Failed to save quiz:', err);
      setError(ownerOnlyError(user, SAVE_QUIZ_ERROR, err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (questions.length === 0) {
      setError('Please add at least one question before exporting PDF');
      return;
    }

    setIsExportingPdf(true);
    try {
      const downloaded = await exportQuizToPdf({
        title: title || 'Untitled Quiz',
        description,
        category: normalizeCategory(category),
        difficulty,
        timer: noTimer ? 0 : timer,
        questions,
      });

      if (!downloaded) {
        setError('تعذر تحميل ملف PDF حالياً. حاول مرة أخرى.');
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loadingQuiz) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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
            onClick={() => isEditing ? navigate('/library') : setActiveTab(null)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? 'تعديل الكويز' : activeTab === 'manual' ? 'Manual Builder' : 'AI Generator'}
            </h1>
            <p className="text-gray-600">
              {isEditing ? 'عدّل إعدادات وأسئلة الكويز ثم احفظ' : activeTab === 'manual' ? 'Create your quiz manually' : 'Generate questions using AI'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleClearAll}
            disabled={isSaving || isGenerating}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isSaving || isGenerating || isExportingPdf || questions.length === 0}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExportingPdf ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            onClick={handleSaveQuiz}
            disabled={isSaving || isGenerating || questions.length === 0}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : isEditing ? <Pencil className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {isEditing ? 'حفظ التعديلات' : 'Save Quiz'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start text-red-600 mb-6"
          >
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium whitespace-pre-line" dir="auto">{error}</p>
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
                <h3 className="text-2xl font-bold text-gray-900">تم بنجاح</h3>
                <p className="text-lg text-indigo-600 font-bold">{success}</p>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                حسناً
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
                    <CategorySelect
                      value={category}
                      onChange={setCategory}
                      sourceType="quiz"
                      placeholder="التصنيف اختياري"
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
                    <CategorySelect
                      value={category}
                      onChange={setCategory}
                      sourceType="quiz"
                      placeholder="التصنيف اختياري"
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
                    accept={ACCEPTED_FILE_TYPES}
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
                        <p className="text-sm text-gray-500">
                          PDF, Word, PowerPoint, Excel, Images, CSV, or text
                          <span className="block sm:inline"> (Max {formatFileSize(MAX_UPLOAD_SIZE_BYTES)})</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
                        <span className="text-sm text-gray-600">عدد الأسئلة:</span>
                        <button
                          onClick={() => setAutoQuestions(!autoQuestions)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            autoQuestions
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          ✨ تلقائي حسب الفهم
                        </button>
                        {autoQuestions ? (
                          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                            سيقرر الذكاء الاصطناعي العدد المثالي
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                      <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setShowNotes(!showNotes)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors mx-auto"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          {showNotes ? 'إخفاء الملاحظات' : 'إضافة ملاحظات للذكاء الاصطناعي'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showNotes && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-2"
                            >
                              <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="مثال: ركّز على الفصل الثالث فقط، أو تجاهل المقدمة، أو اجعل الأسئلة على التعريفات..."
                                className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-xs text-right focus:ring-2 focus:ring-indigo-400 outline-none resize-none h-20"
                                dir="auto"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
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

                  {/* Notes Section */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setShowNotes(!showNotes)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquarePlus className="w-4 h-4" />
                        {notes.trim() ? `ملاحظات: "${notes.substring(0, 40)}${notes.length > 40 ? '...' : ''}"` : 'إضافة ملاحظات توجيهية للذكاء الاصطناعي'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showNotes && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="مثال: ركّز على الفصل الثالث فقط، أو تجاهل المقدمة، أو اجعل الأسئلة على التعريفات والمصطلحات..."
                            className="w-full px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none h-24"
                            dir="auto"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-gray-600">عدد الأسئلة:</span>
                      <button
                        onClick={() => setAutoQuestions(!autoQuestions)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          autoQuestions
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        ✨ تلقائي حسب الفهم
                      </button>
                      {autoQuestions ? (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-medium">
                          سيقرر الذكاء الاصطناعي العدد المثالي
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={numQuestions}
                          onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
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

            {extractedMeta && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      <h3 className="text-lg font-bold text-gray-900">Extracted text preview</h3>
                    </div>
                    <p className="text-sm text-gray-500 break-all">{extractedMeta.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {getExtractionLabel(extractedMeta.method)}
                      {extractedMeta.length > 0 && ` - ${extractedMeta.returnedLength.toLocaleString()} characters ready for quiz generation`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {extractedMeta.usedOcr && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                        OCR used
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowExtractedText(prev => !prev)}
                      disabled={!extractedText}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showExtractedText ? 'Hide text' : 'Show text'}
                    </button>
                  </div>
                </div>

                {showExtractedText && extractedText && (
                  <ExtractedTextPreview text={extractedText} />
                )}

                {!extractedText && (
                  <p className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                    No extracted text preview is available because the image was sent directly to Gemini as a visual input.
                  </p>
                )}
              </motion.div>
            )}

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
