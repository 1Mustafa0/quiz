import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, deleteDoc, doc, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { Users, BookOpen, Trash2, Shield, ShieldAlert, Search, Mail, User, ExternalLink, X, Check, TrendingUp, UserPlus, Eye, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Navigate, Link } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt?: any;
}

interface Quiz {
  id: string;
  title: string;
  authorUid: string;
  category: string;
  createdAt: any;
}

interface VisitorDoc {
  sessionId: string;
  firstVisit: Timestamp;
  lastVisit: Timestamp;
  visitCount: number;
  isRegistered: boolean;
}

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  totalVisitors: number;
  newVisitorsToday: number;
  activeToday: number;
}

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const AdminDashboard: React.FC = () => {
  const { user, role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    newUsersToday: 0,
    newUsersWeek: 0,
    totalVisitors: 0,
    newVisitorsToday: 0,
    activeToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'quizzes'>('users');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  useEffect(() => {
    if (role !== 'admin') return;

    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(userList);

      const todayTs = startOfDay();
      const weekTs = startOfWeek();
      const newToday = userList.filter(u => u.createdAt && u.createdAt.seconds >= todayTs.seconds).length;
      const newWeek = userList.filter(u => u.createdAt && u.createdAt.seconds >= weekTs.seconds).length;

      setStats(prev => ({
        ...prev,
        totalUsers: userList.length,
        newUsersToday: newToday,
        newUsersWeek: newWeek,
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const quizzesUnsubscribe = onSnapshot(collection(db, 'quizzes'), (snapshot) => {
      const quizList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quiz[];
      setQuizzes(quizList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
    });

    // Fetch visitor stats
    const fetchVisitors = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'visitors'));
        const visitors = snapshot.docs.map(d => d.data()) as VisitorDoc[];
        const todayTs = startOfDay();

        const newToday = visitors.filter(v => v.firstVisit && v.firstVisit.seconds >= todayTs.seconds).length;
        const activeToday = visitors.filter(v => v.lastVisit && v.lastVisit.seconds >= todayTs.seconds).length;

        setStats(prev => ({
          ...prev,
          totalVisitors: visitors.length,
          newVisitorsToday: newToday,
          activeToday,
        }));
      } catch {
        // ignore if visitors collection doesn't exist yet
      }
    };

    fetchVisitors();

    return () => {
      usersUnsubscribe();
      quizzesUnsubscribe();
    };
  }, [role]);

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/" />;

  const handleDeleteQuiz = (quizId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'حذف الكويز؟',
      message: 'هل أنت متأكد من حذف هذا الكويز؟ لا يمكن التراجع عن هذا الإجراء.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'quizzes', quizId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `quizzes/${quizId}`);
        }
      }
    });
  };

  const toggleUserRole = (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setConfirmConfig({
      isOpen: true,
      title: 'تغيير رتبة المستخدم؟',
      message: `هل تريد تغيير رتبة المستخدم إلى ${newRole === 'admin' ? 'مدمن' : 'مستخدم'}؟`,
      type: 'warning',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', userId), { role: newRole });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
        }
      }
    });
  };

  const handleUpdateEmail = async () => {
    if (!editingUser || !newEmail) return;
    if (!newEmail.includes('@')) {
      setConfirmConfig({
        isOpen: true,
        title: 'بريد غير صالح',
        message: 'يرجى إدخال عنوان بريد إلكتروني صالح يحتوي على @.',
        type: 'warning',
        onConfirm: () => {}
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), { email: newEmail });
      setEditingUser(null);
      setNewEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.uid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredQuizzes = quizzes.filter(q =>
    q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.authorUid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statCards = [
    {
      label: 'إجمالي المستخدمين',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-100 dark:border-indigo-800',
    },
    {
      label: 'مستخدمون جدد اليوم',
      value: stats.newUsersToday,
      icon: UserPlus,
      color: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      border: 'border-green-100 dark:border-green-800',
    },
    {
      label: 'مستخدمون جدد هذا الأسبوع',
      value: stats.newUsersWeek,
      icon: TrendingUp,
      color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-800',
    },
    {
      label: 'إجمالي الزوار',
      value: stats.totalVisitors,
      icon: Eye,
      color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-800',
    },
    {
      label: 'زوار جدد اليوم',
      value: stats.newVisitorsToday,
      icon: UserCheck,
      color: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      border: 'border-orange-100 dark:border-orange-800',
    },
    {
      label: 'نشطون اليوم',
      value: stats.activeToday,
      icon: TrendingUp,
      color: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-800',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-slate-400">Manage users and content across the platform.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-slate-800 rounded-2xl border ${card.border} shadow-sm p-4 space-y-3`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 leading-tight mt-0.5">{card.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex space-x-4 border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'users' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Users ({users.length})</span>
          </div>
          {activeTab === 'users' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'quizzes' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Quizzes ({quizzes.length})</span>
          </div>
          {activeTab === 'quizzes' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
          )}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={`Search ${activeTab} by name, email, or ID...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-gray-900 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'users' ? (
            <motion.div
              key="users-table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">User</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Role</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{u.displayName || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">{u.uid}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600 dark:text-slate-300">{u.email}</span>
                            <button
                              onClick={() => { setEditingUser(u); setNewEmail(u.email); }}
                              className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title="Edit Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link to={`/profile/${u.uid}`} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="View Profile">
                              <ExternalLink className="w-5 h-5" />
                            </Link>
                            <button onClick={() => toggleUserRole(u.uid, u.role)} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Toggle Admin Role">
                              {u.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile User Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
                {filteredUsers.map((u) => (
                  <div key={u.uid} className="p-4 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {(u.displayName || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{u.displayName || 'Anonymous'}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">{u.uid}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-slate-300">{u.email}</span>
                        <button onClick={() => { setEditingUser(u); setNewEmail(u.email); }} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-end space-x-4 pt-2">
                      <Link to={`/profile/${u.uid}`} className="flex items-center space-x-1 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                        <ExternalLink className="w-4 h-4" /><span>Profile</span>
                      </Link>
                      <button onClick={() => toggleUserRole(u.uid, u.role)} className="flex items-center space-x-1 text-sm text-gray-600 dark:text-slate-400 font-medium">
                        {u.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        <span>Role</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quizzes-table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Quiz Title</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Category</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Author UID</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredQuizzes.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{q.title}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-slate-300">{q.category || 'General'}</td>
                        <td className="px-6 py-4 text-xs text-gray-500 dark:text-slate-400 font-mono">{q.authorUid}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeleteQuiz(q.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete Quiz">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Quiz Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
                {filteredQuizzes.map((q) => (
                  <div key={q.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">{q.title}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                          {q.category || 'General'}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteQuiz(q.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono break-all">Author: {q.authorUid}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Email Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">تعديل بريد المستخدم</h3>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">المستخدم</label>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{editingUser.displayName || 'Anonymous'}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">{editingUser.uid}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">البريد الإلكتروني الجديد</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="أدخل البريد الجديد..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 flex justify-end space-x-3">
                <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                  إلغاء
                </button>
                <button
                  onClick={handleUpdateEmail}
                  disabled={isUpdating}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>تحديث البريد</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
};

export default AdminDashboard;
