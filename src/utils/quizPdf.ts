export interface PdfQuizQuestion {
  type?: string;
  questionText?: string;
  options?: unknown;
  choices?: unknown;
  answers?: unknown;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
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
let html2pdfImportPromise: Promise<any> | null = null;

const loadHtml2Pdf = async () => {
  if (!html2pdfImportPromise) {
    html2pdfImportPromise = import('html2pdf.js')
      .then((module) => (module as any).default || module)
      .catch((error) => {
        html2pdfImportPromise = null;
        throw error;
      });
  }

  return html2pdfImportPromise;
};

export const preloadQuizPdfExporter = () => {
  if (typeof window === 'undefined') return;

  const idleCallback = (window as any).requestIdleCallback as
    | ((callback: () => void, options?: { timeout?: number }) => number)
    | undefined;

  if (idleCallback) {
    idleCallback(() => { void loadHtml2Pdf(); }, { timeout: 2500 });
    return;
  }

  window.setTimeout(() => { void loadHtml2Pdf(); }, 700);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const optionLabel = (index: number) => String.fromCharCode(65 + index);
const optionLetters = ['A', 'B', 'C', 'D'];

const normalizeComparable = (value: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const getAnswerFromOptionObject = (question: PdfQuizQuestion) => {
  if (!question) return '';

  const values = [
    question.options,
    question.choices,
    question.answers,
  ];

  for (const value of values) {
    if (Array.isArray(value)) {
      const correctOption = value.find((option) => {
        if (!option || typeof option !== 'object') return false;
        const objectOption = option as Record<string, unknown>;
        return Boolean(
          objectOption.isCorrect ??
          objectOption.correct ??
          objectOption.is_answer ??
          objectOption.isAnswer
        );
      });

      if (correctOption && typeof correctOption === 'object') {
        const objectOption = correctOption as Record<string, unknown>;
        return String(
          objectOption.text ??
          objectOption.label ??
          objectOption.value ??
          objectOption.answer ??
          objectOption.title ??
          ''
        ).trim();
      }
    }
  }

  return '';
};

export const getPdfQuestionOptions = (question: PdfQuizQuestion) => {
  if (!question) return [];

  const normalize = (value: unknown) => {
    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      return String(
        objectValue.text ??
        objectValue.label ??
        objectValue.value ??
        objectValue.answer ??
        objectValue.title ??
        ''
      ).trim();
    }

    return String(value ?? '').trim();
  };

  const fromArray = (value: unknown) => Array.isArray(value)
    ? value.map(normalize).filter(Boolean)
    : [];

  const fromObject = (value: unknown) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return [];
    const objectValue = value as Record<string, unknown>;
    return [
      objectValue.optionA,
      objectValue.optionB,
      objectValue.optionC,
      objectValue.optionD,
      objectValue.A,
      objectValue.B,
      objectValue.C,
      objectValue.D,
      objectValue.a,
      objectValue.b,
      objectValue.c,
      objectValue.d,
      objectValue['0'],
      objectValue['1'],
      objectValue['2'],
      objectValue['3'],
    ].map(normalize).filter(Boolean).slice(0, 4);
  };

  const directOptions = fromArray(question.options);
  if (directOptions.length) return directOptions;

  const objectOptions = fromObject(question.options);
  if (objectOptions.length) return objectOptions;

  const legacyChoices = fromArray(question.choices);
  if (legacyChoices.length) return legacyChoices;

  const objectChoices = fromObject(question.choices);
  if (objectChoices.length) return objectChoices;

  const legacyAnswers = fromArray(question.answers);
  if (legacyAnswers.length) return legacyAnswers;

  const objectAnswers = fromObject(question.answers);
  if (objectAnswers.length) return objectAnswers;

  return [
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
    (question as any).option1,
    (question as any).option2,
    (question as any).option3,
    (question as any).option4,
    (question as any).A,
    (question as any).B,
    (question as any).C,
    (question as any).D,
    (question as any).a,
    (question as any).b,
    (question as any).c,
    (question as any).d,
  ].map(normalize).filter(Boolean).slice(0, 4);
};

export const getPdfQuestionAnswer = (question: PdfQuizQuestion) => {
  const options = getPdfQuestionOptions(question);
  const answerValue = [
    question.correctAnswer,
    (question as any).answer,
    (question as any).correct,
    (question as any).correct_answer,
    (question as any).rightAnswer,
    (question as any).right_answer,
    (question as any).correctOption,
    (question as any).correct_option,
    (question as any).correctIndex,
    (question as any).correct_index,
    (question as any).answerIndex,
    (question as any).answer_index,
    (question as any).correctChoice,
    (question as any).correct_choice,
    getAnswerFromOptionObject(question),
  ].find(value => String(value ?? '').trim() !== '');

  const answerText = String(answerValue ?? '').trim();
  if (!answerText) return { text: '', index: -1 };

  const numericIndex = Number(answerText);
  if (Number.isInteger(numericIndex)) {
    const zeroBasedIndex = numericIndex >= 1 && numericIndex <= options.length
      ? numericIndex - 1
      : numericIndex;
    if (zeroBasedIndex >= 0 && zeroBasedIndex < options.length) {
      return { text: options[zeroBasedIndex], index: zeroBasedIndex };
    }
  }

  const letterIndex = optionLetters.findIndex(letter => letter.toLowerCase() === answerText.toLowerCase());
  if (letterIndex >= 0 && letterIndex < options.length) {
    return { text: options[letterIndex], index: letterIndex };
  }

  const exactIndex = options.findIndex(option => option === answerText);
  if (exactIndex >= 0) return { text: options[exactIndex], index: exactIndex };

  const normalizedIndex = options.findIndex(option => normalizeComparable(option) === normalizeComparable(answerText));
  if (normalizedIndex >= 0) return { text: options[normalizedIndex], index: normalizedIndex };

  return { text: answerText, index: -1 };
};

const sanitizeFileName = (value: string) => {
  const clean = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return clean || 'quiz';
};

const buildQuestionHtml = (question: PdfQuizQuestion, index: number) => {
  const options = getPdfQuestionOptions(question);
  const optionsHtml = options.length
    ? options.map((option, optionIndex) => `
        <li class="option">
          <span class="option-label">${optionLabel(optionIndex)}</span>
          <span class="option-text" dir="auto">${escapeHtml(option)}</span>
        </li>
      `).join('')
    : '<li class="option missing-option"><span class="option-label">!</span><span class="option-text">الاختيارات غير محفوظة لهذا السؤال</span></li>';

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
    const answer = getPdfQuestionAnswer(question);
    const answerIndex = answer.index;
    const answerLabel = answerIndex >= 0 ? `${optionLabel(answerIndex)}. ` : '';
    const feedback = question.feedback
      ? `<div class="feedback" dir="auto">${escapeHtml(question.feedback)}</div>`
      : '';

    return `
      <div class="answer-row">
        <strong>${index + 1}</strong>
        <span dir="auto">${answerLabel}${escapeHtml(answer.text || 'Not specified')}</span>
        ${feedback}
      </div>
    `;
  }).join('');
};

