import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import type { MindMapData } from '../services/mindmapService';
import MindMapCanvas from '../components/MindMapCanvas';
import CategorySelect from '../components/CategorySelect';
import ExtractedTextPreview from '../components/ExtractedTextPreview';
import { Sparkles, Save, Loader2, AlertCircle, Brain, Download, Upload, FileText, X, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ownerOnlyError } from '../utils/owner';
import { normalizeCategory } from '../utils/categories';
import { formatExtractedTextPreview } from '../utils/extractedText';

type InputMode = 'topic' | 'file';

const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;
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

const SERVER_UNAVAILABLE_ERROR = 'The server is unavailable right now. Wait a moment, then try again.';

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const getExtractionLabel = (method: string) => EXTRACTION_LABELS[method] || method || 'Unknown extraction';
const MINDMAP_GENERATION_ERROR = 'تعذر إنشاء الخريطة الذهنية حالياً. جرّب محتوى أوضح ثم حاول مرة أخرى.';
const MINDMAP_FILE_ERROR = 'تعذر قراءة الملف. جرّب ملفاً نصياً أو صورة أوضح، ثم حاول مرة أخرى.';
const MINDMAP_SAVE_ERROR = 'تعذر حفظ الخريطة الذهنية حالياً. حاول مرة أخرى لاحقاً.';

