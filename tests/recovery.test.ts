import { describe, it, expect } from 'vitest';
import { initialTemplate } from '../src/templateData';
import { commitEdit, buildRestoreCommand } from '../src/lib/commit';
import { getScopeValues } from '../src/lib/resolve';
import type { EditCommand, Template } from '../src/types';

function edit(template: Template, id: string, scope: EditCommand['viewportScope'], changes: any, description = 'edit') {
  const command: EditCommand = {
    source: 'canvas',
    targetIds: [id],
    viewportScope: scope,
    baseRevision: template.version,
    changes: { [id]: changes },
    description,
  };
  const result = commitEdit(template, command);
  expect(result.ok).toBe(true);
  return result;
}

describe('Independent per-element recovery', () => {
  it('restoring one element does not touch a sibling element edited in the same session', () => {
    let template = initialTemplate;

    const r1 = edit(template, 'hero-heading', 'all', { content: 'Edited heading' });
    template = r1.template;
    const r2 = edit(template, 'hero-text', 'all', { content: 'Edited text' });
    template = r2.template;

    // Restore only the heading back to before its edit.
    const headingHistory = r1.historyEntries[0];
    const restoreCommand = buildRestoreCommand(template, headingHistory, 'before');
    const r3 = commitEdit(template, restoreCommand);
    expect(r3.ok).toBe(true);

    expect(r3.template.elements['hero-heading'].base.content).toBe(initialTemplate.elements['hero-heading'].base.content);
    // Sibling element's edit is untouched.
    expect(r3.template.elements['hero-text'].base.content).toBe('Edited text');
  });

  it('restoring one viewport scope for an element does not affect that element\'s other viewport scopes', () => {
    let template = initialTemplate;

    const rAll = edit(template, 'feature-text', 'all', { style: { color: '#111111' } }, 'base color');
    template = rAll.template;
    const rMobile = edit(template, 'feature-text', 'mobile', { style: { color: '#222222' } }, 'mobile override color');
    template = rMobile.template;

    // Restore only the mobile-scope edit.
    const mobileEntry = rMobile.historyEntries[0];
    const restoreCommand = buildRestoreCommand(template, mobileEntry, 'before');
    const restored = commitEdit(template, restoreCommand);
    expect(restored.ok).toBe(true);

    // Mobile override is gone (back to empty, so it resolves to base again).
    expect(getScopeValues(restored.template.elements['feature-text'], 'mobile').style?.color).toBeUndefined();
    // Base ("all") color edit from earlier remains intact.
    expect(restored.template.elements['feature-text'].base.style?.color).toBe('#111111');
  });

  it('each element in a multi-element AI-accepted batch can be recovered independently', () => {
    let template = initialTemplate;
    const r1 = edit(template, 'hero-heading', 'all', { style: { color: '#abcabc' } }, 'ai batch 1');
    template = r1.template;
    const r2 = edit(template, 'hero-text', 'all', { style: { color: '#abcabc' } }, 'ai batch 2');
    template = r2.template;

    // Only restore hero-text; hero-heading keeps the batch-applied color.
    const restoreCommand = buildRestoreCommand(template, r2.historyEntries[0], 'before');
    const restored = commitEdit(template, restoreCommand);
    expect(restored.ok).toBe(true);

    expect(restored.template.elements['hero-heading'].base.style?.color).toBe('#abcabc');
    expect(restored.template.elements['hero-text'].base.style?.color).toBe(initialTemplate.elements['hero-text'].base.style?.color);
  });

  it('a restore itself is recorded as a new history entry, not a rollback of history', () => {
    let template = initialTemplate;
    const r1 = edit(template, 'hero-cta', 'all', { content: 'New CTA text' });
    template = r1.template;

    const restoreCommand = buildRestoreCommand(template, r1.historyEntries[0], 'before');
    const restored = commitEdit(template, restoreCommand);
    expect(restored.ok).toBe(true);
    expect(restored.historyEntries).toHaveLength(1);
    expect(restored.historyEntries[0].source).toBe('restore');
    expect(restored.template.version).toBe(template.version + 1); // version keeps moving forward
  });
});
