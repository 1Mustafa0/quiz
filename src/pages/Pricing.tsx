import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { adminAccess, pricingPlans } from '../config/pricing';
import { useAuth } from '../AuthContext';

const formatLimit = (value: number | 'unlimited', suffix = '') => {
  if (value === 'unlimited') return 'Unlimited';
  return `${value.toLocaleString()}${suffix}`;
};

const Pricing: React.FC = () => {
  const { user, role, login, loginLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedFeature = searchParams.get('feature');

  const handleStart = () => {
    if (user) return;
    void login().catch(() => undefined);
  };

  return (
    <div className="space-y-10 pb-12">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Sparkles className="h-4 w-4" />
          AI EdTech pricing
        </div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Choose the plan that fits your learning workflow
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600 dark:text-slate-400">
          Start free, upgrade when you need more quiz generations, OCR, mind maps, exports, and analytics.
        </p>
      </section>

      {role === 'admin' && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h2 className="font-bold">Admin full access enabled</h2>
                <p className="text-sm opacity-90">{adminAccess.description}</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">
              Unlimited
            </span>
          </div>
        </section>
      )}

      {requestedFeature && role !== 'admin' && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
          <h2 className="font-bold">Upgrade required</h2>
          <p className="mt-1 text-sm opacity-90">
            Mind maps are available on Pro and Premium plans. Your quiz tools remain available on the free plan.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {pricingPlans.map((plan, index) => (
          <motion.article
            key={plan.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.28 }}
            className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-800 ${
              plan.recommended
                ? 'border-indigo-300 ring-2 ring-indigo-100 dark:border-indigo-500 dark:ring-indigo-900/50'
                : 'border-gray-100 dark:border-slate-700'
            }`}
          >
            {plan.recommended && (
              <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                <Crown className="h-3.5 w-3.5" />
                Best value
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">{plan.name}</h2>
              <p className="min-h-12 text-sm leading-6 text-gray-500 dark:text-slate-400">{plan.targetUser}</p>
              <div>
                <div className="flex items-end gap-1 text-gray-900 dark:text-white">
                  <span className="text-4xl font-black">${plan.price.usdMonthly}</span>
                  <span className="pb-1 text-sm text-gray-500 dark:text-slate-400">/month</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-slate-400">
                  About {plan.price.egpMonthly.toLocaleString()} EGP/month
                </p>
              </div>
              <p className="text-sm leading-6 text-gray-600 dark:text-slate-300">{plan.valueProposition}</p>
            </div>

            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 text-sm dark:border-slate-700">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">AI quizzes</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.aiQuizzesPerDay)}/day
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">Monthly quizzes</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.aiQuizzesPerMonth)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">OCR files</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.ocrFilesPerDay)}/day
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">File size</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.maxFileSizeMB, ' MB')}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">Questions/quiz</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.maxQuestionsPerQuiz)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-slate-400">Mind maps</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatLimit(plan.limits.mindMapsPerMonth)}/month
                </span>
              </div>
            </div>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.highlights.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-gray-600 dark:text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
              <li className="flex gap-2 text-sm text-gray-600 dark:text-slate-300">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span>{plan.features.analytics} analytics</span>
              </li>
            </ul>

            {plan.limits.fairUsagePolicy && (
              <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                {plan.limits.fairUsagePolicy}
              </p>
            )}

            {user ? (
              <Link
                to="/builder"
                className={`mt-6 inline-flex justify-center rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  plan.recommended
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'
                }`}
              >
                Start creating
              </Link>
            ) : (
              <button
                onClick={handleStart}
                disabled={loginLoading}
                className={`mt-6 inline-flex justify-center rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-60 ${
                  plan.recommended
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'
                }`}
              >
                {plan.id === 'free' ? 'Start free' : 'Get started'}
              </button>
            )}
          </motion.article>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Built to control AI costs</h2>
        <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-400">
          Usage limits protect the free tier while keeping paid plans useful for real students, teachers, and training teams.
          Groq is used as the primary AI provider, with Gemini as a fallback for reliability.
        </p>
      </section>
    </div>
  );
};

export default Pricing;
