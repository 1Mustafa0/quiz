import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateMindMap, generateMindMapFromContent, MindMapData } from '../services/mindmapService';
import MindMapCanvas from '../components/MindMapCanvas';
import CategorySelect from '../components/CategorySelect';
import { Sparkles, Save, Loader2, AlertCircle, Brain, Download, Upload, FileText, X, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type InputMode = 'topic' | 'file';

const ACCEPTED = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateFromTopic = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setMapData(null);
    try {
      const data = await generateMindMap(topic.trim());
      setMapData(data);
      navigate('/mindmaps/editor', { state: { mapData: data, category: category || 'General' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate mind map. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromFile = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setIsGenerating(true);
    setError(null);
    setMapData(null);

    try {
      setUploadProgress('Uploading file...');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/parse-file', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse file.');
      }
      const { text } = await res.json();
      if (!text || text.length < 20) throw new Error('Could not extract text from this file. Try a different format.');

      setIsUploading(false);
      setUploadProgress('AI is analyzing content...');
      const data = await generateMindMapFromContent(text, selectedFile.name);
      setMapData(data);
      setTopic(data.topic);
      navigate('/mindmaps/editor', { state: { mapData: data, category: category || 'General' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process file. Please try again.');
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
        category: category || 'General',
        data: mapData,
        authorUid: user.uid,
        createdAt: Timestamp.now(),
      });
      navigate('/mindmaps');
    } catch (e) {
      setError('Failed to save. Please try again.');
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setSelectedFile(f);
  };

  const clearFile = () => {
    setSelectedFile(null);
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
                          {(selectedFile.size / 1024).toFixed(1)} KB · Ready to generate
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
                          PDF, Word (.docx), PowerPoint (.pptx), or plain text
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED}
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
            <span className="text-sm font-medium">{error}</span>
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
              {isUploading ? 'Reading your file...' : 'Building your mind map...'}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {isUploading ? 'Extracting text content' : 'AI is analyzing and structuring concepts'}
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
