import React, { createContext, useContext, useCallback } from 'react';
import { ToastContainer, useToast } from '../components/Toast';

interface ToastContextType {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();

  const value: ToastContextType = {
    success: useCallback((message, duration) => toast.success(message, duration), [toast]),
    error: useCallback((message, duration) => toast.error(message, duration), [toast]),
    warning: useCallback((message, duration) => toast.warning(message, duration), [toast]),
    info: useCallback((message, duration) => toast.info(message, duration), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      {children}
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
};
