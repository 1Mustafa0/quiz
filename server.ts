import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
import mammothImport from 'mammoth';
const mammoth = (mammothImport as any).default || mammothImport;
import officeParserImport from 'officeparser';
const officeParser = (officeParserImport as any).default || officeParserImport;
import { parse as csvParse } from 'csv-parse/sync';

const OCR_SYSTEM_PROMPT = `أنت نظام متخصص في استخراج النصوص من الملفات التعليمية.

قد يكون الملف:
- PDF يحتوي على نص حقيقي
- PDF عبارة عن صور ممسوحة Scanner
- صور داخل PDF
- صفحات بجودة ضعيفة
- عربي أو إنجليزي أو مختلط

المطلوب:
1. استخرج كل النصوص الممكنة من الملف.
2. إذا فشل استخراج النص العادي استخدم OCR تلقائيًا.
3. حاول فهم النص حتى مع أخطاء OCR.
4. حافظ على ترتيب المحتوى والعناوين قدر الإمكان.
5. تجاهل العلامات غير المفهومة والضوضاء.
6. لا تلخص المحتوى.
7. أعد النص بشكل نظيف ومنظم.
8. أصلح أخطاء OCR الشائعة إن أمكن.
9. إذا كانت الصفحة صورة فقط استخرج النص منها بالكامل.
10. إذا وُجدت جداول أو نقاط حاول تحويلها لنص مفهوم.

تعليمات مهمة:
- لا تنشئ معلومات غير موجودة.
- لا تشرح أي شيء.
- الناتج يكون النص المستخرج فقط.
- إذا كانت هناك أجزاء غير مقروءة ضع مكانها [غير واضح].`;

async function extractWithGeminiOcr(buffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
  if (!apiKey) {
    console.warn('[GeminiOCR] No API key found, skipping OCR');
    return '';
  }
  try {
    console.log(`[GeminiOCR] Sending ${mimeType} file (${buffer.length} bytes) to Gemini for OCR...`);
    const ai = new GoogleGenAI({ apiKey });
    const base64 = buffer.toString('base64');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        parts: [
          { text: OCR_SYSTEM_PROMPT },
          { inlineData: { data: base64, mimeType } }
        ]
      }]
    });
    const result = response.text?.trim() || '';
    console.log(`[GeminiOCR] Extracted ${result.length} chars`);
    return result;
  } catch (err: any) {
    console.error('[GeminiOCR] Failed:', err?.message || err);
    return '';
  }
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/bmp', 'image/tiff'
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Firebase config (for REST API) ──────────────────────────────
const FIREBASE_API_KEY = 'AIzaSyDlBOAtBLI1raPJ1XNQ1MJrTbvGJ5Jtl5w';
const FIREBASE_PROJECT_ID = 'gen-lang-client-0923522692';
const FIREBASE_DB_ID = 'ai-studio-83d42d29-f235-425e-b6a4-00ed46c00c2f';
const ADMIN_EMAIL = 'mstfyalswdany913@gmail.com';

// ── Server-side Visitor Store ────────────────────────────────────
const VISITORS_FILE = path.join(process.cwd(), '.visitors.json');

interface VisitorRecord {
  sessionId: string;
  firstVisit: number;
  lastVisit: number;
  visitCount: number;
  isRegistered: boolean;
  uid?: string;
}

let visitorStore: Map<string, VisitorRecord> = new Map();

function loadVisitors() {
  try {
    if (fs.existsSync(VISITORS_FILE)) {
      const data = JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
      visitorStore = new Map(Object.entries(data));
      console.log(`[Visitors] Loaded ${visitorStore.size} visitor records`);
    }
  } catch (e) {
    console.warn('[Visitors] Could not load visitors file:', e);
  }
}

function saveVisitors() {
  try {
    fs.writeFileSync(VISITORS_FILE, JSON.stringify(Object.fromEntries(visitorStore), null, 2));
  } catch (e) {
    console.warn('[Visitors] Could not save visitors file:', e);
  }
}

loadVisitors();

// ── Firebase token verification (REST API) ───────────────────────
async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }) }
    );
    const data: any = await res.json();
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, email: user.email || '' };
  } catch {
    return null;
  }
}

// Global error handlers to prevent process crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB limit

