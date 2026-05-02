import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  Sparkles, Brain, Library, ArrowRight, Upload,
  Cpu, Play, FileText, Globe, Zap, Star
} from 'lucide-react';
import { motion } from 'motion/react';

const Home: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const mainFeatures = [
    {
      title: 'AI Quiz Builder',
      titleAr: 'منشئ الكويز بالذكاء الاصطناعي',
      description: 'ارفع ملف PDF أو Word أو صورة، وسيقوم الذكاء الاصطناعي بتحليل المحتوى وإنشاء أسئلة اختيار متعدد احترافية في ثوانٍ.',
      icon: Sparkles,
      gradient: 'from-indigo-500 to-purple-600',
      bg: 'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
      path: '/builder',
    },
    {
      title: 'Mind Map Builder',
      titleAr: 'منشئ الخرائط الذهنية',
      description: 'أنشئ خرائط ذهنية تفاعلية بالذكاء الاصطناعي بمجرد كتابة موضوع، مع عرض مرئي SVG يدعم التكبير والتصغير.',
      icon: Brain,
      gradient: 'from-violet-500 to-fuchsia-600',
      bg: 'from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20',
      path: '/mindmaps/builder',
    },
    {
      title: 'Quiz Library',
      titleAr: 'مكتبة الكويزات',
      description: 'استعرض جميع الكويزات المتاحة، العب وتابع نتائجك وإحصائياتك التفصيلية في مكان واحد.',
      icon: Library,
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      path: '/library',
    },
  ];

  const steps = [
    {
      number: '1',
      title: 'ارفع المحتوى',
      description: 'ارفع PDF أو Word أو صورة أو الصق النص مباشرة في المحرر',
      icon: Upload,
    },
    {
      number: '2',
      title: 'الذكاء الاصطناعي يحلل',
      description: 'يحلل Gemini AI المحتوى ويولد أسئلة دقيقة ومتنوعة تلقائياً',
      icon: Cpu,
    },
    {
      number: '3',
      title: 'العب وشارك',
      description: 'ابدأ الكويز فوراً، تابع نتائجك، وشاركه مع من تريد',
      icon: Play,
    },
  ];

  const capabilities = [
    { label: 'متعدد اللغات', icon: Globe, desc: 'يدعم العربية والإنجليزية وأكثر من 50 لغة أخرى' },
    { label: 'استيراد CSV', icon: FileText, desc: 'استورد أسئلة جاهزة من ملفات CSV بتنسيق بسيط' },
    { label: 'سريع وذكي', icon: Zap, desc: 'يولد كويز كامل في أقل من 30 ثانية' },
    { label: 'مجاني بالكامل', icon: Star, desc: 'جميع المميزات متاحة بدون قيود ولا اشتراك' },
  ];

  return (
    <div className="space-y-20 pb-20 -mt-4">

      {/* Personal Touch Banner */}
      <div className="text-center py-2 animate-pulse">
        <span className="text-xl sm:text-3xl font-bold text-indigo-500 dark:text-indigo-400 drop-shadow-sm font-amiri">
          متنساش تصل على النبي ❤😊
        </span>
      </div>

      {/* Hero Section */}
      <section className="relative text-center space-y-8 max-w-5xl mx-auto overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-r from-indigo-200/40 to-purple-200/40 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium border border-indigo-100 dark:border-indigo-800"
        >
          <Sparkles className="w-4 h-4" />
          مدعوم بـ Gemini AI
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight"
        >
          حوّل محتواك إلى{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            كويز تفاعلي
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
        >
          الأداة الأذكى للطلاب والمعلمين — ارفع أي ملف وسيقوم الذكاء الاصطناعي بإنشاء
          اختبار احترافي فوراً، أو أنشئ خرائط ذهنية بكلمات بسيطة.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative flex flex-col sm:flex-row justify-center items-center gap-4 pt-2"
        >
          {user ? (
            <Link
              to="/builder"
              className="group inline-flex items-center gap-2 px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              أنشئ كويز الآن
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={() => login()}
              className="group inline-flex items-center gap-2 px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              ابدأ مجاناً
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-2xl text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <Library className="w-5 h-5" />
            استعرض الكويزات
          </Link>
        </motion.div>
      </section>

      {/* Main Features */}
      <section className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            كل ما تحتاجه في مكان واحد
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            ثلاث أدوات قوية مدعومة بالذكاء الاصطناعي لتعزيز تجربة التعلم
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mainFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 * (index + 1) }}
              onClick={() => user ? navigate(feature.path) : login()}
              className={`relative group cursor-pointer p-8 bg-gradient-to-br ${feature.bg} rounded-3xl border border-white/80 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden`}
            >
              <div className={`absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-300`} />
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{feature.titleAr}</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3 font-medium tracking-wide uppercase">{feature.title}</p>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed text-sm">{feature.description}</p>
              <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm group-hover:gap-3 transition-all">
                <span>ابدأ الآن</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-10">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            كيف يعمل؟
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">
            ثلاث خطوات بسيطة لإنشاء كويز احترافي
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * (index + 1) }}
              className="relative text-center space-y-4 p-8 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
            >
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 z-10">
                  <ArrowRight className="w-6 h-6 text-indigo-200 dark:text-indigo-800" />
                </div>
              )}
              <div className="relative inline-flex mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30">
                  <step.icon className="w-9 h-9 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-purple-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
              <p className="text-gray-500 dark:text-slate-400 leading-relaxed text-sm max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
            مميزات إضافية
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {capabilities.map((cap, index) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-center group hover:-translate-y-1 cursor-default"
            >
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <cap.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{cap.label}</h4>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-12 text-center text-white space-y-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold">جاهز لتعزيز تعلمك؟</h2>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">
            انضم الآن وابدأ في إنشاء كويزات وخرائط ذهنية ذكية من أي محتوى تعليمي
          </p>
        </div>

        <div className="relative flex flex-col sm:flex-row justify-center gap-4">
          {user ? (
            <>
              <Link
                to="/builder"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 shadow-xl transition-all hover:-translate-y-1"
              >
                <Sparkles className="w-5 h-5" />
                أنشئ كويز
              </Link>
              <Link
                to="/mindmaps/builder"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/30 hover:bg-white/20 transition-all hover:-translate-y-1"
              >
                <Brain className="w-5 h-5" />
                أنشئ خريطة ذهنية
              </Link>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-600 font-bold text-lg rounded-2xl hover:bg-indigo-50 shadow-2xl transition-all hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5" />
              ابدأ مجاناً الآن
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="relative flex justify-center gap-12 pt-2">
          <div className="text-center">
            <div className="text-3xl font-black">50+</div>
            <div className="text-indigo-200 text-sm mt-1">لغة مدعومة</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black">30ث</div>
            <div className="text-indigo-200 text-sm mt-1">لإنشاء كويز</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black">100%</div>
            <div className="text-indigo-200 text-sm mt-1">مجاني</div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
