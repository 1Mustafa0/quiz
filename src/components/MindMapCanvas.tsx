import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MindMapData } from '../services/mindmapService';
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Plus, Pencil, Trash2 } from 'lucide-react';

/* ─── Palette ────────────────────────────────────────────────────── */
const PALETTE = [
  { base: '#6366f1', light: '#eef2ff', text: '#3730a3' },
  { base: '#f97316', light: '#fff7ed', text: '#9a3412' },
  { base: '#10b981', light: '#ecfdf5', text: '#065f46' },
  { base: '#ec4899', light: '#fdf2f8', text: '#9d174d' },
  { base: '#0ea5e9', light: '#f0f9ff', text: '#075985' },
  { base: '#8b5cf6', light: '#f5f3ff', text: '#5b21b6' },
  { base: '#14b8a6', light: '#f0fdfa', text: '#115e59' },
  { base: '#f59e0b', light: '#fffbeb', text: '#78350f' },
];

interface LayoutNode {
  id: string; label: string; depth: number;
  x: number; y: number;
  base: string; light: string; text: string;
  parentId: string | null;
}

/* ─── Geometry ───────────────────────────────────────────────────── */
function nodeGeo(depth: number) {
  return [
    { w: 220, h: 70, rx: 35 },  // root
    { w: 178, h: 58, rx: 29 },  // branch
    { w: 158, h: 50, rx: 10 },  // child
    { w: 140, h: 42, rx: 8 },   // gc
    { w: 124, h: 36, rx: 6 },   // ggc
  ][Math.min(depth, 4)];
}
function nodeFSize(depth: number) { return [15, 12.5, 11, 10.5, 10][Math.min(depth, 4)]; }

/* Text padding per depth: { l, r, t, b } — accounts for decorations */
function nodePad(depth: number) {
  return [
    { l: 14, r: 14, t: 10, b: 10 }, // root
    { l: 22, r: 14, t: 12, b: 8 },  // branch (top accent + left dot)
    { l: 16, r: 10, t: 7,  b: 7 },  // child (left bar)
    { l: 10, r: 10, t: 6,  b: 6 },  // gc
    { l: 8,  r: 8,  t: 5,  b: 5 },  // ggc
  ][Math.min(depth, 4)];
}

/* ─── Leaf count for proportional layout ────────────────────────── */
function countLeaves(node: { children?: { children?: any[] }[] }): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + countLeaves(c), 0);
}

/* ─── Dynamic radii ──────────────────────────────────────────────── */
function computeRadii(data: MindMapData) {
  const N = Math.max(1, data.branches.length);
  const totalLeaves = Math.max(N, data.branches.reduce((s, b) => s + countLeaves(b), 0));
  const R1 = Math.max(270, Math.ceil(N * 196 / (2 * Math.PI)));
  const R2 = Math.min(Math.max(R1 + 250, Math.ceil(totalLeaves * 158 / (2 * Math.PI))), 960);
  return [0, R1, R2, R2 + 250, R2 + 480];
}


