import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MindMapData } from '../services/mindmapService';
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Plus, Pencil, Trash2 } from 'lucide-react';

/* ─── palette ───────────────────────────────────────────────────── */
const BRANCH_COLORS = [
  { base: '#6366f1', light: '#eef2ff', text: '#4338ca' }, // indigo
  { base: '#f59e0b', light: '#fffbeb', text: '#b45309' }, // amber
  { base: '#10b981', light: '#ecfdf5', text: '#047857' }, // emerald
  { base: '#ef4444', light: '#fef2f2', text: '#b91c1c' }, // red
  { base: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9' }, // violet
  { base: '#06b6d4', light: '#ecfeff', text: '#0e7490' }, // cyan
  { base: '#f97316', light: '#fff7ed', text: '#c2410c' }, // orange
  { base: '#ec4899', light: '#fdf2f8', text: '#be185d' }, // pink
];

/* ─── layout constants ───────────────────────────────────────────── */
const RADII = [0, 260, 455, 625, 780];

interface LayoutNode {
  id: string; label: string; depth: number;
  x: number; y: number;
  color: string; lightColor: string; textColor: string;
  parentId: string | null;
}

/* ─── helpers ────────────────────────────────────────────────────── */
function wrapLabel(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    (cur + ' ' + w).length <= max ? (cur += ' ' + w) : (lines.push(cur), cur = w);
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function nodeSize(depth: number) {
  return [
    { w: 210, h: 66, rx: 33 },
    { w: 168, h: 50, rx: 25 },
    { w: 148, h: 40, rx: 10 },
    { w: 130, h: 32, rx: 8 },
    { w: 112, h: 28, rx: 6 },
  ][Math.min(depth, 4)];
}

function nodeFontSize(depth: number) {
  return [16, 13, 11.5, 10.5, 10][Math.min(depth, 4)];
}

/* ─── layout ─────────────────────────────────────────────────────── */
function computeLayout(data: MindMapData): LayoutNode[] {
  const all: LayoutNode[] = [];
  all.push({ id: 'root', label: data.topic, depth: 0, x: 0, y: 0, color: '#4f46e5', lightColor: '#eef2ff', textColor: '#ffffff', parentId: null });

  const N = data.branches.length || 1;
  const startAngle = -Math.PI / 2;

  data.branches.forEach((branch, i) => {
    const pal = BRANCH_COLORS[i % BRANCH_COLORS.length];
    const baseAngle = startAngle + (2 * Math.PI * i) / N;
    const sectorHalf = Math.PI / N;

    const bx = Math.cos(baseAngle) * RADII[1];
    const by = Math.sin(baseAngle) * RADII[1];
    const bId = `b${i}`;
    all.push({ id: bId, label: branch.label, depth: 1, x: bx, y: by, color: pal.base, lightColor: pal.light, textColor: pal.text, parentId: 'root' });

    const M = branch.children.length || 1;
    branch.children.forEach((child, j) => {
      const spread = sectorHalf * (M > 1 ? 1.1 : 0);
      const childAngle = M === 1 ? baseAngle : baseAngle - spread + (spread * 2 * j) / (M - 1);
      const cx2 = Math.cos(childAngle) * RADII[2];
      const cy2 = Math.sin(childAngle) * RADII[2];
      const cId = `b${i}c${j}`;
      all.push({ id: cId, label: child.label, depth: 2, x: cx2, y: cy2, color: pal.base, lightColor: pal.light, textColor: pal.text, parentId: bId });

      const K = child.children?.length || 0;
      if (K > 0) {
        const gcSector = sectorHalf * 0.8 / Math.max(M, 1);
        child.children.forEach((gc, k) => {
          const gcAngle = K === 1 ? childAngle : childAngle - gcSector + (gcSector * 2 * k) / (K - 1);
          const gx = Math.cos(gcAngle) * RADII[3];
          const gy = Math.sin(gcAngle) * RADII[3];
          const gcId = `b${i}c${j}gc${k}`;
          all.push({ id: gcId, label: gc.label, depth: 3, x: gx, y: gy, color: pal.base, lightColor: pal.light, textColor: pal.text, parentId: cId });

          const L = gc.children?.length || 0;
          if (L > 0) {
            const ggSector = gcSector / Math.max(K, 1);
            gc.children.forEach((gg, l) => {
              const ggAngle = L === 1 ? gcAngle : gcAngle - ggSector + (ggSector * 2 * l) / (L - 1);
              all.push({ id: `b${i}c${j}gc${k}gg${l}`, label: gg.label, depth: 4, x: Math.cos(ggAngle) * RADII[4], y: Math.sin(ggAngle) * RADII[4], color: pal.base, lightColor: pal.light, textColor: pal.text, parentId: gcId });
            });
          }
        });
      }
    });
  });
  return all;
}

/* ─── edge path ─────────────────────────────────────────────────── */
function getEdgePath(f: LayoutNode, t: LayoutNode): string {
  const { w: fw, h: fh } = nodeSize(f.depth);
  const { w: tw, h: th } = nodeSize(t.depth);
  const dx = t.x - f.x, dy = t.y - f.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return '';
  const nx = dx / dist, ny = dy / dist;
  // exit from edge of source rect, enter edge of target rect
  const sx = f.x + nx * (fw / 2), sy = f.y + ny * (fh / 2);
  const ex = t.x - nx * (tw / 2), ey = t.y - ny * (th / 2);
  const mid = 0.45;
  return `M ${sx} ${sy} C ${sx + (ex - sx) * mid} ${sy}, ${sx + (ex - sx) * (1 - mid)} ${ey}, ${ex} ${ey}`;
}

/* ─── data mutators ──────────────────────────────────────────────── */
function updateNodeLabel(data: MindMapData, id: string, label: string): MindMapData {
  if (id === 'root') return { ...data, topic: label };
  const m = id.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
  if (!m) return data;
  const [, bi, ci, gci, ggi] = m.map(x => x !== undefined ? parseInt(x) : undefined);
  return {
    ...data, branches: data.branches.map((br, i) => {
      if (i !== bi) return br;
      if (ci === undefined) return { ...br, label };
      return {
        ...br, children: br.children.map((ch, j) => {
          if (j !== ci) return ch;
          if (gci === undefined) return { ...ch, label };
          return {
            ...ch, children: (ch.children || []).map((gc, k) => {
              if (k !== gci) return gc;
              if (ggi === undefined) return { ...gc, label };
              return { ...gc, children: (gc.children || []).map((gg, l) => l !== ggi ? gg : { ...gg, label }) };
            })
          };
        })
      };
    })
  };
}

function addChildToNode(data: MindMapData, parentId: string): { data: MindMapData; newId: string } {
  const blank = { label: 'New Node', children: [] };
  if (parentId === 'root') {
    return { data: { ...data, branches: [...data.branches, blank] }, newId: `b${data.branches.length}` };
  }
  const m = parentId.match(/^b(\d+)(?:c(\d+)(?:gc(\d+))?)?$/);
  if (!m) return { data, newId: '' };
  const [, bi, ci, gci] = m.map(x => x !== undefined ? parseInt(x) : undefined);
  let newId = '';
  const branches = data.branches.map((br, i) => {
    if (i !== bi) return br;
    if (ci === undefined) {
      newId = `b${bi}c${br.children.length}`;
      return { ...br, children: [...br.children, blank] };
    }
    return {
      ...br, children: br.children.map((ch, j) => {
        if (j !== ci) return ch;
        if (gci === undefined) {
          newId = `b${bi}c${ci}gc${(ch.children || []).length}`;
          return { ...ch, children: [...(ch.children || []), blank] };
        }
        return {
          ...ch, children: (ch.children || []).map((gc, k) => {
            if (k !== gci) return gc;
            newId = `b${bi}c${ci}gc${gci}gg${(gc.children || []).length}`;
            return { ...gc, children: [...(gc.children || []), blank] };
          })
        };
      })
    };
  });
  return { data: { ...data, branches }, newId };
}

function deleteNodeFromData(data: MindMapData, id: string): MindMapData {
  if (id === 'root') return data;
  const m = id.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
  if (!m) return data;
  const [, bi, ci, gci, ggi] = m.map(x => x !== undefined ? parseInt(x) : undefined);
  return {
    ...data, branches: data.branches.flatMap((br, i) => {
      if (i !== bi) return [br];
      if (ci === undefined) return [];
      return [{
        ...br, children: br.children.flatMap((ch, j) => {
          if (j !== ci) return [ch];
          if (gci === undefined) return [];
          return [{
            ...ch, children: (ch.children || []).flatMap((gc, k) => {
              if (k !== gci) return [gc];
              if (ggi === undefined) return [];
              return [{ ...gc, children: (gc.children || []).filter((_, l) => l !== ggi) }];
            })
          }];
        })
      }];
    })
  };
}

/* ─── component ──────────────────────────────────────────────────── */
interface Props {
  data: MindMapData;
  onDataChange?: (updated: MindMapData) => void;
  height?: string;
}

const MindMapCanvas: React.FC<Props> = ({ data, onDataChange, height = '680px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cSize, setCSize] = useState({ w: 900, h: 680 });
  const [scale, setScale] = useState(0.70);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const dragRef = useRef<{ mode: 'canvas' | 'node'; nodeId?: string; lastX: number; lastY: number; moved: boolean } | null>(null);

  const baseNodes = useMemo(() => computeLayout(data), [data]);
  const nodes = useMemo(() => baseNodes.map(n => ({
    ...n, x: n.x + (nodeOffsets[n.id]?.x ?? 0), y: n.y + (nodeOffsets[n.id]?.y ?? 0),
  })), [baseNodes, nodeOffsets]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  useEffect(() => {
    if (pendingEditId && nodes.some(n => n.id === pendingEditId)) {
      setEditingId(pendingEditId); setEditValue(''); setPendingEditId(null);
    }
  }, [nodes, pendingEditId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setCSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    setCSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => Math.min(3, Math.max(0.18, s - e.deltaY * 0.0008)));
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId) {
      const val = editValue.trim();
      if (val && onDataChange) onDataChange(updateNodeLabel(data, editingId, val));
    }
    setEditingId(null); setEditValue('');
  }, [editingId, editValue, data, onDataChange]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (editingId) { commitEdit(); return; }
    setDeleteConfirm(false);
    dragRef.current = { mode: 'canvas', lastX: e.clientX, lastY: e.clientY, moved: false };
  }, [editingId, commitEdit]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (editingId) return;
    setDeleteConfirm(false);
    dragRef.current = { mode: 'node', nodeId, lastX: e.clientX, lastY: e.clientY, moved: false };
  }, [editingId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.lastX, dy = e.clientY - d.lastY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    if (d.mode === 'canvas') setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    else if (d.mode === 'node' && d.nodeId && d.moved) {
      const nid = d.nodeId;
      setNodeOffsets(prev => ({ ...prev, [nid]: { x: (prev[nid]?.x ?? 0) + dx / scale, y: (prev[nid]?.y ?? 0) + dy / scale } }));
    }
    d.lastX = e.clientX; d.lastY = e.clientY;
  }, [scale]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (dragRef.current?.moved) return;
    setSelectedId(id => id === nodeId ? null : nodeId);
    setDeleteConfirm(false);
  }, []);
  const handleContainerClick = useCallback(() => {
    if (!dragRef.current?.moved) { setSelectedId(null); setDeleteConfirm(false); }
  }, []);
  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, node: typeof nodes[0]) => {
    e.stopPropagation();
    setSelectedId(node.id); setEditingId(node.id); setEditValue(node.label);
  }, []);

  const handleAddChild = useCallback(() => {
    if (!selectedId) return;
    const { data: updated, newId } = addChildToNode(data, selectedId);
    onDataChange?.(updated); setPendingEditId(newId); setSelectedId(null);
  }, [selectedId, data, onDataChange]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    onDataChange?.(deleteNodeFromData(data, selectedId));
    setSelectedId(null); setDeleteConfirm(false);
  }, [selectedId, data, onDataChange, deleteConfirm]);

  const handleEditSelected = useCallback(() => {
    const node = nodes.find(n => n.id === selectedId);
    if (!node) return;
    setEditingId(node.id); setEditValue(node.label);
  }, [selectedId, nodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingId) { setEditingId(null); setEditValue(''); }
      else { setSelectedId(null); setDeleteConfirm(false); }
    }
    if (e.key === 'Delete' && selectedId && selectedId !== 'root' && !editingId) {
      if (!deleteConfirm) setDeleteConfirm(true);
      else { onDataChange?.(deleteNodeFromData(data, selectedId)); setSelectedId(null); setDeleteConfirm(false); }
    }
  }, [editingId, selectedId, deleteConfirm, data, onDataChange]);

  const cx = cSize.w / 2, cy = cSize.h / 2;

  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;
  const toolbarPos = selectedNode ? (() => {
    const { h } = nodeSize(selectedNode.depth);
    const sx = cx + pan.x + selectedNode.x * scale;
    const sy = cy + pan.y + selectedNode.y * scale;
    const above = sy - (h / 2) * scale - 52;
    return {
      left: Math.max(8, Math.min(cSize.w - 208, sx - 88)),
      top: above < 8 ? sy + (h / 2) * scale + 8 : above,
    };
  })() : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full overflow-hidden outline-none"
      style={{
        height,
        background: 'radial-gradient(ellipse at 50% 0%, #eef2ff 0%, #f8f9fe 55%, #f1f5f9 100%)',
        cursor: dragRef.current?.mode === 'canvas' ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
    >
      {/* dark-mode bg override */}
      <style>{`.dark .mm-canvas-bg { background: radial-gradient(ellipse at 50% 0%, #1e1b4b22 0%, #0f172a 60%) !important; }`}</style>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        {([
          [ZoomIn, () => setScale(s => Math.min(3, s + 0.14))],
          [ZoomOut, () => setScale(s => Math.max(0.18, s - 0.14))],
          [Maximize2, () => { setScale(0.70); setPan({ x: 0, y: 0 }); }],
        ] as const).map(([Icon, fn], i) => (
          <button key={i} onClick={fn as () => void}
            className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow border border-white/60 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-300 transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Floating toolbar */}
      {selectedNode && toolbarPos && !editingId && (
        <div
          className="absolute z-30 flex items-center gap-0.5 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 p-1"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={handleEditSelected}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-slate-600" />
          <button onClick={handleAddChild}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {selectedId !== 'root' && <>
            <div className="w-px h-5 bg-gray-200 dark:bg-slate-600" />
            <button onClick={handleDeleteNode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${deleteConfirm ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            >
              <Trash2 className="w-3.5 h-3.5" /> {deleteConfirm ? 'Sure?' : 'Delete'}
            </button>
          </>}
        </div>
      )}

      {/* Hints */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/60 dark:border-slate-700 pointer-events-none select-none shadow-sm">
        <MousePointer2 className="w-3 h-3" />
        Click to select · Double-click to edit · Drag to move
      </div>
      <div className="absolute bottom-3 right-3 z-10 text-xs font-mono text-gray-400 dark:text-slate-500 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm px-2.5 py-1.5 rounded-xl border border-white/60 dark:border-slate-700 pointer-events-none shadow-sm">
        {Math.round(scale * 100)}%
      </div>

      {/* SVG */}
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          {/* Root gradient */}
          <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>

          {/* Root glow */}
          <filter id="rootGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feFlood floodColor="#6366f1" floodOpacity="0.18" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Branch glow */}
          {BRANCH_COLORS.map((c, i) => (
            <filter key={i} id={`bGlow${i}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feFlood floodColor={c.base} floodOpacity="0.22" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}

          {/* Selection ring filter */}
          <filter id="selGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feFlood floodColor="#6366f1" floodOpacity="0.5" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Dot grid */}
          <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="1" fill="#94a3b8" opacity="0.25" />
          </pattern>
        </defs>

        {/* Grid */}
        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={`translate(${cx + pan.x}, ${cy + pan.y}) scale(${scale})`}>
          {/* Edges */}
          {nodes.map(node => {
            if (!node.parentId) return null;
            const parent = nodeMap.get(node.parentId);
            if (!parent) return null;
            const strokeW = [0, 3, 2, 1.4, 1][Math.min(node.depth, 4)];
            const opacity = [0, 0.55, 0.42, 0.3, 0.22][Math.min(node.depth, 4)];
            return (
              <path key={`e-${node.id}`}
                d={getEdgePath(parent, node)}
                fill="none"
                stroke={node.color}
                strokeWidth={strokeW}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const { w, h, rx } = nodeSize(node.depth);
            const isRoot = node.depth === 0;
            const isBranch = node.depth === 1;
            const isSelected = selectedId === node.id;
            const isEditing = editingId === node.id;
            const fs = nodeFontSize(node.depth);
            const lines = wrapLabel(node.label, isRoot ? 22 : node.depth === 1 ? 17 : 15);
            const lineH = fs + 4.5;
            const colorIdx = BRANCH_COLORS.findIndex(c => c.base === node.color);
            const filterAttr = isRoot ? 'url(#rootGlow)' : isBranch && colorIdx >= 0 ? `url(#bGlow${colorIdx})` : isSelected ? 'url(#selGlow)' : undefined;

            return (
              <g key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                filter={filterAttr}
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
                onClick={e => handleNodeClick(e, node.id)}
                onDoubleClick={e => handleNodeDoubleClick(e, node)}
                style={{ cursor: 'pointer' }}
              >
                {/* === ROOT === */}
                {isRoot && <>
                  {/* Outer glow ring (always) */}
                  <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={rx + 3}
                    fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.4"
                    strokeDasharray={isSelected ? '0' : '5 4'}
                  />
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx}
                    fill="url(#rootGrad)"
                    stroke={isSelected ? '#a5b4fc' : '#4338ca'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                </>}

                {/* === BRANCH (depth 1) === */}
                {isBranch && <>
                  {isSelected && <rect x={-w / 2 - 5} y={-h / 2 - 5} width={w + 10} height={h + 10} rx={rx + 5}
                    fill="none" stroke={node.color} strokeWidth="2" strokeOpacity="0.5" strokeDasharray="6 4"
                  />}
                  {/* subtle shadow rect */}
                  <rect x={-w / 2 + 3} y={-h / 2 + 4} width={w} height={h} rx={rx}
                    fill={node.color} opacity="0.10"
                  />
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx}
                    fill={node.lightColor} stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : 2}
                    strokeOpacity={isSelected ? 1 : 0.75}
                  />
                  {/* Colored top-edge accent */}
                  <rect x={-w / 2 + 14} y={-h / 2} width={w - 28} height={3.5} rx={1.5}
                    fill={node.color} opacity={isSelected ? 0.9 : 0.6}
                  />
                </>}

                {/* === CHILD (depth 2) === */}
                {node.depth === 2 && <>
                  {isSelected && <rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} rx={rx + 4}
                    fill="none" stroke={node.color} strokeWidth="1.8" strokeOpacity="0.5" strokeDasharray="5 3"
                  />}
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx}
                    fill="white" stroke={node.color}
                    strokeWidth={isSelected ? 2 : 1.4}
                    strokeOpacity={isSelected ? 0.9 : 0.55}
                  />
                  {/* Left accent bar */}
                  <rect x={-w / 2} y={-h / 2 + 6} width={4} height={h - 12} rx={2}
                    fill={node.color} opacity={isSelected ? 0.85 : 0.6}
                  />
                </>}

                {/* === GRANDCHILD (depth 3+) === */}
                {node.depth >= 3 && <>
                  {isSelected && <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={rx + 3}
                    fill="none" stroke={node.color} strokeWidth="1.5" strokeOpacity="0.45" strokeDasharray="4 3"
                  />}
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx}
                    fill={node.lightColor} fillOpacity="0.7"
                    stroke={node.color} strokeWidth={isSelected ? 1.8 : 1}
                    strokeOpacity={isSelected ? 0.8 : 0.4}
                  />
                </>}

                {/* === LABEL / EDITOR === */}
                {isEditing ? (
                  <foreignObject x={-w / 2 + 8} y={-h / 2 + 4} width={w - 16} height={h - 8}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                        }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          textAlign: 'center', fontSize: `${fs}px`,
                          fontWeight: node.depth <= 1 ? 700 : 600,
                          color: isRoot ? 'white' : node.depth === 1 ? node.textColor : '#1e293b',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}
                      />
                    </div>
                  </foreignObject>
                ) : (
                  lines.map((line, li) => (
                    <text key={li}
                      x={node.depth === 2 ? 4 : 0}
                      y={(li - (lines.length - 1) / 2) * lineH}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fs}
                      fontWeight={node.depth === 0 ? 800 : node.depth === 1 ? 700 : node.depth === 2 ? 600 : 500}
                      letterSpacing={node.depth === 0 ? '0.4' : '0.15'}
                      fill={
                        isRoot ? 'white'
                          : node.depth === 1 ? node.textColor
                          : node.depth === 2 ? '#1e293b'
                          : '#475569'
                      }
                      style={{
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        pointerEvents: 'none',
                        textRendering: 'optimizeLegibility',
                      }}
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
