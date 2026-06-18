import { FormEvent, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { BarChart3, Bell, CalendarDays, FlaskConical, Plus, Sparkles } from 'lucide-react';
import TubeCard, { HabitTube } from './components/TubeCard';

const STORAGE_KEY = 'habit-lab-tubes-v2';
const LEGACY_STORAGE_KEY = 'habit-lab-tubes-v1';
const REMINDER_KEY = 'habit-lab-reminder-v1';

type ProgressView = 'week' | 'month' | 'year';

type ReminderSettings = {
  enabled: boolean;
  time: string;
};

const colorPalette = [
  { name: 'Coral', value: '#fb7185' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Lime', value: '#84cc16' },
];

const todayKey = () => toDateKey(new Date());

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isYesterday = (dateKey?: string) => {
  if (!dateKey) return false;
  return dateKey === toDateKey(addDays(new Date(), -1));
};

const uniqueDates = (dates: string[]) => [...new Set(dates)].sort();

const starterTubes: HabitTube[] = [
  {
    id: crypto.randomUUID(),
    name: 'قراءة 20 دقيقة',
    color: '#6366f1',
    streak: 4,
    lastCompletedDate: toDateKey(addDays(new Date(), -1)),
    completedDates: [
      toDateKey(addDays(new Date(), -4)),
      toDateKey(addDays(new Date(), -3)),
      toDateKey(addDays(new Date(), -2)),
      toDateKey(addDays(new Date(), -1)),
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'تدريب TypeScript',
    color: '#10b981',
    streak: 2,
    lastCompletedDate: toDateKey(addDays(new Date(), -1)),
    completedDates: [toDateKey(addDays(new Date(), -2)), toDateKey(addDays(new Date(), -1))],
  },
];

const normalizeTube = (tube: Partial<HabitTube> & { progress?: number }): HabitTube => {
  const completedDates = uniqueDates(tube.completedDates ?? []);
  const lastCompletedDate = tube.lastCompletedDate ?? completedDates.at(-1);

  return {
    id: tube.id ?? crypto.randomUUID(),
    name: tube.name?.trim() || 'عادة جديدة',
    color: tube.color || '#6366f1',
    streak: Number.isFinite(tube.streak) ? Number(tube.streak) : 0,
    lastCompletedDate,
    completedDates,
  };
};

const loadReminder = (): ReminderSettings => {
  try {
    const saved = localStorage.getItem(REMINDER_KEY);
    if (!saved) return { enabled: false, time: '08:00' };
    return { enabled: false, time: '08:00', ...JSON.parse(saved) };
  } catch {
    return { enabled: false, time: '08:00' };
  }
};

const loadTubes = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as HabitTube[];
      return Array.isArray(parsed) ? parsed.map(normalizeTube) : starterTubes;
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy) as Array<Partial<HabitTube> & { progress?: number }>;
      if (Array.isArray(parsedLegacy)) {
        return parsedLegacy.map((tube) =>
          normalizeTube({
            ...tube,
            completedDates: tube.progress && tube.progress >= 100 ? [todayKey()] : [],
            lastCompletedDate: tube.progress && tube.progress >= 100 ? todayKey() : undefined,
          })
        );
      }
    }

    return starterTubes;
  } catch {
    return starterTubes;
  }
};

const getDailyProgress = (tube: HabitTube) => (tube.lastCompletedDate === todayKey() ? 100 : 0);

const getCurrentStreak = (tube: HabitTube) => {
  if (tube.lastCompletedDate === todayKey() || isYesterday(tube.lastCompletedDate)) {
    return tube.streak;
  }

  return 0;
};

const getNextReminderDelay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hours || 0, minutes || 0, 0, 0);

  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};

const getPeriodDates = (view: ProgressView) => {
  const now = new Date();

  if (view === 'week') {
    return Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  }

  if (view === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => addDays(start, index));
  }

  return Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), index, 1));
};

