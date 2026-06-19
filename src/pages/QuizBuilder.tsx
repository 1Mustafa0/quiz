import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { GeneratedQuestion } from '../services/geminiService';
import { Upload, FileText, Plus, Trash2, Save, Sparkles, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Pencil, MessageSquarePlus, ChevronDown, Download, Copy, X } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import { motion, AnimatePresence } from 'motion/react';
import SupportCTA from '../components/SupportCTA';
import ConfirmModal from '../components/ConfirmModal';
import CategorySelect from '../components/CategorySelect';
import ExtractedTextPreview from '../components/ExtractedTextPreview';
import { ownerOnlyError } from '../utils/owner';
import { exportQuizToPdf, getPdfQuestionAnswer, getPdfQuestionOptions, preloadQuizPdfExporter } from '../utils/quizPdf';
import { normalizeCategory } from '../utils/categories';
import { formatExtractedTextPreview } from '../utils/extractedText';

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const IMAGE_GENERATION_PAYLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
const PDF_VISUAL_AUTO_QUESTIONS = 20;
const PDF_BROWSER_OCR_MAX_PAGES = 12;
const SUPPORT_AFTER_CREATE_KEY = 'ai-quiz-master-support-after-first-create';
const ACCEPTED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff',
  '.txt', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.md', '.json',
].join(',');

const CSV_FORMAT_PROMPT = `حوّل النص التالي إلى أسئلة اختيار من متعدد بالتنسيق النصي التالي فقط، بدون CSV وبدون أي شرح إضافي.

التنسيق المطلوب بالضبط لكل سؤال:
Question 1: نص السؤال
1. الاختيار الأول
2. الاختيار الثاني
3. الاختيار الثالث
4. الاختيار الرابع
Correct: رقم الإجابة الصحيحة من 1 إلى 4

القواعد:
- اكتب كل اختيار في سطر منفصل.
- افصل بين كل سؤال والسؤال التالي بسطر فارغ.
- رقّم الأسئلة تصاعديًا في سطر السؤال مثل Question 1 ثم Question 2 ثم Question 3.
- لا تضع رقم السؤال داخل نص السؤال نفسه؛ الرقم للتنظيم فقط وسيتم تجاهله عند الاستيراد.
- Correct يجب أن يكون رقما فقط من 1 إلى 4.
- رقم 1 يعني الاختيار الأول، ورقم 2 يعني الاختيار الثاني، ورقم 3 يعني الاختيار الثالث، ورقم 4 يعني الاختيار الرابع.
- لا تستخدم جداول أو CSV أو Markdown.
- لا تكتب أي نص قبل أو بعد الأسئلة.

مثال على التنسيق الصحيح:
Question 1: Before surgery, the patient must have:
1. Written consent
2. Blood transfusion
3. Physiotherapy
4. Isolation
Correct: 1

Question 2: During a seizure, the nurse should first:
1. Insert an object into the mouth
2. Leave the patient alone
3. Stay with the patient and note the time
4. Force the patient to sit
Correct: 3

النص المطلوب تحويله:
`;

const QUESTION_IMPORT_EXAMPLE = `Question 1: Before surgery, the patient must have:
1. Written consent
2. Blood transfusion
3. Physiotherapy
4. Isolation
Correct: 1

Question 2: During a seizure, the nurse should first:
1. Insert an object into the mouth
2. Leave the patient alone
3. Stay with the patient and note the time
4. Force the patient to sit
Correct: 3`;

const isImageUpload = (file: File) =>
  file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name);

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || '';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const createImagePayloadForGemini = async (file: File) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.size <= IMAGE_GENERATION_PAYLOAD_LIMIT_BYTES) {
    return { data: dataUrlToBase64(originalDataUrl), mimeType: file.type || 'image/jpeg' };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const maxDimensions = [1600, 1200, 900, 720];
    const qualities = [0.78, 0.66, 0.54, 0.44];

    for (const maxDimension of maxDimensions) {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrlToBase64(dataUrl);
        if (base64.length * 0.75 <= IMAGE_GENERATION_PAYLOAD_LIMIT_BYTES) {
          return { data: base64, mimeType: 'image/jpeg' };
        }
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error('الصورة كبيرة جدًا للإرسال. جرّب لقطة شاشة أو صورة أوضح بحجم أصغر.');
};

const extractPdfTextInBrowser = async (file: File) => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }

  return pages.join('\n\n').trim();
};

