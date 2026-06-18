import { motion } from 'framer-motion';
import { CheckCircle2, Flame, Sparkles, Trash2 } from 'lucide-react';

export type HabitTube = {
  id: string;
  name: string;
  color: string;
  streak: number;
  lastCompletedDate?: string;
  completedDates: string[];
};

type TubeCardProps = {
  tube: HabitTube;
  progress: number;
  streak: number;
  completedToday: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
};

const bubblePositions = [
  { left: '24%', size: 8, delay: 0 },
  { left: '42%', size: 5, delay: 0.35 },
  { left: '58%', size: 7, delay: 0.7 },
  { left: '71%', size: 4, delay: 1.05 },
];

export default function TubeCard({
  tube,
  progress,
  streak,
  completedToday,
  onComplete,
  onDelete,
}: TubeCardProps) {
  const isFull = progress >= 100;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.10)] backdrop-blur"
    >
      <div
        className="absolute -left-16 -top-16 h-44 w-44 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: tube.color }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-black text-slate-950">{tube.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black ${
                completedToday
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Flame className="h-4 w-4" />
              {streak} ستريك
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600">
              {completedToday ? 'ممتلئ اليوم' : 'فارغ اليوم'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(tube.id)}
          title="حذف الأنبوب"
          aria-label={`حذف ${tube.name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 mt-6 flex justify-center">
        <motion.div
          animate={isFull ? { y: [0, -5, 0] } : { y: 0 }}
          transition={{ repeat: isFull ? Infinity : 0, duration: 1.8, ease: 'easeInOut' }}
          className="relative h-72 w-32"
        >
          <div className="absolute left-1/2 top-0 h-8 w-24 -translate-x-1/2 rounded-t-2xl border-x-4 border-t-4 border-white/80 bg-white/35 shadow-inner" />

          <div className="absolute left-1/2 top-5 h-[250px] w-24 -translate-x-1/2 overflow-hidden rounded-b-[3rem] rounded-t-xl border-x-[5px] border-b-[5px] border-t-2 border-white/85 bg-white/25 shadow-[inset_12px_0_20px_rgba(255,255,255,0.58),inset_-12px_0_22px_rgba(15,23,42,0.10),0_22px_38px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-slate-200/20" />
            {!isFull && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-x-4 bottom-8 h-20 rounded-full border border-dashed border-slate-300"
              />
            )}
            <div className="absolute inset-x-3 top-4 z-20 h-[82%] rounded-full bg-white/20 blur-sm" />
            <div className="absolute right-4 top-4 z-20 h-44 w-4 rounded-full bg-white/45 blur-[1px]" />

            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={false}
              animate={{ height: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 16 }}
              style={{
                background: `linear-gradient(180deg, ${tube.color}dd 0%, ${tube.color} 62%, #0f172a22 100%)`,
                boxShadow: `0 -16px 45px ${tube.color}66`,
              }}
            >
              <motion.div
                className="absolute -top-4 left-1/2 h-8 w-[150%] -translate-x-1/2 rounded-[50%] opacity-95"
                animate={{ x: ['-50%', '-46%', '-54%', '-50%'] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  background: `radial-gradient(ellipse at center, #ffffffaa 0%, ${tube.color}f2 42%, ${tube.color}00 73%)`,
                }}
              />

              {isFull && (
                <motion.div
                  className="absolute -top-2 left-0 h-6 w-[180%] opacity-45"
                  animate={{ x: ['0%', '-38%'] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                  style={{
                    background: `repeating-radial-gradient(ellipse at center, #ffffff 0 2px, ${tube.color} 3px 12px, transparent 13px 22px)`,
                  }}
                />
              )}

              {isFull &&
                bubblePositions.map((bubble) => (
                  <motion.span
                    key={`${tube.id}-${bubble.left}`}
                    className="absolute bottom-4 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                    style={{
                      left: bubble.left,
                      width: bubble.size,
                      height: bubble.size,
                    }}
                    animate={{
                      y: [0, -70, -130],
                      opacity: [0, 0.95, 0],
                      scale: [0.6, 1, 0.75],
                    }}
                    transition={{
                      duration: 2.1,
                      repeat: Infinity,
                      delay: bubble.delay,
                      ease: 'easeOut',
                    }}
                  />
                ))}
            </motion.div>
          </div>

          <div className="absolute bottom-0 left-1/2 h-5 w-32 -translate-x-1/2 rounded-full bg-slate-900/10 blur-sm" />
        </motion.div>
      </div>

      <div className="relative z-10 mt-5">
        <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            className="h-full rounded-full"
            style={{ backgroundColor: tube.color }}
          />
        </div>

        <motion.button
          type="button"
          onClick={() => onComplete(tube.id)}
          disabled={completedToday}
          whileHover={completedToday ? undefined : { scale: 1.015, y: -1 }}
          whileTap={completedToday ? undefined : { scale: 0.96 }}
          className={`group flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black text-white shadow-xl ${
            completedToday ? 'cursor-default opacity-80' : ''
          }`}
          style={{
            background: completedToday
              ? 'linear-gradient(135deg, #16a34a, #111827)'
              : `linear-gradient(135deg, ${tube.color}, #111827)`,
            boxShadow: `0 16px 32px ${tube.color}44`,
          }}
        >
          {completedToday ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5 transition group-hover:rotate-12" />
          )}
          {completedToday ? 'امتلأ اليوم' : 'أنجزت اليوم! ✨'}
        </motion.button>
      </div>
    </motion.article>
  );
}
