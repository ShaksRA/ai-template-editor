import type { AIProposal, AIResult, PropertyValues, Template, TemplateElement, ViewportScope } from '../types';
import { validateFields } from './validation';
import { getScopeValues } from './resolve';

/**
 * Deterministic text-to-edit demo. No model is called. The same
 * (instruction, selectedIds, viewportScope, template.version) always
 * produces the same AIResult — scenarios are picked by keyword matching
 * against the instruction text plus the selected elements' types, and every
 * proposal is computed from the CURRENT values of the CURRENTLY selected
 * elements (never a fixed canned page).
 *
 * Selection is authority: proposals are only ever generated for ids in
 * selectedIds, and only for fields allowed on that element's type.
 */

const FONT_SIZE_STEPS = ['14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px'];

function bumpFontSize(current: string | undefined, direction: 1 | -1): string {
  const idx = FONT_SIZE_STEPS.indexOf(current ?? '16px');
  const base = idx === -1 ? FONT_SIZE_STEPS.indexOf('16px') : idx;
  const next = Math.min(FONT_SIZE_STEPS.length - 1, Math.max(0, base + direction));
  return FONT_SIZE_STEPS[next];
}

const COLOR_WORDS: Record<string, string> = {
  blue: '#2451ff',
  red: '#e0392b',
  green: '#1f9d55',
  black: '#111111',
  white: '#ffffff',
  purple: '#7c3aed',
  orange: '#f2994a',
  gray: '#6b7280',
  grey: '#6b7280',
};

function findColorWord(text: string): string | null {
  for (const word of Object.keys(COLOR_WORDS)) {
    if (text.includes(word)) return word;
  }
  return null;
}

interface EngineContext {
  instruction: string;
  selected: TemplateElement[];
  viewportScope: ViewportScope;
}

type Scenario = {
  name: string;
  match: (ctx: EngineContext) => boolean;
  run: (ctx: EngineContext) => AIProposal[];
};

const scenarios: Scenario[] = [
  // 1. Content rewrite
  {
    name: 'content-rewrite',
    match: (ctx) => /rewrite|reword|change (the )?(text|copy|headline|heading)|shorter|punchier|friendlier/.test(ctx.instruction),
    run: (ctx) =>
      ctx.selected
        .filter((el) => el.type === 'heading' || el.type === 'text' || el.type === 'button')
        .map((el) => {
          const current = getScopeValues(el, ctx.viewportScope).content ?? el.base.content ?? '';
          const rewritten = rewriteCopy(current, ctx.instruction, el.type);
          return {
            elementId: el.id,
            changes: { content: rewritten },
            explanation: `Rewrote copy for "${el.id}" from "${truncate(current)}" to "${truncate(rewritten)}".`,
          };
        }),
  },

  // 2. Style / color change
  {
    name: 'style-color-change',
    match: (ctx) => /colou?r/.test(ctx.instruction) && findColorWord(ctx.instruction) !== null,
    run: (ctx) => {
      const colorWord = findColorWord(ctx.instruction)!;
      const hex = COLOR_WORDS[colorWord];
      const targetsBackground = /button|background|bg/.test(ctx.instruction);
      return ctx.selected.map((el) => {
        const field = targetsBackground && el.type === 'button' ? 'backgroundColor' : 'color';
        return {
          elementId: el.id,
          changes: { style: { [field]: hex } as PropertyValues['style'] },
          explanation: `Set ${field} on "${el.id}" to ${colorWord} (${hex}).`,
        };
      });
    },
  },

  // 3. Font size bigger/smaller
  {
    name: 'font-size-change',
    match: (ctx) => /(bigger|larger|smaller|shrink|increase|decrease).*(font|text|size)|font.*(bigger|larger|smaller)/.test(ctx.instruction),
    run: (ctx) => {
      const direction: 1 | -1 = /smaller|shrink|decrease/.test(ctx.instruction) ? -1 : 1;
      return ctx.selected
        .filter((el) => el.type === 'heading' || el.type === 'text' || el.type === 'button')
        .map((el) => {
          const current = getScopeValues(el, ctx.viewportScope).style?.fontSize ?? el.base.style?.fontSize;
          const next = bumpFontSize(current, direction);
          return {
            elementId: el.id,
            changes: { style: { fontSize: next } },
            explanation: `Changed font size on "${el.id}" from ${current ?? '16px'} to ${next}.`,
          };
        });
    },
  },

  // 4. Move / reorder
  {
    name: 'reorder',
    match: (ctx) => /move (it |this )?(up|down)|reorder|swap order|to the (top|bottom)/.test(ctx.instruction),
    run: (ctx) => {
      const goingUp = /up|top/.test(ctx.instruction);
      return ctx.selected.map((el) => {
        const currentOrder = getScopeValues(el, ctx.viewportScope).order ?? el.base.order ?? 0;
        const delta = goingUp ? -1.5 : 1.5;
        return {
          elementId: el.id,
          changes: { order: currentOrder + delta },
          explanation: `Moved "${el.id}" ${goingUp ? 'earlier' : 'later'} in render order (${currentOrder} \u2192 ${currentOrder + delta}).`,
        };
      });
    },
  },

  // 5. Resize (images/containers)
  {
    name: 'resize',
    match: (ctx) => /resize|make (it |this )?(bigger|smaller|wider|narrower|taller|shorter)|width|height/.test(ctx.instruction),
    run: (ctx) => {
      const shrink = /smaller|narrower|shorter/.test(ctx.instruction);
      return ctx.selected
        .filter((el) => el.type === 'image')
        .map((el) => {
          const currentWidth = getScopeValues(el, ctx.viewportScope).size?.width ?? el.base.size?.width ?? '100%';
          const currentNum = parseInt(currentWidth, 10) || 100;
          const nextNum = Math.max(20, Math.min(100, currentNum + (shrink ? -20 : 20)));
          return {
            elementId: el.id,
            changes: { size: { width: `${nextNum}%` } },
            explanation: `Resized "${el.id}" width from ${currentWidth} to ${nextNum}%.`,
          };
        });
    },
  },

  // 6. One-viewport responsive adjustment (e.g. "on mobile, stack / hide / center")
  {
    name: 'responsive-adjustment',
    match: (ctx) => ctx.viewportScope !== 'all' && /(center|centre|hide|stack|shrink|full width)/.test(ctx.instruction),
    run: (ctx) => {
      const hide = /hide/.test(ctx.instruction);
      const center = /center|centre/.test(ctx.instruction);
      return ctx.selected.map((el) => {
        if (hide) {
          return {
            elementId: el.id,
            changes: { visible: false },
            explanation: `Hid "${el.id}" on ${ctx.viewportScope} only. Other viewports are untouched.`,
          };
        }
        if (center && (el.type === 'heading' || el.type === 'text')) {
          return {
            elementId: el.id,
            changes: { style: { textAlign: 'center' } },
            explanation: `Centered text for "${el.id}" on ${ctx.viewportScope} only.`,
          };
        }
        return {
          elementId: el.id,
          changes: { size: { width: '100%' } },
          explanation: `Set "${el.id}" to full width on ${ctx.viewportScope} only.`,
        };
      });
    },
  },

  // 7. Multi-element "match style"/"align" edit
  {
    name: 'match-style',
    match: (ctx) => ctx.selected.length > 1 && /(match|align|same style|consistent|unify)/.test(ctx.instruction),
    run: (ctx) => {
      const reference = ctx.selected[0];
      const refValues = getScopeValues(reference, ctx.viewportScope);
      return ctx.selected.slice(1).map((el) => ({
        elementId: el.id,
        changes: { style: { ...refValues.style } },
        explanation: `Matched "${el.id}"'s style to reference element "${reference.id}".`,
      }));
    },
  },
];

