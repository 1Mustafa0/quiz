import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const define: Record<string, string> = {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || ''),
    'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || ''),
    'process.env.GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || ''),
    'import.meta.env.VITE_GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || ''),
  };

  // Support GEMINI_API_KEY_1 ... GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const k = `GEMINI_API_KEY_${i}`;
    const val = env[k] || process.env[k] || '';
    define[`process.env.${k}`] = JSON.stringify(val);
    define[`import.meta.env.VITE_${k}`] = JSON.stringify(val);
  }

  // Support numeric-named secrets "1" ... "10" (Replit auto-capture format)
  for (let i = 1; i <= 10; i++) {
    const val = env[String(i)] || process.env[String(i)] || '';
    define[`process.env["${i}"]`] = JSON.stringify(val);
    define[`import.meta.env.VITE_SECRET_${i}`] = JSON.stringify(val);
  }

  return {
    plugins: [react(), tailwindcss()],
    define,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      allowedHosts: true,
      host: '0.0.0.0',
      port: 5000,
    },
  };
});
