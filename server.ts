import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import multer from 'multer';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
const { createCanvas } = require('@napi-rs/canvas');
import mammothImport from 'mammoth';
const mammoth = (mammothImport as any).default || mammothImport;
import officeParserImport from 'officeparser';
const officeParser = (officeParserImport as any).default || officeParserImport;
import { parse as csvParse } from 'csv-parse/sync';
import { generateMindMap, generateMindMapFromContent } from './src/services/mindmapService';
import { generateQuizFromContent } from './src/services/geminiService';
import { adminAccess, getPlanById, pricingPlans, type PlanId } from './src/config/pricing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const OCR_SYSTEM_PROMPT = `You are an OCR engine for educational material.

Task:
- Extract all visible text from the provided image or document.
- Preserve the reading order, headings, bullet points, labels, tables, and slide structure as much as possible.
- The content may be Arabic, English, or mixed. Keep the original language.
- Do not summarize.
- Do not add information that is not visible.
- Ignore logos, decorative elements, noise, and repeated watermarks unless they contain meaningful educational text.
- If a part is unreadable, write [unreadable].

Return only the extracted text.`;

function getServerGeminiApiKeys(): string[] {
  const invalid = new Set(['', 'MY_GEMINI_API_KEY', 'undefined', 'null']);
  const keys: string[] = [];
  const addKey = (key: string | undefined) => {
    const clean = key?.trim();
    if (clean && !invalid.has(clean) && !keys.includes(clean)) {
      keys.push(clean);
    }
  };

  addKey(process.env.GEMINI_API_KEY);
  addKey(process.env.GOOGLE_API_KEY);

  const multi = process.env.GEMINI_API_KEYS || '';
  multi.split(',').forEach(key => addKey(key));

  Object.keys(process.env)
    .filter(name => /^GEMINI_API_KEY_\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(name => addKey(process.env[name]));

  Object.keys(process.env)
    .filter(name => /^\d+$/.test(name))
    .sort((a, b) => Number(a) - Number(b))
    .forEach(name => addKey(process.env[name]));

  return keys;
}

function getServerGeminiApiKey(): string {
  return getServerGeminiApiKeys()[0] || '';
}

function isGeminiQuotaError(err: any): boolean {
  const message = `${err?.message || ''} ${err?.status || ''} ${err?.code || ''}`;
  return err?.status === 429 ||
    err?.code === 429 ||
    /429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message);
}

function createGeminiQuotaError(operation: string): Error {
  const error = new Error(`${operation} quota is temporarily exhausted across the available Gemini keys/models. Try again shortly or add a key from another Google Cloud project.`);
  (error as any).statusCode = 429;
  (error as any).publicMessage = 'خدمة الذكاء الاصطناعي وصلت لحد الاستخدام مؤقتا. انتظر قليلا ثم حاول مرة أخرى.';
  return error;
}

type GeminiOcrInput = {
  buffer: Buffer;
  mimeType: string;
  label?: string;
};

type OcrInput = GeminiOcrInput;

type OcrResult = {
  text: string;
  method: string;
  usedGemini: boolean;
};

const LOCAL_OCR_MIN_CHARS = Number(process.env.LOCAL_OCR_MIN_CHARS || 10);
const LOCAL_OCR_TIMEOUT_MS = Number(process.env.LOCAL_OCR_TIMEOUT_MS || 180000);
const LOCAL_OCR_LANGS = process.env.LOCAL_OCR_LANGS || 'ara+eng';
const PADDLEOCR_LANG = process.env.PADDLEOCR_LANG || 'arabic';
const ALLOW_GEMINI_OCR_FALLBACK = process.env.ALLOW_GEMINI_OCR_FALLBACK === 'true';

const OCR_CONTEXT_METHODS: Record<string, { localPaddle: string; localTesseract: string; gemini: string }> = {
  image: {
    localPaddle: 'local-paddleocr-image',
    localTesseract: 'local-tesseractjs-image',
    gemini: 'gemini-ocr-image',
  },
  'pdf-images': {
    localPaddle: 'local-paddleocr-pdf-images',
    localTesseract: 'local-tesseractjs-pdf-images',
    gemini: 'gemini-ocr-pdf-images',
  },
  'office-images': {
    localPaddle: 'local-paddleocr-office-images',
    localTesseract: 'local-tesseractjs-office-images',
    gemini: 'gemini-ocr-office-images',
  },
};

function getImageExtensionForMime(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('gif')) return '.gif';
  if (mimeType.includes('bmp')) return '.bmp';
  if (mimeType.includes('tiff')) return '.tiff';
  return '.png';
}

function normalizeOcrText(text: string): string {
  return (text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseLastJsonObject(output: string): any | null {
  const trimmed = (output || '').trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.lastIndexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function runProcess(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timeout: NodeJS.Timeout | undefined;

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }

    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (timeout) clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function runPaddleOcr(inputs: OcrInput[]): Promise<string> {
  if (process.env.DISABLE_PADDLE_OCR === 'true') return '';

  const scriptPath = path.join(process.cwd(), 'tools', 'local_ocr.py');
  if (!fs.existsSync(scriptPath)) return '';

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'quiz-paddle-ocr-'));
  try {
    const imagePaths: string[] = [];
    for (const [index, input] of inputs.entries()) {
      const imagePath = path.join(tempDir, `image-${index + 1}${getImageExtensionForMime(input.mimeType)}`);
      await fs.promises.writeFile(imagePath, input.buffer);
      imagePaths.push(imagePath);
    }

    const candidates = process.env.LOCAL_OCR_PYTHON
      ? [{ command: process.env.LOCAL_OCR_PYTHON, args: [] }]
      : [
          { command: 'python', args: [] },
          { command: 'python3', args: [] },
          { command: 'py', args: ['-3'] },
        ];

    for (const candidate of candidates) {
      try {
        const result = await runProcess(
          candidate.command,
          [...candidate.args, scriptPath, ...imagePaths],
          {
            cwd: process.cwd(),
            timeoutMs: LOCAL_OCR_TIMEOUT_MS,
            env: {
              ...process.env,
              PADDLEOCR_LANG,
            },
          }
        );

        if (result.code !== 0) {
          const message = result.stderr || result.stdout;
          console.warn(`[PaddleOCR] ${candidate.command} exited with ${result.code}:`, message.slice(0, 300));
          continue;
        }

        const parsed = parseLastJsonObject(result.stdout);
        const text = normalizeOcrText(parsed?.text || '');
        if (text.length >= LOCAL_OCR_MIN_CHARS) {
          console.log(`[PaddleOCR] extracted ${text.length} chars from ${inputs.length} image(s).`);
          return text;
        }
      } catch (err: any) {
        console.warn(`[PaddleOCR] unavailable via ${candidate.command}:`, err?.message || err);
      }
    }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return '';
}

async function runTesseractJsOcr(inputs: OcrInput[]): Promise<string> {
  if (process.env.DISABLE_TESSERACT_JS_OCR === 'true') return '';

  return withTimeout((async () => {
    const { createWorker } = await import('tesseract.js');
    const cachePath = path.join(process.cwd(), '.local', 'tesseract-cache');
    await fs.promises.mkdir(cachePath, { recursive: true });

    const worker = await createWorker(LOCAL_OCR_LANGS, 1, {
      cachePath,
      logger: message => {
        if (message?.status === 'recognizing text') {
          console.log(`[Tesseract.js] ${Math.round((message.progress || 0) * 100)}%`);
        }
      },
    });

    try {
      const parts: string[] = [];
      for (const [index, input] of inputs.entries()) {
        const result = await worker.recognize(input.buffer);
        const text = normalizeOcrText(result?.data?.text || '');
        if (text) {
          parts.push(`${input.label || `Image ${index + 1}`}:\n${text}`);
        }
      }
      const finalText = normalizeOcrText(parts.join('\n\n'));
      if (finalText.length >= LOCAL_OCR_MIN_CHARS) {
        console.log(`[Tesseract.js] extracted ${finalText.length} chars from ${inputs.length} image(s).`);
        return finalText;
      }
    } finally {
      await worker.terminate();
    }

    return '';
  })(), LOCAL_OCR_TIMEOUT_MS, 'Tesseract.js OCR').catch((err: any) => {
    console.warn('[Tesseract.js] OCR failed:', err?.message || err);
    return '';
  });
}

async function extractWithLocalOcrInputs(inputs: OcrInput[]): Promise<{ text: string; engine: 'paddleocr' | 'tesseractjs' | '' }> {
  if (process.env.DISABLE_LOCAL_OCR === 'true') {
    return { text: '', engine: '' };
  }

  const tesseractText = await runTesseractJsOcr(inputs);
  if (tesseractText.length >= LOCAL_OCR_MIN_CHARS) {
    return { text: tesseractText, engine: 'tesseractjs' };
  }

  const paddleText = await runPaddleOcr(inputs);
  if (paddleText.length >= LOCAL_OCR_MIN_CHARS) {
    return { text: paddleText, engine: 'paddleocr' };
  }

  return { text: '', engine: '' };
}

async function extractWithGeminiOcrInputs(inputs: GeminiOcrInput[]): Promise<string> {
  const apiKeys = getServerGeminiApiKeys();
  if (apiKeys.length === 0) {
    console.warn('[GeminiOCR] No API key found, skipping OCR');
    return '';
  }

  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let sawQuotaError = false;
  const totalBytes = inputs.reduce((sum, input) => sum + input.buffer.length, 0);

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const ai = new GoogleGenAI({ apiKey });

    for (const model of models) {
      try {
        console.log(`[GeminiOCR] Key ${keyIndex + 1}/${apiKeys.length}: sending ${inputs.length} file(s), ${totalBytes} bytes to ${model} for OCR...`);
        const parts: any[] = [{
          text: inputs.length === 1
            ? OCR_SYSTEM_PROMPT
            : `${OCR_SYSTEM_PROMPT}\n\nMultiple images are attached. Extract each image separately and keep the provided image labels in the output.`,
        }];

        for (const input of inputs) {
          if (input.label) {
            parts.push({ text: `\n\n[${input.label}]` });
          }
          parts.push({
            inlineData: {
              data: input.buffer.toString('base64'),
              mimeType: input.mimeType,
            },
          });
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts }]
        });
        const result = response.text?.trim() || '';
        console.log(`[GeminiOCR] ${model} extracted ${result.length} chars`);
        if (result) return result;
      } catch (err: any) {
        if (isGeminiQuotaError(err)) {
          sawQuotaError = true;
          console.warn(`[GeminiOCR] ${model} quota reached on key ${keyIndex + 1}. Trying another model/key...`);
          continue;
        }
        console.error(`[GeminiOCR] ${model} failed on key ${keyIndex + 1}:`, err?.message || err);
      }
    }
  }

  if (sawQuotaError) {
    throw createGeminiQuotaError('Gemini OCR');
  }

  return '';
}

async function extractWithGeminiOcr(buffer: Buffer, mimeType: string): Promise<string> {
  return extractWithGeminiOcrInputs([{ buffer, mimeType }]);
}

async function extractWithBestOcrInputs(inputs: OcrInput[], context: keyof typeof OCR_CONTEXT_METHODS): Promise<OcrResult> {
  const methodNames = OCR_CONTEXT_METHODS[context] || OCR_CONTEXT_METHODS.image;
  const local = await extractWithLocalOcrInputs(inputs);
  if (local.text.length >= LOCAL_OCR_MIN_CHARS) {
    return {
      text: local.text,
      method: local.engine === 'paddleocr' ? methodNames.localPaddle : methodNames.localTesseract,
      usedGemini: false,
    };
  }

  if (!ALLOW_GEMINI_OCR_FALLBACK) {
    console.warn('[OCR] Local OCR did not extract enough text. Gemini OCR fallback is disabled.');
    return {
      text: '',
      method: 'local-ocr-failed',
      usedGemini: false,
    };
  }

  const geminiText = normalizeOcrText(await extractWithGeminiOcrInputs(inputs));
  return {
    text: geminiText,
    method: methodNames.gemini,
    usedGemini: true,
  };
}

async function extractWithBestOcr(buffer: Buffer, mimeType: string, context: keyof typeof OCR_CONTEXT_METHODS): Promise<OcrResult> {
  return extractWithBestOcrInputs([{ buffer, mimeType }], context);
}

function collectTextFields(value: any, output: string[] = []): string[] {
  if (!value || typeof value !== 'object') return output;

  if (typeof value.text === 'string' && value.text.trim()) {
    output.push(value.text.trim());
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectTextFields(item, output));
    return output;
  }

  Object.values(value).forEach(item => collectTextFields(item, output));
  return output;
}

function parseJsonIfPossible(value: string): any | null {
  const trimmed = value.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

async function extractPptxTextFromZip(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter(file => !file.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(file.name))
    .sort((a, b) => {
      const left = Number(a.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const right = Number(b.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return left - right;
    });

  const slides: string[] = [];
  for (const [index, file] of slideFiles.entries()) {
    const xml = await file.async('text');
    const values = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)/g))
      .map(match => decodeXmlText(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const unique: string[] = [];
    for (const value of values) {
      if (unique[unique.length - 1] !== value) unique.push(value);
    }

    if (unique.length > 0) {
      slides.push(`Slide ${index + 1}\n${unique.join('\n')}`);
    }
  }

  return slides.join('\n\n').trim();
}

function extractMeaningfulOfficeText(extracted: any): string {
  if (typeof extracted === 'string') {
    const parsed = parseJsonIfPossible(extracted);
    if (parsed) {
      return collectTextFields(parsed).join('\n').trim();
    }
    return extracted.trim();
  }

  if (!extracted || typeof extracted !== 'object') return '';

  if (typeof extracted.text === 'string' && extracted.text.trim()) {
    return extracted.text.trim();
  }

  return collectTextFields(extracted).join('\n').trim();
}

function normalizeExtractedFileText(value: string): string {
  const lowValueLinePatterns = [
    /^pptx$/i,
    /^powerpoint presentation$/i,
    /^slide$/i,
    /^heading$/i,
    /^text$/i,
    /^paragraph$/i,
    /^list$/i,
    /^unordered$/i,
    /^image$/i,
    /^justify$/i,
    /^center$/i,
    /^left$/i,
    /^right$/i,
    /^\d+pt$/i,
    /^#[0-9a-f]{6}$/i,
    /^times new roman$/i,
    /^calibri$/i,
    /^century gothic$/i,
    /^\+mj-[a-z]+$/i,
    /^image\d+\.(png|jpe?g|gif|webp)$/i,
    /^description:\s*https?:\/\//i,
    /^https?:\/\//i,
    /^page\s+\d+:?$/i,
    /^image\s+\d+:?$/i,
    /^slide\s+image\s+\d+:?/i,
    /^camscanner$/i,
    /^cam\s*3?\s*scanner$/i,
    /^\(?bc\s+on\s+scanner\)?$/i,
    /^scanned\s+with\s+camscanner$/i,
    /^scan(?:ned)?\s+by\s+camscanner$/i,
  ];

  const hasLetter = (line: string) => /[\p{L}]/u.test(line);
  const looksLikeOcrDebris = (line: string) => {
    const compact = line.replace(/\s+/g, '');
    if (!compact) return true;
    if (!hasLetter(line)) return true;
    if (compact.length < 2) return true;

    const letters = (compact.match(/\p{L}/gu) || []).length;
    const numbers = (compact.match(/\p{N}/gu) || []).length;
    const questionMarks = (compact.match(/\?/g) || []).length;
    const symbols = compact.length - letters - numbers;
    const letterRatio = letters / compact.length;
    const symbolRatio = symbols / compact.length;
    const usefulWords = line.match(/[\p{L}]{3,}/gu) || [];

    if (compact.length >= 8 && questionMarks / compact.length > 0.2) return true;
    if (compact.length >= 8 && usefulWords.length < 2 && symbolRatio > 0.15) return true;
    return compact.length >= 12 && letterRatio < 0.35 && symbolRatio > 0.25;
  };

  const lines = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[•●○▪▫]/g, '\n- ')
    .split('\n')
    .map(line => line
      .replace(/[|~_=]{2,}/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
    )
    .filter(line => line && !lowValueLinePatterns.some(pattern => pattern.test(line)))
    .filter(line => !looksLikeOcrDebris(line));

  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = line.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const cleanedLines = lines.filter(line => {
    const count = counts.get(line.toLowerCase()) || 0;
    return !(line.length <= 40 && count >= 5 && count / Math.max(lines.length, 1) > 0.25);
  });

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasEnoughUsefulOcrText(text: string): boolean {
  const usefulWords = text.match(/[\p{L}]{3,}/gu) || [];
  return text.length >= 25 && usefulWords.length >= 4;
}

function formatCsvRecordsForPreview(records: any[]): string {
  if (!Array.isArray(records) || records.length === 0) return '';

  const rows = records
    .filter(row => Array.isArray(row) ? row.some(cell => String(cell ?? '').trim()) : String(row ?? '').trim())
    .slice(0, 250);

  if (rows.length === 0) return '';

  const firstRow = Array.isArray(rows[0]) ? rows[0].map(cell => String(cell ?? '').trim()) : [];
  const hasHeader = firstRow.length > 0 && firstRow.every(cell => cell && !/^\d+(\.\d+)?$/.test(cell));
  const headers = hasHeader ? firstRow : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const parts = ['Table 1'];
  dataRows.forEach((row, rowIndex) => {
    const cells = Array.isArray(row) ? row : [row];
    parts.push(`Row ${rowIndex + 1}:`);
    cells.forEach((cell, cellIndex) => {
      const value = String(cell ?? '').trim();
      if (!value) return;
      const label = headers[cellIndex] || `Column ${cellIndex + 1}`;
      parts.push(`- ${label}: ${value}`);
    });
  });

  return parts.join('\n');
}

function looksLikeTechnicalOfficeDump(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const parsed = parseJsonIfPossible(trimmed);
  if (parsed) {
    const meaningful = collectTextFields(parsed).join('').trim();
    const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : '';
    return ['pptx', 'docx', 'xlsx'].includes(type) && meaningful.length < 20;
  }

  return /"attachmentName"\s*:\s*"image\d+\./i.test(trimmed) &&
    /"type"\s*:\s*"image"/i.test(trimmed) &&
    !/"text"\s*:\s*"[^"]{20,}"/i.test(trimmed);
}

function imageMimeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return null;
}

async function renderPdfPagesToPng(buffer: Buffer, maxPages = 20): Promise<Buffer[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const pages: Buffer[] = [];
  const pageCount = Math.min(doc.numPages, maxPages);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewportAtOne = page.getViewport({ scale: 1 });
    const longestSide = Math.max(viewportAtOne.width, viewportAtOne.height);
    const scale = Math.min(2.6, Math.max(1.6, 2200 / longestSide));
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const canvasContext = canvas.getContext('2d');

    await page.render({ canvas, canvasContext, viewport }).promise;
    pages.push(canvas.toBuffer('image/png'));
    page.cleanup?.();
  }

  await doc.destroy?.();
  return pages;
}

async function extractPdfImageOcr(buffer: Buffer): Promise<{ text: string; pageCount: number; ocrPageCount: number; ocrChars: number; method?: string; usedGemini?: boolean }> {
  try {
    const pageImages = await renderPdfPagesToPng(buffer);
    if (pageImages.length === 0) {
      return { text: '', pageCount: 0, ocrPageCount: 0, ocrChars: 0 };
    }

    console.log(`[PdfImageOCR] Rendered ${pageImages.length} PDF pages to images. Running OCR...`);
    const parts: string[] = [];
    let ocrPageCount = 0;
    let ocrChars = 0;
    let ocrMethod = '';
    let usedGemini = false;

    for (const [index, imageBuffer] of pageImages.entries()) {
      const pageOcr = await extractWithBestOcr(imageBuffer, 'image/png', 'pdf-images');
      const pageText = normalizeExtractedFileText(pageOcr.text);
      if (hasEnoughUsefulOcrText(pageText)) {
        ocrPageCount += 1;
        ocrChars += pageText.trim().length;
        ocrMethod = ocrMethod && ocrMethod !== pageOcr.method ? 'mixed-ocr-pdf-images' : pageOcr.method;
        usedGemini = usedGemini || pageOcr.usedGemini;
        parts.push(`Page ${index + 1}:\n${pageText.trim()}`);
      }
    }

    return {
      text: parts.join('\n\n').trim(),
      pageCount: pageImages.length,
      ocrPageCount,
      ocrChars,
      method: ocrMethod || undefined,
      usedGemini,
    };
  } catch (err: any) {
    console.warn('[PdfImageOCR] PDF to image OCR failed:', err?.message || err);
    return { text: '', pageCount: 0, ocrPageCount: 0, ocrChars: 0 };
  }
}

async function getOfficeImageEntries(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Object.values(zip.files)
    .filter(file => !file.dir && /\/media\//i.test(file.name) && imageMimeFromPath(file.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 25);
}

async function extractOfficeImageOcr(buffer: Buffer): Promise<{ text: string; imageCount: number; ocrImageCount: number; ocrChars: number; quotaExhausted?: boolean; method?: string; usedGemini?: boolean }> {
  const imageEntries = await getOfficeImageEntries(buffer);

  if (imageEntries.length === 0) {
    return { text: '', imageCount: 0, ocrImageCount: 0, ocrChars: 0 };
  }

  console.log(`[OfficeOCR] Found ${imageEntries.length} embedded images. Running OCR...`);
  const parts: string[] = [];
  let ocrImageCount = 0;
  let ocrChars = 0;
  let quotaExhausted = false;
  let ocrMethod = '';
  let usedGemini = false;
  let currentBatch: GeminiOcrInput[] = [];
  let currentBatchBytes = 0;
  const batches: GeminiOcrInput[][] = [];
  const maxBatchBytes = 4 * 1024 * 1024;
  const maxBatchImages = 3;

  for (const [index, file] of imageEntries.entries()) {
    const mimeType = imageMimeFromPath(file.name);
    if (!mimeType) continue;

    const imageBuffer = Buffer.from(await file.async('uint8array'));
    if (imageBuffer.length < 1024) continue;

    if (
      currentBatch.length > 0 &&
      (currentBatch.length >= maxBatchImages || currentBatchBytes + imageBuffer.length > maxBatchBytes)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }

    currentBatch.push({
      buffer: imageBuffer,
      mimeType,
      label: `Slide image ${index + 1} (${path.basename(file.name)})`,
    });
    currentBatchBytes += imageBuffer.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  for (const batch of batches) {
    try {
      const batchOcr = await extractWithBestOcrInputs(batch, 'office-images');
      const imageText = batchOcr.text;
      if (imageText.trim()) {
        ocrImageCount += batch.length;
        ocrChars += imageText.trim().length;
        ocrMethod = ocrMethod && ocrMethod !== batchOcr.method ? 'mixed-ocr-office-images' : batchOcr.method;
        usedGemini = usedGemini || batchOcr.usedGemini;
        parts.push(imageText.trim());
      }
    } catch (err: any) {
      if (isGeminiQuotaError(err) || err?.statusCode === 429) {
        quotaExhausted = true;
        if (parts.length > 0) {
          console.warn('[OfficeOCR] OCR quota exhausted after partial extraction. Returning partial text.');
          break;
        }
      }
      throw err;
    }
  }

  return {
    text: parts.join('\n\n').trim(),
    imageCount: imageEntries.length,
    ocrImageCount,
    ocrChars,
    quotaExhausted,
    method: ocrMethod || undefined,
    usedGemini,
  };
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/bmp', 'image/tiff'
]);

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

interface ExtractionDiagnostics {
  embeddedImageCount?: number;
  ocrImageCount?: number;
  ocrChars?: number;
  renderedPdfPages?: number;
  ocrPdfPages?: number;
  note?: string;
}

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

// ── Server-side User Store ────────────────────────────────────────
const USERS_FILE = path.join(process.cwd(), '.users.json');

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: string;
  plan: PlanId;
  createdAt: string;
}

let userStore: Map<string, UserRecord> = new Map();

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      userStore = new Map(Object.entries(data));
      console.log(`[Users] Loaded ${userStore.size} user records`);
    }
  } catch (e) {
    console.warn('[Users] Could not load users file:', e);
  }
}

function saveUsersStore() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(userStore), null, 2));
  } catch (e) {
    console.warn('[Users] Could not save users file:', e);
  }
}

loadUsers();

// ── Public Shared Quiz Store ─────────────────────────────────────
const SHARED_QUIZZES_FILE = path.join(process.cwd(), '.shared-quizzes.json');

interface SharedQuizRecord {
  shareId: string;
  quizId: string;
  title: string;
  description?: string;
  category?: string;
  difficulty?: string;
  feedbackMode?: 'end' | 'per-question';
  timer: number;
  questions: any[];
  ownerUid: string;
  createdAt: string;
}

let sharedQuizStore: Map<string, SharedQuizRecord> = new Map();

function loadSharedQuizzes() {
  try {
    if (fs.existsSync(SHARED_QUIZZES_FILE)) {
      const data = JSON.parse(fs.readFileSync(SHARED_QUIZZES_FILE, 'utf-8'));
      sharedQuizStore = new Map(Object.entries(data));
      console.log(`[SharedQuizzes] Loaded ${sharedQuizStore.size} shared quiz records`);
    }
  } catch (e) {
    console.warn('[SharedQuizzes] Could not load shared quizzes file:', e);
  }
}

function saveSharedQuizzes() {
  try {
    fs.writeFileSync(SHARED_QUIZZES_FILE, JSON.stringify(Object.fromEntries(sharedQuizStore), null, 2));
  } catch (e) {
    console.warn('[SharedQuizzes] Could not save shared quizzes file:', e);
  }
}

loadSharedQuizzes();

// Helper: parse Firestore REST document fields to plain object
function parseFirestoreDoc(doc: any): Record<string, any> {
  const fields = doc.fields || {};
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields as Record<string, any>)) {
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.integerValue !== undefined) result[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) result[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.timestampValue !== undefined) result[key] = val.timestampValue;
    else if (val.nullValue !== undefined) result[key] = null;
    else if (val.arrayValue !== undefined) result[key] = (val.arrayValue.values || []).map((v: any) => parseFirestoreDoc({ fields: { _: v } })._);
    else if (val.mapValue !== undefined) result[key] = parseFirestoreDoc(val.mapValue);
  }
  return result;
}

// Helper: fetch a Firestore collection via REST API (using any auth token)
async function fetchFirestoreCollection(collection: string, idToken: string, pageSize = 500): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/${collection}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore REST ${res.status}`);
  }
  const data: any = await res.json();
  return (data.documents || []).map((doc: any) => {
    const id = doc.name.split('/').pop();
    return { id, ...parseFirestoreDoc(doc) };
  });
}

