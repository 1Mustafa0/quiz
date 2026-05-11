import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { GitBranch, Plus, Trash2, Search, Filter, Eye, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';
import MindMapCanvas from '../components/MindMapCanvas';
import type { MindMapData, MindMapBranch } from '../services/mindmapService';
import { getCategoryTone, normalizeCategory, sortCategories } from '../utils/categories';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

const MiniMapPreview: React.FC<{ branches: MindMapBranch[] }> = ({ branches }) => {
  const N = Math.min(branches.length, 8);
  const cx = 80, cy = 80, r1 = 48, r2 = 70;
  return (
    <svg width={160} height={160} viewBox="0 0 160 160" className="opacity-90">
      {branches.slice(0, N).map((branch, i) => {
        const angle = (2 * Math.PI * i / N) - Math.PI / 2;
        const x1 = cx + Math.cos(angle) * r1;
        const y1 = cy + Math.sin(angle) * r1;
        const color = COLORS[i % COLORS.length];
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x1} y2={y1} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
            <circle cx={x1} cy={y1} r={6} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} />
            {branch.children.slice(0, 3).map((_, j) => {
              const M = Math.min(branch.children.length, 3);
              const childAngle = angle + (j - (M - 1) / 2) * 0.35;
              const x2 = cx + Math.cos(childAngle) * r2;
              const y2 = cy + Math.sin(childAngle) * r2;
              return (
                <g key={j}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
                  <circle cx={x2} cy={y2} r={3.5} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1} />
                </g>
              );
            })}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={10} fill="#4f46e5" fillOpacity={0.9} />
    </svg>
  );
};

interface MindMapDoc {
  id: string;
  title: string;
  topic: string;
  category: string;
  data: MindMapData;
  createdAt: any;
}

const MindMapLibrary: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MindMapDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState<MindMapDoc | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'mindmaps'),
      where('authorUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setMaps(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MindMapDoc[]);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const handleDelete = async () => {
    if (!toDelete) return;
    await deleteDoc(doc(db, 'mindmaps', toDelete)).catch(() => {});
    setToDelete(null);
  };

  const categoryCounts = useMemo(() => {
    return maps.reduce<Record<string, number>>((acc, map) => {
      const category = normalizeCategory(map.category);
      if (!category) return acc;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }, [maps]);

  const categories = ['All', ...sortCategories(Object.keys(categoryCounts))];

  const filtered = maps.filter(m => {
    const category = normalizeCategory(m.category);
    const matchSearch = `${m.title || ''} ${category}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'All' || category === filterCat;
    return matchSearch && matchCat;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            خرائطي الذهنية
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">إدارة خرائطك الذهنية المنشأة بالذكاء الاصطناعي</p>
        </div>
        <Link
          to="/mindmaps/builder"
          className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          خريطة جديدة
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث في خرائطك..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="flex-grow px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'All' ? `All categories (${maps.length})` : `${c} (${categoryCounts[c] || 0})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
          <GitBranch className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">لا توجد خرائط</h3>
          <p className="text-gray-500 dark:text-slate-400 mt-2">أنشئ خريطتك الذهنية الأولى الآن</p>
          <Link to="/mindmaps/builder" className="mt-4 inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md transition-all">
            <Plus className="w-4 h-4 mr-2" />
            إنشاء خريطة
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map(map => {
              const mapCategory = normalizeCategory(map.category);

              return (
                <motion.div
                  key={map.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
                >
                {/* Mini Preview */}
                <div className="h-40 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center border-b border-gray-100 dark:border-slate-700 relative overflow-hidden">
                  <MiniMapPreview branches={map.data.branches} />
                </div>

                <div className="p-5 flex-grow space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {mapCategory && (
                        <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryTone(mapCategory)}`} dir="auto">
                          {mapCategory}
                        </span>
                      )}
                      <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-2">{map.title}</h3>
                    </div>
                    <button
                      onClick={() => setToDelete(map.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {map.createdAt?.toDate?.()?.toLocaleDateString?.('ar-EG') || ''}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 space-y-2">
                  <button
                    onClick={() => setPreview(map)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm transition-all"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    عرض الخريطة
                  </button>
                  <button
                    onClick={() => navigate(`/mindmaps/editor/${map.id}`, { state: { mapData: map.data, category: map.category, docId: map.id } })}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 shadow-sm transition-all"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    تحرير الخريطة
                  </button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{preview.title}</h3>
                  {normalizeCategory(preview.category) && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryTone(preview.category)}`} dir="auto">
                      {normalizeCategory(preview.category)}
                    </span>
                  )}
                </div>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-2xl font-bold">✕</button>
              </div>
              <div className="p-4">
                <MindMapCanvas data={preview.data} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="حذف الخريطة؟"
        message="هل أنت متأكد من حذف هذه الخريطة؟ لا يمكن التراجع."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  );
};

export default MindMapLibrary;
