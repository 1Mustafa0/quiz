import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MindMapData } from '../services/mindmapService';
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Plus, Pencil, Trash2 } from 'lucide-react';

const BRANCH_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];
const RADII = [0, 220, 400, 555, 680];

interface LayoutNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  color: string;
  parentId: string | null;
}

function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= maxChars) { cur += ' ' + w; }
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function nodeSize(depth: number): { w: number; h: number } {
  if (depth === 0) return { w: 190, h: 60 };
  if (depth === 1) return { w: 158, h: 46 };
  if (depth === 2) return { w: 134, h: 38 };
  return { w: 114, h: 32 };
}

function nodeFontSize(depth: number): number {
  return [15, 12, 11, 10][depth] ?? 10;
}

function computeLayout(data: MindMapData): LayoutNode[] {
  const all: LayoutNode[] = [];
  all.push({ id: 'root', label: data.topic, depth: 0, x: 0, y: 0, color: '#4f46e5', parentId: null });
  const N = data.branches.length || 1;
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
      const childAngle = M === 1 ? baseAngle : (baseAngle - sectorHalf * 0.85) + (sectorHalf * 1.7 * j / (M - 1));
      const cx2 = Math.cos(childAngle) * RADII[2];
      const cy2 = Math.sin(childAngle) * RADII[2];
      const cId = `b${i}c${j}`;
      all.push({ id: cId, label: child.label, depth: 2, x: cx2, y: cy2, color, parentId: bId });
      const K = child.children?.length || 0;
      if (K > 0) {
        const gcSectorHalf = sectorHalf * 0.85 / Math.max(M, 1);
        child.children.forEach((gc, k) => {
          const gcAngle = K === 1 ? childAngle : (childAngle - gcSectorHalf) + (gcSectorHalf * 2 * k / (K - 1));
          const gx = Math.cos(gcAngle) * RADII[3];
          const gy = Math.sin(gcAngle) * RADII[3];
          all.push({ id: `b${i}c${j}gc${k}`, label: gc.label, depth: 3, x: gx, y: gy, color, parentId: cId });
          const L = gc.children?.length || 0;
          if (L > 0) {
            const ggSectorHalf = gcSectorHalf / Math.max(K, 1);
            gc.children.forEach((gg, l) => {
              const ggAngle = L === 1 ? gcAngle : (gcAngle - ggSectorHalf) + (ggSectorHalf * 2 * l / (L - 1));
              all.push({ id: `b${i}c${j}gc${k}gg${l}`, label: gg.label, depth: 4, x: Math.cos(ggAngle) * RADII[4], y: Math.sin(ggAngle) * RADII[4], color, parentId: `b${i}c${j}gc${k}` });
            });
          }
        });
      }
    });
  });
  return all;
}

