const getAllApiKeys = (): string[] => {
  // Security rule: do not read secrets from the browser bundle.
  // Secret keys must be used only in server-side code and loaded from .env.local / server environment.
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    return [];
  }

  const keys: string[] = [];
  const invalid = new Set(['', 'MY_GEMINI_API_KEY', 'undefined', 'null']);

  const addKey = (k: string | undefined) => {
    if (k && !invalid.has(k.trim()) && !keys.includes(k.trim())) keys.push(k.trim());
  };

  const readProcessEnv = (name: string): string | undefined => {
    if (typeof process === 'undefined') return undefined;
    return (process as any).env?.[name];
  };

  // Keys must be read in backend/server only.
  addKey(readProcessEnv('GEMINI_API_KEY'));
  addKey(readProcessEnv('GOOGLE_API_KEY'));

  for (let i = 1; i <= 10; i++) {
    addKey(readProcessEnv(`GEMINI_API_KEY_${i}`));
  }

  const multi = readProcessEnv('GEMINI_API_KEYS') || '';
  if (multi) {
    multi.split(',').forEach((k: string) => addKey(k.trim()));
  }

  const numericMulti = readProcessEnv('NUMERIC_SECRET_KEYS') || '';
  if (numericMulti) {
    numericMulti.split(',').forEach((k: string) => addKey(k.trim()));
  }

  return keys;
};

let currentIndex = 0;

export const getNextApiKey = (): string => {
  const keys = getAllApiKeys();
  if (keys.length === 0) return '';
  return keys[currentIndex % keys.length];
};

export const rotateToNextKey = (): string => {
  const keys = getAllApiKeys();
  if (keys.length === 0) return '';
  currentIndex = (currentIndex + 1) % keys.length;
  return keys[currentIndex];
};

export const getKeyCount = (): number => getAllApiKeys().length;

export const getKeySummary = (): { index: number; total: number; prefix: string } => {
  const keys = getAllApiKeys();
  const idx = currentIndex % Math.max(keys.length, 1);
  const key = keys[idx] || '';
  return {
    index: idx + 1,
    total: keys.length,
    prefix: key ? key.substring(0, 8) + '...' : 'none',
  };
};
