import React from 'react';
import { motion } from 'motion/react';

export const Skeleton: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
}) => {
  return (
    <motion.div
      className={`${width} ${height} bg-gray-200 dark:bg-slate-700 rounded-md ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
          <Skeleton height="h-6" width="w-3/4" />
          <Skeleton height="h-4" width="w-full" />
          <Skeleton height="h-4" width="w-5/6" />
          <div className="flex gap-2">
            <Skeleton height="h-10" width="w-24" className="rounded" />
            <Skeleton height="h-10" width="w-24" className="rounded" />
          </div>
        </div>
      ))}
    </>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg">
          <Skeleton height="h-12" width="w-12" className="rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton height="h-4" width="w-3/4" />
            <Skeleton height="h-3" width="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <Skeleton height="h-6" width="w-1/3" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton height="h-4" width="w-1/4" />
            <Skeleton height="h-10" width="w-full" className="rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton height="h-10" width="w-24" className="rounded" />
        <Skeleton height="h-10" width="w-24" className="rounded" />
      </div>
    </div>
  );
};
