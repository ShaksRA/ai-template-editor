import { describe, it, expect } from 'vitest';
import { initialTemplate } from '../src/templateData';
import { runAIDemo } from '../src/lib/aiEngine';

describe('AI demo scope enforcement', () => {
  it('never proposes changes for an element outside the current selection', () => {
    const result = runAIDemo(initialTemplate, 'Change the color to blue', ['hero-heading'], 'all', initialTemplate.version);
    expect(result.ok).toBe(true);
    for (const p of result.proposals) {
      expect(['hero-heading']).toContain(p.elementId);
    }
    // hero-text, hero-cta, etc were NOT selected and must not appear.
    expect(result.proposals.some((p) => p.elementId === 'hero-text')).toBe(false);
  });

  it('rejects an instruction when nothing is selected (safe failure)', () => {
    const result = runAIDemo(initialTemplate, 'Change the color to blue', [], 'all', initialTemplate.version);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no elements selected/i);
  });

  it('safely fails on an unsupported instruction', () => {
    const result = runAIDemo(initialTemplate, 'Deploy this site to production', ['hero-heading'], 'all', initialTemplate.version);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unsupported instruction/i);
  });

  it('rejects a stale revision instead of silently using current state', () => {
    const staleRevision = initialTemplate.version - 1; // pretend caller computed against an older version
    const result = runAIDemo(initialTemplate, 'Change the color to blue', ['hero-heading'], 'all', staleRevision);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/stale revision/i);
  });

  it('only proposes fields allowed for the selected element type', () => {
    // "resize" scenario only applies to images; selecting a heading should
    // yield no valid proposals, not a proposal with a forbidden field.
    const result = runAIDemo(initialTemplate, 'Resize this to be smaller', ['hero-heading'], 'all', initialTemplate.version);
    expect(result.ok).toBe(false);
  });

  it('a multi-element AI proposal only ever targets ids within the selection', () => {
    const result = runAIDemo(
      initialTemplate,
      'Change the color to blue',
      ['hero-heading', 'hero-text', 'feature-text'],
      'all',
      initialTemplate.version
    );
    expect(result.ok).toBe(true);
    const proposedIds = result.proposals.map((p) => p.elementId);
    expect(proposedIds.every((id) => ['hero-heading', 'hero-text', 'feature-text'].includes(id))).toBe(true);
  });

  it('respects the chosen viewport scope for a responsive-only instruction', () => {
    const allScope = runAIDemo(initialTemplate, 'On mobile, hide this element', ['hero-image'], 'all', initialTemplate.version);
    // The responsive-adjustment scenario requires a non-"all" scope to match.
    expect(allScope.ok).toBe(false);

    const mobileScope = runAIDemo(initialTemplate, 'On mobile, hide this element', ['hero-image'], 'mobile', initialTemplate.version);
    expect(mobileScope.ok).toBe(true);
    expect(mobileScope.proposals[0].changes.visible).toBe(false);
  });
});