/* ─── Full layout (all nodes, not filtered) ──────────────────────── */
function computeLayout(data: MindMapData): LayoutNode[] {
  const R = computeRadii(data);
  const all: LayoutNode[] = [];
  all.push({ id: 'root', label: data.topic, depth: 0, x: 0, y: 0, base: '#4f46e5', light: '#eef2ff', text: '#ffffff', parentId: null });

  const N = data.branches.length;
  if (N === 0) return all;

  const bLeaves = data.branches.map(b => countLeaves(b));
  const totalLeaves = bLeaves.reduce((s, l) => s + l, 0) || N;
  let aSector = -Math.PI / 2;

  data.branches.forEach((branch, i) => {
    const pal = PALETTE[i % PALETTE.length];
    const bSize = (2 * Math.PI * bLeaves[i]) / totalLeaves;
    const bAngle = aSector + bSize / 2;
    aSector += bSize;

    all.push({ id: `b${i}`, label: branch.label, depth: 1, x: Math.cos(bAngle) * R[1], y: Math.sin(bAngle) * R[1], ...pal, parentId: 'root' });

    const M = branch.children.length;
    if (M === 0) return;
    const cLeaves = branch.children.map(c => countLeaves(c));
    const cTotal = cLeaves.reduce((s, l) => s + l, 0) || M;
    const mg = Math.min(0.07, bSize * 0.1);
    const usable = bSize - 2 * mg;
    let cStart = bAngle - bSize / 2 + mg;

    branch.children.forEach((child, j) => {
      const cSize = usable * cLeaves[j] / cTotal;
      const cAngle = cStart + cSize / 2;
      cStart += cSize;
      all.push({ id: `b${i}c${j}`, label: child.label, depth: 2, x: Math.cos(cAngle) * R[2], y: Math.sin(cAngle) * R[2], ...pal, parentId: `b${i}` });

      const K = child.children?.length || 0;
      if (K === 0) return;
      const gcLeaves = child.children.map(g => countLeaves(g));
      const gcTotal = gcLeaves.reduce((s, l) => s + l, 0) || K;
      const gcMg = Math.min(0.05, cSize * 0.1);
      const gcUsable = cSize - 2 * gcMg;
      let gcStart = cAngle - cSize / 2 + gcMg;

      child.children.forEach((gc, k) => {
        const gcSize = gcUsable * gcLeaves[k] / gcTotal;
        const gcAngle = gcStart + gcSize / 2;
        gcStart += gcSize;
        all.push({ id: `b${i}c${j}gc${k}`, label: gc.label, depth: 3, x: Math.cos(gcAngle) * R[3], y: Math.sin(gcAngle) * R[3], ...pal, parentId: `b${i}c${j}` });

        const L = gc.children?.length || 0;
        if (L === 0) return;
        const ggLeaves = gc.children.map(g => countLeaves(g));
        const ggTotal = ggLeaves.reduce((s, l) => s + l, 0) || L;
        const ggMg = Math.min(0.04, gcSize * 0.1);
        const ggUsable = gcSize - 2 * ggMg;
        let ggStart = gcAngle - gcSize / 2 + ggMg;
        gc.children.forEach((gg, l) => {
          const ggSize = ggUsable * ggLeaves[l] / ggTotal;
          const ggAngle = ggStart + ggSize / 2;
          ggStart += ggSize;
          all.push({ id: `b${i}c${j}gc${k}gg${l}`, label: gg.label, depth: 4, x: Math.cos(ggAngle) * R[4], y: Math.sin(ggAngle) * R[4], ...pal, parentId: `b${i}c${j}gc${k}` });
        });
      });
    });
  });
  return all;
}

/* ─── Initial collapsed: all branch nodes with children ──────────── */
function makeInitialCollapsed(data: MindMapData): Set<string> {
  const s = new Set<string>();
  data.branches.forEach((br, i) => {
    if (br.children.length > 0) {
      s.add(`b${i}`);
      br.children.forEach((ch, j) => { if ((ch.children?.length || 0) > 0) s.add(`b${i}c${j}`); });
    }
  });
  return s;
}

/* ─── Filter visible nodes based on collapsed set ────────────────── */
function filterVisible(all: LayoutNode[], collapsed: Set<string>): LayoutNode[] {
  const hidden = new Set<string>();
  for (const n of all) {
    if (n.parentId && (collapsed.has(n.parentId) || hidden.has(n.parentId))) hidden.add(n.id);
  }
  return all.filter(n => !hidden.has(n.id));
}