async function startServer() {
  const app = express();
  const PORT = 5000;

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);

  app.use(express.json());

  // ── Visitor tracking (server-side, bypasses Firestore rules) ──
  app.post('/api/track-visit', express.json(), (req: any, res: any) => {
    try {
      const { sessionId, uid } = req.body || {};
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'sessionId required' });
      }
      const now = Date.now();
      const existing = visitorStore.get(sessionId);
      if (existing) {
        existing.lastVisit = now;
        existing.visitCount += 1;
        if (uid) { existing.isRegistered = true; existing.uid = uid; }
      } else {
        visitorStore.set(sessionId, {
          sessionId, firstVisit: now, lastVisit: now,
          visitCount: 1, isRegistered: !!uid, ...(uid ? { uid } : {}),
        });
      }
      saveVisitors();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin: get all visitors ─────────────────────────────────────
  app.get('/api/admin/visitors', async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser || tokenUser.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.json({ visitors: Array.from(visitorStore.values()) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Create/update user profile via Firestore REST API ──────────
  app.post('/api/user/ensure-profile', express.json(), async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });

      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });

      const { profileData } = req.body || {};
      if (!profileData?.uid) return res.status(400).json({ error: 'profileData.uid required' });
      if (profileData.uid !== tokenUser.uid) return res.status(403).json({ error: 'uid mismatch' });

      const now = new Date().toISOString();
      const fields: Record<string, any> = {
        uid:         { stringValue: profileData.uid },
        email:       { stringValue: profileData.email || '' },
        displayName: { stringValue: profileData.displayName || '' },
        photoURL:    profileData.photoURL ? { stringValue: profileData.photoURL } : { nullValue: null },
        role:        { stringValue: profileData.role || 'user' },
        createdAt:   { timestampValue: now },
      };

      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/users/${profileData.uid}`;
      const fsRes = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ fields }),
      });
      const fsData: any = await fsRes.json();

      if (!fsRes.ok) {
        console.error('[ensure-profile] Firestore REST failed:', fsData?.error?.message);
        return res.status(fsRes.status).json({ error: fsData?.error?.message || 'Firestore write failed' });
      }

      console.log('[ensure-profile] Profile saved for uid:', profileData.uid);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Health check route
  app.get('/api/health', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const keyPrefix = hasKey ? process.env.GEMINI_API_KEY?.substring(0, 5) : 'none';
    res.json({ 
      status: 'ok', 
      message: 'Server is running', 
      env: process.env.NODE_ENV,
      hasGeminiKey: hasKey,
      keyPrefix: keyPrefix
    });
  });

  // API Routes
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  
  app.post('/api/parse-file', upload.single('file'), async (req: any, res: any, next: any) => {
    console.log('--- NEW PARSE REQUEST ---');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('File:', req.file ? `${req.file.originalname} (${req.file.mimetype})` : 'NO FILE');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { mimetype, buffer, originalname } = req.file;
      const lowerName = originalname.toLowerCase();
      console.log(`Processing file: ${originalname}, size: ${buffer.length} bytes, type: ${mimetype}`);
      console.log('Buffer preview (hex):', buffer.slice(0, 20).toString('hex'));
      let text = '';

      // ── Image files → Gemini OCR directly ─────────────────────
      const isImage = IMAGE_MIME_TYPES.has(mimetype) ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'].some(e => lowerName.endsWith(e));

      if (isImage) {
        console.log('Image file detected — sending to Gemini OCR directly...');
        const imageMime = mimetype.startsWith('image/') ? mimetype : `image/${lowerName.split('.').pop()}`;
        text = await extractWithGeminiOcr(buffer, imageMime);
      } else if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        console.log('Parsing PDF...');
        try {
          const data = await pdfParser(buffer);
          text = data?.text || '';
          console.log('PDF extraction result length:', text.length);
          if (text.trim().length < 100) {
            console.log('PDF text too short — likely scanned. Falling back to Gemini OCR...');
            const ocrText = await extractWithGeminiOcr(buffer, 'application/pdf');
            if (ocrText.length > text.trim().length) {
              text = ocrText;
              console.log('Gemini OCR improved result:', text.length, 'chars');
            }
          }
        } catch (err: any) {
          console.error('PDF Parse failed — trying Gemini OCR:', err?.message);
          text = await extractWithGeminiOcr(buffer, 'application/pdf');
          if (!text) {
            text = buffer.toString('utf-8').replace(/[^\x20-\x7E\s]/g, '');
          }
        }
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mimetype === 'application/vnd.ms-powerpoint' ||
        mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimetype === 'application/vnd.ms-excel' ||
        originalname.toLowerCase().endsWith('.docx') || originalname.toLowerCase().endsWith('.doc') || 
        originalname.toLowerCase().endsWith('.pptx') || originalname.toLowerCase().endsWith('.ppt') ||
        originalname.toLowerCase().endsWith('.xlsx') || originalname.toLowerCase().endsWith('.xls')
      ) {
        console.log('Parsing Office document:', mimetype || originalname);
        try {
          // Special handling for .docx which mammoth handles better
          if (originalname.toLowerCase().endsWith('.docx')) {
            try {
              console.log('Using mammoth for .docx');
              const result = await mammoth.extractRawText({ buffer });
              text = result.value;
            } catch (mErr) {
              console.error('Mammoth failed, falling back to officeParser:', mErr);
            }
          }

          // If mammoth didn't get text or it's not a docx, use officeParser
          if (!text) {
            try {
              // Wrap officeParser in a try-catch to handle its internal errors gracefully
              const extracted = await officeParser.parseOffice(buffer);
              text = typeof extracted === 'string' ? extracted : (extracted?.text || JSON.stringify(extracted));
            } catch (pErr: any) {
              const errMsg = pErr?.message || String(pErr);
              console.log('Office promise API failed or unsupported format:', errMsg);
              
              // If it's an unsupported format error (like CFB), don't bother with callback API
              const isUnsupported = errMsg.includes('supports docx, pptx, xlsx only') || 
                                   errMsg.includes('support for cfb files');
              
              if (!isUnsupported) {
                try {
                  console.log('Trying callback API as fallback...');
                  text = await new Promise((resolve, reject) => {
                    // Set a timeout for the callback API to prevent hanging
                    const timeout = setTimeout(() => reject(new Error('Office callback API timed out')), 5000);
                    
                    officeParser.parseOffice(buffer, (data: any, err: any) => {
                      clearTimeout(timeout);
                      if (err) reject(err);
                      else resolve(typeof data === 'string' ? data : (data?.text || JSON.stringify(data)));
                    });
                  });
                } catch (cbErr) {
                  console.error('Office callback API also failed:', cbErr);
                }
              } else {
                console.log('Skipping callback API due to known unsupported format');
              }
            }
          }
          
          console.log('Office extraction result length:', text?.length || 0);
        } catch (err: any) {
          console.error('Office document parse block failed:', err);
        }
      } else if (mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv')) {
        console.log('Parsing CSV...');
        try {
          const records = csvParse(buffer.toString());
          text = JSON.stringify(records);
        } catch (err: any) {
          console.error('CSV Parse failed:', err);
          text = buffer.toString();
        }
      } else if (
        mimetype.startsWith('text/') || 
        originalname.endsWith('.txt') || 
        originalname.endsWith('.js') || 
        originalname.endsWith('.ts') || 
        originalname.endsWith('.tsx') ||
        originalname.endsWith('.jsx') ||
        originalname.endsWith('.py') || 
        originalname.endsWith('.java') || 
        originalname.endsWith('.cpp') || 
        originalname.endsWith('.c') || 
        originalname.endsWith('.html') || 
        originalname.endsWith('.css') ||
        originalname.endsWith('.md') ||
        originalname.endsWith('.json')
      ) {
        console.log('Parsing plain text or code file...');
        text = buffer.toString('utf-8');
      } else {
        // Generic fallback for unknown types - try as text
        console.log('Unknown mimetype, trying as plain text:', mimetype);
        text = buffer.toString('utf-8');
      }

      // Final cleanup and validation
      if (typeof text !== 'string') {
        text = String(text || '');
      }
      
      if (!text || text.length < 10 || text === '[object Object]') {
        console.log('All parsers failed, trying final UTF-8 fallback...');
        text = buffer.toString('utf-8').replace(/[^\x20-\x7E\s\u0600-\u06FF]/g, ''); // Keep Arabic characters too
      }

      text = text.replace(/\s+/g, ' ').trim();
      
      if (!text || text.length < 10 || text === '[object Object]') {
        console.error('Extraction failed or resulted in too little text. Length:', text?.length);
        return res.status(400).json({ 
          error: 'Could not extract meaningful text from this file.',
          details: `Detected type: ${mimetype}, Size: ${buffer.length} bytes, Extracted length: ${text?.length || 0}. The file might be empty, encrypted, or in an unsupported format.`
        });
      }

      console.log('Successfully extracted text, length:', text.length);
      res.json({ text: text.substring(0, 100000) }); // Increased limit to 100k
    } catch (error: any) {
      console.error('Parsing error details:', error);
      res.status(500).json({ 
        error: 'Failed to parse file', 
        details: error.message || String(error)
      });
    }
  });

  // Global error handler to ensure JSON is always returned for API routes
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  console.log(`Server starting in ${isProduction ? 'production' : 'development'} mode`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Using Vite middleware for serving assets');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      console.log('Serving static assets from dist directory');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error('Production mode enabled but dist directory not found!');
      // Fallback to Vite if dist is missing even in production
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
