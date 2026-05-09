import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Crown, Zap, FileText, Infinity } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'quiz_limit' | 'file_size';
}

const REASONS = {
  quiz_limit: {
    icon: Infinity,
    title: 'وصلت للحد الأقصى المجاني',
    desc: 'المستخدمون المجانيون يمكنهم إنشاء 3 كويزات فقط. ترقّ إلى Pro للحصول على كويزات غير محدودة.',
    color: 'from-violet-600 to-purple-600',
  },
  file_size: {
    icon: FileText,
    title: 'الملف أكبر من الحد المسموح',
    desc: 'المستخدمون المجانيون يمكنهم رفع ملفات حتى 5 ميجابايت. ترقّ إلى Pro لرفع ملفات أكبر بدون قيود.',
    color: 'from-orange-500 to-amber-500',
  },
};

const PERKS = [
  { icon: Infinity, label: 'كويزات غير محدودة' },
  { icon: FileText, label: 'رفع ملفات بدون حد للحجم' },
  { icon: Zap, label: 'أولوية في معالجة الذكاء الاصطناعي' },
  { icon: Crown, label: 'شارة Pro على ملفك الشخصي' },
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  const config = REASONS[reason];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`bg-gradient-to-br ${config.color} p-8 text-white text-center`}>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
              <p className="text-white/80 text-sm leading-relaxed">{config.desc}</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-3">
                {PERKS.map(({ icon: PerkIcon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <PerkIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">{label}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/pricing"
                onClick={onClose}
                className="block w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-2xl text-center transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02]"
              >
                <Crown className="inline w-4 h-4 mr-2 -mt-0.5" />
                ترقّ إلى Pro الآن
              </Link>

              <button
                onClick={onClose}
                className="block w-full py-3 text-gray-500 dark:text-slate-400 text-sm hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
              >
                ربما لاحقاً
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;