const getPdfCanvasScale = (questionCount: number) => {
  const deviceScale = window.devicePixelRatio || 1;
  const baseScale = deviceScale > 1.5 ? 2 : 1.7;

  if (questionCount >= 80) return 1.35;
  if (questionCount >= 45) return 1.5;
  if (questionCount >= 25) return Math.min(1.7, baseScale);

  return Math.min(2, baseScale);
};

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, "Segoe UI", Tahoma, sans-serif;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 14mm;
      position: relative;
    }
    .top-rule {
      display: none;
    }
    .brand-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      direction: ltr;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #111827;
      color: #ffffff;
      font-weight: 900;
      letter-spacing: .5px;
      box-shadow: inset 0 0 0 3px rgba(255,255,255,.12);
    }
    .brand-title {
      margin: 0;
      font-size: 16px;
      letter-spacing: 0;
    }
    .brand-subtitle {
      margin: 2px 0 0;
      color: #6b7280;
      font-size: 12px;
    }
    .doc-label {
      min-width: 105px;
      border: 1px solid #111827;
      border-radius: 6px;
      padding: 7px 10px;
      text-align: center;
      color: #111827;
      font-weight: 800;
      background: #ffffff;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 10px;
      border-bottom: 1px solid #94a3b8;
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
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      margin: 0 0 10px;
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
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: #1d4ed8;
      color: #ffffff;
      font-weight: 900;
      direction: ltr;
    }
    .question-type {
      color: #0f766e;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .04em;
      direction: ltr;
    }
    .question-card h2 {
      margin: 0 0 12px;
      font-size: 15px;
      line-height: 1.45;
      color: #0f172a;
      font-weight: 800;
    }
    .options-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 6px;
    }
    .option {
      direction: ltr;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-height: 32px;
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #0f172a;
    }
    .option-label {
      flex: 0 0 auto;
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
    .option-text {
      flex: 1 1 auto;
      min-width: 0;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.45;
      text-align: start;
      direction: auto;
      unicode-bidi: plaintext;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .missing-option {
      border-color: #f59e0b;
      background: #fffbeb;
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
          <p class="brand-subtitle">نموذج كويز جاهز للطباعة</p>
        </div>
      </div>
      <div class="doc-label">ملف اختبار</div>
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
    await waitForNextPaint();
    const html2pdf = await loadHtml2Pdf();
    const title = quiz.title?.trim() || 'quiz';
    const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

    await html2pdf()
      .set({
        filename: `${sanitizeFileName(title)}.pdf`,
        margin: 0,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
          scale: getPdfCanvasScale(questionCount),
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
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
