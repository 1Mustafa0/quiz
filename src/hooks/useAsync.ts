import { useState, useCallback } from 'react';

interface UseLoadingState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface UseLoadingReturn extends UseLoadingState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: boolean) => void;
  reset: () => void;
  execute: <T,>(fn: () => Promise<T>) => Promise<T | null>;
}

export const useLoading = (): UseLoadingReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  const execute = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(false);

        const result = await fn();
        setSuccess(true);
        setLoading(false);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        setError(message);
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    loading,
    error,
    success,
    setLoading,
    setError,
    setSuccess,
    reset,
    execute,
  };
};

// Hook for pagination
interface UsePaginationOptions {
  pageSize?: number;
  initialPage?: number;
}

interface UsePaginationReturn<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setItems: (items: T[]) => void;
}

export const usePagination = <T,>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> => {
  const { pageSize = 10, initialPage = 1 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [displayItems, setDisplayItems] = useState(items);

  const totalPages = Math.ceil(displayItems.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = displayItems.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  return {
    items: paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems: displayItems.length,
    goToPage,
    nextPage,
    prevPage,
    setItems: setDisplayItems,
  };
};

// Hook for form state management
interface FormState {
  [key: string]: any;
}

interface UseFormReturn<T extends FormState> {
  values: T;
  errors: Partial<T>;
  touched: Partial<Record<keyof T, boolean>>;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldError: (field: keyof T, error: string | null) => void;
  setFieldTouched: (field: keyof T, touched: boolean) => void;
  reset: () => void;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<T>) => void;
}

export const useForm = <T extends FormState>(initialValues: T): UseFormReturn<T> => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean) => {
    setTouched(prev => ({
      ...prev,
      [field]: isTouched,
    }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    reset,
    setValues: (vals: Partial<T>) => setValues(prev => ({ ...prev, ...vals })),
    setErrors: (errs: Partial<T>) => setErrors(errs),
  };
};
