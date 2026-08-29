# Scoped AI Template Editor

A browser-based, deterministic prototype of a scoped AI template editor, built for the
"Build the Scoped AI Template Editor" hiring exercise.

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm test          # runs the automated test suite (vitest)
```

No environment variables, API keys, or backend are required. Everything — including the
"AI" — runs client-side and in-memory, with `localStorage` persistence.

## Template source

The one-page template ("Corner Loaf — one-page bakery site") is **original**, authored
specifically for this assignment in `src/templateData.ts`. It is not derived from any
third-party template, theme, or design file. The hero photo is loaded from Unsplash
(royalty-free, no attribution required) purely as placeholder imagery.

## Required journey — where each step lives

| # | Requirement | Where |
|---|---|---|
| 1 | Load one responsive template | `src/templateData.ts` (typed `Template`), loaded by `TemplateProvider` |
| 2 | Desktop/tablet/mobile preview | `Toolbar` viewport pills + `Canvas`, resolved by `lib/resolve.ts` |
| 3 | Click / additive / marquee selection, keyboard-operable | `Canvas.tsx` (mouse handlers) + `ElementTree.tsx`, `role="option"`/`aria-selected`, arrow-key navigation |
| 4 | Manual canvas editing (content/style/position/size/order/structure) | `Inspector.tsx` → dispatches `EditCommand` → `lib/commit.ts` |
| 5 | Code editing (element or full template), invalid edits don't corrupt state | `CodeEditor.tsx` + `lib/validation.ts` |
| 6 | Responsive edit scope (All / Desktop / Tablet / Mobile) | `Toolbar` scope selector, consumed by every edit surface |
| 7 | AI demo edit request (selection + text + scope) | `AIDemoPanel.tsx` → `lib/aiEngine.ts` |
| 8 | Per-element proposal review, independent accept/reject | `AIDemoPanel.tsx` proposal cards |
| 9 | Per-element, per-viewport-scope recovery | `HistoryPanel.tsx` → `buildRestoreCommand` in `lib/commit.ts` |
| 10 | Persistence + reset + documented demo examples | `lib/persistence.ts`, `Toolbar` Reset button, `EXAMPLE_INSTRUCTIONS` in `lib/aiEngine.ts` |

## Architecture

```
src/
  types.ts                 Typed, JSON-serializable model: Template, TemplateElement,
                            PropertyValues, EditCommand, HistoryEntry, AIResult
  templateData.ts           The seed template (original content)
  lib/
    resolve.ts               Base + viewport-override resolution (the ONLY place this happens)
    validation.ts             Field allow-lists per element type; JSON payload validation
    commit.ts                 THE commit pipeline — every edit source funnels through here
    aiEngine.ts                Deterministic scenario engine (no model call)
    persistence.ts             localStorage load/save/clear
  state/
    TemplateContext.tsx        React context + reducer wiring commit/restore/persist
  components/
    Toolbar.tsx                Viewport switch, edit-scope select, reset
    ElementTree.tsx             Keyboard-operable element list (left rail)
    Canvas.tsx                   Click / Shift-click / marquee selection, renders resolved template
    ElementRenderer.tsx           Renders one resolved element by type
    Inspector.tsx                 Manual property editing (canvas surface)
    CodeEditor.tsx                 JSON editing for one element or the whole template
    AIDemoPanel.tsx                 Instruction input, example chips, proposal review
    HistoryPanel.tsx                 Per-element revision list + restore
tests/
    aiScope.test.ts             AI selection / field / viewport scope enforcement
    canvasCodeSync.test.ts       Canvas and code edits share one pipeline and one state shape
    viewportIsolation.test.ts     A single-view edit never leaks into other views
    recovery.test.ts              Independent per-element / per-viewport recovery
    canvasInteraction.test.tsx     DOM-level: click/Shift-click/keyboard/marquee selection in Canvas
```

### Single source of truth

`Template` (see `types.ts`) is the only durable state. It is a plain, JSON-serializable
object: `{ id, version, elements: Record<id, TemplateElement>, rootOrder }`. Every element
has stable `id`s that are never inferred from CSS classes, text content, or DOM position.

**Every edit — a canvas drag, a saved code edit, an accepted AI proposal, or a restore —
becomes the same `EditCommand` shape and passes through the same `commitEdit()` function**
in `lib/commit.ts`. That is what guarantees canvas/code/AI never disagree, and it's the
single choke point where validation happens (see `PRODUCT_NOTES.md` for the full
commit-boundary explanation and trade-off).

### Responsive resolution

`base` values apply to all viewports. `overrides.desktop` / `.tablet` / `.mobile` apply
only to that viewport, and win over `base` per-field (not per-object — a mobile override
that only sets `fontSize` doesn't blow away the base `color`). This resolution happens in
exactly one function, `resolveElement()`, so the canvas preview, the code editor's rendered
value, and the AI engine's "current value" always agree.

### Deterministic AI demo

No model is called. `lib/aiEngine.ts` matches the instruction text (lowercased) plus the
selected elements' types and the chosen viewport scope against a small set of scenario
rules, and computes proposals from the **current** values of the **currently selected**
elements — never a fixed canned page. The same instruction + selection + scope + template
version always produces the same result. See the "Example instructions" panel in the AI
demo tab for the six documented paths (content rewrite, style/color, font-size, reorder,
one-viewport responsive adjustment, multi-element match-style, and one safe-failure case).

## Editor/component libraries used

None. No canvas/drag-drop library, no code-editor library (the code surface is a styled
`<textarea>`, not Monaco/CodeMirror), no state-management library beyond React's built-in
`useReducer`/Context. This was a deliberate choice for this exercise so that the entire
canonical model, validation, responsive-override resolution, and history live in
application code that's easy to point to and read — see the file table above.

## Frontend quality bar — how it's met

- **1280px+ usable, 1440/768/375 previews without clipping**: the canvas frame width is
  capped to the viewport's reference width (1440/768/375, clamped to 900px on-screen) and
  scrolls independently of the side panels; the app shell has a `min-width: 1280px`.
- **Keyboard operability**: elements are focusable (`tabIndex=0`, `role="option"`), Enter/
  Space toggles selection, Arrow Up/Down moves focus between elements, Escape clears
  selection. All form controls in the Inspector/Code/AI panels have associated `<label>`s.
  Focus is visible via `:focus-visible` outlines app-wide.
- **Tests**: `npm test` runs 27 focused tests across five files: the four required areas
  (AI scope enforcement, canvas/code state consistency, viewport isolation, independent
  recovery) as pure-logic tests against the commit/resolution/AI-engine layer, plus a
  DOM-level suite (`canvasInteraction.test.tsx`, React Testing Library + jsdom) that drives
  actual click, Shift-click, keyboard, and marquee-drag events against the rendered
  `Canvas` component.

## Known limitations / cuts

See `PRODUCT_NOTES.md` for the full list, priority-ordered.
