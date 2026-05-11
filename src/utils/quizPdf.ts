export interface PdfQuizQuestion {
  type?: string;
  questionText?: string;
  options?: string[];
  correctAnswer?: string;
  feedback?: string;
}

export interface PdfQuizData {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  timer?: number;
  questions?: PdfQuizQuestion[];
  createdAt?: any;
}

const BRAND_NAME = 'AI Quiz Master';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const optionLabel = (index: number) => String.fromCharCode(65 + index);

const sanitizeFileName = (value: string) => {
  const clean = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return clean || 'quiz';
};

const buildQuestionHtml = (question: PdfQuizQuestion, index: number) => {
  const options = Array.isArray(question.options) ? question.options : [];
  const optionsHtml = options.length
    ? options.map((option, optionIndex) => `
        <li class="option">
          <span class="option-label">${optionLabel(optionIndex)}</span>
          <span dir="auto">${escapeHtml(option)}</span>
        </li>
      `).join('')
    : '<li class="option empty-line"><span></span></li>';

  return `
    <article class="question-card">
      <div class="question-heading">
        <span class="question-number">${index + 1}</span>
        <span class="question-type">Multiple choice</span>
      </div>
      <h2 dir="auto">${escapeHtml(question.questionText || `Question ${index + 1}`)}</h2>
      <ol class="options-list">${optionsHtml}</ol>
    </article>
  `;
};

const buildAnswerKeyHtml = (questions: PdfQuizQuestion[]) => {
  if (!questions.length) {
    return '<p class="muted">No answer key available.</p>';
  }

  return questions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options : [];
    const answerIndex = options.findIndex(option => option === question.correctAnswer);
    const answerLabel = answerIndex >= 0 ? `${optionLabel(answerIndex)}. ` : '';
    const feedback = question.feedback
      ? `<div class="feedback" dir="auto">${escapeHtml(question.feedback)}</div>`
      : '';

    return `
      <div class="answer-row">
        <strong>${index + 1}</strong>
        <span dir="auto">${answerLabel}${escapeHtml(question.correctAnswer || 'Not specified')}</span>
        ${feedback}
      </div>
    `;
  }).join('');
};

export const buildQuizPdfHtml = (quiz: PdfQuizData) => {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const title = quiz.title?.trim() || 'Untitled Quiz';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - PDF</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      line-height: 1.6;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 18mm;
      position: relative;
    }
    .top-rule {
      height: 10px;
      margin: -18mm -18mm 18mm;
      background: linear-gradient(90deg, #4f46e5, #0f766e 50%, #f59e0b);
    }
    .brand-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      direction: ltr;
    }
    .brand-mark {
      width: 48px;
      height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: #111827;
      color: #ffffff;
      font-weight: 900;
      letter-spacing: .5px;
      box-shadow: inset 0 0 0 3px rgba(255,255,255,.12);
    }
    .brand-title {
      margin: 0;
      font-size: 20px;
      letter-spacing: 0;
    }
    .brand-subtitle {
      margin: 2px 0 0;
      color: #6b7280;
      font-size: 12px;
    }
    .doc-label {
      min-width: 130px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 10px 12px;
      text-align: center;
      color: #374151;
      font-weight: 800;
      background: #f9fafb;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 12px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .section-title h2 {
      margin: 0;
      font-size: 18px;
      color: #111827;
    }
    .question-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 14px;
      margin: 0 0 12px;
      background: #ffffff;
    }
    .question-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .question-number {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: #4f46e5;
      color: #ffffff;
      font-weight: 900;
      direction: ltr;
    }
    .question-type {
      color: #0f766e;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .04em;
      direction: ltr;
    }
    .question-card h2 {
      margin: 0 0 12px;
      font-size: 16px;
      line-height: 1.55;
      color: #111827;
      font-weight: 800;
    }
    .options-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .option {
      display: grid;
      grid-template-columns: 30px 1fr;
      align-items: start;
      gap: 8px;
      min-height: 34px;
      padding: 8px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #f9fafb;
    }
    .option-label {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #f59e0b;
      color: #111827;
      font-weight: 900;
      font-size: 12px;
      direction: ltr;
    }
    .empty-line {
      min-height: 42px;
      background-image: repeating-linear-gradient(to right, transparent 0, transparent 18px, rgba(17, 24, 39, .12) 19px);
    }
    .answer-key {
      break-before: page;
      page-break-before: always;
    }
    .answer-row {
      break-inside: avoid;
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 10px;
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 0;
    }
    .answer-row strong {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #ecfdf5;
      color: #047857;
      direction: ltr;
    }
    .feedback {
      grid-column: 2;
      color: #6b7280;
      font-size: 12px;
      margin-top: -4px;
    }
    .muted {
      color: #6b7280;
      font-size: 13px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 11px;
      direction: ltr;
    }
    @media print {
      body { background: #ffffff; }
      .sheet {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
      }
      .top-rule { margin: 0 0 16px; }
      .question-card, .answer-row { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="top-rule"></div>
    <header class="brand-row">
      <div class="brand">
        <div class="brand-mark">AQ</div>
        <div>
          <h2 class="brand-title">${BRAND_NAME}</h2>
          <p class="brand-subtitle">Unified smart quiz template</p>
        </div>
      </div>
      <div class="doc-label">Exam PDF</div>
    </header>

    <section>
      <div class="section-title">
        <h2>الأسئلة</h2>
      </div>
      ${questions.length ? questions.map(buildQuestionHtml).join('') : '<p class="muted">No questions were found in this quiz.</p>'}
    </section>

    <section class="answer-key">
      <div class="section-title">
        <h2>نموذج الإجابة</h2>
      </div>
      ${buildAnswerKeyHtml(questions)}
    </section>

    <footer class="footer">
      <span>${BRAND_NAME}</span>
    </footer>
  </main>
</body>
</html>`;
};

const createPdfRenderElement = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const style = parsed.querySelector('style');
  const sheet = parsed.querySelector('.sheet');

  if (!sheet) return null;

  const styleEl = document.createElement('style');
  styleEl.textContent = style?.textContent || '';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.style.background = '#ffffff';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '-1';
  wrapper.appendChild(sheet.cloneNode(true));

  document.head.appendChild(styleEl);
  document.body.appendChild(wrapper);

  return {
    element: wrapper.firstElementChild as HTMLElement,
    cleanup: () => {
      wrapper.remove();
      styleEl.remove();
    },
  };
};

export const exportQuizToPdf = async (quiz: PdfQuizData) => {
  if (typeof document === 'undefined') return false;

  const html = buildQuizPdfHtml(quiz);
  const renderTarget = createPdfRenderElement(html);
  if (!renderTarget?.element) return false;

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;
    const title = quiz.title?.trim() || 'quiz';

    await html2pdf()
      .set({
        filename: `${sanitizeFileName(title)}.pdf`,
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.question-card', '.answer-row'] },
      })
      .from(renderTarget.element)
      .save();

    return true;
  } catch (error) {
    console.error('[PDF] Direct download failed:', error);
    return false;
  } finally {
    renderTarget.cleanup();
  }
};
