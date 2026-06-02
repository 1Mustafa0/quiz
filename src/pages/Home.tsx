import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  Sparkles, Brain, Library, ArrowRight, Upload,
  Cpu, Play, FileText, Globe, Zap, Star, Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

const Home: React.FC = () => {
  const { user, login, loginLoading } = useAuth();
  const { direction, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogin = () => {
    void login().catch(() => {
      // The shared layout displays the login error.
    });
  };

  const mainFeatures = [
    {
      title: t('home.feature.quiz.title'),
      description: t('home.feature.quiz.description'),
      icon: Sparkles,
      gradient: 'from-indigo-500 to-purple-600',
      bg: 'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
      path: '/builder',
    },
    {
      title: t('home.feature.mindmap.title'),
      description: t('home.feature.mindmap.description'),
      icon: Brain,
      gradient: 'from-violet-500 to-fuchsia-600',
      bg: 'from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20',
      path: '/mindmaps/builder',
    },
    {
      title: t('home.feature.library.title'),
      description: t('home.feature.library.description'),
      icon: Library,
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      path: '/library',
    },
  ];

  const steps = [
    {
      number: '1',
      title: t('home.step.upload.title'),
      description: t('home.step.upload.description'),
      icon: Upload,
    },
    {
      number: '2',
      title: t('home.step.ai.title'),
      description: t('home.step.ai.description'),
      icon: Cpu,
    },
    {
      number: '3',
      title: t('home.step.share.title'),
      description: t('home.step.share.description'),
      icon: Play,
    },
  ];

  const capabilities = [
    { label: t('home.capability.multilingual.label'), icon: Globe, desc: t('home.capability.multilingual.desc') },
    { label: t('home.capability.csv.label'), icon: FileText, desc: t('home.capability.csv.desc') },
    { label: t('home.capability.fast.label'), icon: Zap, desc: t('home.capability.fast.desc') },
    { label: t('home.capability.free.label'), icon: Star, desc: t('home.capability.free.desc') },
  ];

  const searchTopics = [
    {
      title: t('home.seo.topic1.title'),
      text: t('home.seo.topic1.text'),
    },
    {
      title: t('home.seo.topic2.title'),
      text: t('home.seo.topic2.text'),
    },
    {
      title: t('home.seo.topic3.title'),
      text: t('home.seo.topic3.text'),
    },
    {
      title: t('home.seo.topic4.title'),
      text: t('home.seo.topic4.text'),
    },
  ];

  return (
    <div className="space-y-20 pb-20 mt-6 sm:mt-8">

      {/* Hero Section */}
      <section className="relative text-center space-y-7 max-w-5xl mx-auto overflow-hidden px-1 sm:px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mx-auto max-w-4xl text-balance text-[2.45rem] font-black leading-[1.08] text-gray-900 dark:text-white sm:text-5xl lg:text-6xl"
          dir={direction}
        >
          <span className="block">{t('home.hero.line1')}</span>
          <span className="block">
            {t('home.hero.line2Prefix')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              {t('home.hero.line2Highlight')}
            </span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative mx-auto max-w-3xl text-base leading-8 text-gray-600 dark:text-slate-400 sm:text-lg"
          dir={direction}
        >
          {t('home.hero.subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative flex flex-col-reverse sm:flex-row justify-center items-center gap-4 pt-2"
        >
          {user ? (
            <Link
              to="/builder"
              className="w-full sm:w-auto min-w-[220px] justify-center group inline-flex items-center gap-2 px-7 py-4 text-base font-bold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              {t('home.action.createQuiz')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              aria-busy={loginLoading}
              className="w-full sm:w-auto min-w-[220px] justify-center group inline-flex items-center gap-2 px-7 py-4 text-base font-bold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-indigo-400 disabled:to-purple-400 disabled:cursor-not-allowed shadow-xl shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:shadow-2xl transition-all transform hover:-translate-y-1 disabled:hover:translate-y-0"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
              {loginLoading ? t('auth.signingIn') : t('home.action.getStartedFree')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          <Link
            to="/library"
            className="w-full sm:w-auto min-w-[220px] justify-center inline-flex items-center gap-2 px-7 py-4 text-base font-semibold rounded-2xl text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <Library className="w-5 h-5" />
            {t('home.action.browseQuizzes')}
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
            {t('home.features.title')}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            {t('home.features.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mainFeatures.map((feature, index) => (
            <motion.button
              key={feature.title}
              type="button"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 * (index + 1) }}
              onClick={() => user ? navigate(feature.path) : handleLogin()}
              aria-label={`Go to ${feature.title}`}
              className={`relative group w-full text-left p-8 bg-gradient-to-br ${feature.bg} rounded-3xl border border-white/80 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden`}
            >
              <div className={`absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-300`} />
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed text-sm">{feature.description}</p>
              <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm group-hover:gap-3 transition-all">
                <span>{t('home.action.getStarted')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-10">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            {t('home.how.title')}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">
            {t('home.how.subtitle')}
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
            {t('home.more.title')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Search-friendly Arabic content */}
      <section className="space-y-8" aria-labelledby="seo-learning-tools">
        <div className="text-center max-w-3xl mx-auto">
          <h2 id="seo-learning-tools" className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            {t('home.seo.title')}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed">
            {t('home.seo.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {searchTopics.map((topic) => (
            <article
              key={topic.title}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm"
              dir={direction}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{topic.title}</h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed">{topic.text}</p>
            </article>
          ))}
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 text-center" dir={direction}>
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">
            {t('home.seo.banner.title')}
          </h3>
          <p className="text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
            {t('home.seo.banner.text')}
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-8 sm:p-10 md:p-12 text-center text-white space-y-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold">{t('home.cta.title')}</h2>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">
            {t('home.cta.subtitle')}
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
                {t('home.action.createQuiz')}
              </Link>
              <Link
                to="/mindmaps/builder"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/30 hover:bg-white/20 transition-all hover:-translate-y-1"
              >
                <Brain className="w-5 h-5" />
                {t('home.action.buildMindMap')}
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              aria-busy={loginLoading}
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-600 font-bold text-lg rounded-2xl hover:bg-indigo-50 disabled:bg-indigo-100 disabled:cursor-not-allowed shadow-2xl transition-all hover:-translate-y-1 disabled:hover:translate-y-0"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loginLoading ? t('auth.signingIn') : t('home.action.getStartedFree')}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-center">
          <div>
            <div className="text-3xl font-black">50+</div>
            <div className="text-indigo-200 text-sm mt-1">{t('home.stat.languages')}</div>
          </div>
          <div>
            <div className="text-3xl font-black">30s</div>
            <div className="text-indigo-200 text-sm mt-1">{t('home.stat.generate')}</div>
          </div>
          <div>
            <div className="text-3xl font-black">{t('home.capability.free.label')}</div>
            <div className="text-indigo-200 text-sm mt-1">{t('home.stat.free')}</div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