async function fetchFirestoreDocument(collection: string, docId: string, idToken: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/${collection}/${docId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore REST ${res.status}`);
  }
  const data: any = await res.json();
  return { id: docId, ...parseFirestoreDoc(data) };
}

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

function getBearerToken(req: any): string {
  return String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

async function requestIsOwner(req: any): Promise<boolean> {
  const idToken = getBearerToken(req);
  if (!idToken) return false;
  const tokenUser = await verifyFirebaseToken(idToken);
  return tokenUser?.email === ADMIN_EMAIL;
}

async function tokenUserIsAdmin(tokenUser: { uid: string; email: string } | null, idToken: string): Promise<boolean> {
  if (!tokenUser) return false;
  if (tokenUser.email === ADMIN_EMAIL) return true;

  try {
    const profile = await fetchFirestoreDocument('users', tokenUser.uid, idToken);
    return profile?.role === 'admin';
  } catch (err: any) {
    console.warn('[admin-check] Firestore role lookup failed:', err?.message || err);
    return false;
  }
}

function privateDetails(isOwner: boolean, details: string, publicDetails: string) {
  return isOwner ? details : publicDetails;
}

function normalizePlanId(plan: unknown): PlanId {
  return pricingPlans.some(item => item.id === plan) ? plan as PlanId : 'free';
}

function resolvePlanForUser(user: { email?: string | null; plan?: unknown; role?: string | null }) {
  if ((user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'admin') {
    return {
      plan: 'premium' as PlanId,
      adminAccess,
      limits: adminAccess.limits,
    };
  }

  const planId = normalizePlanId(user.plan);
  return {
    plan: planId,
    adminAccess: null,
    limits: getPlanById(planId).limits,
  };
}

const QUIZ_RATE_LIMIT_WINDOW_MS = Number(process.env.QUIZ_RATE_LIMIT_WINDOW_MS || 24 * 60 * 60 * 1000);
const QUIZ_RATE_LIMIT_MAX = Number(process.env.QUIZ_RATE_LIMIT_MAX || 0);
const quizRateLimits = new Map<string, number[]>();
const apiRateLimits = new Map<string, number[]>();

function enforceSimpleRateLimit(options: {
  bucket: string;
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}) {
  if (!Number.isFinite(options.maxRequests) || options.maxRequests <= 0) return;

  const now = Date.now();
  const windowStart = now - options.windowMs;
  const mapKey = `${options.bucket}:${options.key || 'anonymous'}`;
  const recent = (apiRateLimits.get(mapKey) || []).filter(timestamp => timestamp > windowStart);

  if (recent.length >= options.maxRequests) {
    const error = new Error(options.message);
    (error as any).statusCode = 429;
    throw error;
  }

  recent.push(now);
  apiRateLimits.set(mapKey, recent);
}

function enforceQuizRateLimit(tokenUser: { uid: string; email: string }, ip: string) {
  if ((tokenUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;

  const existing = userStore.get(tokenUser.uid);
  const plan = getPlanById(existing?.plan || 'free');
  const planDailyLimit = plan.limits.aiQuizzesPerDay === 'unlimited'
    ? Number.POSITIVE_INFINITY
    : plan.limits.aiQuizzesPerDay;
  const maxRequests = QUIZ_RATE_LIMIT_MAX > 0
    ? Math.min(QUIZ_RATE_LIMIT_MAX, planDailyLimit)
    : planDailyLimit;
  const key = tokenUser.uid || ip || 'anonymous';
  const now = Date.now();
  const windowStart = now - QUIZ_RATE_LIMIT_WINDOW_MS;
  const recent = (quizRateLimits.get(key) || []).filter(timestamp => timestamp > windowStart);

  if (recent.length >= maxRequests) {
    const error = new Error('تم الوصول للحد اليومي لإنشاء الكويزات. حاول لاحقًا.');
    (error as any).statusCode = 429;
    throw error;
  }

  recent.push(now);
  quizRateLimits.set(key, recent);
}

const MINDMAP_RATE_LIMIT_WINDOW_MS = Number(process.env.MINDMAP_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000);
const MINDMAP_RATE_LIMIT_MAX = Number(process.env.MINDMAP_RATE_LIMIT_MAX || 500);
const FILE_PARSE_RATE_LIMIT_WINDOW_MS = Number(process.env.FILE_PARSE_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000);
const FILE_PARSE_RATE_LIMIT_MAX = Number(process.env.FILE_PARSE_RATE_LIMIT_MAX || 500);

// Global error handlers to prevent process crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } });

export async function createApp(options: { serveClient?: boolean } = {}) {
  const { serveClient = true } = options;
  const app = express();

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
  app.all('/api/track-visit', (req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
  });

  // ── Sync user to local store on every sign-in ──────────────────
  app.post('/api/user/sync', express.json(), async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });

      const { displayName, photoURL } = req.body || {};
      const resolvedUid = tokenUser.uid;
      const resolvedEmail = tokenUser.email || '';
      const existing = userStore.get(resolvedUid);
      const firestoreProfile = await fetchFirestoreDocument('users', resolvedUid, idToken).catch(() => null);
      const resolvedRole = resolvedEmail === ADMIN_EMAIL
        ? 'admin'
        : firestoreProfile?.role === 'admin'
          ? 'admin'
          : 'user';

      userStore.set(resolvedUid, {
        uid: resolvedUid,
        email: resolvedEmail,
        displayName: displayName || existing?.displayName || '',
        photoURL: photoURL !== undefined ? photoURL : (existing?.photoURL ?? null),
        role: resolvedRole,
        plan: resolvedRole === 'admin' ? 'premium' : normalizePlanId(existing?.plan || firestoreProfile?.plan),
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
      saveUsersStore();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin: get all users ────────────────────────────────────────
  app.get('/api/admin/users', async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser || !(await tokenUserIsAdmin(tokenUser, idToken))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      // Try Firestore REST first (merges with local store)
      try {
        const fsDocs = await fetchFirestoreCollection('users', idToken);
        if (fsDocs.length > 0) {
          fsDocs.forEach((d: any) => {
            const uid = d.id || d.uid;
            if (uid) {
              const existing = userStore.get(uid);
              userStore.set(uid, {
                uid,
                email: d.email || '',
                displayName: d.displayName || '',
                photoURL: d.photoURL || null,
                role: d.role || 'user',
                plan: d.role === 'admin' ? 'premium' : normalizePlanId(d.plan || existing?.plan),
                createdAt: d.createdAt || existing?.createdAt || new Date().toISOString(),
              });
            }
          });
          saveUsersStore();
          console.log(`[admin/users] Firestore returned ${fsDocs.length} users`);
          return res.json({ users: Array.from(userStore.values()) });
        }
      } catch (fsErr: any) {
        console.warn('[admin/users] Firestore REST failed, using local store:', fsErr.message);
      }

      res.json({ users: Array.from(userStore.values()) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Get user plan ───────────────────────────────────────────────
  app.get('/api/user/plan', async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });
      
      const existing = userStore.get(tokenUser.uid);
      const firestoreProfile = await fetchFirestoreDocument('users', tokenUser.uid, idToken).catch(() => null);
      const role = tokenUser.email === ADMIN_EMAIL || firestoreProfile?.role === 'admin'
        ? 'admin'
        : existing?.role || 'user';
      const resolved = resolvePlanForUser({
        email: tokenUser.email,
        role,
        plan: firestoreProfile?.plan || existing?.plan,
      });

      res.json({
        plan: resolved.plan,
        adminAccess: resolved.adminAccess,
        limits: resolved.limits,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin: set user plan ────────────────────────────────────────
  app.post('/api/user/set-plan', express.json(), async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser || !(await tokenUserIsAdmin(tokenUser, idToken))) return res.status(403).json({ error: 'forbidden' });
      const { uid, plan } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'uid required' });
      const nextPlan = normalizePlanId(plan);
      const existing = userStore.get(uid);
      if (!existing) return res.status(404).json({ error: 'user not found' });
      userStore.set(uid, { ...existing, plan: existing.role === 'admin' ? 'premium' : nextPlan });
      saveUsersStore();
      res.json({ ok: true, uid, plan: existing.role === 'admin' ? 'premium' : nextPlan });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin: get all quizzes ──────────────────────────────────────
  app.get('/api/admin/quizzes', async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser || !(await tokenUserIsAdmin(tokenUser, idToken))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const fsDocs = await fetchFirestoreCollection('quizzes', idToken, 300);
      const quizzes = fsDocs.map((d: any) => ({
        id: d.id,
        title: d.title || '',
        category: d.category || '',
        authorUid: d.authorUid || '',
        createdAt: d.createdAt || null,
      }));
      res.json({ quizzes });
    } catch (e: any) {
      console.error('[admin/quizzes]', e.message);
      res.status(500).json({ error: e.message, quizzes: [] });
    }
  });

  // ── Public sharing: create a guest exam link for one quiz ───────
  app.post('/api/share-quiz', express.json(), async (req: any, res: any) => {
    let isOwnerRequest = false;
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });

      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });
      isOwnerRequest = tokenUser.email === ADMIN_EMAIL;

      const { quizId } = req.body || {};
      if (!quizId || typeof quizId !== 'string') {
        return res.status(400).json({ error: 'quizId required' });
      }

      const quiz = await fetchFirestoreDocument('quizzes', quizId, idToken);
      if (!quiz) return res.status(404).json({ error: 'quiz not found' });
      if (quiz.authorUid !== tokenUser.uid && tokenUser.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        return res.status(400).json({ error: 'quiz has no questions' });
      }

      const existing = Array.from(sharedQuizStore.values())
        .find(shared => shared.quizId === quizId && shared.ownerUid === tokenUser.uid);

      const shareId = existing?.shareId || randomUUID().replace(/-/g, '').slice(0, 16);
      const record: SharedQuizRecord = {
        shareId,
        quizId,
        title: quiz.title || 'Shared Quiz',
        description: quiz.description || '',
        category: quiz.category || 'General',
        difficulty: quiz.difficulty || 'medium',
        feedbackMode: quiz.feedbackMode === 'per-question' ? 'per-question' : 'end',
        timer: Number(quiz.timer ?? 10),
        questions: quiz.questions,
        ownerUid: tokenUser.uid,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      sharedQuizStore.set(shareId, record);
      saveSharedQuizzes();
      res.json({ shareId, url: `/exam/${shareId}` });
    } catch (e: any) {
      console.error('[share-quiz]', e.message);
      res.status(500).json({
        error: privateDetails(isOwnerRequest, e.message || String(e), 'تعذر إنشاء رابط المشاركة حالياً.'),
      });
    }
  });

  // ── Public sharing: read a shared quiz without login ────────────
  app.get('/api/shared-quiz/:shareId', (req: any, res: any) => {
    const shareId = String(req.params.shareId || '');
    const shared = sharedQuizStore.get(shareId);
    if (!shared) return res.status(404).json({ error: 'shared quiz not found' });

    res.json({
      quiz: {
        id: shared.shareId,
        sourceQuizId: shared.quizId,
        title: shared.title,
        description: shared.description || '',
        category: shared.category || 'General',
        difficulty: shared.difficulty || 'medium',
        feedbackMode: shared.feedbackMode === 'per-question' ? 'per-question' : 'end',
        timer: shared.timer,
        questions: shared.questions,
      },
    });
  });

  // ── Admin: get all visitors ─────────────────────────────────────
  app.get('/api/admin/visitors', async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser || !(await tokenUserIsAdmin(tokenUser, idToken))) {
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
      const safeEmail = tokenUser.email || '';
      const safeRole = safeEmail === ADMIN_EMAIL ? 'admin' : 'user';

      // Always save to local store first (guaranteed to work)
      userStore.set(profileData.uid, {
        uid: profileData.uid,
        email: safeEmail,
        displayName: profileData.displayName || '',
        photoURL: profileData.photoURL || null,
        role: safeRole,
        plan: safeRole === 'admin' ? 'premium' : 'free',
        createdAt: now,
      });
      saveUsersStore();
      console.log('[ensure-profile] Profile saved locally for uid:', profileData.uid);

      // Also try Firestore REST (best-effort, don't block response)
      const fields: Record<string, any> = {
        uid:         { stringValue: profileData.uid },
        email:       { stringValue: safeEmail },
        displayName: { stringValue: profileData.displayName || '' },
        photoURL:    profileData.photoURL ? { stringValue: profileData.photoURL } : { nullValue: null },
        role:        { stringValue: safeRole },
        plan:        { stringValue: safeRole === 'admin' ? 'premium' : 'free' },
        createdAt:   { timestampValue: now },
      };

      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/users/${profileData.uid}`;
      fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ fields }),
      }).then(async (fsRes) => {
        if (!fsRes.ok) {
          const fsData: any = await fsRes.json().catch(() => ({}));
          console.warn('[ensure-profile] Firestore REST failed (local save succeeded):', fsData?.error?.message);
        } else {
          console.log('[ensure-profile] Profile also saved to Firestore for uid:', profileData.uid);
        }
      }).catch((e) => console.warn('[ensure-profile] Firestore REST error:', e.message));

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Health check route
  app.get('/api/health', (req, res) => {
    const apiKey = getServerGeminiApiKey();
    const hasKey = !!apiKey;
    res.json({ 
      status: 'ok', 
      message: 'Server is running', 
      hasGeminiKey: hasKey,
      hasGroqKey: !!process.env.GROQ_API_KEY,
    });
  });

  // AI generation routes
  app.post('/api/generate-quiz', express.json({ limit: '10mb' }), async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });
      enforceQuizRateLimit(tokenUser, req.ip);

      const { content, image, numQuestions, language, difficulty, notes } = req.body || {};
      if (!content && !image) {
        return res.status(400).json({ error: 'content or image required' });
      }

      const quiz = await generateQuizFromContent({ content, image, numQuestions, language, difficulty, notes });
      res.json(quiz);
    } catch (e: any) {
      console.error('[generate-quiz] error:', e?.message || e);
      const status = Number(e?.statusCode) || (/json|schema|invalid/i.test(e?.message || '') ? 502 : 500);
      res.status(status).json({
        error: e?.message || 'Failed to generate quiz',
        code: e?.code || (status === 502 ? 'AI_RESPONSE_INVALID' : 'QUIZ_GENERATION_FAILED'),
        details: status === 502 ? 'The model response could not be converted into the required quiz JSON schema.' : undefined,
      });
    }
  });

  app.post('/api/generate-mindmap', express.json({ limit: '10mb' }), async (req: any, res: any) => {
    try {
      const idToken = (req.headers.authorization || '').replace('Bearer ', '');
      if (!idToken) return res.status(401).json({ error: 'unauthorized' });
      const tokenUser = await verifyFirebaseToken(idToken);
      if (!tokenUser) return res.status(401).json({ error: 'invalid token' });
      enforceSimpleRateLimit({
        bucket: 'mindmap',
        key: tokenUser.uid || req.ip,
        maxRequests: MINDMAP_RATE_LIMIT_MAX,
        windowMs: MINDMAP_RATE_LIMIT_WINDOW_MS,
        message: 'تم الوصول للحد المؤقت لإنشاء الخرائط الذهنية. حاول لاحقًا.',
      });

      const { topic, content, filename } = req.body || {};
      if (typeof topic === 'string' && topic.trim().length > 0) {
        const mapData = await generateMindMap(topic.trim());
        return res.json(mapData);
      }
      if (typeof content === 'string' && content.trim().length > 0) {
        const mapData = await generateMindMapFromContent(content, filename);
        return res.json(mapData);
      }
      res.status(400).json({ error: 'topic or content required' });
    } catch (e: any) {
      console.error('[generate-mindmap] error:', e?.message || e);
      res.status(Number(e?.statusCode) || 500).json({ error: e?.message || 'Failed to generate mind map' });
    }
  });

  // API Routes
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  
  app.post('/api/parse-file', upload.single('file'), async (req: any, res: any, next: any) => {
    console.log('--- NEW PARSE REQUEST ---');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    const safeHeaders = { ...req.headers, authorization: req.headers.authorization ? '[redacted]' : undefined };
    console.log('Headers:', JSON.stringify(safeHeaders, null, 2));
    console.log('File:', req.file ? `${req.file.originalname} (${req.file.mimetype})` : 'NO FILE');
    let isOwnerRequest = false;
    
    try {
      enforceSimpleRateLimit({
        bucket: 'parse-file',
        key: getBearerToken(req) || req.ip,
        maxRequests: FILE_PARSE_RATE_LIMIT_MAX,
        windowMs: FILE_PARSE_RATE_LIMIT_WINDOW_MS,
        message: 'تم الوصول للحد المؤقت لمعالجة الملفات. حاول لاحقًا.',
      });

      isOwnerRequest = await requestIsOwner(req);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded', details: 'لم يتم رفع أي ملف.' });
      }

      const idToken = getBearerToken(req);
      const tokenUser = idToken ? await verifyFirebaseToken(idToken) : null;
      const existingUser = tokenUser ? userStore.get(tokenUser.uid) : null;
      const userPlan = tokenUser
        ? resolvePlanForUser({ email: tokenUser.email, role: existingUser?.role, plan: existingUser?.plan })
        : resolvePlanForUser({ plan: 'free' });
      const planLimits: any = userPlan.limits === 'unlimited' ? null : userPlan.limits;
      const maxFileSizeMB = planLimits?.maxFileSizeMB === 'unlimited' || !planLimits
        ? Number.POSITIVE_INFINITY
        : Number(planLimits.maxFileSizeMB);
      if (req.file.size > maxFileSizeMB * 1024 * 1024) {
        return res.status(413).json({
          error: 'File too large for current plan',
          details: `Your current plan allows files up to ${maxFileSizeMB} MB.`,
        });
      }

      const { mimetype, buffer, originalname } = req.file;
      const lowerName = originalname.toLowerCase();
      console.log(`Processing file: ${originalname}, size: ${buffer.length} bytes, type: ${mimetype}`);
      console.log('Buffer preview (hex):', buffer.slice(0, 20).toString('hex'));
      let text = '';
      let extractionMethod = 'unknown';
      let usedOcr = false;
      let allowUtf8Fallback = true;
      const diagnostics: ExtractionDiagnostics = {};

      // Images and scanned pages use specialized OCR libraries first.
      const isImage = IMAGE_MIME_TYPES.has(mimetype) ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff'].some(e => lowerName.endsWith(e));

      if (isImage) {
        console.log('Image file detected - running specialized OCR libraries...');
        const imageMime = mimetype.startsWith('image/') ? mimetype : `image/${lowerName.split('.').pop()}`;
        usedOcr = true;
        allowUtf8Fallback = false;
        const ocr = await extractWithBestOcr(buffer, imageMime, 'image');
        extractionMethod = ocr.method;
        text = ocr.text;
      } else if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        console.log('Parsing PDF...');
        extractionMethod = 'pdf-parser';
        allowUtf8Fallback = false;
        try {
          const data = await pdfParser(buffer);
          text = normalizeExtractedFileText(data?.text || '');
          console.log('PDF extraction result length:', text.length);
          if (text.trim().length < 100) {
            console.log('PDF text too short — likely scanned. Rendering pages to images for OCR...');
            const imageOcr = await extractPdfImageOcr(buffer);
            diagnostics.renderedPdfPages = imageOcr.pageCount;
            diagnostics.ocrPdfPages = imageOcr.ocrPageCount;
            diagnostics.ocrChars = imageOcr.ocrChars;

            if (imageOcr.text.length > text.trim().length) {
              text = imageOcr.text;
              extractionMethod = imageOcr.method || 'gemini-ocr-pdf-images';
              usedOcr = true;
              console.log('PDF image OCR improved result:', text.length, 'chars');
            } else if (ALLOW_GEMINI_OCR_FALLBACK) {
              console.log('PDF image OCR did not extract enough text. Trying optional Gemini PDF OCR fallback...');
              const ocrText = await extractWithGeminiOcr(buffer, 'application/pdf');
              if (ocrText.length > text.trim().length) {
                text = ocrText;
                extractionMethod = 'gemini-ocr-pdf';
                usedOcr = true;
                console.log('Optional Gemini PDF OCR improved result:', text.length, 'chars');
              }
            }
          }
        } catch (err: any) {
          console.error('PDF Parse failed — rendering pages to images for OCR:', err?.message);
          const imageOcr = await extractPdfImageOcr(buffer);
          diagnostics.renderedPdfPages = imageOcr.pageCount;
          diagnostics.ocrPdfPages = imageOcr.ocrPageCount;
          diagnostics.ocrChars = imageOcr.ocrChars;

          if (imageOcr.text) {
            text = imageOcr.text;
            extractionMethod = imageOcr.method || 'gemini-ocr-pdf-images';
            usedOcr = true;
          } else if (ALLOW_GEMINI_OCR_FALLBACK) {
            extractionMethod = 'gemini-ocr-pdf';
            text = await extractWithGeminiOcr(buffer, 'application/pdf');
            usedOcr = !!text;
          } else {
            extractionMethod = imageOcr.method || 'local-ocr-failed';
            text = '';
            usedOcr = true;
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
        extractionMethod = 'office-parser';
        allowUtf8Fallback = false;
        try {
          if (originalname.toLowerCase().endsWith('.pptx')) {
            try {
              console.log('Using PPTX zip text extractor');
              text = await extractPptxTextFromZip(buffer);
              if (text) extractionMethod = 'pptx-zip-text';
            } catch (pptxErr) {
              console.error('PPTX zip extraction failed, falling back to officeParser:', pptxErr);
            }
          }

          // Special handling for .docx which mammoth handles better
          if (!text && originalname.toLowerCase().endsWith('.docx')) {
            try {
              console.log('Using mammoth for .docx');
              const result = await mammoth.extractRawText({ buffer });
              text = result.value;
              if (text) extractionMethod = 'mammoth-docx';
            } catch (mErr) {
              console.error('Mammoth failed, falling back to officeParser:', mErr);
            }
          }

          // If mammoth didn't get text or it's not a docx, use officeParser
          if (!text) {
            try {
              // Wrap officeParser in a try-catch to handle its internal errors gracefully
              const extracted = await officeParser.parseOffice(buffer);
              text = extractMeaningfulOfficeText(extracted);
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
                      else resolve(extractMeaningfulOfficeText(data));
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

          const isPresentation = lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') ||
            mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            mimetype === 'application/vnd.ms-powerpoint';
          const isTechnicalDump = looksLikeTechnicalOfficeDump(text);
          const embeddedImageCount = isPresentation ? (await getOfficeImageEntries(buffer)).length : 0;
          const shouldOcrOfficeImages = isPresentation && embeddedImageCount > 0 &&
            (isTechnicalDump || text.trim().length < 1200 || embeddedImageCount >= 3);

          if (!text || isTechnicalDump || shouldOcrOfficeImages) {
            console.log(`Office parser returned ${text?.length || 0} chars and ${embeddedImageCount} embedded images. Trying OCR on embedded images...`);
            const officeOcr = await extractOfficeImageOcr(buffer);
            diagnostics.embeddedImageCount = officeOcr.imageCount;
            diagnostics.ocrImageCount = officeOcr.ocrImageCount;
            diagnostics.ocrChars = officeOcr.ocrChars;
            if (officeOcr.quotaExhausted) {
              diagnostics.note = 'OCR quota was exhausted after partial Office image extraction.';
            }

            if (officeOcr.text) {
              const existingText = isTechnicalDump ? '' : text.trim();
              text = [existingText, officeOcr.text].filter(Boolean).join('\n\n');
              extractionMethod = officeOcr.method || 'gemini-ocr-office-images';
              usedOcr = true;
            } else if (isTechnicalDump) {
              text = '';
              diagnostics.note = 'Embedded images were found, but OCR returned no readable text.';
            }
          }
          
          console.log('Office extraction result length:', text?.length || 0);
        } catch (err: any) {
          console.error('Office document parse block failed:', err);
          if (err?.statusCode) {
            throw err;
          }
        }
      } else if (mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv')) {
        console.log('Parsing CSV...');
        extractionMethod = 'csv-parser';
        try {
          const records = csvParse(buffer.toString(), { skip_empty_lines: true });
          text = formatCsvRecordsForPreview(records);
        } catch (err: any) {
          console.error('CSV Parse failed:', err);
          extractionMethod = 'utf8-fallback';
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
        extractionMethod = 'plain-text';
        text = buffer.toString('utf-8');
      } else {
        // Generic fallback for unknown types - try as text
        console.log('Unknown mimetype, trying as plain text:', mimetype);
        extractionMethod = 'utf8-fallback';
        text = buffer.toString('utf-8');
      }

      // Final cleanup and validation
      if (typeof text !== 'string') {
        text = String(text || '');
      }
      
      if (looksLikeTechnicalOfficeDump(text)) {
        text = '';
      }

      if (allowUtf8Fallback && (!text || text.length < 10 || text === '[object Object]')) {
        console.log('All parsers failed, trying final UTF-8 fallback...');
        extractionMethod = 'utf8-fallback';
        usedOcr = false;
        text = buffer.toString('utf-8').replace(/[^\x20-\x7E\s\u0600-\u06FF]/g, ''); // Keep Arabic characters too
      }

      text = normalizeExtractedFileText(text);
      
      if (!text || text.length < 10 || text === '[object Object]') {
        console.error('Extraction failed or resulted in too little text. Length:', text?.length);
        const diagnosticMessage = diagnostics.embeddedImageCount !== undefined
          ? ` Found ${diagnostics.embeddedImageCount} embedded images; OCR read ${diagnostics.ocrChars || 0} characters from ${diagnostics.ocrImageCount || 0} images.`
          : diagnostics.renderedPdfPages !== undefined
            ? ` Rendered ${diagnostics.renderedPdfPages} PDF pages; OCR read ${diagnostics.ocrChars || 0} characters from ${diagnostics.ocrPdfPages || 0} pages.`
          : '';
        const ownerDetails = `Detected type: ${mimetype}, Size: ${buffer.length} bytes, Extracted length: ${text?.length || 0}.${diagnosticMessage} The file might be empty, encrypted, image-only, or too low-resolution for OCR.`;
        return res.status(400).json({ 
          error: 'Could not extract meaningful text from this file.',
          details: privateDetails(
            isOwnerRequest,
            ownerDetails,
            'تعذر استخراج نص واضح من الملف. جرّب ملفاً نصياً أو صورة أوضح، ثم حاول مرة أخرى.'
          )
        });
      }

      console.log('Successfully extracted text, length:', text.length);
      res.json({
        text: text.substring(0, 100000),
        extraction: {
          method: extractionMethod,
          usedOcr,
          length: text.length,
          returnedLength: Math.min(text.length, 100000),
          originalName: originalname,
          mimeType: mimetype,
          diagnostics,
        },
      }); // Increased limit to 100k
    } catch (error: any) {
      console.error('Parsing error details:', error);
      const statusCode = Number(error?.statusCode) || 500;
      res.status(statusCode).json({
        error: statusCode === 429 ? 'AI quota exceeded' : 'Failed to parse file',
        details: privateDetails(
          isOwnerRequest,
          error.message || String(error),
          error?.publicMessage || 'حدث خطأ أثناء معالجة الملف. حاول مرة أخرى لاحقاً.'
        )
      });
    }
  });

  // Global error handler to ensure JSON is always returned for API routes
  app.use('/api', async (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    const isOwnerRequest = await requestIsOwner(req).catch(() => false);
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: privateDetails(
          isOwnerRequest,
          `Maximum upload size is ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB.`,
          'حجم الملف أكبر من الحد المسموح.'
        ),
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      details: privateDetails(
        isOwnerRequest,
        err.message || String(err),
        'حدث خطأ داخلي. حاول مرة أخرى لاحقاً.'
      ),
    });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  console.log(`Server starting in ${isProduction ? 'production' : 'development'} mode`);

  if (serveClient) {
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
  }

  return app;
}

async function startServer() {
  const app = await createApp({ serveClient: true });
  const PORT = Number(process.env.PORT || 5000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer();
}
