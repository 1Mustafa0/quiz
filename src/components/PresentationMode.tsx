import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MindMapData } from '../services/mindmapService';
import { X, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

const PALETTE = [
  { base: '#6366f1', light: '#eef2ff', dark: '#c7d2fe' },
  { base: '#f97316', light: '#fff7ed', dark: '#fed7aa' },
  { base: '#10b981', light: '#ecfdf5', dark: '#a7f3d0' },
  { base: '#ec4899', light: '#fdf2f8', dark: '#fbcfe8' },
  { base: '#0ea5e9', light: '#f0f9ff', dark: '#bae6fd' },
  { base: '#8b5cf6', light: '#f5f3ff', dark: '#ddd6fe' },
  { base: '#14b8a6', light: '#f0fdfa', dark: '#99f6e4' },
  { base: '#f59e0b', light: '#fffbeb', dark: '#fde68a' },
];

interface Slide {
  type: 'title' | 'overview' | 'branch';
  title: string;
  subtitle?: string;
  items?: { label: string; children?: string[] }[];
  color?: typeof PALETTE[0];
  branchIdx?: number;
  totalBranches?: number;
}

function buildSlides(data: MindMapData): Slide[] {
  const slides: Slide[] = [];

  slides.push({
    type: 'title',
    title: data.topic,
    subtitle: `${data.branches.length} main topics`,
  });

  slides.push({
    type: 'overview',
    title: 'Topics Overview',
    items: data.branches.map(b => ({ label: b.label })),
  });

  data.branches.forEach((branch, i) => {
    slides.push({
      type: 'branch',
      title: branch.label,
      color: PALETTE[i % PALETTE.length],
      branchIdx: i + 1,
      totalBranches: data.branches.length,
      items: branch.children.map(ch => ({
        label: ch.label,
        children: ch.children?.map(gc => gc.label) ?? [],
      })),
    });
  });

  return slides;
}

interface Props {
  data: MindMapData;
  onClose: () => void;
}

const PresentationMode: React.FC<Props> = ({ data, onClose }) => {
  const slides = useMemo(() => buildSlides(data), [data]);
  const [idx, setIdx] = useState(0);
  const [animDir, setAnimDir] = useState<'in-right' | 'in-left' | null>(null);
  const [visibleItems, setVisibleItems] = useState<number>(0);

  const total = slides.length;
  const slide = slides[idx];

  const go = useCallback((dir: 1 | -1) => {
    const next = idx + dir;
    if (next < 0 || next >= total) return;
    setAnimDir(dir === 1 ? 'in-right' : 'in-left');
    setIdx(next);
    setVisibleItems(0);
  }, [idx, total]);

  useEffect(() => {
    setAnimDir(null);
    const t = setTimeout(() => setVisibleItems(0), 10);
    return () => clearTimeout(t);
  }, [idx]);

  useEffect(() => {
    if (slide.type !== 'branch' || !slide.items) return;
    const max = slide.items.length;
    if (visibleItems >= max) return;
    const t = setTimeout(() => setVisibleItems(v => v + 1), 180);
    return () => clearTimeout(t);
  }, [slide, visibleItems]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [go, onClose]);

  const progress = ((idx + 1) / total) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
          <Layers className="w-4 h-4" />
          <span>Presentation Mode</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm font-mono">{idx + 1} / {total}</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-white/10 flex-shrink-0">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-8 py-6 min-h-0 overflow-hidden">
        <div
          className="w-full max-w-4xl"
          style={{
            animation: animDir ? `slide-${animDir} 0.35s ease-out` : undefined,
          }}
        >
          {slide.type === 'title' && <TitleSlide slide={slide} />}
          {slide.type === 'overview' && <OverviewSlide slide={slide} allBranches={data.branches.map(b => b.label)} />}
          {slide.type === 'branch' && <BranchSlide slide={slide} visibleItems={visibleItems} />}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 pb-6 flex-shrink-0">
        <button
          onClick={() => go(-1)}
          disabled={idx === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setVisibleItems(0); }}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 20 : 7,
                height: 7,
                background: i === idx ? '#6366f1' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={idx === total - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <style>{`
        @keyframes slide-in-right { from { opacity:0; transform: translateX(60px); } to { opacity:1; transform:none; } }
        @keyframes slide-in-left  { from { opacity:0; transform: translateX(-60px); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  );
};

const TitleSlide: React.FC<{ slide: Slide }> = ({ slide }) => (
  <div className="text-center">
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium mb-8">
      <Layers className="w-4 h-4" /> Mind Map
    </div>
    <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight">
      {slide.title}
    </h1>
    <p className="text-xl text-slate-400">{slide.subtitle}</p>
    <div className="mt-12 text-slate-600 text-sm">Press → or Space to continue</div>
  </div>
);

const OverviewSlide: React.FC<{ slide: Slide; allBranches: string[] }> = ({ allBranches }) => (
  <div>
    <h2 className="text-3xl font-bold text-white mb-8 text-center">Topics Overview</h2>
    <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
      {allBranches.map((label, i) => {
        const pal = PALETTE[i % PALETTE.length];
        return (
          <div
            key={i}
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: `${pal.base}18`, border: `1px solid ${pal.base}40` }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: pal.base }}>
              {i + 1}
            </div>
            <span className="text-white font-medium text-sm">{label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const BranchSlide: React.FC<{ slide: Slide; visibleItems: number }> = ({ slide, visibleItems }) => {
  const pal = slide.color!;
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: `${pal.base}30`, color: pal.dark }}>
          Topic {slide.branchIdx} of {slide.totalBranches}
        </span>
      </div>
      <h2 className="text-4xl font-extrabold text-white mb-8" style={{ textShadow: `0 0 40px ${pal.base}60` }}>
        {slide.title}
      </h2>
      {slide.items && slide.items.length > 0 ? (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {slide.items.map((item, i) => (
            <div
              key={i}
              style={{
                opacity: i < visibleItems ? 1 : 0,
                transform: i < visibleItems ? 'none' : 'translateY(12px)',
                transition: 'all 0.3s ease-out',
              }}
            >
              <div className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: `${pal.base}18`, border: `1px solid ${pal.base}35` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ background: pal.base }}>
                  {i + 1}
                </div>
                <div>
                  <div className="text-white font-semibold text-base">{item.label}</div>
                  {item.children && item.children.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.children.map((gc, k) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${pal.base}25`, color: pal.dark }}>
                          {gc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-lg italic">No sub-topics</p>
      )}
    </div>
  );
};

export default PresentationMode;