/* ─── Edge path ──────────────────────────────────────────────────── */
function edgePath(f: LayoutNode, t: LayoutNode): string {
  const { w: fw, h: fh } = nodeGeo(f.depth);
  const { w: tw, h: th } = nodeGeo(t.depth);
  const dx = t.x - f.x, dy = t.y - f.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return '';
  const nx = dx / dist, ny = dy / dist;
  const sx = f.x + nx * (fw / 2), sy = f.y + ny * (fh / 2);
  const ex = t.x - nx * (tw / 2), ey = t.y - ny * (th / 2);
  return `M ${sx} ${sy} C ${sx + (ex - sx) * 0.42} ${sy}, ${sx + (ex - sx) * 0.58} ${ey}, ${ex} ${ey}`;
}

/* ─── Data helpers ───────────────────────────────────────────────── */
function updateLabel(data: MindMapData, id: string, label: string): MindMapData {
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
          return { ...ch, children: (ch.children || []).map((gc, k) => k !== gci ? gc : ggi === undefined ? { ...gc, label } : { ...gc, children: (gc.children || []).map((gg, l) => l !== ggi ? gg : { ...gg, label }) }) };
        })
      };
    })
  };
}

function addChild(data: MindMapData, pid: string): { data: MindMapData; newId: string } {
  const blank = { label: 'New Node', children: [] };
  if (pid === 'root') return { data: { ...data, branches: [...data.branches, blank] }, newId: `b${data.branches.length}` };
  const m = pid.match(/^b(\d+)(?:c(\d+)(?:gc(\d+))?)?$/);
  if (!m) return { data, newId: '' };
  const [, bi, ci, gci] = m.map(x => x !== undefined ? parseInt(x) : undefined);
  let newId = '';
  const branches = data.branches.map((br, i) => {
    if (i !== bi) return br;
    if (ci === undefined) { newId = `b${bi}c${br.children.length}`; return { ...br, children: [...br.children, blank] }; }
    return {
      ...br, children: br.children.map((ch, j) => {
        if (j !== ci) return ch;
        if (gci === undefined) { newId = `b${bi}c${ci}gc${(ch.children || []).length}`; return { ...ch, children: [...(ch.children || []), blank] }; }
        return { ...ch, children: (ch.children || []).map((gc, k) => { if (k !== gci) return gc; newId = `b${bi}c${ci}gc${gci}gg${(gc.children || []).length}`; return { ...gc, children: [...(gc.children || []), blank] }; }) };
      })
    };
  });
  return { data: { ...data, branches }, newId };
}

function removeNode(data: MindMapData, id: string): MindMapData {
  if (id === 'root') return data;
  const m = id.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
  if (!m) return data;
  const [, bi, ci, gci, ggi] = m.map(x => x !== undefined ? parseInt(x) : undefined);
  return {
    ...data, branches: data.branches.flatMap((br, i) => {
      if (i !== bi) return [br];
      if (ci === undefined) return [];
      return [{ ...br, children: br.children.flatMap((ch, j) => { if (j !== ci) return [ch]; if (gci === undefined) return []; return [{ ...ch, children: (ch.children || []).flatMap((gc, k) => { if (k !== gci) return [gc]; if (ggi === undefined) return []; return [{ ...gc, children: (gc.children || []).filter((_, l) => l !== ggi) }]; }) }]; }) }];
    })
  };
}

/* ═══ Component ══════════════════════════════════════════════════════ */
interface Props { data: MindMapData; onDataChange?: (d: MindMapData) => void; height?: string; }

