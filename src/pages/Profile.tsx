import React, { useEffect, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, Mail, Calendar, Award, BookOpen, BarChart2, Copy, Check, Shield, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: any;
  photoURL?: string;
}

interface Stats {
  quizzesCreated: number;
  quizzesTaken: number;
  averageScore: number;
  totalScore: number;
}

const Profile: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const { user: currentUser, role: currentRole } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    quizzesCreated: 0,
    quizzesTaken: 0,
    averageScore: 0,
    totalScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const targetUid = uid || currentUser?.uid;

  useEffect(() => {
    if (!targetUid) return;

    const fetchProfileAndStats = async () => {
      setLoading(true);
      try {
        // Fetch User Profile
        const userDoc = await getDoc(doc(db, 'users', targetUid));
        if (userDoc.exists()) {
          setProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
        }

        // Fetch Quizzes Created
        const quizzesQuery = query(collection(db, 'quizzes'), where('authorUid', '==', targetUid));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        const quizzesCreated = quizzesSnapshot.size;

        // Fetch Quizzes Taken (Results)
        const resultsQuery = query(collection(db, 'results'), where('userId', '==', targetUid));
        const resultsSnapshot = await getDocs(resultsQuery);
        const quizzesTaken = resultsSnapshot.size;
        
        let totalScore = 0;
        resultsSnapshot.forEach(doc => {
          const data = doc.data();
          totalScore += (data.score / (data.totalQuestions || 1)) * 100;
        });

        const averageScore = quizzesTaken > 0 ? Math.round(totalScore / quizzesTaken) : 0;

        setStats({
          quizzesCreated,
          quizzesTaken,
          averageScore,
          totalScore
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${targetUid}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndStats();
  }, [targetUid]);

  const copyUid = () => {
    if (!profile?.uid) return;
    navigator.clipboard.writeText(profile.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">User not found</h2>
        <p className="text-gray-600">The profile you are looking for does not exist or you don't have permission to view it.</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === profile.uid;
  const isAdmin = currentRole === 'admin';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg">
                <div className="w-full h-full rounded-xl bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (profile.displayName || profile.email || '?')[0].toUpperCase()
                  )}
                </div>
              </div>
              {profile.role === 'admin' && (
                <div className="absolute -top-2 -right-2 bg-purple-600 text-white p-1.5 rounded-lg shadow-lg">
                  <Shield className="w-4 h-4" />
                </div>
              )}
            </div>
            {isAdmin && !isOwnProfile && (
              <Link
                to="/admin"
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                Back to Admin
              </Link>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{profile.displayName || 'Anonymous User'}</h1>
              <div className="flex items-center space-x-4 mt-2 text-gray-600">
                <div className="flex items-center space-x-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{profile.email}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Joined {profile.createdAt?.toDate()?.toLocaleDateString() || 'تاريخ غير معروف'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl border border-gray-100 w-fit">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">User ID:</span>
              <code className="text-sm font-mono text-indigo-600 font-semibold">{profile.uid}</code>
              <button
                onClick={copyUid}
                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded-md hover:bg-white shadow-sm"
                title="Copy ID"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Quizzes Created</div>
              <div className="text-2xl font-bold text-gray-900">{stats.quizzesCreated}</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Quizzes Taken</div>
              <div className="text-2xl font-bold text-gray-900">{stats.quizzesTaken}</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Average Score</div>
              <div className="text-2xl font-bold text-gray-900">{stats.averageScore}%</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Additional Info / History Link */}
      <div className="flex justify-center">
        <Link
          to={isOwnProfile ? "/history" : "/library"}
          className="inline-flex items-center space-x-2 text-indigo-600 font-medium hover:underline"
        >
          <span>{isOwnProfile ? "View your full quiz history" : "Explore available quizzes"}</span>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default Profile;
