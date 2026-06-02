export type PlanId = 'free' | 'starter' | 'pro' | 'premium';

export interface PricingPlan {
  id: PlanId;
  name: string;
  price: {
    usdMonthly: number;
    egpMonthly: number;
  };
  targetUser: string;
  recommended: boolean;
  valueProposition: string;
  limits: {
    aiQuizzesPerDay: number | 'unlimited';
    aiQuizzesPerMonth: number | 'unlimited';
    ocrFilesPerDay: number | 'unlimited';
    ocrFilesPerMonth: number | 'unlimited';
    maxQuestionsPerQuiz: number | 'unlimited';
    maxFileSizeMB: number | 'unlimited';
    savedQuizzes: number | 'unlimited';
    pdfExportsPerMonth: number | 'unlimited';
    mindMapsPerMonth: number | 'unlimited';
    fairUsagePolicy?: string;
  };
  features: {
    textInput: boolean;
    fileUpload: boolean;
    ocr: boolean;
    textCleaning: boolean;
    editableQuizzes: boolean;
    quizTakingMode: boolean;
    quizHistory: 'limited' | 'standard' | 'full' | 'unlimited';
    pdfExport: boolean;
    mindMaps: boolean;
    analytics: 'basic' | 'standard' | 'detailed' | 'advanced';
  };
  highlights: string[];
}

export const adminAccess = {
  enabled: true,
  role: 'admin',
  price: 0,
  limits: 'unlimited',
  description: 'Platform owner/admin always has full free access to every feature with no limits or restrictions.',
} as const;

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: {
      usdMonthly: 0,
      egpMonthly: 0,
    },
    targetUser: 'Students and casual users testing AI quiz generation',
    recommended: false,
    valueProposition: 'A useful free entry plan for trying the core quiz workflow with clear cost-safe limits.',
    limits: {
      aiQuizzesPerDay: 3,
      aiQuizzesPerMonth: 30,
      ocrFilesPerDay: 2,
      ocrFilesPerMonth: 20,
      maxQuestionsPerQuiz: 10,
      maxFileSizeMB: 5,
      savedQuizzes: 10,
      pdfExportsPerMonth: 5,
      mindMapsPerMonth: 0,
    },
    features: {
      textInput: true,
      fileUpload: true,
      ocr: true,
      textCleaning: true,
      editableQuizzes: true,
      quizTakingMode: true,
      quizHistory: 'limited',
      pdfExport: true,
      mindMaps: false,
      analytics: 'basic',
    },
    highlights: [
      'AI quiz generation from text and files',
      'Basic OCR for scanned content',
      'Editable quizzes and scoring',
      'Limited PDF export',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: {
      usdMonthly: 4.99,
      egpMonthly: 249,
    },
    targetUser: 'Active students, tutors, and individual learners',
    recommended: false,
    valueProposition: 'Affordable regular usage for learners who create quizzes weekly or daily.',
    limits: {
      aiQuizzesPerDay: 15,
      aiQuizzesPerMonth: 300,
      ocrFilesPerDay: 10,
      ocrFilesPerMonth: 150,
      maxQuestionsPerQuiz: 20,
      maxFileSizeMB: 15,
      savedQuizzes: 100,
      pdfExportsPerMonth: 50,
      mindMapsPerMonth: 0,
    },
    features: {
      textInput: true,
      fileUpload: true,
      ocr: true,
      textCleaning: true,
      editableQuizzes: true,
      quizTakingMode: true,
      quizHistory: 'standard',
      pdfExport: true,
      mindMaps: false,
      analytics: 'standard',
    },
    highlights: [
      'Higher quiz and OCR limits',
      'Larger uploads',
      'More saved quizzes',
      'Standard history and results',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: {
      usdMonthly: 9.99,
      egpMonthly: 499,
    },
    targetUser: 'Teachers, content creators, trainers, and serious learners',
    recommended: true,
    valueProposition: 'Best value for frequent educational content creation and the main plan for most paid users.',
    limits: {
      aiQuizzesPerDay: 50,
      aiQuizzesPerMonth: 1200,
      ocrFilesPerDay: 30,
      ocrFilesPerMonth: 600,
      maxQuestionsPerQuiz: 30,
      maxFileSizeMB: 25,
      savedQuizzes: 1000,
      pdfExportsPerMonth: 300,
      mindMapsPerMonth: 100,
    },
    features: {
      textInput: true,
      fileUpload: true,
      ocr: true,
      textCleaning: true,
      editableQuizzes: true,
      quizTakingMode: true,
      quizHistory: 'full',
      pdfExport: true,
      mindMaps: true,
      analytics: 'detailed',
    },
    highlights: [
      'Full 30-question quizzes',
      'Mind map generation',
      'Detailed performance analytics',
      'High daily AI allowance',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: {
      usdMonthly: 19.99,
      egpMonthly: 999,
    },
    targetUser: 'Power users, training centers, small teams, and professional educators',
    recommended: false,
    valueProposition: 'Maximum usage and advanced learning tools for users who depend on the platform every day.',
    limits: {
      aiQuizzesPerDay: 150,
      aiQuizzesPerMonth: 4000,
      ocrFilesPerDay: 100,
      ocrFilesPerMonth: 2000,
      maxQuestionsPerQuiz: 30,
      maxFileSizeMB: 50,
      savedQuizzes: 'unlimited',
      pdfExportsPerMonth: 'unlimited',
      mindMapsPerMonth: 500,
      fairUsagePolicy: 'Very high usage included. Excessive automated or abusive usage may be rate-limited.',
    },
    features: {
      textInput: true,
      fileUpload: true,
      ocr: true,
      textCleaning: true,
      editableQuizzes: true,
      quizTakingMode: true,
      quizHistory: 'unlimited',
      pdfExport: true,
      mindMaps: true,
      analytics: 'advanced',
    },
    highlights: [
      'Advanced analytics',
      'High OCR and file limits',
      'Unlimited quiz history',
      'Fair-usage high volume access',
    ],
  },
];

export const getPlanById = (planId: string | null | undefined) =>
  pricingPlans.find(plan => plan.id === planId) || pricingPlans[0];
