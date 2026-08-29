import React, { useMemo, useRef, useState } from 'react';
import { useTemplate } from '../state/TemplateContext';
import { resolveTemplate } from '../lib/resolve';
import ElementRenderer from './ElementRenderer';

const FRAME_WIDTH: Record<string, number> = { desktop: 1440, tablet: 768, mobile: 375 };

export default function Canvas() {
  const { template, viewport, selectedIds, toggleSelect, select } = useTemplate();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const elRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const resolved = useMemo(() => resolveTemplate(template, viewport), [template, viewport]);

  function handleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    toggleSelect(id, additive);
  }

  function handleKeyDown(id: string, e: React.KeyboardEvent) {
    const ids = resolved.map((r) => r.element.id);
    const idx = ids.indexOf(id);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSelect(id, e.shiftKey || e.metaKey || e.ctrlKey);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = ids[Math.min(ids.length - 1, idx + 1)];
      elRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = ids[Math.max(0, idx - 1)];
      elRefs.current[prev]?.focus();
    } else if (e.key === 'Escape') {
      select([]);
    }
  }

  function handleFrameMouseDown(e: React.MouseEvent) {
    if (e.target !== frameRef.current) return; // only start marquee on empty canvas area
    const rect = frameRef.current!.getBoundingClientRect();
    dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMarquee({ x: dragStart.current.x, y: dragStart.current.y, w: 0, h: 0 });
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) select([]);
  }

  function handleFrameMouseMove(e: React.MouseEvent) {
    if (!dragStart.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const x = Math.min(dragStart.current.x, curX);
    const y = Math.min(dragStart.current.y, curY);
    const w = Math.abs(curX - dragStart.current.x);
    const h = Math.abs(curY - dragStart.current.y);
    setMarquee({ x, y, w, h });
  }

  function handleFrameMouseUp() {
    if (!marquee || !frameRef.current) {
      dragStart.current = null;
      setMarquee(null);
      return;
    }
    const frameRect = frameRef.current.getBoundingClientRect();
    const marqueeRect = {
      left: frameRect.left + marquee.x,
      top: frameRect.top + marquee.y,
      right: frameRect.left + marquee.x + marquee.w,
      bottom: frameRect.top + marquee.y + marquee.h,
    };
    const hits: string[] = [];
    for (const [id, node] of Object.entries(elRefs.current)) {
      if (!node) continue;
      const r = node.getBoundingClientRect();
      const intersects = r.left < marqueeRect.right && r.right > marqueeRect.left && r.top < marqueeRect.bottom && r.bottom > marqueeRect.top;
      if (intersects) hits.push(id);
    }
    if (hits.length > 0) select(hits);
    dragStart.current = null;
    setMarquee(null);
  }

  return (
    <div className="canvas-area">
      <div style={{ marginBottom: 8, fontSize: 12, color: '#8a8074' }}>
        {viewport[0].toUpperCase() + viewport.slice(1)} preview · {FRAME_WIDTH[viewport]}px reference width · drag on empty
        space to marquee-select, Shift/Cmd-click to add to selection
      </div>
      <div
        ref={frameRef}
        className="canvas-frame"
        role="listbox"
        aria-multiselectable="true"
        aria-label={`Template canvas, ${viewport} view`}
        style={{ width: Math.min(FRAME_WIDTH[viewport], 900), padding: 0 }}
        onMouseDown={handleFrameMouseDown}
        onMouseMove={handleFrameMouseMove}
        onMouseUp={handleFrameMouseUp}
      >
        {resolved.map(({ element, resolved: values }) => (
          <ElementRenderer
            key={element.id}
            element={element}
            resolved={values}
            selected={selectedIds.includes(element.id)}
            onSelect={(e) => handleSelect(element.id, e)}
            onKeyDown={(e) => handleKeyDown(element.id, e)}
            elRef={(node) => {
              elRefs.current[element.id] = node;
            }}
          />
        ))}
        {marquee && (
          <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
        )}
      </div>
    </div>
  );
}
