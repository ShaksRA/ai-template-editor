import { describe, it, expect } from 'vitest';
import { initialTemplate } from '../src/templateData';
import { commitEdit } from '../src/lib/commit';
import { getScopeValues } from '../src/lib/resolve';
import type { EditCommand } from '../src/types';

describe('Canvas and code edits share one commit pipeline / state', () => {
  it('a canvas-sourced edit and a code-sourced edit produce identically shaped state', () => {
    const canvasCommand: EditCommand = {
      source: 'canvas',
      targetIds: ['hero-heading'],
      viewportScope: 'all',
      baseRevision: initialTemplate.version,
      changes: { 'hero-heading': { content: 'From canvas' } },
      description: 'canvas edit',
    };
    const codeCommand: EditCommand = {
      source: 'code',
      targetIds: ['hero-heading'],
      viewportScope: 'all',
      baseRevision: initialTemplate.version,
      changes: { 'hero-heading': { content: 'From code' } },
      description: 'code edit',
    };

    const r1 = commitEdit(initialTemplate, canvasCommand);
    const r2 = commitEdit(initialTemplate, codeCommand);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r1.template.elements['hero-heading'].base.content).toBe('From canvas');
    expect(r2.template.elements['hero-heading'].base.content).toBe('From code');
    // Both bumped version identically and both produced exactly one history entry.
    expect(r1.template.version).toBe(initialTemplate.version + 1);
    expect(r2.template.version).toBe(initialTemplate.version + 1);
    expect(r1.historyEntries).toHaveLength(1);
    expect(r2.historyEntries).toHaveLength(1);
  });

  it('a code edit that writes a forbidden field for the element type is rejected, not applied', () => {
    const command: EditCommand = {
      source: 'code',
      targetIds: ['hero-heading'], // heading does not allow backgroundColor
      viewportScope: 'all',
      baseRevision: initialTemplate.version,
      changes: { 'hero-heading': { style: { backgroundColor: '#ff0000' } } },
      description: 'invalid code edit',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(false);
    expect(result.template.version).toBe(initialTemplate.version); // unchanged
  });

  it('a stale revision (canvas or code) never reaches state', () => {
    const command: EditCommand = {
      source: 'canvas',
      targetIds: ['hero-heading'],
      viewportScope: 'all',
      baseRevision: initialTemplate.version - 1,
      changes: { 'hero-heading': { content: 'Should not apply' } },
      description: 'stale edit',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(false);
    expect(result.template).toBe(initialTemplate); // exact same object, untouched
  });

  it('after a code edit, resolved values for that scope match what was written', () => {
    const command: EditCommand = {
      source: 'code',
      targetIds: ['hero-text'],
      viewportScope: 'tablet',
      baseRevision: initialTemplate.version,
      changes: { 'hero-text': { style: { fontSize: '22px' } } },
      description: 'tablet override via code',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(true);
    const values = getScopeValues(result.template.elements['hero-text'], 'tablet');
    expect(values.style?.fontSize).toBe('22px');
  });
});
