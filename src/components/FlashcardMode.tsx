import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { MindMapData } from '../services/mindmapService';
import { X, RotateCcw, Shuffle, CheckCircle, XCircle, SkipForward, Trophy } from 'lucide-react';

const PALETTE = [
  { base: '#6366f1', light: '#eef2ff', dark: '#c7d2fe', text: '#3730a3' },
  { base: '#f97316', light: '#fff7ed', dark: '#fed7aa', text: '#9a3412' },
  { base: '#10b981', light: '#ecfdf5', dark: '#a7f3d0', text: '#065f46' },
  { base: '#ec4899', light: '#fdf2f8', dark: '#fbcfe8', text: '#9d174d' },
  { base: '#0ea5e9', light: '#f0f9ff', dark: '#bae6fd', text: '#075985' },
  { base: '#8b5cf6', light: '#f5f3ff', dark: '#ddd6fe', text: '#5b21b6' },
  { base: '#14b8a6', light: '#f0fdfa', dark: '#99f6e4', text: '#115e59' },
  { base: '#f59e0b', light: '#fffbeb', dark: '#fde68a', text: '#78350f' },
];

interface Card {
  id: string;
  front: string;
  back: string;
  backItems: string[];
  category: string;
  color: typeof PALETTE[0];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards(data: MindMapData): Card[] {
  const cards: Card[] = [];
  data.branches.forEach((branch, i) => {
    const pal = PALETTE[i % PALETTE.length];
    if (branch.children.length > 0) {
      cards.push({
        id: `b${i}-overview`,
        front: `What are the main sub-topics of\n"${branch.label}"?`,
        back: '',
        backItems: branch.children.map(c => c.label),
        category: branch.label,
        color: pal,
      });
      branch.children.forEach((child, j) => {
        cards.push({
          id: `b${i}c${j}-parent`,
          front: `"${child.label}"\n↑ Which main topic does this belong to?`,
          back: branch.label,
          backItems: [],
          category: branch.label,
          color: pal,
        });
        if (child.children && child.children.length > 0) {
          cards.push({
            id: `b${i}c${j}-children`,
            front: `What does\n"${child.label}"\ninclude?`,
            back: '',
            backItems: child.children.map(gc => gc.label),
            category: branch.label,
            color: pal,
          });
        }
      });
    }
  });
  return cards;
}

interface Props {
  data: MindMapData;
  onClose: () => void;
}

type Result = 'know' | 'review' | 'skip';

const FlashcardMode: React.FC<Props> = ({ data, onClose }) => {
  const baseCards = useMemo(() => buildCards(data), [data]);
  const [deck, setDeck] = useState<Card[]>(() => shuffle(buildCards(data)));
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [done, setDone] = useState(false);
  const [animating, setAnimating] = useState(false);

  const card = deck[cardIdx];
  const total = deck.length;
  const answered = Object.keys(results).length;
  const known = Object.values(results).filter(r => r === 'know').length;
  const toReview = Object.values(results).filter(r => r === 'review').length;

  const advance = useCallback((result: Result) => {
    if (animating) return;
    setAnimating(true);
    setResults(prev => ({ ...prev, [card.id]: result }));
    setTimeout(() => {
      if (cardIdx + 1 >= total) setDone(true);
      else { setCardIdx(c => c + 1); setFlipped(false); }
      setAnimating(false);
    }, 300);
  }, [animating, card, cardIdx, total]);

  const restart = () => {
    setDeck(shuffle(baseCards));
    setCardIdx(0); setFlipped(false); setResults({}); setDone(false);
  };

  const restartWrong = () => {
    const wrong = deck.filter(c => results[c.id] === 'review');
    if (wrong.length === 0) return;
    setDeck(shuffle(wrong));
    setCardIdx(0); setFlipped(false); setResults({}); setDone(false);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'f') { e.preventDefault(); if (!done) setFlipped(f => !f); }
      if (e.key === 'ArrowRight' && flipped) advance('know');
      if (e.key === 'ArrowDown' && flipped) advance('review');
      if (e.key === 'ArrowLeft') advance('skip');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [flipped, done, advance, onClose]);

