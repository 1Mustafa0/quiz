import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { MindMapData } from '../services/mindmapService';
import MindMapCanvas from '../components/MindMapCanvas';
import CategorySelect from '../components/CategorySelect';
import { Save, Download, ArrowLeft, Loader2, Brain, Check } from 'lucide-react';

const MindMapEditor: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { mapData?: MindMapData; category?: string; docId?: string } | null;

  const [mapData, setMapData] = useState<MindMapData | null>(null);
  const [category, setCategory] = useState(state?.category || 'General');
  const [docId, setDocId] = useState<string | null>(state?.docId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.mapData) {
      setMapData(state.mapData);
    } else {
      navigate('/mindmaps/builder', { replace: true });
    }
  }, []);

  const handleSave = async () => {
    if (!user || !mapData) return;
    setIsSaving(true);
    setError(null);
    try {
      if (docId) {
        await updateDoc(doc(db, 'mindmaps', docId), {
          topic: mapData.topic,
          title: mapData.topic,
          category,
          data: mapData,
          updatedAt: Timestamp.now(),
        });
      } else {
        const ref = await addDoc(collection(db, 'mindmaps'), {
          topic: mapData.topic,
          title: mapData.topic,
          category,
          data: mapData,
          authorUid: user.uid,
          createdAt: Timestamp.now(),
        });
        setDocId(ref.id);
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!mapData) return;
    const svg = document.querySelector('.mindmap-export-target svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.topic || 'mindmap'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mapData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div
      className="-mt-6 sm:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 flex flex-col"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Top Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 flex-wrap">
        {/* Back */}
        <button
          onClick={() => navigate('/mindmaps/builder')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-slate-700" />

        {/* Map Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {mapData.topic}
          </span>
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
            · {mapData.branches.length} branches
          </span>
        </div>

        {/* Category */}
        <div className="w-40 flex-shrink-0">
          <CategorySelect value={category} onChange={setCategory} sourceType="mindmap" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all shadow-sm disabled:opacity-60 ${
              savedOk
                ? 'bg-emerald-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedOk ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savedOk ? 'Saved!' : 'Save'}
          </button>
        </div>

        {error && (
          <p className="w-full text-xs text-red-500 px-1">{error}</p>
        )}
      </div>

      {/* Full-Screen Canvas */}
      <div className="flex-1 min-h-0 mindmap-export-target">
        <MindMapCanvas
          data={mapData}
          onDataChange={setMapData}
          height="100%"
        />
      </div>
    </div>
  );
};

export default MindMapEditor;
