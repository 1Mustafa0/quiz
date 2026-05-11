import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  success?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
  required?: boolean;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    { label, error, success, helperText, icon, required, className, ...props },
    ref
  ) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
          <input
            ref={ref}
            className={`
              w-full px-4 py-3 ${icon ? 'pl-12' : ''} rounded-lg border-2 transition-all duration-200
              text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600
              bg-white dark:bg-slate-800
              focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
              ${
                error
                  ? 'border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
                  : success
                    ? 'border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500 focus:ring-green-500 dark:focus:ring-green-500'
                    : 'border-gray-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-500'
              }
              ${className || ''}
            `}
            {...props}
          />
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400"
            >
              <Check className="w-5 h-5" />
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-red-600 dark:text-red-400"
            >
              <AlertCircle className="w-5 h-5" />
            </motion.div>
          )}
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, required, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
            text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600
            bg-white dark:bg-slate-800 resize-none
            focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
            ${
              error
                ? 'border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
                : 'border-gray-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-500'
            }
            ${className || ''}
          `}
          {...props}
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  options: Array<{ value: string | number; label: string }>;
  required?: boolean;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helperText, options, required, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
            text-gray-900 dark:text-white
            bg-white dark:bg-slate-800
            focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
            ${
              error
                ? 'border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
                : 'border-gray-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-500'
            }
            ${className || ''}
          `}
          {...props}
        >
          <option value="">اختر...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';
