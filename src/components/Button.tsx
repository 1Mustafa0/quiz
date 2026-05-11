import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const buttonVariants = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 focus:ring-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/50',
  secondary:
    'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 focus:ring-gray-500 border border-gray-200 dark:border-slate-600',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-100 dark:shadow-red-900/50',
  success:
    'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-lg shadow-green-100 dark:shadow-green-900/50',
  ghost:
    'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 focus:ring-gray-500',
};

const sizeVariants = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded-lg font-semibold
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed
          ${buttonVariants[variant]}
          ${sizeVariants[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className || ''}
        `}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {icon && !loading && <span>{icon}</span>}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

interface ButtonGroupProps {
  children: React.ReactNode;
  vertical?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, vertical }) => {
  return (
    <div className={`flex gap-3 ${vertical ? 'flex-col' : 'flex-row'}`}>
      {children}
    </div>
  );
};
