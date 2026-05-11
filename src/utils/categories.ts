const EMPTY_CATEGORY_ALIASES = ['general', 'عام', 'misc', 'other', 'متنوع', 'uncategorized'];

const CATEGORY_TONES = [
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
  'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-200',
  'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-200',
  'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200',
];

export const normalizeForCompare = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');

const titleCase = (value: string) =>
  /[a-z]/i.test(value)
    ? value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;

export const normalizeCategory = (value?: string | null) => {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';

  const comparable = normalizeForCompare(raw);
  if (EMPTY_CATEGORY_ALIASES.some((alias) => normalizeForCompare(alias) === comparable)) {
    return '';
  }

  return titleCase(raw);
};

const hashCategory = (category: string) => {
  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = (hash * 31 + category.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getCategoryTone = (value?: string | null) => {
  const normalized = normalizeCategory(value);
  if (!normalized) return CATEGORY_TONES[CATEGORY_TONES.length - 1];
  return CATEGORY_TONES[hashCategory(normalized) % CATEGORY_TONES.length];
};

export const sortCategories = (categories: Array<string | null | undefined>) => {
  const unique = Array.from(new Set(categories.map(normalizeCategory).filter(Boolean)));
  return unique.sort((a, b) => a.localeCompare(b, 'ar'));
};

export const categoryMatchesSearch = (category: string, search: string) => {
  const needle = normalizeForCompare(search);
  if (!needle) return true;
  return normalizeForCompare(category).includes(needle);
};