  const progress = total > 0 ? (answered / total) * 100 : 0;

  if (done) {
    const pct = total > 0 ? Math.round((known / total) * 100) : 0;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2">Session Complete!</h2>
          <p className="text-slate-400 mb-8">You reviewed {total} flashcards</p>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{known}</div>
              <div className="text-xs text-slate-500 mt-1">Knew it</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{toReview}</div>
              <div className="text-xs text-slate-500 mt-1">Need review</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-400">{pct}%</div>
              <div className="text-xs text-slate-500 mt-1">Score</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {toReview > 0 && (
              <button onClick={restartWrong}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold transition-colors">
                Review {toReview} missed cards
              </button>
            )}
            <button onClick={restart}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm font-medium">Flashcards</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: `${card.color.base}30`, color: card.color.dark }}>
            {card.category}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setDeck(shuffle(deck)); setCardIdx(0); setFlipped(false); setResults({}); }}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
          <span className="text-slate-500 text-sm font-mono">{cardIdx + 1}/{total}</span>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-0.5 w-full bg-white/10 flex-shrink-0">
        <div className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: card.color.base }} />
      </div>

      {/* Score pills */}
      <div className="flex justify-center gap-4 pt-3 pb-1 flex-shrink-0">
        <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" /> {known} knew
        </span>
        <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
          <RotateCcw className="w-3.5 h-3.5" /> {toReview} review
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-4 min-h-0">
        <div
          className="relative w-full max-w-lg cursor-pointer select-none"
          style={{ perspective: 1200, height: 320 }}
          onClick={() => setFlipped(f => !f)}
        >
          <div
            style={{
              position: 'absolute', inset: 0,
              transition: 'transform 0.55s cubic-bezier(.4,0,.2,1)',
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div
              style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                background: `linear-gradient(135deg, ${card.color.base}22 0%, ${card.color.base}10 100%)`,
                border: `1.5px solid ${card.color.base}45`,
                borderRadius: 20,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '28px 32px',
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-5"
                style={{ color: card.color.dark, opacity: 0.7 }}>Question</div>
              <p className="text-white text-xl font-bold text-center leading-relaxed whitespace-pre-line">
                {card.front}
              </p>
              <div className="mt-6 text-slate-600 text-xs">Click or press Space to reveal</div>
            </div>

            {/* Back */}
            <div
              style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: `linear-gradient(135deg, ${card.color.base}35 0%, ${card.color.base}18 100%)`,
                border: `2px solid ${card.color.base}70`,
                borderRadius: 20,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '24px 32px',
                gap: 12,
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: card.color.dark, opacity: 0.7 }}>Answer</div>
              {card.back ? (
                <p className="text-white text-2xl font-extrabold text-center">{card.back}</p>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center max-h-44 overflow-y-auto">
                  {card.backItems.map((item, i) => (
                    <span key={i}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
                      style={{ background: `${card.color.base}50`, border: `1px solid ${card.color.base}60` }}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pb-8 px-6 flex-shrink-0">
        <button
          onClick={() => advance('skip')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 text-slate-400 hover:text-white text-sm font-semibold transition-all border border-white/10"
        >
          <SkipForward className="w-4 h-4" /> Skip
        </button>

        {flipped ? (
          <>
            <button
              onClick={() => advance('review')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 hover:text-amber-200 text-sm font-semibold transition-all border border-amber-500/35"
            >
              <XCircle className="w-4 h-4" /> Review again
            </button>
            <button
              onClick={() => advance('know')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/25"
            >
              <CheckCircle className="w-4 h-4" /> Knew it!
            </button>
          </>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
            style={{ background: card.color.base, boxShadow: `0 4px 20px ${card.color.base}50` }}
          >
            Reveal Answer
          </button>
        )}
      </div>

      <div className="pb-3 text-center text-slate-700 text-xs flex-shrink-0">
        Space = flip · → knew it · ↓ review · ← skip
      </div>
    </div>
  );
};

export default FlashcardMode;
