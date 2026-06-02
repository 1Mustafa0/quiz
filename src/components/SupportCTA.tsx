import React from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface SupportCTAProps {
  variant?: 'compact' | 'success' | 'inline';
  message?: string;
}

const SupportCTA: React.FC<SupportCTAProps> = ({
  variant = 'compact',
  message = 'If this helped you study, you can support the project so it keeps running.',
}) => {
  if (variant === 'inline') {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-center shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{message}</p>
        <Link
          to="/support"
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <HeartHandshake className="h-4 w-4" />
          Support Button
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-slate-800 ${
        variant === 'success' ? 'p-5' : 'p-6'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Support</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        <Link
          to="/support"
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 dark:shadow-none"
        >
          <HeartHandshake className="h-4 w-4" />
          Support Button
        </Link>
      </div>
    </motion.div>
  );
};

export default SupportCTA;
