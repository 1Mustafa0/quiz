import React from 'react';
import { motion } from 'motion/react';
import { Check, Crown, Zap, FileText, Infinity, Sparkles, Shield, Users } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

const FREE_FEATURES = [
  '3 كويزات مجاناً',
  'رفع ملفات حتى 5 ميجابايت',
  'توليد أسئلة بالذكاء الاصطناعي',
  'الخرائط الذهنية',
  'مشاركة الكويزات',
];

const PRO_FEATURES = [
  'كويزات غير محدودة',
  'رفع ملفات بدون حد للحجم',
  'توليد أسئلة بالذكاء الاصطناعي',
  'الخرائط الذهنية',
  'مشاركة الكويزات',
  'شارة Pro على ملفك الشخصي',
  'أولوية في معالجة الذكاء الاصطناعي',
  'دعم متميز',
];

const Pricing: React.FC = () => {
  const { user, plan } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full text-sm font-semibold">
          <Crown className="w-4 h-4" />
          خطط الاشتراك
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          اختر الخطة المناسبة لك
        </h1>
        <p className="text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
          ابدأ مجاناً وترقّ عندما تحتاج إلى المزيد. لا توجد رسوم خفية.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Free Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 p-8 space-y-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gray-600 dark:text-slate-300" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">مجاني</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$0</span>
              <span className="text-gray-500 dark:text-slate-400">/شهر</span>
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-2">للبدء واستكشاف المنصة</p>
          </div>

          <ul className="space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {plan === 'free' ? (
            <div className="w-full py-3.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold rounded-2xl text-center text-sm">
              خطتك الحالية
            </div>
          ) : (
            <Link
              to="/builder"
              className="block w-full py-3.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 font-semibold rounded-2xl text-center text-sm transition-colors"
            >
              ابدأ مجاناً
            </Link>
          )}
        </motion.div>

        {/* Pro Plan */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="relative bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-8 space-y-6 shadow-2xl shadow-violet-500/30"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-lg">
              <Crown className="w-3.5 h-3.5" />
              الأكثر شعبية
            </span>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Pro</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold text-white">$9.99</span>
              <span className="text-white/70">/شهر</span>
            </div>
            <p className="text-white/70 text-sm mt-2">أو $79.99/سنة (وفر 33%)</p>
          </div>

          <ul className="space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white">
                <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                {f}
              </li>
            ))}
          </ul>

          {plan === 'pro' ? (
            <div className="w-full py-3.5 bg-white/20 text-white font-semibold rounded-2xl text-center text-sm">
              <Crown className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              أنت على Pro بالفعل 🎉
            </div>
          ) : !user ? (
            <Link
              to="/"
              className="block w-full py-3.5 bg-white hover:bg-gray-50 text-violet-700 font-bold rounded-2xl text-center text-sm transition-colors shadow-lg"
            >
              سجّل الدخول للاشتراك
            </Link>
          ) : (
            <div className="space-y-3">
              <button
                disabled
                className="block w-full py-3.5 bg-white text-violet-700 font-bold rounded-2xl text-center text-sm opacity-80 cursor-not-allowed"
              >
                الدفع قريباً — تواصل مع الأدمن
              </button>
              <p className="text-white/60 text-xs text-center">
                للترقية يدوياً: تواصل مع مشرف الموقع عبر البريد الإلكتروني
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Feature comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">مقارنة كاملة بين الخطتين</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {[
            { feature: 'عدد الكويزات', free: '3 كويزات', pro: 'غير محدود' },
            { feature: 'حجم الملف', free: 'حتى 5 MB', pro: 'غير محدود' },
            { feature: 'توليد أسئلة AI', free: true, pro: true },
            { feature: 'الخرائط الذهنية', free: true, pro: true },
            { feature: 'مشاركة الكويزات', free: true, pro: true },
            { feature: 'شارة Pro', free: false, pro: true },
            { feature: 'أولوية AI', free: false, pro: true },
            { feature: 'دعم متميز', free: false, pro: true },
          ].map(({ feature, free, pro }) => (
            <div key={feature} className="grid grid-cols-3 px-8 py-4 text-sm">
              <span className="text-gray-700 dark:text-slate-300 font-medium">{feature}</span>
              <span className="text-center">
                {typeof free === 'boolean' ? (
                  free ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 dark:text-slate-600">—</span>
                ) : (
                  <span className="text-gray-600 dark:text-slate-400">{free}</span>
                )}
              </span>
              <span className="text-center">
                {typeof pro === 'boolean' ? (
                  pro ? <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 mx-auto" /> : <span className="text-gray-300 dark:text-slate-600">—</span>
                ) : (
                  <span className="font-semibold text-violet-600 dark:text-violet-400">{pro}</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 px-8 py-3 bg-gray-50 dark:bg-slate-700/50 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-t border-gray-100 dark:border-slate-700">
          <span>الميزة</span>
          <span className="text-center">مجاني</span>
          <span className="text-center text-violet-600 dark:text-violet-400">Pro</span>
        </div>
      </motion.div>

      {/* Testimonials / Trust */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-4 text-center"
      >
        {[
          { icon: Users, value: '500+', label: 'مستخدم نشط' },
          { icon: FileText, value: '2000+', label: 'كويز منشأ' },
          { icon: Shield, value: '100%', label: 'آمن ومحمي' },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <Icon className="w-6 h-6 text-violet-600 dark:text-violet-400 mx-auto mb-2" />
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default Pricing;
