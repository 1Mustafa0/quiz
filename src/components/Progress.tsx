import React from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  progress: number; // 0-100
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
  height?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'primary',
  animated = true,
  height = 'h-2',
}) => {
  const variants = {
    primary: 'bg-indigo-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  return (
    <div className={`w-full ${height} bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
      <motion.div
        className={`${height} ${variants[variant]} transition-all duration-300 rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        style={{
          backgroundImage: animated
            ? 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)'
            : undefined,
          backgroundSize: animated ? '40px 40px' : undefined,
          animation: animated ? 'slide 2s linear infinite' : undefined,
        }}
      />
    </div>
  );
};

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'indigo' | 'white' | 'gray';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'indigo' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  const colorClasses = {
    indigo: 'border-indigo-600 dark:border-indigo-400',
    white: 'border-white',
    gray: 'border-gray-600 dark:border-gray-400',
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`
        ${sizeClasses[size]} ${colorClasses[color]}
        border-4 border-t-transparent border-r-transparent rounded-full
      `}
    />
  );
};

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  message = 'جاري التحميل...',
  fullScreen = false,
}) => {
  if (!loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`
        flex items-center justify-center gap-4
        ${fullScreen ? 'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm' : 'absolute inset-0 bg-white/50 dark:bg-slate-800/50'}
      `}
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        {message && <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{message}</p>}
      </div>
    </motion.div>
  );
};

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 100,
  strokeWidth = 4,
  variant = 'primary',
}) => {
  const colorMap = {
    primary: '#4f46e5',
    success: '#16a34a',
    warning: '#ca8a04',
    danger: '#dc2626',
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
        className="dark:stroke-slate-700"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colorMap[variant]}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeLinecap="round"
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dy="0.3em"
        className="text-2xl font-bold"
        fill={colorMap[variant]}
      >
        {progress}%
      </text>
    </svg>
  );
};