function getEdgePath(from: { x: number; y: number; depth: number }, to: { x: number; y: number; depth: number }): string {
  const fh = nodeSize(from.depth).h / 2;
  const th = nodeSize(to.depth).h / 2;
  const fw = nodeSize(from.depth).w / 2;
  const tw = nodeSize(to.depth).w / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';
  const nx = dx / dist, ny = dy / dist;
  const sx = from.x + nx * fw, sy = from.y + ny * fh;
  const ex = to.x - nx * tw, ey = to.y - ny * th;
  const c1x = sx + (ex - sx) * 0.4, c2x = sx + (ex - sx) * 0.6;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`;
}

function updateNodeLabel(data: MindMapData, nodeId: string, label: string): MindMapData {
  if (nodeId === 'root') return { ...data, topic: label };
  const m = nodeId.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
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
    const newId = `b${data.branches.length}`;
    return { data: { ...data, branches: [...data.branches, blank] }, newId };
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

function deleteNodeFromData(data: MindMapData, nodeId: string): MindMapData {
  if (nodeId === 'root') return data;
  const m = nodeId.match(/^b(\d+)(?:c(\d+)(?:gc(\d+)(?:gg(\d+))?)?)?$/);
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

interface Props {
  data: MindMapData;
  onDataChange?: (updated: MindMapData) => void;
  height?: string;
}

const MindMapCanvas: React.FC<Props> = ({ data, onDataChange, height = '680px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cSize, setCSize] = useState({ w: 900, h: 680 });
  const [scale, setScale] = useState(0.72);
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
    ...n,
    x: n.x + (nodeOffsets[n.id]?.x ?? 0),
    y: n.y + (nodeOffsets[n.id]?.y ?? 0),
  })), [baseNodes, nodeOffsets]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Auto-edit new node after add
  useEffect(() => {
    if (pendingEditId && nodes.some(n => n.id === pendingEditId)) {
      setEditingId(pendingEditId);
      setEditValue('');
      setPendingEditId(null);
    }
  }, [nodes, pendingEditId]);

  // Container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(e => {
      const r = e[0]?.contentRect;
      if (r) setCSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    setCSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => Math.min(3, Math.max(0.2, s - e.deltaY * 0.0008)));
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId) {
      const val = editValue.trim();
      if (val && onDataChange) onDataChange(updateNodeLabel(data, editingId, val));
    }
    setEditingId(null);
    setEditValue('');
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
    setSelectedId(node.id);
    setEditingId(node.id);
    setEditValue(node.label);
  }, []);

  const handleAddChild = useCallback(() => {
    if (!selectedId) return;
    const { data: updated, newId } = addChildToNode(data, selectedId);
    onDataChange?.(updated);
    setPendingEditId(newId);
    setSelectedId(null);
  }, [selectedId, data, onDataChange]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    const updated = deleteNodeFromData(data, selectedId);
    onDataChange?.(updated);
    setSelectedId(null);
    setDeleteConfirm(false);
  }, [selectedId, data, onDataChange, deleteConfirm]);

  const handleEditSelected = useCallback(() => {
    if (!selectedId) return;
    const node = nodes.find(n => n.id === selectedId);
    if (!node) return;
    setEditingId(node.id);
    setEditValue(node.label);
  }, [selectedId, nodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingId) { setEditingId(null); setEditValue(''); }
      else { setSelectedId(null); setDeleteConfirm(false); }
    }
    if (e.key === 'Delete' && selectedId && selectedId !== 'root' && !editingId) {
      if (!deleteConfirm) { setDeleteConfirm(true); }
      else { onDataChange?.(deleteNodeFromData(data, selectedId)); setSelectedId(null); setDeleteConfirm(false); }
    }
  }, [editingId, selectedId, deleteConfirm, data, onDataChange]);

  const resetView = () => { setScale(0.72); setPan({ x: 0, y: 0 }); };

  const cx = cSize.w / 2, cy = cSize.h / 2;

  // Compute toolbar position
  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;
  const toolbarPos = selectedNode ? (() => {
    const { h } = nodeSize(selectedNode.depth);
    const sx = cx + pan.x + selectedNode.x * scale;
    const sy = cy + pan.y + selectedNode.y * scale;
    const above = sy - (h / 2) * scale - 52;
    return {
      left: Math.max(8, Math.min(cSize.w - 200, sx - 88)),
      top: above < 8 ? sy + (h / 2) * scale + 8 : above,
    };
  })() : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full bg-[#f8f9fe] dark:bg-slate-900 overflow-hidden outline-none"
      style={{ height, cursor: dragRef.current?.mode === 'canvas' ? 'grabbing' : 'grab' }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
    >
      {/* Zoom Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn, fn: () => setScale(s => Math.min(3, s + 0.15)) },
          { icon: ZoomOut, fn: () => setScale(s => Math.max(0.2, s - 0.15)) },
          { icon: Maximize2, fn: resetView },
        ].map(({ icon: Icon, fn }, i) => (
          <button key={i} onClick={fn}
            className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Floating Node Toolbar */}
      {selectedNode && toolbarPos && !editingId && (
        <div
          className="absolute z-30 flex items-center gap-0.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-600 p-1"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={handleEditSelected}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Edit label"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-slate-600" />
          <button onClick={handleAddChild}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title="Add child node"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {selectedId !== 'root' && (
            <>
              <div className="w-px h-5 bg-gray-200 dark:bg-slate-600" />
              <button onClick={handleDeleteNode}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  deleteConfirm
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
                title="Delete node"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700 pointer-events-none select-none">
        <MousePointer2 className="w-3 h-3" />
        Click to select · Double-click to edit · Drag to move
      </div>

      {/* Scale badge */}
      <div className="absolute bottom-3 right-3 z-10 text-xs font-mono text-gray-400 dark:text-slate-500 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-100 dark:border-slate-700 pointer-events-none">
        {Math.round(scale * 100)}%
      </div>

      {/* SVG Canvas */}
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          {BRANCH_COLORS.map((c, i) => (
            <filter key={i} id={`s${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={c} floodOpacity="0.2" />
            </filter>
          ))}
          <filter id="sroot" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#4f46e5" floodOpacity="0.28" />
          </filter>
          <filter id="ssel" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#6366f1" floodOpacity="0.5" />
          </filter>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.2" />
          </pattern>
        </defs>

        {/* Dot grid */}
        <rect width="100%" height="100%" fill="url(#grid)" className="text-slate-400 dark:text-slate-600" />

        <g transform={`translate(${cx + pan.x}, ${cy + pan.y}) scale(${scale})`}>
          {/* Edges */}
          {nodes.map(node => {
            if (!node.parentId) return null;
            const parent = nodeMap.get(node.parentId);
            if (!parent) return null;
            return (
              <path key={`e-${node.id}`}
                d={getEdgePath(parent, node)}
                fill="none"
                stroke={node.color}
                strokeWidth={node.depth === 1 ? 2.5 : node.depth === 2 ? 1.8 : 1.2}
                strokeOpacity={node.depth === 1 ? 0.65 : node.depth === 2 ? 0.5 : 0.38}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const { w, h } = nodeSize(node.depth);
            const isRoot = node.depth === 0;
            const isSelected = selectedId === node.id;
            const isEditing = editingId === node.id;
            const colorIdx = BRANCH_COLORS.indexOf(node.color);
            const fs = nodeFontSize(node.depth);
            const lines = wrapLabel(node.label, isRoot ? 22 : node.depth === 1 ? 18 : 16);
            const lineH = fs + 4;
            const filterStr = isSelected ? 'url(#ssel)' : isRoot ? 'url(#sroot)' : colorIdx >= 0 ? `url(#s${colorIdx})` : undefined;

            return (
              <g key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                filter={filterStr}
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
                onClick={e => handleNodeClick(e, node.id)}
                onDoubleClick={e => handleNodeDoubleClick(e, node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Selection ring */}
                {isSelected && !isEditing && (
                  <rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8}
                    rx={isRoot ? 20 : node.depth === 1 ? 16 : 12}
                    fill="none" stroke="#6366f1" strokeWidth={2}
                    strokeDasharray="6 3" opacity={0.8}
                  />
                )}

                {/* Node shape */}
                {isRoot ? (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={18}
                    fill="#4f46e5" stroke="#3730a3" strokeWidth={isSelected ? 2.5 : 2}
                  />
                ) : node.depth === 1 ? (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12}
                    fill={node.color} fillOpacity={isSelected ? 0.22 : 0.13}
                    stroke={node.color} strokeWidth={isSelected ? 2.5 : 1.8}
                  />
                ) : (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={9}
                    fill="white" fillOpacity={0.97}
                    stroke={node.color} strokeWidth={isSelected ? 2 : 1.2}
                    strokeOpacity={isSelected ? 0.9 : 0.6}
                  />
                )}

                {/* Inline editor */}
                {isEditing ? (
                  <foreignObject x={-w / 2 + 6} y={-h / 2 + 4} width={w - 12} height={h - 8}>
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
                          fontWeight: node.depth <= 1 ? 700 : 500,
                          color: isRoot ? 'white' : node.depth === 1 ? node.color : '#1e293b',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}
                      />
                    </div>
                  </foreignObject>
                ) : (
                  /* Text */
                  lines.map((line, li) => (
                    <text key={li}
                      x={0}
                      y={(li - (lines.length - 1) / 2) * lineH}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fs}
                      fontWeight={node.depth <= 1 ? 700 : 500}
                      letterSpacing={node.depth === 0 ? '0.3' : '0.1'}
                      fill={isRoot ? 'white' : node.depth === 1 ? node.color : '#334155'}
                      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', pointerEvents: 'none', textRendering: 'optimizeLegibility' }}
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
