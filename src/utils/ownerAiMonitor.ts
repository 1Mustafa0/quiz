import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebaseAuth';
import { app, firebaseConfig } from '../firebaseApp';

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export type OwnerAiSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface OwnerAiFailureReport {
  source: string;
  operation: string;
  message: string;
  severity?: OwnerAiSeverity;
  details?: unknown;
  stack?: string;
  url?: string;
  userAgent?: string;
  user?: {
    uid?: string;
    email?: string | null;
  };
}

const MAX_TEXT_LENGTH = 4000;
const seenReports = new Map<string, number>();

const trimText = (value: unknown, limit = MAX_TEXT_LENGTH): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const normalizeDetails = (details: unknown) => {
  if (details == null) return null;
  try {
    return JSON.parse(trimText(details));
  } catch {
    return trimText(details);
  }
};

const removeUndefinedValues = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(removeUndefinedValues);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefinedValues(entryValue)])
    );
  }
  return value;
};

const dedupeKey = (report: OwnerAiFailureReport) =>
  [report.source, report.operation, report.message, report.url].join('|').slice(0, 500);

const shouldSkipDuplicate = (report: OwnerAiFailureReport) => {
  const key = dedupeKey(report);
  const now = Date.now();
  const last = seenReports.get(key) || 0;
  seenReports.set(key, now);
  return now - last < 60_000;
};

export async function reportOwnerAiFailure(report: OwnerAiFailureReport) {
  if (!report.message || shouldSkipDuplicate(report)) return;

  const currentUser = auth.currentUser;
  const payload = {
    ...(removeUndefinedValues({
    source: report.source,
    operation: report.operation,
    severity: report.severity || 'error',
    message: trimText(report.message, 1200),
    details: normalizeDetails(report.details),
    stack: report.stack ? trimText(report.stack, 3000) : null,
    url: report.url || window.location.href,
    userAgent: report.userAgent || navigator.userAgent,
    user: report.user || {
      uid: currentUser?.uid,
      email: currentUser?.email,
    },
    status: 'new',
    clientTime: new Date().toISOString(),
    }) as Record<string, unknown>),
    createdAt: serverTimestamp(),
  };

  let ownerAiResult: Record<string, unknown> = {};
  try {
    const response = await fetch('/api/owner-ai/report-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    ownerAiResult = await response.json().catch(() => ({}));
  } catch {
    ownerAiResult = {};
  }

  try {
    await addDoc(collection(db, 'owner_ai_reports'), {
      ...payload,
      aiSummary: typeof ownerAiResult.aiSummary === 'string' ? ownerAiResult.aiSummary : null,
      webhookSent: Boolean(ownerAiResult.webhookSent),
    });
  } catch (error) {
    console.warn('[owner-ai] could not save report:', error);
  }
}

export function installOwnerAiGlobalMonitor() {
  window.addEventListener('error', (event) => {
    void reportOwnerAiFailure({
      source: 'window',
      operation: 'runtime-error',
      severity: 'critical',
      message: event.message || 'Unhandled browser error',
      stack: event.error?.stack,
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    void reportOwnerAiFailure({
      source: 'window',
      operation: 'unhandled-promise-rejection',
      severity: 'critical',
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack,
      details: reason,
    });
  });
}
