import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../firebaseAuth';
import { isOwnerUser } from '../utils/owner';
import { reportOwnerAiFailure } from '../utils/ownerAiMonitor';

interface Props {
  children: React.ReactNode;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    
    // Track error count for analytics
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
    
    void reportOwnerAiFailure({
      source: 'react',
      operation: 'error-boundary',
      severity: 'critical',
      message: error.message,
      stack: error.stack,
      details: { componentStack: errorInfo.componentStack },
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.resetError();
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const showOwnerDetails = isOwnerUser(auth.currentUser);

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full"
          >
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 text-center space-y-6 border border-gray-100 dark:border-slate-700">
              {/* Error Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto"
              >
                <AlertCircle className="w-10 h-10" />
              </motion.div>
              
              {/* Error Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="space-y-2"
              >
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">حدث خطأ غير متوقع</h1>
                <p className="text-gray-600 dark:text-slate-400 text-sm">
                  نعتذر عن هذا الخلل. يمكنك محاولة إعادة تحميل الصفحة أو العودة للرئيسية.
                </p>
              </motion.div>

              {/* Error Details (Owner only) */}
              {this.state.error && showOwnerDetails && (
                <motion.div
                  initial={{ opacity: 0, maxHeight: 0 }}
                  animate={{ opacity: 1, maxHeight: 200 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="mt-4 p-3 bg-gray-50 dark:bg-slate-900 rounded-xl text-left overflow-auto max-h-40"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                    {this.state.error.message}
                  </p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className="flex flex-col gap-3 pt-4"
              >
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/50 active:scale-95 transform duration-150"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  إعادة تحميل الصفحة
                </button>
                <a
                  href="/"
                  className="w-full flex items-center justify-center px-6 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-600 transition-all active:scale-95 transform duration-150"
                >
                  <Home className="w-5 h-5 mr-2" />
                  العودة للرئيسية
                </a>
              </motion.div>

              {/* Error Count */}
              {this.state.errorCount > 1 && (
                <p className="text-xs text-gray-500 dark:text-slate-400 pt-2">
                  حدث {this.state.errorCount} أخطاء. إذا استمرت المشكلة، يرجى التواصل مع الدعم.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
