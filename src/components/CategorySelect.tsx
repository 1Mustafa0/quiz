import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Tag, X, ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  sourceType?: 'quiz' | 'mindmap' | 'all';
  placeholder?: string;
}

const PRESET_CATEGORIES = [
  'علوم', 'رياضيات', 'تاريخ', 'جغرافيا', 'لغة عربية', 'لغة إنجليزية',
  'أحياء', 'كيمياء', 'فيزياء', 'دين', 'برمجة', 'فنون', 'اقتصاد',
  'فلسفة', 'أدب', 'طب', 'قانون', 'هندسة', 'General',
];

const CategorySelect: React.FC<Props> = ({ value, onChange, sourceType = 'all', placeholder = 'اختر أو اكتب تصنيفاً...' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const cats = new Set<string>();
      try {
        if (sourceType !== 'mindmap') {
          const snap = await getDocs(collection(db, 'quizzes'));
          snap.forEach(d => { if (d.data().category) cats.add(d.data().category); });
        }
        if (sourceType !== 'quiz') {
          const snap = await getDocs(collection(db, 'mindmaps'));
          snap.forEach(d => { if (d.data().category) cats.add(d.data().category); });
        }
      } catch {}
      setDbCategories(Array.from(cats));
    };
    fetch();
  }, [sourceType]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allCategories = Array.from(new Set([...PRESET_CATEGORIES, ...dbCategories]));
  const filtered = allCategories.filter(c =>
    c.toLowerCase().includes(search.toLowerCase()) && c !== value
  );

  const select = (cat: string) => {
    onChange(cat);
    setSearch('');
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Tag className="w-4 h-4 text-gray-400 dark:text-slate-400 flex-shrink-0 mr-2" />
        {value ? (
          <div className="flex items-center flex-1 gap-2 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold truncate">
              {value}
            </span>
            <button onClick={clear} className="p-0.5 text-gray-400 hover:text-red-500 rounded flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-slate-400 text-sm truncate">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-700">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) { select(search.trim()); }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="ابحث أو أضف تصنيفاً جديداً..."
              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {search.trim() && !allCategories.some(c => c.toLowerCase() === search.toLowerCase()) && (
              <button
                onClick={() => select(search.trim())}
                className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-2 font-medium"
              >
                <Tag className="w-3.5 h-3.5" />
                إضافة "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !search.trim() && (
              <p className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500 text-center">لا توجد تصنيفات أخرى</p>
            )}
            {filtered.map(cat => (
              <button
                key={cat}
                onClick={() => select(cat)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySelect;
