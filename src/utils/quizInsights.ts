export interface InsightAnswer {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  options?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  topic_tag?: string;
  isCorrect: boolean;
  feedback?: string;
}

export interface InsightResult {
  score: number;
  totalQuestions: number;
  answers: InsightAnswer[];
  category?: string;
  quizTitle?: string;
}

const stopWords = new Set([
  'what', 'which', 'when', 'where', 'why', 'how', 'does', 'this', 'that', 'with', 'from', 'into', 'about',
  'the', 'and', 'for', 'are', 'was', 'were', 'you', 'your', 'question', 'answer', 'correct',
  'ما', 'من', 'في', 'على', 'عن', 'إلى', 'الى', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي',
  'كان', 'كانت', 'يكون', 'أو', 'او', 'مع', 'بعد', 'قبل', 'كل', 'أي', 'اي',
]);

export const getResultPercentage = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

export const extractFocusTerms = (answers: InsightAnswer[], limit = 3) => {
  const counts = new Map<string, number>();
  const text = answers
    .filter(answer => !answer.isCorrect)
    .map(answer => `${answer.question} ${answer.feedback || ''}`)
    .join(' ');

  const terms = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length >= 4 && !stopWords.has(term.toLowerCase()));

  terms.forEach((term) => counts.set(term, (counts.get(term) || 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
};

export const buildResultInsights = (result: InsightResult) => {
  const percentage = getResultPercentage(result.score, result.totalQuestions);
  const incorrectAnswers = result.answers.filter(answer => !answer.isCorrect);
  const correctAnswers = result.answers.filter(answer => answer.isCorrect);
  const markedWrong = incorrectAnswers.filter(answer => (answer as any).isMarked).length;
  const topicCounts = new Map<string, number>();
  incorrectAnswers.forEach((answer) => {
    if (answer.topic_tag) {
      topicCounts.set(answer.topic_tag, (topicCounts.get(answer.topic_tag) || 0) + 1);
    }
  });
  const weakestTaggedTopic = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const focusTerms = extractFocusTerms(result.answers);
  const weakTopic = weakestTaggedTopic || focusTerms[0] || result.category || result.quizTitle || 'الموضوع الأساسي';

  const strengths: string[] = [];
  if (percentage >= 80) strengths.push('إتقان قوي لمعظم أسئلة الاختبار.');
  if (correctAnswers.length > incorrectAnswers.length) strengths.push('إجاباتك الصحيحة أكثر من الأخطاء، وده مؤشر تقدم جيد.');
  if (incorrectAnswers.length === 0) strengths.push('لم تظهر أخطاء في هذا الاختبار.');
  if (!strengths.length) strengths.push('أكملت الاختبار، وده يعطيك خريطة واضحة لما يحتاج مراجعة.');

  const weaknesses = incorrectAnswers.length
    ? [
        `يوجد ${incorrectAnswers.length} ${incorrectAnswers.length === 1 ? 'سؤال يحتاج' : 'أسئلة تحتاج'} مراجعة.`,
        ...(markedWrong ? [`${markedWrong} من الأسئلة الخاطئة كانت معلّمة للمراجعة أثناء الحل.`] : []),
        ...(focusTerms.length ? [`أكثر الكلمات المتكررة في الأخطاء: ${focusTerms.join('، ')}.`] : []),
      ]
    : ['لا توجد نقاط ضعف واضحة في هذه المحاولة.'];

  const advice = incorrectAnswers.length
    ? `ابدأ بمراجعة "${weakTopic}" ثم اضغط على زر "راجع أخطائي" لحل الأسئلة التي أخطأت فيها فقط.`
    : 'حافظ على مستواك بإعادة الاختبار لاحقا أو جرّب اختبارا أصعب في نفس التصنيف.';

  return {
    percentage,
    correctAnswers,
    incorrectAnswers,
    strengths,
    weaknesses,
    weakTopic,
    advice,
  };
};

export const calculateDailyStreak = (dates: Date[]) => {
  const days = Array.from(new Set(dates.map(date => date.toISOString().slice(0, 10)))).sort().reverse();
  if (!days.length) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of days) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1);
      if (day === cursor.toISOString().slice(0, 10)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
    break;
  }

  return streak;
};

export const getBadges = (results: Array<{ score: number; totalQuestions: number }>, streak: number) => {
  const attempts = results.length;
  const average = attempts
    ? Math.round(results.reduce((sum, result) => sum + getResultPercentage(result.score, result.totalQuestions), 0) / attempts)
    : 0;
  const perfect = results.some(result => getResultPercentage(result.score, result.totalQuestions) === 100);
  const badges: Array<{ title: string; description: string; earned: boolean }> = [
    { title: 'بداية قوية', description: 'أكمل أول اختبار.', earned: attempts >= 1 },
    { title: 'مراجع نشيط', description: 'أكمل 5 اختبارات.', earned: attempts >= 5 },
    { title: 'إتقان كامل', description: 'حقق 100% في اختبار واحد.', earned: perfect },
    { title: 'ثبات يومي', description: 'حافظ على 3 أيام متتالية.', earned: streak >= 3 },
    { title: 'متوسط ممتاز', description: 'متوسطك العام 80% أو أكثر.', earned: average >= 80 && attempts > 0 },
  ];

  return { badges, average };
};
