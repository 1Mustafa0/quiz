import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Users, BookOpen, Trash2, Shield, ShieldAlert, Search, Mail, User, ExternalLink, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Navigate, Link } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

interface Quiz {
  id: string;
  title: string;
  authorUid: string;
  category: string;
  createdAt: any;
}

const AdminDashboard: React.FC = () => {
  const { user, role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users and content across the platform.</p>
        </div>
      </div>

      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'users' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Users ({users.length})</span>
          </div>
          {activeTab === 'users' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'quizzes' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Quizzes ({quizzes.length})</span>
          </div>
          {activeTab === 'quizzes' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${activeTab} by name, email, or ID...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">User</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Email</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Role</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{u.displayName || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500 font-mono">{u.uid}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">{u.email}</span>
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setNewEmail(u.email);
                              }}
                              className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Edit Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              to={`/profile/${u.uid}`}
                              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="View Profile"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </Link>
                            <button
                              onClick={() => toggleUserRole(u.uid, u.role)}
                              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Toggle Admin Role"
                            >
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
              <div className="md:hidden divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <div key={u.uid} className="p-4 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {(u.displayName || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{u.displayName || 'Anonymous'}</div>
                        <div className="text-xs text-gray-500 font-mono">{u.uid}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{u.email}</span>
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setNewEmail(u.email);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-end space-x-4 pt-2">
                      <Link
                        to={`/profile/${u.uid}`}
                        className="flex items-center space-x-1 text-sm text-indigo-600 font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Profile</span>
                      </Link>
                      <button
                        onClick={() => toggleUserRole(u.uid, u.role)}
                        className="flex items-center space-x-1 text-sm text-gray-600 font-medium"
                      >
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
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Quiz Title</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Category</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Author UID</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQuizzes.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{q.title}</td>
                        <td className="px-6 py-4 text-gray-600">{q.category || 'General'}</td>
                        <td className="px-6 py-4 text-xs text-gray-500 font-mono">{q.authorUid}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteQuiz(q.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Quiz"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Quiz Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredQuizzes.map((q) => (
                  <div key={q.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-900">{q.title}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                          {q.category || 'General'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteQuiz(q.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono break-all">
                      Author: {q.authorUid}
                    </div>
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">تعديل بريد المستخدم</h3>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم</label>
                  <div className="text-sm text-gray-900 font-medium">{editingUser.displayName || 'Anonymous'}</div>
                  <div className="text-xs text-gray-500 font-mono">{editingUser.uid}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني الجديد</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="أدخل البريد الجديد..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
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