const createPdfVisualPayloadForGemini = async (file: File) => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageTargets = [12, 10, 8, 6, 4, 2, 1].filter(count => count <= pdf.numPages);
  const widths = [1000, 850, 700, 560];
  const qualities = [0.72, 0.6, 0.48, 0.36, 0.28];

  for (const pageTarget of pageTargets) {
    for (const targetWidth of widths) {
      const renderedPages: HTMLCanvasElement[] = [];
      try {
        let totalHeight = 0;
        let maxWidth = 0;

        for (let pageNumber = 1; pageNumber <= pageTarget; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas is not available for PDF rendering.');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context, viewport }).promise;
          renderedPages.push(canvas);
          maxWidth = Math.max(maxWidth, canvas.width);
          totalHeight += canvas.height + 36;
        }

        const sheet = document.createElement('canvas');
        sheet.width = maxWidth;
        sheet.height = totalHeight;
        const sheetContext = sheet.getContext('2d');
        if (!sheetContext) throw new Error('Canvas is not available for PDF rendering.');
        sheetContext.fillStyle = '#ffffff';
        sheetContext.fillRect(0, 0, sheet.width, sheet.height);
        sheetContext.font = '20px Arial';
        sheetContext.fillStyle = '#111827';

        let offsetY = 0;
        renderedPages.forEach((canvas, index) => {
          sheetContext.fillText(`PDF page ${index + 1} of ${pdf.numPages}`, 12, offsetY + 24);
          offsetY += 36;
          sheetContext.drawImage(canvas, 0, offsetY);
          offsetY += canvas.height;
        });

        for (const quality of qualities) {
          const dataUrl = sheet.toDataURL('image/jpeg', quality);
          const base64 = dataUrlToBase64(dataUrl);
          if (base64.length * 0.75 <= IMAGE_GENERATION_PAYLOAD_LIMIT_BYTES) {
            return {
              data: base64,
              mimeType: 'image/jpeg',
              pageCount: pageTarget,
              totalPages: pdf.numPages,
            };
          }
        }
      } finally {
        renderedPages.forEach(canvas => {
          canvas.width = 1;
          canvas.height = 1;
        });
      }
    }
  }

  throw new Error('Could not compress the scanned PDF pages enough for visual generation.');
};

const extractPdfOcrInBrowser = async (file: File) => {
  const [{ createWorker }, pdfjs] = await Promise.all([
    import('tesseract.js'),
    import('pdfjs-dist/build/pdf.mjs'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageLimit = Math.min(pdf.numPages, PDF_BROWSER_OCR_MAX_PAGES);
  const worker = await createWorker('eng');
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, Math.max(1.2, 1500 / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const result = await worker.recognize(canvas);
      const pageText = result.data.text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (pageText) pages.push(`Page ${pageNumber}:\n${pageText}`);

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  const text = pages.join('\n\n').trim();
  return {
    text,
    pageCount: pageLimit,
    totalPages: pdf.numPages,
  };
};

const extractTextFileInBrowser = async (file: File) => {
  const text = await file.text();
  return text.trim();
};

const parseLargeFileInBrowser = async (file: File): Promise<{ text: string; extraction?: any }> => {
  const lowerName = file.name.toLowerCase();
  let text = '';
  let method = 'browser-text';

  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    text = await extractPdfTextInBrowser(file);
    method = 'browser-pdfjs';
  } else if (
    file.type.startsWith('text/') ||
    /\.(txt|md|json|csv|js|ts|tsx|jsx|py|java|cpp|c|html|css)$/i.test(lowerName)
  ) {
    text = await extractTextFileInBrowser(file);
    method = 'browser-text';
  } else {
    throw new Error('الملف كبير على نسخة Vercel الحالية. جرّب PDF يحتوي على نص قابل للنسخ، أو انسخ النص داخل خانة النص.');
  }

  if (!text || text.length < 10) {
    throw new Error('تعذر استخراج نص واضح من الملف داخل المتصفح. جرّب ملفًا نصيًا أو انسخ النص يدويًا.');
  }

  return {
    text,
    extraction: {
      method,
      usedOcr: false,
      length: text.length,
      returnedLength: text.length,
      originalName: file.name,
      mimeType: file.type,
    },
  };
};

const isPdfUpload = (file: File) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

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
  'browser-pdf-visual': 'Browser-rendered PDF pages',
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

const MAX_GENERATED_QUESTIONS = 30;
type FeedbackMode = 'end' | 'per-question';

const estimateQuestionCountFromText = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const numberedQuestionCount = lines.filter(line =>
    /^(?:س|q|question)?\s*\d{1,3}\s*[\).\-:]/i.test(line) ||
    /^\d{1,3}\s*[-–]\s*/.test(line)
  ).length;
  const questionMarkCount = (text.match(/[؟?]/g) || []).length;
  const qaCount = lines.filter(line => /^(?:q|س)\s*\d{0,3}\s*[:\-]/i.test(line)).length;

  return Math.min(
    MAX_GENERATED_QUESTIONS,
    Math.max(numberedQuestionCount, questionMarkCount, qaCount)
  );
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(value => value.trim() !== '')) rows.push(row);

  return rows;
};

