import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, X } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string | null;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, userName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-2xl max-w-md w-full text-center space-y-8 border border-gray-100 relative overflow-hidden"
          >
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-50 rounded-full blur-3xl opacity-50" />

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner transform rotate-3">
              <Sparkles className="w-12 h-12" />
            </div>

            <div className="space-y-4 relative">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                أهلاً بك يا {userName?.split(' ')[0] || 'بطل'}! 👋
              </h2>
              <div className="space-y-2">
                <p className="text-xl text-gray-600 leading-relaxed">
                  سعداء جداً بانضمامك إلينا في رحلة التعلم الذكي.
                </p>
                <p className="text-2xl text-indigo-600 font-bold animate-bounce mt-4">
                  صل على النبي بقا ❤️
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onClose}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
              >
                ابدأ رحلتك الآن
              </button>
            </div>

            <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم إنشاء حسابك بنجاح</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;
