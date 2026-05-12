import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const readEnv = (name: string) => env[name] || process.env[name] || '';
  const collectEnvValues = (pattern: RegExp) => {
    const names = new Set([...Object.keys(env), ...Object.keys(process.env)]);
    return [...names]
      .filter(name => pattern.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(readEnv)
      .filter(Boolean);
  };

  const allGeminiKeys = [
    readEnv('GEMINI_API_KEY'),
    readEnv('GOOGLE_API_KEY'),
    readEnv('GEMINI_API_KEYS'),
    ...collectEnvValues(/^GEMINI_API_KEY_\d+$/),
  ]
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);

  const numericSecretKeys = collectEnvValues(/^\d+$/);

  const define: Record<string, string> = {
    // Only define non-secret environment values here if needed.
  };

  return {
    base: readEnv('VITE_BASE_PATH') || '/',
    plugins: [react(), tailwindcss()],
    define,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Optimize bundle size
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]firestore[\\/]/.test(id) ||
                /[\\/]node_modules[\\/]@firebase[\\/]webchannel-wrapper[\\/]/.test(id)) {
              return 'vendor-firestore';
            }
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]auth[\\/]/.test(id)) {
              return 'vendor-firebase-auth';
            }
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) {
              return 'vendor-firebase-core';
            }
            if (/[\\/]node_modules[\\/](lucide-react|lucide)[\\/]/.test(id)) {
              return 'vendor-icons';
            }
            if (/[\\/]node_modules[\\/]@google[\\/]genai[\\/]/.test(id)) {
              return 'vendor-ai';
            }
            return undefined;
          },
        },
      },
      minify: 'esbuild',
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      hmr: false,
      allowedHosts: true,
      host: '0.0.0.0',
      port: 5000,
    },
  };
});