const normalizeImportedOptions = (optionColumns: string[]) => {
  if (optionColumns.length === 4) return optionColumns;
  if (optionColumns.length < 4) return null;

  if (optionColumns[optionColumns.length - 1] === '') {
    return [
      optionColumns[0] || '',
      optionColumns[1] || '',
      optionColumns.slice(2, -1).join(', ').trim(),
      '',
    ];
  }

  return [
    optionColumns[0] || '',
    optionColumns[1] || '',
    optionColumns[2] || '',
    optionColumns.slice(3).join(', ').trim(),
  ];
};

const looksLikeCsvHeader = (columns: string[]) => {
  const normalized = columns.map(column => column.trim().toLowerCase());
  return normalized[0] === 'question' && (
    normalized.includes('correct') ||
    normalized.includes('answer') ||
    normalized.some(column => /^option\s*1$/.test(column))
  );
};

const getImportedCorrectIndex = (value: string, options: string[]) => {
  const clean = normalizeImportLine(value);
  const numeric = Number.parseInt(clean, 10);
  if (!Number.isNaN(numeric)) {
    if (numeric >= 0 && numeric < options.length) return numeric;
    if (numeric >= 1 && numeric <= options.length) return numeric - 1;
  }

  const letterIndex = ['A', 'B', 'C', 'D'].indexOf(clean.toUpperCase());
  if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;

  const answerTextIndex = options.findIndex(option => option.trim().toLowerCase() === clean.toLowerCase());
  return answerTextIndex >= 0 ? answerTextIndex : -1;
};

const normalizeImportLine = (value: string) =>
  value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[：]/g, ':')
    .replace(/[–—]/g, '-')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim();

const getOneBasedCorrectIndex = (value: string, options: string[]) => {
  const clean = normalizeImportLine(value);
  const numeric = Number.parseInt(clean, 10);
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
    return numeric - 1;
  }

  const letterIndex = ['A', 'B', 'C', 'D'].indexOf(clean.toUpperCase());
  if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;

  const answerTextIndex = options.findIndex(option => option.trim().toLowerCase() === clean.toLowerCase());
  return answerTextIndex >= 0 ? answerTextIndex : -1;
};

const QUESTION_LINE_PATTERN = /^(?:(?:question|q|سؤال|السؤال)\s*\d+|\d+\s*[\).:\-]\s*(?:question|q|سؤال|السؤال)|(?:question|q|سؤال|السؤال))\s*[:.\-)]\s*/i;

const stripQuestionLabel = (line: string) =>
  normalizeImportLine(line)
    .replace(QUESTION_LINE_PATTERN, '')
    .replace(/^\d+\s*[\).:\-]\s*/, '')
    .trim();

