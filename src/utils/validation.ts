// Form validation utilities
export interface ValidationRule {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  custom?: (value: any) => boolean | string;
  message?: string;
}

export interface ValidationRules {
  [field: string]: ValidationRule | ValidationRule[];
}

export interface ValidationErrors {
  [field: string]: string;
}

export const validateField = (
  value: any,
  rules: ValidationRule | ValidationRule[]
): string | null => {
  const ruleArray = Array.isArray(rules) ? rules : [rules];

  for (const rule of ruleArray) {
    // Check required
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return rule.message || 'هذا الحقل مطلوب';
    }

    // Check min length
    if (rule.minLength && value && value.length < rule.minLength) {
      return rule.message || `يجب أن يكون الحد الأدنى ${rule.minLength} أحرف`;
    }

    // Check max length
    if (rule.maxLength && value && value.length > rule.maxLength) {
      return rule.message || `يجب ألا يتجاوز ${rule.maxLength} أحرف`;
    }

    // Check pattern
    if (rule.pattern && value && !rule.pattern.test(value)) {
      return rule.message || 'الصيغة غير صحيحة';
    }

    // Check custom validation
    if (rule.custom) {
      const result = rule.custom(value);
      if (result !== true) {
        return rule.message || (typeof result === 'string' ? result : 'القيمة غير صحيحة');
      }
    }
  }

  return null;
};

export const validateForm = (
  formData: { [key: string]: any },
  rules: ValidationRules
): ValidationErrors => {
  const errors: ValidationErrors = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const error = validateField(formData[field], fieldRules);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
};

// Common validation rules
export const emailRule: ValidationRule = {
  required: true,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  message: 'يرجى إدخال بريد إلكتروني صحيح',
};

export const passwordRule: ValidationRule = {
  required: true,
  minLength: 6,
  message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
};

export const nameRule: ValidationRule = {
  required: true,
  minLength: 2,
  maxLength: 50,
  pattern: /^[a-zA-Z\u0600-\u06FF\s'-]+$/,
  message: 'الاسم غير صحيح',
};

export const requiredRule: ValidationRule = {
  required: true,
  message: 'هذا الحقل مطلوب',
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