const MindMapBuilder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<InputMode>('topic');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const [mapData, setMapData] = useState<MindMapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [extractedMeta, setExtractedMeta] = useState<ExtractionMeta | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMindMapOnServer = async (payload: {
    topic?: string;
    content?: string;
    filename?: string;
  }) => {
    if (!user) {
      throw new Error('User must be authenticated to generate mind maps.');
    }

    const token = await user.getIdToken();
    const response = await fetch('/api/generate-mindmap', {
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

    const responseText = await response.text().catch(() => '');
    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.details || errorData.error || errorMessage;
      } catch (e) {
        if (responseText.includes('<!DOCTYPE html>')) {
          errorMessage = 'Server returned HTML instead of JSON. The backend might not be running correctly.';
        } else if (responseText) {
          errorMessage = responseText.substring(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    try {
      return JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<!DOCTYPE html>')) {
        throw new Error('Server returned HTML instead of JSON. The backend might not be running correctly.');
      }
      throw new Error('Failed to parse server response as JSON.');
    }
  };

  const generateMindMapFromExtractedText = async (file: File, text: string, extraction?: any) => {
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (cleanText === '[object Object]' || cleanText.length < 10) {
      throw new Error('Could not extract enough readable text from this file.');
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
    setIsUploading(false);
    setUploadProgress('AI is analyzing extracted content...');

    const data = await generateMindMapOnServer({ content: formattedText, filename: file.name });
    setMapData(data);
    setTopic(data.topic);
    navigate('/mindmaps/editor', { state: { mapData: data, category: normalizeCategory(category) } });
  };

  const handleGenerateFromTopic = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setMapData(null);
    try {
      const data = await generateMindMapOnServer({ topic: topic.trim() });
      setMapData(data);
      navigate('/mindmaps/editor', { state: { mapData: data, category: normalizeCategory(category) } });
    } catch (e) {
      console.error('[MindMapBuilder] topic generation failed:', e);
      setError(ownerOnlyError(user, MINDMAP_GENERATION_ERROR, e));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromFile = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`File is too large. Maximum upload size is ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`);
      return;
    }

    setIsUploading(true);
    setIsGenerating(true);
    setError(null);
    setMapData(null);
    setExtractedText('');
    setExtractedMeta(null);
    setShowExtractedText(false);

    let fileWasParsed = false;

    try {
      setUploadProgress('Checking server...');
      const healthCheck = await fetch('/api/health').then(r => r.json()).catch(() => null);
      if (!healthCheck || healthCheck.status !== 'ok') {
        throw new Error('Backend server is not responding.');
      }

      setUploadProgress('Extracting text with OCR when needed...');
      const parsed = await parseFileOnServer(selectedFile);
      fileWasParsed = true;
      await generateMindMapFromExtractedText(selectedFile, parsed.text, parsed.extraction);
    } catch (e) {
      console.error('[MindMapBuilder] file generation failed:', e);
      const fallbackError = e instanceof Error && e.message === 'Backend server is not responding.'
        ? SERVER_UNAVAILABLE_ERROR
        : fileWasParsed
          ? MINDMAP_GENERATION_ERROR
          : MINDMAP_FILE_ERROR;
      setError(ownerOnlyError(user, fallbackError, e));
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleSave = async () => {
    if (!user || !mapData) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'mindmaps'), {
        topic: mapData.topic,
        title: mapData.topic,
        category: normalizeCategory(category),
        data: mapData,
        authorUid: user.uid,
        createdAt: Timestamp.now(),
      });
      navigate('/mindmaps');
    } catch (e) {
      console.error('[MindMapBuilder] save failed:', e);
      setError(ownerOnlyError(user, MINDMAP_SAVE_ERROR, e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!mapData) return;
    const svg = document.querySelector('#mindmap-export svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.topic}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetExtractionPreview = () => {
    setExtractedText('');
    setExtractedMeta(null);
    setShowExtractedText(false);
  };

  const setFileForMindMap = (file: File) => {
    resetExtractionPreview();
    setMapData(null);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setSelectedFile(null);
      setError(`File is too large. Maximum upload size is ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`);
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFileForMindMap(f);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFileForMindMap(f);
  };

  const clearFile = () => {
    setSelectedFile(null);
    resetExtractionPreview();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLoading = isGenerating || isUploading;
  const canGenerate = mode === 'topic' ? topic.trim().length > 0 : !!selectedFile;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Mind Map Builder
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Generate an interactive mind map from a topic or any document
          </p>
        </div>
        {mapData && (
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export SVG
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Map
            </button>
          </div>
        )}
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Mode Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          <button
            onClick={() => setMode('topic')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'topic'
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Type className="w-4 h-4" />
            From Topic
          </button>
          <button
            onClick={() => setMode('file')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'file'
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Upload className="w-4 h-4" />
            From File
          </button>
        </div>

        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'topic' ? (
              <motion.div
                key="topic"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isLoading && handleGenerateFromTopic()}
                    placeholder="e.g. The Industrial Revolution, Cell Biology, Python programming..."
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <CategorySelect value={category} onChange={setCategory} sourceType="mindmap" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => !selectedFile && fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    selectedFile
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/10'
                      : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {formatFileSize(selectedFile.size)} - Ready to generate
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); clearFile(); }}
                        className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto">
                        <Upload className="w-7 h-7 text-gray-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-slate-300">
                          Drop a file here or{' '}
                          <span className="text-indigo-600 dark:text-indigo-400">browse</span>
                        </p>
                        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                          PDF, Word, PowerPoint, Excel, Images, CSV, code, or text
                          <span className="block sm:inline"> (Max {formatFileSize(MAX_UPLOAD_SIZE_BYTES)})</span>
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <CategorySelect value={category} onChange={setCategory} sourceType="mindmap" />
                </div>

                {extractedMeta && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-950/20 p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">Extracted text ready</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-slate-400 break-all">{extractedMeta.fileName}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {getExtractionLabel(extractedMeta.method)}
                          {extractedMeta.length > 0 && ` - ${extractedMeta.returnedLength.toLocaleString()} characters ready for mind map generation`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {extractedMeta.usedOcr && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                            OCR used
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowExtractedText(prev => !prev)}
                          disabled={!extractedText}
                          className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {showExtractedText ? 'Hide text' : 'Show text'}
                        </button>
                      </div>
                    </div>

                    {showExtractedText && extractedText && (
                      <ExtractedTextPreview text={extractedText} className="border-indigo-100 dark:border-indigo-900" />
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button
            onClick={mode === 'topic' ? handleGenerateFromTopic : handleGenerateFromFile}
            disabled={isLoading || !canGenerate}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadProgress || 'Generating mind map...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Mind Map with AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium whitespace-pre-line" dir="auto">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 font-bold">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 flex flex-col items-center justify-center gap-4" style={{ height: '420px' }}>
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDuration: '1.5s' }} />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-gray-700 dark:text-slate-300 font-semibold">
              {isUploading ? 'Extracting readable text...' : 'Building your mind map...'}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {isUploading ? 'Using document parsing and OCR when needed' : 'AI is analyzing and structuring concepts'}
            </p>
          </div>
        </div>
      )}

      {/* Mind Map Display */}
      <AnimatePresence>
        {mapData && !isLoading && (
          <motion.div
            id="mindmap-export"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{mapData.topic}</h2>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {mapData.branches.length} branches · Drag to rearrange · Double-click to edit
              </span>
            </div>
            <MindMapCanvas
              data={mapData}
              onDataChange={(updated) => setMapData(updated)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MindMapBuilder;