const stripOptionLabel = (line: string) => {
  const normalized = normalizeImportLine(line);
  const match = normalized.match(/^(?:option\s*)?([1-4a-d])\s*[\).:\-]\s*(.+)$/i);
  if (!match) return null;

  return {
    label: match[1].toUpperCase(),
    text: match[2].trim(),
  };
};

const getBlockCorrectValue = (line: string) => {
  const normalized = normalizeImportLine(line);
  const match = normalized.match(/^(?:correct answer|right answer|correct|answer|الإجابة الصحيحة|الاجابة الصحيحة|الإجابة|الاجابة|الصحيح)\s*[:.\-)]?\s*(?:option\s*)?([1-4a-d])\s*$/i);
  return match?.[1] || '';
};

const parseQuestionTextBlocks = (text: string): GeneratedQuestion[] => {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeImportLine)
    .filter(Boolean);

  const importedQuestions: GeneratedQuestion[] = [];
  let questionText = '';
  let options: string[] = [];
  let correctValue = '';

  const pushQuestion = () => {
    if (!questionText || options.length !== 4 || !correctValue) return;

    const correctIndex = getOneBasedCorrectIndex(correctValue, options);
    if (correctIndex < 0 || correctIndex >= options.length) return;

    importedQuestions.push({
      type: 'multiple-choice',
      questionText,
      options,
      correctAnswer: options[correctIndex],
      feedback: '',
    });
  };

  for (const line of lines) {
    const isQuestionLine = QUESTION_LINE_PATTERN.test(line);
    if (isQuestionLine) {
      pushQuestion();
      questionText = stripQuestionLabel(line);
      options = [];
      correctValue = '';
      continue;
    }

    const option = stripOptionLabel(line);
    if (option && options.length < 4) {
      options.push(option.text);
      continue;
    }

    const answer = getBlockCorrectValue(line);
    if (answer) {
      correctValue = answer;
      pushQuestion();
      questionText = '';
      options = [];
      correctValue = '';
      continue;
    }

    if (questionText && options.length < 4) {
      options.push(line);
      continue;
    }

    if (!questionText && options.length === 0) {
      questionText = stripQuestionLabel(line);
    }
  }

  pushQuestion();
  return importedQuestions;
};

const parseImportedCsvQuestions = (text: string): GeneratedQuestion[] => {
  const blockQuestions = parseQuestionTextBlocks(text);
  if (blockQuestions.length > 0) return blockQuestions;

  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];

  const startIndex = looksLikeCsvHeader(rows[0]) ? 1 : 0;
  const importedQuestions: GeneratedQuestion[] = [];

  for (let i = startIndex; i < rows.length; i += 1) {
    const columns = rows[i].map(col => col.trim());
    const correctValue = columns[columns.length - 1] || '';
    const optionColumns = columns.length >= 6
      ? columns.slice(Math.max(1, columns.length - 5), columns.length - 1)
      : columns.slice(1, -1);
    const questionColumns = columns.slice(0, Math.max(1, columns.length - 5));
    const questionText = questionColumns.join(', ').trim();
    const options = normalizeImportedOptions(optionColumns);
    if (!questionText || !options || options.some(option => !option.trim())) continue;

    const correctIndex = getImportedCorrectIndex(correctValue, options);
    if (correctIndex < 0 || correctIndex >= options.length) continue;

    importedQuestions.push({
      type: 'multiple-choice',
      questionText,
      options,
      correctAnswer: options[correctIndex],
      feedback: '',
    });
  }

  return importedQuestions;
};

