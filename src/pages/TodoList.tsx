import React, { useEffect, useMemo, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock3,
  Edit3,
  Filter,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Priority = 'low' | 'medium' | 'high';
type StatusFilter = 'all' | 'active' | 'completed';
type DateFilter = 'all' | 'today' | 'overdue' | 'week';

interface Todo {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: any;
  updatedAt?: any;
  completedAt?: any;
  dueDate?: string;
  priority: Priority;
  category?: string;
  notes?: string;
}

const priorityLabels: Record<Priority, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

const categoryOptions = ['مذاكرة', 'مراجعة', 'اختبار', 'مشروع', 'عام'];

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getTodayKey = () => toDateKey(new Date());

const getWeekEndKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return toDateKey(date);
};

const formatDate = (value?: string) => {
  if (!value) return 'بدون موعد';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
};

const isOverdue = (todo: Todo) =>
  Boolean(todo.dueDate && !todo.completed && todo.dueDate < getTodayKey());

const isDueToday = (todo: Todo) => todo.dueDate === getTodayKey();

const TodoList: React.FC = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [taskText, setTaskText] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('مذاكرة');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'todos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todoList = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Todo[];
      setTodos(todoList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'todos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter(todo => todo.completed).length;
    const active = total - completed;
    const today = todos.filter(todo => !todo.completed && isDueToday(todo)).length;
    const overdue = todos.filter(isOverdue).length;
    const completion = total ? Math.round((completed / total) * 100) : 0;

    return { total, completed, active, today, overdue, completion };
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const today = getTodayKey();
    const weekEnd = getWeekEndKey();
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return todos.filter((todo) => {
      if (statusFilter === 'active' && todo.completed) return false;
      if (statusFilter === 'completed' && !todo.completed) return false;
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false;
      if (dateFilter === 'today' && todo.dueDate !== today) return false;
      if (dateFilter === 'overdue' && !isOverdue(todo)) return false;
      if (dateFilter === 'week' && (!todo.dueDate || todo.dueDate < today || todo.dueDate > weekEnd)) return false;
      if (!normalizedSearch) return true;

      return `${todo.text} ${todo.category || ''} ${todo.notes || ''}`.toLowerCase().includes(normalizedSearch);
    });
  }, [todos, statusFilter, priorityFilter, dateFilter, searchTerm]);

  const resetForm = () => {
    setTaskText('');
    setNotes('');
    setDueDate('');
    setPriority('medium');
    setCategory('مذاكرة');
  };

  const handleAddTodo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskText.trim() || !user) return;

    try {
      await addDoc(collection(db, 'todos'), {
        userId: user.uid,
        text: taskText.trim(),
        notes: notes.trim(),
        dueDate,
        category,
        completed: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        priority,
      });
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'todos');
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      const completed = !todo.completed;
      await updateDoc(doc(db, 'todos', todo.id), {
        completed,
        completedAt: completed ? Timestamp.now() : null,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${todo.id}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `todos/${id}`);
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingText(todo.text);
  };

  const saveEdit = async (todo: Todo) => {
    const nextText = editingText.trim();
    if (!nextText) return;

    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        text: nextText,
        updatedAt: Timestamp.now(),
      });
      setEditingId(null);
      setEditingText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${todo.id}`);
    }
  };

  const updateTodoField = async (todo: Todo, field: 'priority' | 'category' | 'dueDate', value: string) => {
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        [field]: value,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${todo.id}`);
    }
  };

  const getPriorityColor = (value: Priority) => {
    switch (value) {
      case 'high': return 'text-red-700 bg-red-50 border-red-100';
      case 'medium': return 'text-amber-700 bg-amber-50 border-amber-100';
      case 'low': return 'text-green-700 bg-green-50 border-green-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
            <CheckSquare className="h-4 w-4" />
            نظام المهام الدراسية
          </div>
          <h1 className="mt-3 text-3xl font-black text-gray-900">خطط مذاكرتك بوضوح</h1>
          <p className="mt-2 text-gray-600">رتب المهام حسب الأولوية والموعد، وتابع تقدمك اليومي من مكان واحد.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500">المتبقي</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500">اليوم</p>
            <p className="mt-1 text-2xl font-black text-indigo-600">{stats.today}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500">متأخر</p>
            <p className="mt-1 text-2xl font-black text-red-600">{stats.overdue}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500">الإنجاز</p>
            <p className="mt-1 text-2xl font-black text-green-600">{stats.completion}%</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddTodo} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_160px_150px_150px_auto]">
          <input
            type="text"
            value={taskText}
            onChange={(event) => setTaskText(event.target.value)}
            placeholder="اكتب مهمة جديدة..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="low">أولوية منخفضة</option>
            <option value="medium">أولوية متوسطة</option>
            <option value="high">أولوية عالية</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!taskText.trim()}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-5 font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="إضافة مهمة"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="ملاحظات اختيارية: صفحات، رابط محاضرة، أو تفاصيل قصيرة..."
          className="mt-3 h-20 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </form>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث في المهام..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-4 pr-10 text-right outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'completed'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setStatusFilter(item)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  statusFilter === item ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item === 'all' ? 'الكل' : item === 'active' ? 'قيد التنفيذ' : 'مكتمل'}
              </button>
            ))}
          </div>

          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateFilter)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">كل المواعيد</option>
            <option value="today">اليوم</option>
            <option value="overdue">متأخرة</option>
            <option value="week">هذا الأسبوع</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as 'all' | Priority)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">كل الأولويات</option>
            <option value="high">عالية</option>
            <option value="medium">متوسطة</option>
            <option value="low">منخفضة</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`group rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                  todo.completed ? 'border-gray-100 opacity-70' : isOverdue(todo) ? 'border-red-100' : 'border-gray-100 hover:shadow-md'
                }`}
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleTodo(todo)}
                    className={`mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                      todo.completed ? 'bg-green-500 text-white' : 'border-2 border-gray-200 text-transparent hover:border-indigo-500'
                    }`}
                    title={todo.completed ? 'إرجاع المهمة' : 'إنهاء المهمة'}
                  >
                    {todo.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0 flex-1 space-y-3">
                    {editingId === todo.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveEdit(todo);
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(todo)}
                          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-xl bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className={`break-words text-base font-bold ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {todo.text}
                        </p>
                        {todo.notes && <p className="mt-1 break-words text-sm text-gray-500">{todo.notes}</p>}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={todo.priority || 'medium'}
                        onChange={(event) => updateTodoField(todo, 'priority', event.target.value)}
                        className={`rounded-lg border px-2 py-1 font-bold outline-none ${getPriorityColor(todo.priority || 'medium')}`}
                      >
                        <option value="high">عالية</option>
                        <option value="medium">متوسطة</option>
                        <option value="low">منخفضة</option>
                      </select>
                      <select
                        value={todo.category || 'عام'}
                        onChange={(event) => updateTodoField(todo, 'category', event.target.value)}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 font-bold text-gray-600 outline-none"
                      >
                        {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-bold ${
                        isOverdue(todo) ? 'border-red-100 bg-red-50 text-red-700' : isDueToday(todo) ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-500'
                      }`}>
                        <Calendar className="h-3 w-3" />
                        {formatDate(todo.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col gap-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      onClick={() => startEditing(todo)}
                      className="rounded-xl p-2 text-gray-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                      title="تعديل"
                    >
                      <Edit3 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="rounded-xl p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                      title="حذف"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredTodos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
              <Filter className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="font-bold text-gray-700">لا توجد مهام مطابقة</p>
              <p className="mt-1 text-sm text-gray-500">غيّر الفلاتر أو أضف مهمة جديدة.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <Target className="h-5 w-5 text-indigo-600" />
              تركيز اليوم
            </div>
            <div className="mt-4 space-y-3">
              {todos.filter(todo => !todo.completed && (isDueToday(todo) || isOverdue(todo))).slice(0, 4).map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => setSearchTerm(todo.text)}
                  className="block w-full rounded-xl bg-gray-50 p-3 text-right transition-colors hover:bg-gray-100"
                >
                  <p className="line-clamp-2 text-sm font-bold text-gray-800">{todo.text}</p>
                  <p className={`mt-1 text-xs font-bold ${isOverdue(todo) ? 'text-red-600' : 'text-indigo-600'}`}>
                    {isOverdue(todo) ? 'متأخرة' : 'موعدها اليوم'}
                  </p>
                </button>
              ))}
              {todos.filter(todo => !todo.completed && (isDueToday(todo) || isOverdue(todo))).length === 0 && (
                <div className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">
                  لا توجد مهام عاجلة حاليا.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <Clock3 className="h-5 w-5 text-amber-600" />
              توزيع الأولويات
            </div>
            <div className="mt-4 space-y-3">
              {(['high', 'medium', 'low'] as Priority[]).map((item) => {
                const count = todos.filter(todo => !todo.completed && todo.priority === item).length;
                const width = stats.active ? Math.round((count / stats.active) * 100) : 0;
                return (
                  <div key={item}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-bold text-gray-700">{priorityLabels[item]}</span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {stats.overdue > 0 && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-bold">عندك {stats.overdue} مهمة متأخرة. ابدأ بواحدة فقط الآن لتقليل الضغط.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default TodoList;
