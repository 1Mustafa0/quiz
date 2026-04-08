import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateMindMap, MindMapData } from '../services/mindmapService';
import MindMapCanvas from '../components/MindMapCanvas';
import CategorySelect from '../components/CategorySelect';
import { Sparkles, Save, Loader2, AlertCircle, GitBranch, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MindMapBuilder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const [mapData, setMapData] = useState<MindMapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setMapData(null);
    try {
      const data = await generateMindMap(topic.trim());
      setMapData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ. حاول مرة أخرى.');
    } finally {
      setIsGenerating(false);
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
      setError('فشل حفظ الخريطة. حاول مرة أخرى.');
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            بناء خريطة ذهنية
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">أدخل موضوعاً وسيقوم الذكاء الاصطناعي ببناء خريطة ذهنية شاملة</p>
        </div>
        {mapData && (
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              تصدير SVG
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              حفظ الخريطة
            </button>
          </div>
        )}
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">الموضوع</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="مثال: الثورة الصناعية، الخلية الحيوانية، Python programming..."
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">التصنيف</label>
            <CategorySelect value={category} onChange={setCategory} sourceType="mindmap" />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              يتم توليد الخريطة الذهنية...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              توليد الخريطة الذهنية بالذكاء الاصطناعي
            </>
          )}
        </button>
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

      {/* Generating Skeleton */}
      {isGenerating && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 flex flex-col items-center justify-center gap-4" style={{ height: '420px' }}>
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDuration: '1.5s' }} />
            <GitBranch className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-gray-500 dark:text-slate-400 font-medium text-center">
            يحلل الذكاء الاصطناعي الموضوع ويبني الخريطة الذهنية...<br />
            <span className="text-sm text-gray-400 dark:text-slate-500">قد يستغرق ذلك لحظات</span>
          </p>
        </div>
      )}

      {/* Mind Map Display */}
      <AnimatePresence>
        {mapData && !isGenerating && (
          <motion.div
            id="mindmap-export"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{mapData.topic}</h2>
              <span className="text-sm text-gray-500 dark:text-slate-400">{mapData.branches.length} فروع رئيسية</span>
            </div>
            <MindMapCanvas data={mapData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MindMapBuilder;
