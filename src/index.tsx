import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import { installOwnerAiGlobalMonitor } from './utils/ownerAiMonitor';
import './index.css';

installOwnerAiGlobalMonitor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
