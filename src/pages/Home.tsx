import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Sparkles, FileText, LayoutDashboard, CheckCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const Home: React.FC = () => {
  const { user, login } = useAuth();

  const features = [
    {
      title: 'AI Generation',
      description: 'Upload PDFs, Word docs, or PowerPoints and let AI generate questions in seconds.',
      icon: Sparkles,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Cloud Storage',
      description: 'Access your quizzes and results from any device, anytime.',
      icon: LayoutDashboard,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Multiple Formats',
      description: 'Support for multiple choice, true/false, and short answer questions.',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Manual Builder',
      description: 'Create quizzes manually or upload CSV files for bulk generation.',
      icon: FileText,
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="space-y-24 py-12">
      {/* Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          AI-Powered Learning
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight"
        >
          Transform Your Content into <span className="text-indigo-600">Interactive Quizzes</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
        >
          The ultimate tool for teachers, students, and lifelong learners. Generate high-quality assessments from any document in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4"
        >
          {user ? (
            <Link
              to="/builder"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          ) : (
            <button
              onClick={() => login()}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              Sign In to Start
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          )}
          <Link
            to="/library"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-gray-200 text-lg font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            Browse Quizzes
          </Link>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * index }}
            className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
            <p className="text-gray-600 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </section>

      {/* Social Proof / Stats */}
      <section className="bg-indigo-600 rounded-3xl p-12 text-center text-white space-y-8">
        <h2 className="text-3xl font-bold">Ready to boost your learning?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div>
            <div className="text-4xl font-extrabold mb-2">100%</div>
            <div className="text-indigo-100">AI Accuracy</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold mb-2">50+</div>
            <div className="text-indigo-100">Supported Languages</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold mb-2">24/7</div>
            <div className="text-indigo-100">Cloud Access</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