function truncate(s: string, n = 40) {
  return s.length > n ? s.slice(0, n) + '\u2026' : s;
}

function rewriteCopy(current: string, instruction: string, type: string): string {
  if (/shorter|punchier/.test(instruction)) {
    const words = current.split(' ');
    return words.length > 4 ? words.slice(0, 4).join(' ') + (type === 'heading' ? '.' : '') : current;
  }
  if (/friendlier|warm/.test(instruction)) {
    return `${current.replace(/\.$/, '')} \u2014 we're glad you're here.`;
  }
  return `${current} (updated)`;
}

export function runAIDemo(
  template: Template,
  instruction: string,
  selectedIds: string[],
  viewportScope: ViewportScope,
  baseRevision: number
): AIResult {
  const trimmed = instruction.trim();

  if (baseRevision !== template.version) {
    return {
      ok: false,
      error: `Stale revision: the template changed (v${baseRevision} \u2192 v${template.version}). Refresh selection and try again.`,
      proposals: [],
    };
  }

  if (selectedIds.length === 0) {
    return { ok: false, error: 'No elements selected. Select one or more elements before running the AI demo.', proposals: [] };
  }

  if (trimmed.length === 0) {
    return { ok: false, error: 'Enter an instruction describing the change you want.', proposals: [] };
  }

  const unknown = selectedIds.filter((id) => !template.elements[id]);
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown selected id(s): ${unknown.join(', ')}`, proposals: [] };
  }

  const selected = selectedIds.map((id) => template.elements[id]);
  const instructionLower = trimmed.toLowerCase();
  const ctx: EngineContext = { instruction: instructionLower, selected, viewportScope };

  const scenario = scenarios.find((s) => s.match(ctx));
  if (!scenario) {
    return {
      ok: false,
      error:
        'Unsupported instruction: this deterministic demo does not recognize that request. Try one of the documented example instructions.',
      proposals: [],
    };
  }

  const rawProposals = scenario.run(ctx);

  // Selection + field-allow-list are re-enforced here even though scenarios
  // are already built from `selected` — this is the safety net so a future
  // scenario author cannot accidentally propose an out-of-selection id or a
  // forbidden field for a type.
  const proposals = rawProposals.filter((p) => {
    if (!selectedIds.includes(p.elementId)) return false;
    const el = template.elements[p.elementId];
    const check = validateFields(el.type, p.changes);
    return check.valid;
  });

  if (proposals.length === 0) {
    return {
      ok: false,
      error: `The "${scenario.name}" scenario matched, but produced no valid proposals for the current selection (wrong element type(s) for this instruction).`,
      proposals: [],
    };
  }

  return { ok: true, matchedScenario: scenario.name, proposals };
}

export const EXAMPLE_INSTRUCTIONS: Array<{ label: string; instruction: string; note: string }> = [
  { label: 'Content rewrite', instruction: 'Make this text shorter and punchier', note: 'Select a heading, text, or button first.' },
  { label: 'Style change', instruction: 'Change the color to blue', note: 'Select any element.' },
  { label: 'Move / resize / reorder', instruction: 'Make the font bigger', note: 'Select a heading, text, or button.' },
  {
    label: 'One-viewport responsive adjustment',
    instruction: 'On mobile, hide this element',
    note: 'Switch viewport scope to Mobile first, then select an element.',
  },
  {
    label: 'Multi-element edit',
    instruction: 'Match the style of the first selected element',
    note: 'Select two or more elements (first click, then Shift/Ctrl-click more).',
  },
  { label: 'Safe failure: unsupported', instruction: 'Deploy this site to production', note: 'No scenario matches — demonstrates a safe failure.' },
];
