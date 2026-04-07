import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const define: Record<string, string> = {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'process.env.GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || ''),
    'import.meta.env.VITE_GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || ''),
  };

  for (let i = 1; i <= 10; i++) {
    const envKey = `GEMINI_API_KEY_${i}`;
    const val = env[envKey] || process.env[envKey] || '';
    define[`process.env.${envKey}`] = JSON.stringify(val);
    define[`import.meta.env.VITE_${envKey}`] = JSON.stringify(val);
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
