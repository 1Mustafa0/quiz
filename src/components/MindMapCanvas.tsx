import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MindMapData } from '../services/mindmapService';
import { ZoomIn, ZoomOut, Maximize2, MousePointer2 } from 'lucide-react';

const BRANCH_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

const RADII = [0, 210, 390, 540, 660];

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
  return lines.slice(0, 3);
}

function nodeSize(depth: number): { w: number; h: number } {
  if (depth === 0) return { w: 180, h: 56 };
  if (depth === 1) return { w: 150, h: 44 };
  if (depth === 2) return { w: 128, h: 36 };
  return { w: 108, h: 30 };
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

function getEdgePath(from: { x: number; y: number; depth: number }, to: { x: number; y: number; depth: number }): string {
  const fw = nodeSize(from.depth).w / 2;
  const tw = nodeSize(to.depth).w / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';
  const nx = dx / dist;
  const ny = dy / dist;
  const sx = from.x + nx * fw;
  const sy = from.y + ny * (nodeSize(from.depth).h / 2);
  const ex = to.x - nx * tw;
  const ey = to.y - ny * (nodeSize(to.depth).h / 2);
  const c1x = sx + (ex - sx) * 0.45;
  const c2x = sx + (ex - sx) * 0.55;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`;
}

function updateNodeLabel(data: MindMapData, nodeId: string, newLabel: string): MindMapData {
  if (nodeId === 'root') return { ...data, topic: newLabel };

  const m = nodeId.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
  if (!m) return data;
  const [, bi, ci, gci, ggi] = m.map(x => (x !== undefined ? parseInt(x) : undefined));

  return {
    ...data,
    branches: data.branches.map((branch, i) => {
      if (i !== bi) return branch;
      if (ci === undefined) return { ...branch, label: newLabel };
      return {
        ...branch,
        children: branch.children.map((child, j) => {
          if (j !== ci) return child;
          if (gci === undefined) return { ...child, label: newLabel };
          return {
            ...child,
            children: (child.children || []).map((gc, k) => {
              if (k !== gci) return gc;
              if (ggi === undefined) return { ...gc, label: newLabel };
              return {
                ...gc,
                children: (gc.children || []).map((gg, l) =>
                  l !== ggi ? gg : { ...gg, label: newLabel }
                ),
              };
            }),
          };
        }),
      };
    }),
  };
}

interface Props {
  data: MindMapData;
  onDataChange?: (updated: MindMapData) => void;
}

const MindMapCanvas: React.FC<Props> = ({ data, onDataChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 900, h: 680 });
  const [scale, setScale] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const dragRef = useRef<{
    mode: 'canvas' | 'node';
    nodeId?: string;
    lastX: number;
    lastY: number;
  } | null>(null);

  const baseNodes = useMemo(() => computeLayout(data), [data]);

  useEffect(() => { setNodeOffsets({}); }, [data]);

  const nodes = useMemo(() =>
    baseNodes.map(n => ({
      ...n,
      x: n.x + (nodeOffsets[n.id]?.x ?? 0),
      y: n.y + (nodeOffsets[n.id]?.y ?? 0),
    })),
    [baseNodes, nodeOffsets]
  );

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => Math.min(3, Math.max(0.2, s - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (editingId) { commitEdit(); return; }
    dragRef.current = { mode: 'canvas', lastX: e.clientX, lastY: e.clientY };
  }, [editingId]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (editingId) return;
    dragRef.current = { mode: 'node', nodeId, lastX: e.clientX, lastY: e.clientY };
  }, [editingId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    if (d.mode === 'canvas') {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (d.mode === 'node' && d.nodeId) {
      const nid = d.nodeId;
      setNodeOffsets(prev => ({
        ...prev,
        [nid]: {
          x: (prev[nid]?.x ?? 0) + dx / scale,
          y: (prev[nid]?.y ?? 0) + dy / scale,
        },
      }));
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  }, [scale]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, node: LayoutNode & { x: number; y: number }) => {
    e.stopPropagation();
    setEditingId(node.id);
    setEditValue(node.label);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId && editValue.trim() && onDataChange) {
      const updated = updateNodeLabel(data, editingId, editValue.trim());
      onDataChange(updated);
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, data, onDataChange]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
  }, [commitEdit]);

  const resetView = () => { setScale(0.75); setPan({ x: 0, y: 0 }); setNodeOffsets({}); };

  const cx = containerSize.w / 2;
  const cy = containerSize.h / 2;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-slate-50 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden select-none"
      style={{ height: '680px', cursor: dragRef.current?.mode === 'canvas' ? 'grabbing' : 'grab' }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn, onClick: () => setScale(s => Math.min(3, s + 0.15)) },
          { icon: ZoomOut, onClick: () => setScale(s => Math.max(0.2, s - 0.15)) },
          { icon: Maximize2, onClick: resetView },
        ].map(({ icon: Icon, onClick }, i) => (
          <button
            key={i}
            onClick={onClick}
            className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700 pointer-events-none">
        <MousePointer2 className="w-3 h-3" />
        Drag nodes to rearrange · Double-click to edit
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-3 right-3 z-10 text-xs text-gray-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-100 dark:border-slate-700 pointer-events-none">
        {Math.round(scale * 100)}%
      </div>

      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          {BRANCH_COLORS.map((c, i) => (
            <filter key={i} id={`mm-shadow-${i}`} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={c} floodOpacity="0.22" />
            </filter>
          ))}
          <filter id="mm-shadow-root" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#4f46e5" floodOpacity="0.3" />
          </filter>
          <pattern id="mm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.15" />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect width="100%" height="100%" fill="url(#mm-grid)" className="text-gray-400 dark:text-slate-600" />

        <g transform={`translate(${cx + pan.x}, ${cy + pan.y}) scale(${scale})`}>
          {/* Edges */}
          {nodes.map(node => {
            if (!node.parentId) return null;
            const parent = nodeMap.get(node.parentId);
            if (!parent) return null;
            return (
              <path
                key={`edge-${node.id}`}
                d={getEdgePath(parent, node)}
                fill="none"
                stroke={node.color}
                strokeWidth={node.depth === 1 ? 2.5 : node.depth === 2 ? 1.8 : 1.2}
                strokeOpacity={node.depth === 1 ? 0.7 : node.depth === 2 ? 0.55 : 0.4}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const { w, h } = nodeSize(node.depth);
            const lines = wrapLabel(node.label, node.depth === 0 ? 22 : node.depth === 1 ? 18 : 16);
            const lineH = fontSize(node.depth) + 3.5;
            const isRoot = node.depth === 0;
            const colorIdx = BRANCH_COLORS.indexOf(node.color);
            const filterStr = isRoot ? 'url(#mm-shadow-root)' : colorIdx >= 0 ? `url(#mm-shadow-${colorIdx})` : undefined;
            const isEditing = editingId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                filter={filterStr}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                style={{ cursor: 'move' }}
              >
                {/* Node shape */}
                {isRoot ? (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={16}
                    fill="#4f46e5" stroke="#3730a3" strokeWidth={2} />
                ) : node.depth === 1 ? (
                  <>
                    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12}
                      fill={node.color} fillOpacity={0.12} stroke={node.color} strokeWidth={2} />
                  </>
                ) : (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8}
                    fill="white" fillOpacity={0.95} stroke={node.color} strokeWidth={1.3} strokeOpacity={0.65} />
                )}

                {/* Inline editor */}
                {isEditing ? (
                  <foreignObject x={-w / 2 + 4} y={-h / 2 + 4} width={w - 8} height={h - 8}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        onMouseDown={e => e.stopPropagation()}
                        autoFocus
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          textAlign: 'center',
                          fontSize: `${fontSize(node.depth)}px`,
                          fontWeight: node.depth <= 1 ? 700 : 500,
                          color: isRoot ? 'white' : node.depth === 1 ? node.color : '#1e293b',
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      />
                    </div>
                  </foreignObject>
                ) : (
                  lines.map((line, li) => (
                    <text
                      key={li}
                      x={0}
                      y={(li - (lines.length - 1) / 2) * lineH}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize(node.depth)}
                      fontWeight={node.depth <= 1 ? '700' : '500'}
                      fill={isRoot ? 'white' : node.depth === 1 ? node.color : '#1e293b'}
                      style={{ fontFamily: 'system-ui, sans-serif', pointerEvents: 'none' }}
                    >
                      {line}
                    </text>
                  ))
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default MindMapCanvas;
