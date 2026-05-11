import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronDown, Search, Tag, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import {
  categoryMatchesSearch,
  getCategoryTone,
  normalizeCategory,
  normalizeForCompare,
  sortCategories,
} from '../utils/categories';

interface Props {
  value: string;
  onChange: (val: string) => void;
  sourceType?: 'quiz' | 'mindmap' | 'all';
  placeholder?: string;
}

const CategorySelect: React.FC<Props> = ({
  value,
  onChange,
  sourceType = 'all',
  placeholder = 'اكتب تصنيفاً اختيارياً...',
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      if (!user) {
        setDbCategories([]);
        return;
      }

      setLoadingCategories(true);
      const cats = new Set<string>();

      const readCategories = async (collectionName: 'quizzes' | 'mindmaps') => {
        const snap = await getDocs(query(collection(db, collectionName), where('authorUid', '==', user.uid)));
        snap.forEach((docSnap) => {
          const category = normalizeCategory(docSnap.data().category);
          if (category) cats.add(category);
        });
      };

      try {
        const reads: Array<Promise<void>> = [];
        if (sourceType !== 'mindmap') reads.push(readCategories('quizzes'));
        if (sourceType !== 'quiz') reads.push(readCategories('mindmaps'));
        await Promise.all(reads);
      } catch (error) {
        console.warn('[CategorySelect] failed to load categories:', error);
      } finally {
        if (!cancelled) {
          setDbCategories(sortCategories(Array.from(cats)));
          setLoadingCategories(false);
        }
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, [sourceType, user]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCategory = value ? normalizeCategory(value) : '';
  const allCategories = useMemo(
    () => sortCategories(dbCategories),
    [dbCategories]
  );

  const filtered = allCategories.filter((category) =>
    category !== selectedCategory && categoryMatchesSearch(category, search)
  );

  const normalizedSearch = search.trim() ? normalizeCategory(search) : '';
  const canCreate =
    Boolean(search.trim()) &&
    !allCategories.some((category) => normalizeForCompare(category) === normalizeForCompare(normalizedSearch));

  const select = (category: string) => {
    onChange(normalizeCategory(category));
    setSearch('');
    setOpen(false);
  };

  const clear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setOpen((current) => !current);
        }}
      >
        <Tag className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-slate-400" />
        {selectedCategory ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryTone(selectedCategory)}`}
              dir="auto"
            >
              <span className="truncate">{selectedCategory}</span>
            </span>
            <button
              type="button"
              onClick={clear}
              className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500"
              aria-label="Clear category"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="flex-1 truncate text-sm text-gray-400 dark:text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className={`ml-1 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="border-b border-gray-100 p-2 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && search.trim()) select(search.trim());
                  if (event.key === 'Escape') setOpen(false);
                }}
                placeholder="ابحث أو أضف تصنيفاً جديداً..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {canCreate && (
              <button
                type="button"
                onClick={() => select(search.trim())}
                className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
              >
                <Tag className="h-4 w-4" />
                <span dir="auto">إضافة "{search.trim()}"</span>
              </button>
            )}

            {loadingCategories && (
              <p className="px-3 py-2 text-center text-xs text-gray-400 dark:text-slate-500">جار تحميل تصنيفاتك...</p>
            )}

            {filtered.length === 0 && !canCreate && !loadingCategories && (
              <p className="px-3 py-3 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد تصنيفات مطابقة</p>
            )}

            {filtered.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => select(category)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span className="truncate" dir="auto">{category}</span>
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${getCategoryTone(category).split(' ')[0]}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySelect;
