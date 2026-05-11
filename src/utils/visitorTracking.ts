const VISITOR_SESSION_KEY = 'aqm_visitor_session';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function trackVisit(uid?: string): Promise<void> {
  try {
    let sessionId = localStorage.getItem(VISITOR_SESSION_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(VISITOR_SESSION_KEY, sessionId);
    }

    const send = () => fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...(uid ? { uid } : {}) }),
      keepalive: true,
    }).catch((err) => {
      console.warn('[trackVisit] Server call failed:', err?.message);
    });

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => void send(), { timeout: 2500 });
    } else {
      globalThis.setTimeout(() => void send(), 800);
    }
  } catch (e: any) {
    console.warn('[trackVisit] Unexpected error:', e?.message);
  }
}
