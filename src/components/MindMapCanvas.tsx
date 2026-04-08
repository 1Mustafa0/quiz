import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MindMapData } from '../services/mindmapService';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const BRANCH_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

const RADII = [0, 210, 380, 520, 640];

interface LayoutNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  color: string;
  parentId: string | null;
}

function wrapLabel(text: string, maxLen = 18): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur ? cur + ' ' + w : w).length <= maxLen) {
      cur = cur ? cur + ' ' + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function nodeSize(depth: number): { w: number; h: number } {
  if (depth === 0) return { w: 170, h: 52 };
  if (depth === 1) return { w: 140, h: 40 };
  if (depth === 2) return { w: 120, h: 34 };
  return { w: 100, h: 28 };
}

function fontSize(depth: number): number {
  if (depth === 0) return 15;
  if (depth === 1) return 12.5;
  if (depth === 2) return 11;
  return 10;
}

function computeLayout(data: MindMapData): LayoutNode[] {
  const all: LayoutNode[] = [];

  all.push({ id: 'root', label: data.topic, depth: 0, x: 0, y: 0, color: '#4f46e5', parentId: null });

  const N = data.branches.length;

  data.branches.forEach((branch, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
    const baseAngle = (2 * Math.PI * i / N) - Math.PI / 2;
    const sectorHalf = Math.PI / N;

    const bx = Math.cos(baseAngle) * RADII[1];
    const by = Math.sin(baseAngle) * RADII[1];
    const bId = `b${i}`;
    all.push({ id: bId, label: branch.label, depth: 1, x: bx, y: by, color, parentId: 'root' });

    const M = branch.children.length || 1;

    branch.children.forEach((child, j) => {
      const childAngle = M === 1
        ? baseAngle
        : (baseAngle - sectorHalf * 0.85) + (sectorHalf * 1.7 * j / (M - 1));

      const cx2 = Math.cos(childAngle) * RADII[2];
      const cy2 = Math.sin(childAngle) * RADII[2];
      const cId = `b${i}c${j}`;
      all.push({ id: cId, label: child.label, depth: 2, x: cx2, y: cy2, color, parentId: bId });

      const K = child.children?.length || 0;
      if (K > 0) {
        const gcSectorHalf = sectorHalf * 0.85 / Math.max(M, 1);
        child.children.forEach((gc, k) => {
          const gcAngle = K === 1
            ? childAngle
            : (childAngle - gcSectorHalf) + (gcSectorHalf * 2 * k / (K - 1));

          const gx = Math.cos(gcAngle) * RADII[3];
          const gy = Math.sin(gcAngle) * RADII[3];
          all.push({ id: `b${i}c${j}gc${k}`, label: gc.label, depth: 3, x: gx, y: gy, color, parentId: cId });

          const L = gc.children?.length || 0;
          if (L > 0) {
            const ggSectorHalf = gcSectorHalf / Math.max(K, 1);
            gc.children.forEach((gg, l) => {
              const ggAngle = L === 1
                ? gcAngle
                : (gcAngle - ggSectorHalf) + (ggSectorHalf * 2 * l / (L - 1));
              const ggx = Math.cos(ggAngle) * RADII[4];
              const ggy = Math.sin(ggAngle) * RADII[4];
              all.push({ id: `b${i}c${j}gc${k}gg${l}`, label: gg.label, depth: 4, x: ggx, y: ggy, color, parentId: `b${i}c${j}gc${k}` });
            });
          }
        });
      }
    });
  });

  return all;
}

function getEdgePath(from: LayoutNode, to: LayoutNode): string {
  const fw = nodeSize(from.depth).w / 2;
  const tw = nodeSize(to.depth).w / 2;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';

  const nx = dx / dist;
  const ny = dy / dist;

  const sx = from.x + nx * fw;
  const sy = from.y + ny * nodeSize(from.depth).h / 2;
  const ex = to.x - nx * tw;
  const ey = to.y - ny * nodeSize(to.depth).h / 2;

  const c1x = sx + (ex - sx) * 0.45;
  const c1y = sy;
  const c2x = sx + (ex - sx) * 0.55;
  const c2y = ey;

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
}

interface Props {
  data: MindMapData;
}

const MindMapCanvas: React.FC<Props> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const nodes = computeLayout(data);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const pad = 120;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const vw = maxX - minX;
  const vh = maxY - minY;

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(2.5, Math.max(0.3, s - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({
      x: p.x + (e.clientX - lastPos.current.x),
      y: p.y + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  const resetView = () => { setScale(0.85); setPan({ x: 0, y: 0 }); };

  return (
    <div className="relative w-full bg-slate-50 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden" style={{ height: '620px' }}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button onClick={() => setScale(s => Math.min(2.5, s + 0.15))} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => setScale(s => Math.max(0.3, s - 0.15))} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={resetView} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="absolute bottom-3 left-3 z-10 text-xs text-gray-400 dark:text-slate-500 select-none">
        اسحب للتحريك • عجلة الماوس للتكبير
      </div>

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${minX} ${minY} ${vw} ${vh}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging.current ? 'none' : 'transform 0.15s ease',
          }}
        >
          <defs>
            {BRANCH_COLORS.map((c, i) => (
              <filter key={i} id={`shadow-${i}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={c} floodOpacity="0.25" />
              </filter>
            ))}
            <filter id="shadow-root" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#4f46e5" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Edges */}
          {nodes.map(node => {
            if (!node.parentId) return null;
            const parent = nodeMap.get(node.parentId);
            if (!parent) return null;
            const d = getEdgePath(parent, node);
            const strokeWidth = node.depth === 1 ? 2.5 : node.depth === 2 ? 1.8 : 1.3;
            const opacity = node.depth === 1 ? 0.75 : node.depth === 2 ? 0.6 : 0.45;
            return (
              <path
                key={`edge-${node.id}`}
                d={d}
                fill="none"
                stroke={node.color}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const { w, h } = nodeSize(node.depth);
            const lines = wrapLabel(node.label, node.depth === 0 ? 22 : node.depth === 1 ? 18 : 16);
            const lineH = fontSize(node.depth) + 3;
            const totalH = lines.length * lineH;
            const isRoot = node.depth === 0;
            const colorIdx = BRANCH_COLORS.indexOf(node.color);
            const filterStr = isRoot ? 'url(#shadow-root)' : colorIdx >= 0 ? `url(#shadow-${colorIdx})` : undefined;

            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} filter={filterStr}>
                {isRoot ? (
                  <rect
                    x={-w / 2} y={-h / 2} width={w} height={h} rx={14}
                    fill="#4f46e5"
                    stroke="#3730a3"
                    strokeWidth={2}
                  />
                ) : node.depth === 1 ? (
                  <rect
                    x={-w / 2} y={-h / 2} width={w} height={h} rx={10}
                    fill={node.color}
                    stroke={node.color}
                    strokeWidth={1.5}
                    fillOpacity={0.18}
                    strokeOpacity={0.9}
                  />
                ) : (
                  <rect
                    x={-w / 2} y={-h / 2} width={w} height={h} rx={7}
                    fill="white"
                    stroke={node.color}
                    strokeWidth={1.2}
                    strokeOpacity={0.6}
                    fillOpacity={0.92}
                  />
                )}

                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={0}
                    y={(li - (lines.length - 1) / 2) * lineH}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fontSize(node.depth)}
                    fontWeight={node.depth <= 1 ? '700' : '500'}
                    fill={isRoot ? 'white' : node.depth === 1 ? node.color : '#1e293b'}
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default MindMapCanvas;