const MindMapCanvas: React.FC<Props> = ({ data, onDataChange, height = '680px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cSize, setCSize] = useState({ w: 900, h: 680 });
  const [scale, setScale] = useState(0.68);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(() => makeInitialCollapsed(data));
  const [selId, setSelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [delConfirm, setDelConfirm] = useState(false);
  const drag = useRef<{ mode: 'canvas' | 'node'; nid?: string; lx: number; ly: number; moved: boolean } | null>(null);

  // Reset on new map (topic change)
  const prevTopic = useRef(data.topic);
  useEffect(() => {
    if (data.topic !== prevTopic.current) {
      setCollapsed(makeInitialCollapsed(data));
      prevTopic.current = data.topic;
      setOffsets({}); setSelId(null); setEditId(null);
    }
  }, [data.topic]);

  // All nodes (for hasChildren check & initial layout)
  const allBaseNodes = useMemo(() => computeLayout(data), [data]);

  // Which nodes have children (in original data)
  const hasChildrenSet = useMemo(() => {
    const s = new Set<string>();
    allBaseNodes.forEach(n => { if (n.parentId) s.add(n.parentId); });
    return s;
  }, [allBaseNodes]);

  // Count direct children for badge
  const childCount = useMemo(() => {
    const m = new Map<string, number>();
    allBaseNodes.forEach(n => { if (n.parentId) m.set(n.parentId, (m.get(n.parentId) ?? 0) + 1); });
    return m;
  }, [allBaseNodes]);

  // Visible nodes (filtered by collapsed)
  const visibleBaseNodes = useMemo(() => filterVisible(allBaseNodes, collapsed), [allBaseNodes, collapsed]);

  const nodes = useMemo(() => visibleBaseNodes.map(n => ({
    ...n, x: n.x + (offsets[n.id]?.x ?? 0), y: n.y + (offsets[n.id]?.y ?? 0),
  })), [visibleBaseNodes, offsets]);

  const nMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Auto-edit newly added node
  useEffect(() => {
    if (pendingId && nodes.some(n => n.id === pendingId)) { setEditId(pendingId); setEditVal(''); setPendingId(null); }
  }, [nodes, pendingId]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e) setCSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el); setCSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); setScale(s => Math.min(3, Math.max(0.15, s - e.deltaY * 0.0008))); };
    el.addEventListener('wheel', fn, { passive: false }); return () => el.removeEventListener('wheel', fn);
  }, []);

  const commitEdit = useCallback(() => {
    if (editId && editVal.trim() && onDataChange) onDataChange(updateLabel(data, editId, editVal.trim()));
    setEditId(null); setEditVal('');
  }, [editId, editVal, data, onDataChange]);

  const onContainerMD = useCallback((e: React.MouseEvent) => {
    if (editId) { commitEdit(); return; }
    setDelConfirm(false);
    drag.current = { mode: 'canvas', lx: e.clientX, ly: e.clientY, moved: false };
  }, [editId, commitEdit]);

  const onNodeMD = useCallback((e: React.MouseEvent, nid: string) => {
    e.stopPropagation(); if (editId) return;
    setDelConfirm(false);
    drag.current = { mode: 'node', nid, lx: e.clientX, ly: e.clientY, moved: false };
  }, [editId]);

  const onMM = useCallback((e: React.MouseEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    if (d.mode === 'canvas') setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    else if (d.mode === 'node' && d.nid && d.moved) {
      const id = d.nid;
      setOffsets(prev => ({ ...prev, [id]: { x: (prev[id]?.x ?? 0) + dx / scale, y: (prev[id]?.y ?? 0) + dy / scale } }));
    }
    d.lx = e.clientX; d.ly = e.clientY;
  }, [scale]);

  const onMU = useCallback(() => { drag.current = null; }, []);

  // Click: select + toggle collapse
  const onNodeClick = useCallback((e: React.MouseEvent, nid: string) => {
    e.stopPropagation();
    if (drag.current?.moved) return;
    setDelConfirm(false);
    setSelId(prev => prev === nid ? null : nid);
    // Toggle collapse if has children
    if (hasChildrenSet.has(nid) && nid !== 'root') {
      setCollapsed(prev => {
        const next = new Set(prev);
        next.has(nid) ? next.delete(nid) : next.add(nid);
        return next;
      });
    }
  }, [hasChildrenSet]);

  const onContainerClick = useCallback(() => {
    if (!drag.current?.moved) { setSelId(null); setDelConfirm(false); }
  }, []);

  const onNodeDbl = useCallback((e: React.MouseEvent, n: typeof nodes[0]) => {
    e.stopPropagation(); setSelId(n.id); setEditId(n.id); setEditVal(n.label);
  }, []);

  const doAdd = useCallback(() => {
    if (!selId) return;
    const { data: d, newId } = addChild(data, selId);
    onDataChange?.(d);
    setPendingId(newId);
    // Auto-expand parent so new node is visible
    setCollapsed(prev => { const next = new Set(prev); next.delete(selId); return next; });
    setSelId(null);
  }, [selId, data, onDataChange]);

  const doDel = useCallback(() => {
    if (!selId || selId === 'root') return;
    if (!delConfirm) { setDelConfirm(true); return; }
    onDataChange?.(removeNode(data, selId));
    setCollapsed(prev => { const next = new Set(prev); next.delete(selId); return next; });
    setSelId(null); setDelConfirm(false);
  }, [selId, data, onDataChange, delConfirm]);

  const doEdit = useCallback(() => {
    const n = nodes.find(x => x.id === selId); if (!n) return;
    setEditId(n.id); setEditVal(n.label);
  }, [selId, nodes]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { if (editId) { setEditId(null); setEditVal(''); } else { setSelId(null); setDelConfirm(false); } }
    if (e.key === 'Delete' && selId && selId !== 'root' && !editId) {
      if (!delConfirm) setDelConfirm(true);
      else { onDataChange?.(removeNode(data, selId)); setSelId(null); setDelConfirm(false); }
    }
  }, [editId, selId, delConfirm, data, onDataChange]);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(makeInitialCollapsed(data));

  const cx = cSize.w / 2, cy = cSize.h / 2;
  const selNode = selId ? nodes.find(n => n.id === selId) : null;
  const toolbarPos = selNode ? (() => {
    const { h } = nodeGeo(selNode.depth);
    const sx = cx + pan.x + selNode.x * scale, sy = cy + pan.y + selNode.y * scale;
    const above = sy - (h / 2) * scale - 52;
    return { left: Math.max(8, Math.min(cSize.w - 212, sx - 88)), top: above < 8 ? sy + (h / 2) * scale + 8 : above };
  })() : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full overflow-hidden outline-none"
      style={{ height, background: 'linear-gradient(145deg,#f0f4ff 0%,#f8fafc 50%,#f0faf5 100%)', cursor: drag.current?.mode === 'canvas' ? 'grabbing' : 'grab' }}
      onMouseDown={onContainerMD} onMouseMove={onMM} onMouseUp={onMU}
      onMouseLeave={onMU} onClick={onContainerClick} onKeyDown={onKey}
    >
      {/* Controls top-right */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        {([
          [ZoomIn, () => setScale(s => Math.min(3, s + 0.12))],
          [ZoomOut, () => setScale(s => Math.max(0.15, s - 0.12))],
          [Maximize2, () => { setScale(0.68); setPan({ x: 0, y: 0 }); setOffsets({}); }],
        ] as const).map(([Icon, fn], i) => (
          <button key={i} onClick={fn as () => void}
            className="p-2 bg-white/95 rounded-lg shadow-sm border border-slate-200 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all"
          ><Icon className="w-4 h-4" /></button>
        ))}
      </div>

      {/* Expand / Collapse all buttons */}
      <div className="absolute top-3 left-3 z-20 flex gap-1.5">
        <button onClick={expandAll}
          className="px-3 py-1.5 text-xs font-semibold bg-white/95 rounded-lg shadow-sm border border-slate-200 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all"
        >Expand All</button>
        <button onClick={collapseAll}
          className="px-3 py-1.5 text-xs font-semibold bg-white/95 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all"
        >Collapse All</button>
      </div>

      {/* Node toolbar */}
      {selNode && toolbarPos && !editId && (
        <div
          className="absolute z-30 flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-slate-100 p-1"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
          onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
        >
          <button onClick={doEdit} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button onClick={doAdd} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {selId !== 'root' && <>
            <div className="w-px h-5 bg-slate-200" />
            <button onClick={doDel} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${delConfirm ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}>
              <Trash2 className="w-3.5 h-3.5" /> {delConfirm ? 'Sure?' : 'Delete'}
            </button>
          </>}
        </div>
      )}

      {/* Bottom hints */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-xs text-slate-400 bg-white/85 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/60 pointer-events-none select-none shadow-sm">
        <MousePointer2 className="w-3 h-3" /> Click to expand · Double-click to edit · Drag to move
      </div>
      <div className="absolute bottom-3 right-3 z-10 text-xs font-mono text-slate-400 bg-white/85 backdrop-blur-sm px-2.5 py-1.5 rounded-xl border border-white/60 pointer-events-none shadow-sm">
        {Math.round(scale * 100)}%
      </div>

      {/* SVG */}
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.9" fill="#94a3b8" opacity="0.22" />
          </pattern>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <filter id="rglow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feFlood floodColor="#6366f1" floodOpacity="0.2" result="c" />
            <feComposite in="c" in2="b" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {PALETTE.map((p, i) => (
            <filter key={i} id={`pg${i}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feFlood floodColor={p.base} floodOpacity="0.18" result="c" />
              <feComposite in="c" in2="b" operator="in" result="g" />
              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <filter id="sglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feFlood floodColor="#6366f1" floodOpacity="0.45" result="c" />
            <feComposite in="c" in2="b" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${cx + pan.x}, ${cy + pan.y}) scale(${scale})`}>
          {/* Edges */}
          {nodes.map(n => {
            if (!n.parentId) return null;
            const parent = nMap.get(n.parentId); if (!parent) return null;
            const sw = [0, 2.8, 1.8, 1.2, 0.9][Math.min(n.depth, 4)];
            const op = [0, 0.55, 0.38, 0.26, 0.18][Math.min(n.depth, 4)];
            return <path key={`e-${n.id}`} d={edgePath(parent, n)} fill="none" stroke={n.base} strokeWidth={sw} strokeOpacity={op} strokeLinecap="round" />;
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const { w, h, rx } = nodeGeo(n.depth);
            const pad = nodePad(n.depth);
            const isSel = selId === n.id;
            const isEdit = editId === n.id;
            const isRoot = n.depth === 0;
            const isBranch = n.depth === 1;
            const isCollapsed = collapsed.has(n.id);
            const hasKids = hasChildrenSet.has(n.id);
            const kCount = childCount.get(n.id) ?? 0;
            const fs = nodeFSize(n.depth);
            const palIdx = PALETTE.findIndex(p => p.base === n.base);
            const filterAttr = isRoot ? 'url(#rglow)' : isBranch && palIdx >= 0 ? `url(#pg${palIdx})` : isSel ? 'url(#sglow)' : undefined;

            /* text area inside the node */
            const foX = -w / 2 + pad.l;
            const foY = -h / 2 + pad.t;
            const foW = w - pad.l - pad.r;
            const foH = h - pad.t - pad.b;

            const textColor = isRoot ? 'white' : n.depth === 1 ? n.text : n.depth === 2 ? '#1e293b' : '#374151';
            const fontWeight = n.depth === 0 ? 800 : n.depth === 1 ? 700 : n.depth === 2 ? 600 : 500;

            return (
              <g key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                filter={filterAttr}
                onMouseDown={e => onNodeMD(e, n.id)}
                onClick={e => onNodeClick(e, n.id)}
                onDoubleClick={e => onNodeDbl(e, n)}
                style={{ cursor: 'pointer' }}
              >
                {/* ROOT */}
                {isRoot && <>
                  <rect x={-w/2-4} y={-h/2-4} width={w+8} height={h+8} rx={rx+4}
                    fill="none" stroke="#a5b4fc" strokeWidth="1.5"
                    strokeOpacity={isSel ? 0.9 : 0.45} strokeDasharray={isSel ? '0' : '6 4'}
                  />
                  <rect x={-w/2} y={-h/2} width={w} height={h} rx={rx}
                    fill="url(#rg)" stroke={isSel ? '#c7d2fe' : '#4338ca'} strokeWidth={isSel ? 2.5 : 1.5}
                  />
                </>}

                {/* BRANCH */}
                {isBranch && <>
                  {isSel && <rect x={-w/2-5} y={-h/2-5} width={w+10} height={h+10} rx={rx+5}
                    fill="none" stroke={n.base} strokeWidth="2" strokeOpacity="0.45" strokeDasharray="6 4"
                  />}
                  <rect x={-w/2+2} y={-h/2+3} width={w} height={h} rx={rx} fill={n.base} opacity="0.09" />
                  <rect x={-w/2} y={-h/2} width={w} height={h} rx={rx}
                    fill={n.light} stroke={n.base} strokeWidth={isSel ? 2.5 : 1.8} strokeOpacity={isSel ? 1 : 0.7}
                  />
                  <rect x={-w/2+16} y={-h/2} width={w-32} height={3.5} rx={1.75}
                    fill={n.base} opacity={isSel ? 0.85 : 0.55}
                  />
                  <circle cx={-w/2+11} cy={0} r={3.5} fill={n.base} opacity="0.8" />
                </>}

                {/* CHILD */}
                {n.depth === 2 && <>
                  {isSel && <rect x={-w/2-4} y={-h/2-4} width={w+8} height={h+8} rx={rx+4}
                    fill="none" stroke={n.base} strokeWidth="1.8" strokeOpacity="0.45" strokeDasharray="5 3"
                  />}
                  <rect x={-w/2} y={-h/2} width={w} height={h} rx={rx}
                    fill="white" stroke={n.base} strokeWidth={isSel ? 2 : 1.2} strokeOpacity={isSel ? 0.85 : 0.45}
                  />
                  <rect x={-w/2} y={-h/2+8} width={4} height={h-16} rx={2}
                    fill={n.base} opacity={isSel ? 0.8 : 0.55}
                  />
                </>}

                {/* GC+ */}
                {n.depth >= 3 && <>
                  {isSel && <rect x={-w/2-3} y={-h/2-3} width={w+6} height={h+6} rx={rx+3}
                    fill="none" stroke={n.base} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 3"
                  />}
                  <rect x={-w/2} y={-h/2} width={w} height={h} rx={rx}
                    fill={n.light} fillOpacity="0.65"
                    stroke={n.base} strokeWidth={isSel ? 1.8 : 0.9} strokeOpacity={isSel ? 0.75 : 0.35}
                  />
                </>}

                {/* Text area — foreignObject for proper CSS wrapping */}
                <foreignObject x={foX} y={foY} width={foW} height={foH}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    {isEdit ? (
                      <input
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') { setEditId(null); setEditVal(''); }
                        }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          textAlign: 'center',
                          fontSize: `${fs}px`,
                          fontWeight,
                          color: textColor,
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          fontSize: `${fs}px`,
                          fontWeight,
                          color: textColor,
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          hyphens: 'auto',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                          pointerEvents: 'none',
                          userSelect: 'none',
                          letterSpacing: n.depth === 0 ? '0.3px' : '0.05px',
                        }}
                      >
                        {n.label}
                      </span>
                    )}
                  </div>
                </foreignObject>

                {/* Collapse/Expand badge */}
                {hasKids && !isRoot && !isEdit && (
                  <g transform={`translate(${w / 2 + 1}, 0)`} style={{ pointerEvents: 'none' }}>
                    <circle r={11} fill={isCollapsed ? n.base : 'white'} stroke={n.base} strokeWidth={1.5} opacity={0.96} />
                    <text
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={isCollapsed ? 9 : 13}
                      fontWeight={800}
                      fill={isCollapsed ? 'white' : n.base}
                      style={{ fontFamily: 'system-ui, monospace', userSelect: 'none' }}
                    >
                      {isCollapsed ? `+${kCount}` : '−'}
                    </text>
                  </g>
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
