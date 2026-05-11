# Local OCR Setup

The app now separates responsibilities:

- Local OCR extracts text from images, scanned PDFs, and image-only PowerPoint slides.
- Gemini receives extracted text only and generates quizzes or mind maps.

## Default behavior

The server tries OCR in this order:

1. Tesseract.js through Node.js as the default local OCR engine.
2. PaddleOCR through `tools/local_ocr.py` if Python and PaddleOCR are installed.

Gemini does not run OCR by default. Its role is generating quizzes and mind maps from extracted text.

## Install PaddleOCR

PaddleOCR gives better results for scanned slides and Arabic/English educational material.

```powershell
python -m pip install -r requirements-ocr.txt
```

If Python is installed in a custom path, add this to `.env.local`:

```env
LOCAL_OCR_PYTHON=C:\Path\To\python.exe
```

Useful optional settings:

```env
PADDLEOCR_LANG=arabic
LOCAL_OCR_LANGS=ara+eng
LOCAL_OCR_TIMEOUT_MS=180000
LOCAL_OCR_MIN_CHARS=10
```

If you explicitly want Gemini to act as an emergency OCR fallback, add:

```env
ALLOW_GEMINI_OCR_FALLBACK=true
```

To disable local OCR:

```env
DISABLE_LOCAL_OCR=true
```

To disable one local engine:

```env
DISABLE_PADDLE_OCR=true
DISABLE_TESSERACT_JS_OCR=true
```
