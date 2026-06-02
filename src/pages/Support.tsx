import React, { useState } from 'react';
import { Check, Clipboard, ShieldCheck, Sparkles, Wallet, CreditCard, HandHeart } from 'lucide-react';
import { motion } from 'motion/react';

const supportMethods = [
  {
    label: 'wallet',
    value: '01554730033',
    icon: Wallet,
    tone: 'emerald',
  },
  {
    label: 'Telda Card',
    value: '5484 4600 8300 3947',
    icon: CreditCard,
    tone: 'indigo',
  },
];

const copyToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const Support: React.FC = () => {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = async (value: string) => {
    await copyToClipboard(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(null), 1800);
  };

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10" dir="rtl">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-xl shadow-emerald-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"
      >
        <div className="relative px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                دعم اختياري بالكامل
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
                  Support the Project ❤️
                </h1>
                <div className="max-w-2xl space-y-4 text-lg leading-8 text-gray-600 dark:text-slate-300">
                  <p>المشروع ده مجاني بالكامل ومتاح لكل الناس بدون أي رسوم.</p>
                  <p>
                    لو عجبك أو ساعدك في المذاكرة، تقدر تدعمنا عشان نكمل تطويره ونحسن خدمات الذكاء الاصطناعي.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['مجاني بالكامل', 'بدون أي رسوم'],
                  ['مستقل', 'مبني باجتهاد شخصي'],
                  ['خدمات AI', 'الدعم يساعدنا نكمل'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <Check className="mb-3 h-5 w-5 text-emerald-600" />
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{title}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-black text-gray-950 dark:text-white">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                طرق الدعم:
              </div>

              {supportMethods.map((method, index) => {
                const Icon = method.icon;
                const copied = copiedValue === method.value;
                const toneClasses =
                  method.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';

                return (
                  <motion.div
                    key={method.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-lg shadow-gray-100/80 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{method.label}</p>
                        <p
                          dir="ltr"
                          style={{ unicodeBidi: 'isolate' }}
                          className="mt-1 break-words text-left font-mono text-2xl font-black tracking-wide text-gray-950 dark:text-white"
                        >
                          {method.value}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopy(method.value)}
                      className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                        copied
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none'
                          : 'bg-gray-950 text-white shadow-md shadow-gray-200 hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-slate-950 dark:shadow-none'
                      }`}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      {copied ? 'تم النسخ' : 'نسخ الرقم'}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-emerald-100 bg-emerald-50/70 px-6 py-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-base font-bold text-emerald-900 shadow-sm dark:bg-slate-900 dark:text-emerald-100">
            <HandHeart className="h-5 w-5 text-emerald-600" />
            ولو مش قادر تدعم ماديًا، كفاية دعوة حلوة لينا ولأهلنا 🤍
          </div>
        </div>
      </motion.section>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 text-center text-sm leading-7 text-gray-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
        🙏 ادعيلنا ولوالدينا وإخواتنا بالرحمة والمغفرة.
        <br />
        شكرًا جدًا ليك ❤️
      </div>
    </div>
  );
};

export default Support;
