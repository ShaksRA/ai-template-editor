// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { TemplateProvider } from '../src/state/TemplateContext';
import Canvas from '../src/components/Canvas';

/**
 * These tests exercise the actual DOM interaction paths in Canvas.tsx —
 * click selection, Shift-click additive selection, keyboard navigation, and
 * marquee drag-select — rather than only the underlying reducer/commit
 * logic (covered elsewhere). This was flagged as a coverage gap in
 * AI_USAGE.md and is closed here.
 */

function renderCanvas() {
  return render(
    <TemplateProvider>
      <Canvas />
    </TemplateProvider>
  );
}

function el(id: string) {
  return document.querySelector(`[data-el-id="${id}"]`) as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('Canvas click selection', () => {
  it('a plain click selects exactly one element', () => {
    renderCanvas();
    fireEvent.click(el('hero-heading'));
    expect(el('hero-heading').getAttribute('data-selected')).toBe('true');
    expect(el('hero-text').getAttribute('data-selected')).toBe('false');
  });

  it('clicking a second element without a modifier replaces the selection, not adds to it', () => {
    renderCanvas();
    fireEvent.click(el('hero-heading'));
    fireEvent.click(el('hero-text'));
    expect(el('hero-heading').getAttribute('data-selected')).toBe('false');
    expect(el('hero-text').getAttribute('data-selected')).toBe('true');
  });

  it('Shift-click adds to the existing selection (additive group selection)', () => {
    renderCanvas();
    fireEvent.click(el('hero-heading'));
    fireEvent.click(el('hero-text'), { shiftKey: true });
    expect(el('hero-heading').getAttribute('data-selected')).toBe('true');
    expect(el('hero-text').getAttribute('data-selected')).toBe('true');
  });

  it('Shift-clicking an already-selected element toggles it back off', () => {
    renderCanvas();
    fireEvent.click(el('hero-heading'));
    fireEvent.click(el('hero-text'), { shiftKey: true });
    fireEvent.click(el('hero-heading'), { shiftKey: true });
    expect(el('hero-heading').getAttribute('data-selected')).toBe('false');
    expect(el('hero-text').getAttribute('data-selected')).toBe('true');
  });
});

describe('Canvas keyboard operability', () => {
  it('Enter selects the focused element', () => {
    renderCanvas();
    el('hero-cta').focus();
    fireEvent.keyDown(el('hero-cta'), { key: 'Enter' });
    expect(el('hero-cta').getAttribute('data-selected')).toBe('true');
  });

  it('ArrowDown moves focus to the next element in render order', () => {
    renderCanvas();
    el('nav').focus();
    fireEvent.keyDown(el('nav'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(el('hero-heading'));
  });

  it('ArrowUp moves focus to the previous element and does not go out of bounds', () => {
    renderCanvas();
    el('nav').focus();
    fireEvent.keyDown(el('nav'), { key: 'ArrowUp' });
    // Already first element; focus should stay put, not throw or move past the start.
    expect(document.activeElement).toBe(el('nav'));
  });

  it('Escape clears the current selection', () => {
    renderCanvas();
    fireEvent.click(el('hero-heading'));
    expect(el('hero-heading').getAttribute('data-selected')).toBe('true');
    fireEvent.keyDown(el('hero-heading'), { key: 'Escape' });
    expect(el('hero-heading').getAttribute('data-selected')).toBe('false');
  });
});

describe('Canvas marquee (drag-rectangle) selection', () => {
  it('dragging a rectangle over two elements selects both, and leaves elements outside the rectangle unselected', () => {
    renderCanvas();
    const frame = screen.getByRole('listbox', { name: /template canvas/i });

    // jsdom does not compute real layout, so we stub getBoundingClientRect
    // for the frame and each element to simulate a vertical stack, matching
    // how Canvas.tsx actually measures intersection.
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 900, bottom: 1000, width: 900, height: 1000, x: 0, y: 0, toJSON: () => {},
    } as DOMRect);

    const rects: Record<string, DOMRect> = {
      nav: { left: 0, top: 0, right: 900, bottom: 50 } as DOMRect,
      'hero-heading': { left: 0, top: 60, right: 900, bottom: 110 } as DOMRect,
      'hero-text': { left: 0, top: 120, right: 900, bottom: 170 } as DOMRect,
      'hero-cta': { left: 0, top: 180, right: 900, bottom: 230 } as DOMRect,
    };
    for (const [id, rect] of Object.entries(rects)) {
      vi.spyOn(el(id), 'getBoundingClientRect').mockReturnValue({
        ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top, x: rect.left, y: rect.top, toJSON: () => {},
      } as DOMRect);
    }

    // Drag a marquee rectangle from y=55 to y=175 — should intersect
    // hero-heading (60-110) and hero-text (120-170), but not nav (0-50) or hero-cta (180-230).
    fireEvent.mouseDown(frame, { clientX: 10, clientY: 55, target: frame });
    fireEvent.mouseMove(frame, { clientX: 800, clientY: 175 });
    fireEvent.mouseUp(frame);

    expect(el('hero-heading').getAttribute('data-selected')).toBe('true');
    expect(el('hero-text').getAttribute('data-selected')).toBe('true');
    expect(el('nav').getAttribute('data-selected')).toBe('false');
    expect(el('hero-cta').getAttribute('data-selected')).toBe('false');
  });
});
