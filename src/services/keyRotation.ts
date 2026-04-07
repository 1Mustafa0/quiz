const getAllApiKeys = (): string[] => {
  const keys: string[] = [];
  const invalid = new Set(['', 'MY_GEMINI_API_KEY', 'undefined', 'null']);

  const addKey = (k: string | undefined) => {
    if (k && !invalid.has(k.trim()) && !keys.includes(k.trim())) keys.push(k.trim());
  };

  // Primary key
  addKey(process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY);

  // Indexed keys: GEMINI_API_KEY_1 ... GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    addKey(
      process.env[`GEMINI_API_KEY_${i}`] || (import.meta as any).env?.[`VITE_GEMINI_API_KEY_${i}`]
    );
  }

  // Comma-separated list
  const multi = process.env.GEMINI_API_KEYS || (import.meta as any).env?.VITE_GEMINI_API_KEYS || '';
  if (multi) {
    multi.split(',').forEach((k: string) => addKey(k.trim()));
  }

  // Numeric-named secrets: "1", "2", ... "10" (Replit auto-capture format)
  for (let i = 1; i <= 10; i++) {
    addKey(
      process.env[String(i)] || (import.meta as any).env?.[`VITE_SECRET_${i}`]
    );
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
