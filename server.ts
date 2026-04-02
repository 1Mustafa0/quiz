import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
import mammothImport from 'mammoth';
const mammoth = (mammothImport as any).default || mammothImport;
import officeParserImport from 'officeparser';
const officeParser = (officeParserImport as any).default || officeParserImport;
import { parse as csvParse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running', env: process.env.NODE_ENV });
  });

  // API Routes
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
      console.log(`Processing file: ${originalname}, size: ${buffer.length} bytes, type: ${mimetype}`);
      console.log('Buffer preview (hex):', buffer.slice(0, 20).toString('hex'));
      let text = '';

      if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
        console.log('Parsing PDF...');
        try {
          const data = await pdfParser(buffer);
          text = data?.text || '';
          console.log('PDF extraction result length:', text.length);
          if (text.length < 50) {
            console.log('PDF text too short, might be scanned. Preview:', text.substring(0, 100));
          }
        } catch (err: any) {
          console.error('PDF Parse failed:', err);
          text = buffer.toString('utf-8').replace(/[^\x20-\x7E\s]/g, '');
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
          // Try promise first
          try {
            const extracted = await officeParser.parseOffice(buffer);
            text = typeof extracted === 'string' ? extracted : (extracted?.text || JSON.stringify(extracted));
          } catch (pErr) {
            console.log('Office promise API failed, trying callback API...');
            text = await new Promise((resolve, reject) => {
              officeParser.parseOffice(buffer, (data: any, err: any) => {
                if (err) reject(err);
                else resolve(typeof data === 'string' ? data : (data?.text || JSON.stringify(data)));
              });
            });
          }
          console.log('Office extraction successful, length:', text?.length);
        } catch (err: any) {
          console.error('Office document parse failed:', err);
          if (originalname.toLowerCase().endsWith('.docx')) {
            console.log('Falling back to mammoth for .docx');
            try {
              const result = await mammoth.extractRawText({ buffer });
              text = result.value;
            } catch (mErr) {
              console.error('Mammoth fallback failed:', mErr);
            }
          }
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
          details: `Detected type: ${mimetype}, Size: ${buffer.length} bytes, Extracted length: ${text?.length || 0}. The file might be empty, encrypted, or contain only images. If it is an image-based PDF, please try uploading it as an image file (JPG/PNG) instead.`
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

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = require('fs').existsSync(distPath);

  console.log(`Server starting in ${isProduction ? 'production' : 'development'} mode`);
  console.log(`Dist directory exists: ${hasDist}`);

  if (!isProduction || !hasDist) {
    console.log('Using Vite middleware for serving assets');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving static assets from dist directory');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