const isLikelyQuestionCsv = (text: string) => {
  if (parseQuestionTextBlocks(text).length > 0) return true;

  const rows = parseCsvRows(text);
  if (rows.length < 2) return false;
  if (looksLikeCsvHeader(rows[0])) return true;

  const sampleRows = rows.slice(0, 5);
  const validRows = parseImportedCsvQuestions(sampleRows.map(row => row.join(',')).join('\n')).length;
  return validRows >= Math.min(2, sampleRows.length);
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const getExtractionLabel = (method: string) => EXTRACTION_LABELS[method] || method || 'Unknown extraction';

const FeedbackModeControl: React.FC<{
  value: FeedbackMode;
  onChange: (value: FeedbackMode) => void;
}> = ({ value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Timing</label>
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange('end')}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          value === 'end'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
      >
        End of quiz
      </button>
      <button
        type="button"
        onClick={() => onChange('per-question')}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          value === 'per-question'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
      >
        Each question
      </button>
    </div>
  </div>
);

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
                  const wasCorrectAnswer = question.correctAnswer === opt;
                  newOpts[optIndex] = e.target.value;
                  onUpdate({
                    options: newOpts,
                    ...(wasCorrectAnswer ? { correctAnswer: e.target.value } : {}),
                  });
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

  useEffect(() => {
    preloadQuizPdfExporter();
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timer, setTimer] = useState<number>(10);
  const [noTimer, setNoTimer] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('end');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(isEditing);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSupportAfterCreate, setShowSupportAfterCreate] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [autoQuestions, setAutoQuestions] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [extractedMeta, setExtractedMeta] = useState<ExtractionMeta | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [lastGenerationMeta, setLastGenerationMeta] = useState<any>(null);

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
        setFeedbackMode(data.feedbackMode === 'per-question' ? 'per-question' : 'end');
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
  const manualDetectedQuestionCount = estimateQuestionCountFromText(manualText);

  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importError, setImportError] = useState('');
  const detectedImportQuestionCount = useMemo(
    () => (csvText.trim() ? parseImportedCsvQuestions(csvText).length : 0),
    [csvText]
  );
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
    setImportError('');
    
    try {
      const rows = parseCsvRows(csvText);
      if (rows.length < 1) {
        setImportError('يرجى إدخال نص يحتوي على سؤال واحد على الأقل.');
        return;
      }

      const newQuestions = parseImportedCsvQuestions(csvText);

      if (newQuestions.length > 0) {
        setQuestions([...questions, ...newQuestions]);
        setSuccess(`تم استيراد ${newQuestions.length} أسئلة بنجاح!`);
        setShowCsvImport(false);
        setCsvText('');
      } else {
        setImportError('لم يتم العثور على أسئلة صالحة. تأكد أن كل سؤال يحتوي على 4 اختيارات في أسطر منفصلة وسطر Correct برقم من 1 إلى 4.');
      }
    } catch (err) {
      setImportError('حدث خطأ أثناء معالجة النص. يرجى التأكد من التنسيق الصحيح.');
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
        feedbackMode,
        questions: generated.questions,
        provider: generated.provider || lastGenerationMeta?.provider || 'unknown',
        status: generated.status || 'success',
        attempts: generated.attempts || lastGenerationMeta?.attempts || [],
        cleanedText: generated.cleanedText || lastGenerationMeta?.cleanedText || extractedText || '',
        userId: user.uid,
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
        setLastGenerationMeta(null);
        setShowExtractedText(false);
        setError(null);
        setSuccess(null);
      }
    });
  };

  const handleGenerateFromManualText = async () => {
    const cleanManualText = manualText.trim();
    if (!cleanManualText) return;
    const detectedQuestionCount = estimateQuestionCountFromText(cleanManualText);
    const requestedQuestionCount = autoQuestions
      ? Math.max(detectedQuestionCount, 0)
      : Math.max(numQuestions, detectedQuestionCount);
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
      if (isLikelyQuestionCsv(cleanManualText)) {
        const importedQuestions = parseImportedCsvQuestions(cleanManualText);
        if (importedQuestions.length > 0) {
          const importedQuiz = {
            title: title.trim() || 'Imported Quiz',
            description: `Imported ${importedQuestions.length} questions from formatted text.`,
            questions: importedQuestions,
            provider: 'text-import',
            status: 'success',
            cleanedText: cleanManualText,
            attempts: ['formatted-text-direct-import'],
          };
          setLastGenerationMeta(importedQuiz);
          setTitle(importedQuiz.title);
          setDescription(importedQuiz.description);
          setQuestions(importedQuestions);
          await autoSaveAndPlay(importedQuiz);
          return;
        }
      }

      const generated = await generateQuizOnServer({
        content: cleanManualText,
        numQuestions: requestedQuestionCount,
        language: 'detect',
        difficulty,
        notes: [
          detectedQuestionCount > numQuestions
            ? `The pasted manual text appears to contain about ${detectedQuestionCount} question-like items. Do not omit them; generate up to ${requestedQuestionCount} questions to preserve coverage.`
            : '',
          notes.trim(),
        ].filter(Boolean).join('\n') || undefined,
      });
      
      setLastGenerationMeta(generated);
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

    const responseText = await response.text();
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || `Server returned ${response.status}` };
    }

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

    if (isLikelyQuestionCsv(cleanText)) {
      const importedQuestions = parseImportedCsvQuestions(cleanText);
      if (importedQuestions.length > 0) {
        const importedQuiz = {
          title: title.trim() || file.name.replace(/\.[^.]+$/, '') || 'Imported Quiz',
          description: `Imported ${importedQuestions.length} questions from formatted text file.`,
          questions: importedQuestions,
          provider: 'text-import',
          status: 'success',
          cleanedText: cleanText,
          attempts: ['formatted-text-direct-import'],
        };
        setLastGenerationMeta(importedQuiz);
        setTitle(importedQuiz.title);
        setDescription(importedQuiz.description);
        setQuestions(importedQuestions);
        await autoSaveAndPlay(importedQuiz);
        return;
      }
    }

    const generated = await generateQuizOnServer({
      content: formattedText,
      numQuestions: autoQuestions ? 0 : numQuestions,
      language: 'detect',
      difficulty,
      notes: notes.trim() || undefined,
    });

    setLastGenerationMeta(generated);
    setTitle(generated.title);
    setDescription(generated.description);
    setQuestions(generated.questions);
    await autoSaveAndPlay(generated);
  };

  const processFile = async (file: File) => {
    const isImageFile = isImageUpload(file);
    if (isImageFile && file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
      setError(`الصورة كبيرة جدًا. الحد الأقصى للصور هو ${formatFileSize(MAX_IMAGE_UPLOAD_SIZE_BYTES)}.`);
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
      if (isImageFile) {
        setExtractedText('');
        setExtractedMeta({
          fileName: file.name,
          method: 'gemini-vision-direct',
          usedOcr: false,
          length: 0,
          returnedLength: 0,
        });
        setShowExtractedText(false);

        const imagePayload = await createImagePayloadForGemini(file);
        const generated = await generateQuizOnServer({
          image: imagePayload,
          numQuestions: autoQuestions ? 0 : numQuestions,
          language: 'detect',
          difficulty,
          notes: notes.trim() || undefined,
        });

        setLastGenerationMeta(generated);
        setTitle(generated.title);
        setDescription(generated.description);
        setQuestions(generated.questions);
        await autoSaveAndPlay(generated);
        return;
      }

      let parsed: { text: string; extraction?: any } | null = null;
      try {
        parsed = await parseFileOnServer(file);
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
        const canFallbackToBrowser = /payload|too large|413|function|server returned html|backend|api route|missing|crashed/i.test(message);
        if (!canFallbackToBrowser) {
          throw parseErr;
        }

        try {
          parsed = await parseLargeFileInBrowser(file);
        } catch (browserParseErr) {
          if (!isPdfUpload(file)) {
            throw browserParseErr;
          }

          try {
            const browserOcr = await extractPdfOcrInBrowser(file);
            if (browserOcr.text.length >= 80) {
              parsed = {
                text: browserOcr.text,
                extraction: {
                  method: 'browser-tesseract-pdf',
                  usedOcr: true,
                  length: browserOcr.text.length,
                  returnedLength: browserOcr.text.length,
                  originalName: file.name,
                  mimeType: file.type,
                  diagnostics: {
                    ocrPdfPages: browserOcr.pageCount,
                    renderedPdfPages: browserOcr.totalPages,
                  },
                },
              };
            }
          } catch (ocrErr) {
            console.warn('[QuizBuilder] browser PDF OCR failed, falling back to visual input:', ocrErr);
          }

          if (parsed) {
            // Continue with the normal text-generation flow below.
          } else {
          const pdfVisualPayload = await createPdfVisualPayloadForGemini(file);
          setExtractedText('');
          setExtractedMeta({
            fileName: file.name,
            method: 'browser-pdf-visual',
            usedOcr: true,
            length: 0,
            returnedLength: 0,
          });
          setShowExtractedText(false);

          const visualNotes = [
            `The uploaded PDF appears to be scanned or image-only. It was rendered in the browser as ${pdfVisualPayload.pageCount} visible page image(s) out of ${pdfVisualPayload.totalPages}. Read the visible educational content carefully and generate questions that cover every distinct visible knowledge point.`,
            notes.trim(),
          ].filter(Boolean).join('\n') || undefined;

          const generated = await generateQuizOnServer({
            image: {
              data: pdfVisualPayload.data,
              mimeType: pdfVisualPayload.mimeType,
            },
            numQuestions: autoQuestions ? PDF_VISUAL_AUTO_QUESTIONS : numQuestions,
            language: 'detect',
            difficulty,
            notes: visualNotes,
          });

          setLastGenerationMeta(generated);
          setTitle(generated.title);
          setDescription(generated.description);
          setQuestions(generated.questions);
          await autoSaveAndPlay(generated);
          return;
          }
        }
      }

      await generateQuizFromExtractedText(file, parsed.text, parsed.extraction);
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
          feedbackMode,
          questions,
          provider: lastGenerationMeta?.provider || 'manual',
          status: lastGenerationMeta?.status || 'success',
          attempts: lastGenerationMeta?.attempts || [],
          cleanedText: lastGenerationMeta?.cleanedText || extractedText || '',
          userId: user.uid,
          updatedAt: Timestamp.now(),
        });
        setShowSupportAfterCreate(false);
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
          feedbackMode,
          questions,
          provider: lastGenerationMeta?.provider || 'manual',
          status: lastGenerationMeta?.status || 'success',
          attempts: lastGenerationMeta?.attempts || [],
          cleanedText: lastGenerationMeta?.cleanedText || extractedText || '',
          userId: user.uid,
          authorUid: user.uid,
          createdAt: Timestamp.now(),
        };

        await addDoc(collection(db, 'quizzes'), quizData);
        const shouldShowSupport = localStorage.getItem(SUPPORT_AFTER_CREATE_KEY) !== '1';
        if (shouldShowSupport) {
          localStorage.setItem(SUPPORT_AFTER_CREATE_KEY, '1');
        }
        setShowSupportAfterCreate(shouldShowSupport);
        setSuccess('تم حفظ الكويز بنجاح! جاري الانتقال...');
        if (!shouldShowSupport) {
          setTimeout(() => navigate('/library'), 1500);
        }
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

    const invalidQuestionIndex = questions.findIndex(question =>
      question.type === 'multiple-choice' && getPdfQuestionOptions(question).length < 4
    );
    if (invalidQuestionIndex >= 0) {
      setError(`السؤال رقم ${invalidQuestionIndex + 1} لا يحتوي على 4 اختيارات مكتوبة. أضف الاختيارات أولاً ثم حمّل ملف PDF.`);
      return;
    }

    const missingAnswerIndex = questions.findIndex(question => !getPdfQuestionAnswer(question).text);
    if (missingAnswerIndex >= 0) {
      setError(`السؤال رقم ${missingAnswerIndex + 1} لا يحتوي على إجابة صحيحة محددة. اختر الإجابة الصحيحة قبل تحميل ملف PDF.`);
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
              {showSupportAfterCreate && (
                <SupportCTA
                  variant="inline"
                  message="❤️ لو الكويز ساعدك في المذاكرة، تقدر تدعم المشروع ليستمر"
                />
              )}
              <button
                onClick={() => {
                  setSuccess(null);
                  if (showSupportAfterCreate) {
                    setShowSupportAfterCreate(false);
                    navigate('/library');
                  }
                }}
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
                <FeedbackModeControl value={feedbackMode} onChange={setFeedbackMode} />
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
                    استيراد نص
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

              {/* Text Import Modal */}
              <AnimatePresence>
                {showCsvImport && (
                  <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5 lg:items-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:my-0"
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xl font-bold text-slate-950 dark:text-white">استيراد أسئلة من نص منسق</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">كل اختيار في سطر منفصل، وCorrect برقم من 1 إلى 4.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCsvImport(false);
                            setImportError('');
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="إغلاق"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain bg-slate-50 p-5 dark:bg-slate-900 sm:p-6">
                        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.25fr]">
                          <div className="space-y-4">
                        <div className="grid gap-3">
                          {[
                            ['1', 'اكتب السؤال', 'ابدأ كل سؤال بسطر Question:'],
                            ['2', 'أضف الاختيارات', 'اكتب 4 اختيارات، كل اختيار في سطر.'],
                            ['3', 'حدد الصحيح', 'اكتب Correct: ثم رقم الإجابة.'],
                          ].map(([step, label, detail]) => (
                            <div key={step} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{step}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{label}</span>
                              </div>
                              <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-950 dark:text-white">مثال صحيح</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">لاحظ أن رقم 2 يعني الاختيار الثاني، وليس الثالث.</p>
                            </div>
                          </div>
                          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-left font-mono text-[12px] leading-5 text-slate-100 shadow-inner dark:border-slate-700" dir="ltr">{QUESTION_IMPORT_EXAMPLE}</pre>
                        </div>
                          </div>

                          <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">برومبت جاهز للنسخ</p>
                              <p className="text-xs text-emerald-700 dark:text-emerald-300">انسخه للذكاء الاصطناعي، ثم الصق النص الناتج في مربع الاستيراد بالأسفل.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(CSV_FORMAT_PROMPT)}
                              className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              نسخ
                            </button>
                          </div>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-bold text-emerald-800 dark:text-emerald-200">عرض البرومبت كامل</summary>
                            <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-3 text-xs leading-5 text-emerald-950 dark:border-emerald-500/20 dark:bg-slate-950 dark:text-emerald-100" dir="auto">{CSV_FORMAT_PROMPT}</pre>
                          </details>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-900 dark:text-white">الصق الأسئلة هنا</label>
                          <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            csvText.trim() && detectedImportQuestionCount === 0
                              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                          }`}>
                            {csvText.trim()
                              ? `تم اكتشاف ${detectedImportQuestionCount} سؤال قابل للاستيراد.`
                              : 'الصق النص وسيظهر هنا عدد الأسئلة المكتشفة قبل الاستيراد.'}
                          </div>
                          <textarea
                            value={csvText}
                            onChange={(e) => {
                              setCsvText(e.target.value);
                              if (importError) setImportError('');
                            }}
                            placeholder={`Question 1: Your question here
1. First answer
2. Second answer
3. Third answer
4. Fourth answer
Correct: 2`}
                            className="min-h-72 w-full resize-y overflow-auto rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm leading-6 text-slate-950 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-amber-500/20"
                            dir="auto"
                          />
                          {importError && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                              {importError}
                            </p>
                          )}
                        </div>
                        </div>
                      </div>
                      </div>

                      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:px-6">
                        <button
                          onClick={() => {
                            setShowCsvImport(false);
                            setImportError('');
                          }}
                          className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={handleCsvImport}
                          disabled={!csvText.trim()}
                          className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white shadow-sm transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {detectedImportQuestionCount > 0 ? `استيراد ${detectedImportQuestionCount} سؤال` : 'استيراد الآن'}
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
                <FeedbackModeControl value={feedbackMode} onChange={setFeedbackMode} />
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
                  {manualDetectedQuestionCount > numQuestions && (
                    <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                      Detected about {manualDetectedQuestionCount} question-like items in the pasted text, so generation will preserve that coverage instead of stopping at {numQuestions}.
                    </p>
                  )}

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
            <div className="min-h-[420px]">
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

        {questions.length === 0 && isGenerating && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
              <div className="w-[150px] h-10">
                <CardSkeleton count={1} />
              </div>
            </div>
            <div className="space-y-6">
              <CardSkeleton count={Math.max(3, Math.min(numQuestions || 5, 6))} />
            </div>
          </div>
        )}

        {questions.length === 0 && !isGenerating && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Start adding questions manually to build your quiz.</p>
          </div>
        )}
      </div>
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
