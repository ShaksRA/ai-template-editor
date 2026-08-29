import { describe, it, expect } from 'vitest';
import { initialTemplate } from '../src/templateData';
import { commitEdit } from '../src/lib/commit';
import { resolveElement } from '../src/lib/resolve';
import type { EditCommand } from '../src/types';

describe('Viewport scope isolation', () => {
  it('a mobile-only edit changes the mobile-resolved value but leaves desktop/tablet resolved values untouched', () => {
    const before = {
      desktop: resolveElement(initialTemplate.elements['hero-text'], 'desktop'),
      tablet: resolveElement(initialTemplate.elements['hero-text'], 'tablet'),
      mobile: resolveElement(initialTemplate.elements['hero-text'], 'mobile'),
    };

    const command: EditCommand = {
      source: 'canvas',
      targetIds: ['hero-text'],
      viewportScope: 'mobile',
      baseRevision: initialTemplate.version,
      changes: { 'hero-text': { style: { color: '#ff00ff' } } },
      description: 'mobile-only color change',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(true);

    const after = {
      desktop: resolveElement(result.template.elements['hero-text'], 'desktop'),
      tablet: resolveElement(result.template.elements['hero-text'], 'tablet'),
      mobile: resolveElement(result.template.elements['hero-text'], 'mobile'),
    };

    expect(after.mobile.style?.color).toBe('#ff00ff');
    expect(after.desktop).toEqual(before.desktop);
    expect(after.tablet).toEqual(before.tablet);
  });

  it('an "all" scope edit updates every viewport that does not already have its own override for that field', () => {
    const command: EditCommand = {
      source: 'canvas',
      targetIds: ['feature-text'], // has no overrides at all in the seed data
      viewportScope: 'all',
      baseRevision: initialTemplate.version,
      changes: { 'feature-text': { style: { color: '#00ff00' } } },
      description: 'shared color change',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(true);

    expect(resolveElement(result.template.elements['feature-text'], 'desktop').style?.color).toBe('#00ff00');
    expect(resolveElement(result.template.elements['feature-text'], 'tablet').style?.color).toBe('#00ff00');
    expect(resolveElement(result.template.elements['feature-text'], 'mobile').style?.color).toBe('#00ff00');
  });

  it('an existing viewport override still wins over a later "all" scope edit on that same field', () => {
    // hero-heading already has a mobile fontSize override in the seed data.
    const command: EditCommand = {
      source: 'canvas',
      targetIds: ['hero-heading'],
      viewportScope: 'all',
      baseRevision: initialTemplate.version,
      changes: { 'hero-heading': { style: { fontSize: '64px' } } },
      description: 'shared font size change',
    };
    const result = commitEdit(initialTemplate, command);
    expect(result.ok).toBe(true);

    expect(resolveElement(result.template.elements['hero-heading'], 'desktop').style?.fontSize).toBe('64px');
    // Mobile keeps its own override (28px from seed data), unaffected by the shared change.
    expect(resolveElement(result.template.elements['hero-heading'], 'mobile').style?.fontSize).toBe('28px');
  });
});