function ProgressPanel({ tubes }: { tubes: HabitTube[] }) {
  const [view, setView] = useState<ProgressView>('week');
  const dates = getPeriodDates(view);
  const totalSlots = Math.max(tubes.length, 1);

  const points = dates.map((date) => {
    const key = toDateKey(date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const completed =
      view === 'year'
        ? tubes.reduce(
            (sum, tube) =>
              sum +
              tube.completedDates.filter((day) => {
                const completedDate = fromDateKey(day);
                return completedDate.getFullYear() === year && completedDate.getMonth() === month;
              }).length,
            0
          )
        : tubes.filter((tube) => tube.completedDates.includes(key)).length;

    const max =
      view === 'year'
        ? totalSlots * new Date(year, month + 1, 0).getDate()
        : totalSlots;

    return {
      key,
      label:
        view === 'year'
          ? date.toLocaleDateString('ar-EG', { month: 'short' })
          : date.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }),
      completed,
      percent: Math.round((completed / max) * 100),
    };
  });

  const totalCompleted = points.reduce((sum, point) => sum + point.completed, 0);
  const average = points.length
    ? Math.round(points.reduce((sum, point) => sum + point.percent, 0) / points.length)
    : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-slate-950">التقدم الزمني</h2>
            <p className="text-sm font-semibold text-slate-500">
              {totalCompleted} إنجاز مسجل، ومتوسط الالتزام {average}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
          {(['week', 'month', 'year'] as ProgressView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                view === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
              }`}
            >
              {item === 'week' ? 'أسبوعي' : item === 'month' ? 'شهري' : 'سنوي'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-2">
        {points.map((point) => (
          <div key={point.key} className="flex min-w-12 flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end rounded-2xl bg-slate-100 p-1">
              <motion.div
                initial={false}
                animate={{ height: `${Math.max(point.percent, point.completed ? 8 : 0)}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                className="w-full rounded-xl bg-gradient-to-t from-cyan-500 to-indigo-500 shadow-lg shadow-cyan-500/20"
              />
            </div>
            <span className="text-xs font-black text-slate-500">{point.label}</span>
            <span className="text-xs font-black text-slate-900">{point.percent}%</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

export default function Streak() {
  const [tubes, setTubes] = useState<HabitTube[]>(loadTubes);
  const [habitName, setHabitName] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorPalette[4].value);
  const [reminder, setReminder] = useState<ReminderSettings>(loadReminder);
  const [notificationStatus, setNotificationStatus] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const totalStreak = useMemo(
    () => tubes.reduce((sum, tube) => sum + getCurrentStreak(tube), 0),
    [tubes]
  );

  const filledToday = useMemo(
    () => tubes.filter((tube) => tube.lastCompletedDate === todayKey()).length,
    [tubes]
  );

  const averageProgress = useMemo(() => {
    if (!tubes.length) return 0;
    return Math.round(tubes.reduce((sum, tube) => sum + getDailyProgress(tube), 0) / tubes.length);
  }, [tubes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tubes));
  }, [tubes]);

  useEffect(() => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(reminder));
  }, [reminder]);

  useEffect(() => {
    if (!reminder.enabled || notificationStatus !== 'granted') return;

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      new Notification('حان وقت الامتلاء', {
        body: 'املأ أنبوب عادتك اليوم وحافظ على شعلة الستريك.',
      });

      intervalId = window.setInterval(() => {
        new Notification('حان وقت الامتلاء', {
          body: 'املأ أنبوب عادتك اليوم وحافظ على شعلة الستريك.',
        });
      }, 24 * 60 * 60 * 1000);
    }, getNextReminderDelay(reminder.time));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [notificationStatus, reminder.enabled, reminder.time]);

  const celebrateTube = (color: string) => {
    confetti({
      particleCount: 130,
      spread: 80,
      origin: { y: 0.66 },
      colors: [color, '#ffffff', '#facc15', '#38bdf8'],
      scalar: 1,
    });

    window.setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.74 },
        colors: [color, '#f8fafc'],
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.74 },
        colors: [color, '#f8fafc'],
      });
    }, 180);
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      setReminder((current) => ({ ...current, enabled: true }));
      new Notification('حان وقت الامتلاء', {
        body: 'تم تفعيل التنبيه اليومي بنجاح.',
      });
    }
  };

  const addTube = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = habitName.trim();
    if (!cleanName) return;

    setTubes((current) => [
      {
        id: crypto.randomUUID(),
        name: cleanName,
        color: selectedColor,
        streak: 0,
        completedDates: [],
      },
      ...current,
    ]);
    setHabitName('');
  };

  const completeToday = (id: string) => {
    setTubes((current) =>
      current.map((tube) => {
        if (tube.id !== id) return tube;

        const today = todayKey();
        if (tube.lastCompletedDate === today) return tube;

        const nextStreak = isYesterday(tube.lastCompletedDate) ? tube.streak + 1 : 1;
        window.setTimeout(() => celebrateTube(tube.color), 180);

        return {
          ...tube,
          streak: nextStreak,
          lastCompletedDate: today,
          completedDates: uniqueDates([...tube.completedDates, today]),
        };
      })
    );
  };

  const deleteTube = (id: string) => {
    setTubes((current) => current.filter((tube) => tube.id !== id));
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#f6f7fb] text-slate-950"
    >
      <section className="relative isolate min-h-screen px-4 py-6 sm:px-6 lg:px-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(20,184,166,0.18),transparent_26%),radial-gradient(circle_at_82%_4%,rgba(244,114,182,0.16),transparent_22%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#ecfeff_100%)]" />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <motion.header
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
                  <FlaskConical className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-cyan-700">Habit Lab</p>
                  <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
                    مختبر الستريك اليومي
                  </h1>
                </div>
              </div>
              <p className="max-w-2xl text-base leading-8 text-slate-600">
                كل صباح يبدأ الأنبوب فارغًا. عندما تنجز العادة يمتلئ بالكامل، تشتعل الشعلة،
                ويسجل اليوم في تقدمك الأسبوعي والشهري والسنوي.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-sm font-semibold text-slate-500">ستريك نشط</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{totalStreak}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-sm font-semibold text-slate-500">امتلاء اليوم</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{averageProgress}%</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-sm font-semibold text-slate-500">أنابيب ممتلئة</p>
                <p className="mt-3 text-3xl font-black text-slate-950">
                  {filledToday}/{tubes.length}
                </p>
              </div>
            </div>
          </motion.header>

          <motion.form
            onSubmit={addTube}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5"
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto_auto] xl:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  اسم العادة أو المهارة
                </span>
                <input
                  value={habitName}
                  onChange={(event) => setHabitName(event.target.value)}
                  placeholder="مثال: حل 5 مسائل، تعلم كلمة جديدة، تمارين صباحية"
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 shadow-inner outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  لون السائل
                </span>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                  {colorPalette.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      title={color.name}
                      aria-label={`اختيار لون ${color.name}`}
                      onClick={() => setSelectedColor(color.value)}
                      className="relative h-10 w-10 rounded-full border-2 border-white shadow-md outline-none ring-offset-2 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-slate-950"
                      style={{ backgroundColor: color.value }}
                    >
                      {selectedColor === color.value && (
                        <span className="absolute inset-1 rounded-full border-2 border-white/90" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  وقت التنبيه
                </span>
                <div className="flex h-13 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                  <Bell className="h-5 w-5 text-slate-500" />
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(event) =>
                      setReminder((current) => ({ ...current, time: event.target.value }))
                    }
                    className="w-28 border-0 bg-transparent font-black text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={requestNotifications}
                    className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700"
                  >
                    {notificationStatus === 'granted' && reminder.enabled ? 'مفعل' : 'تفعيل'}
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="submit"
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white shadow-xl shadow-slate-950/20"
              >
                <Plus className="h-5 w-5" />
                إنشاء أنبوب
              </motion.button>
            </div>

            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CalendarDays className="h-4 w-4" />
              التنبيه اليومي يعمل عندما يكون المتصفح قادرًا على إرسال إشعارات لهذا الموقع.
            </p>
          </motion.form>

          <ProgressPanel tubes={tubes} />

          {tubes.length ? (
            <motion.div
              layout
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {tubes.map((tube) => (
                <TubeCard
                  key={tube.id}
                  tube={tube}
                  progress={getDailyProgress(tube)}
                  streak={getCurrentStreak(tube)}
                  completedToday={tube.lastCompletedDate === todayKey()}
                  onComplete={completeToday}
                  onDelete={deleteTube}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-white/55 p-10 text-center"
            >
              <Sparkles className="mb-4 h-10 w-10 text-cyan-500" />
              <h2 className="text-2xl font-black text-slate-900">ابدأ أول تجربة</h2>
              <p className="mt-2 max-w-md text-slate-500">
                أضف عادة من النموذج بالأعلى وسيظهر أنبوبها هنا جاهزًا للامتلاء.
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}
