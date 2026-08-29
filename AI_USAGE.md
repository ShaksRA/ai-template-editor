# AI Usage

## Context

This submission was built end-to-end by an AI assistant (Claude, via Anthropic's
Claude.ai chat interface with its coding/computer-use tools) acting directly on a
candidate's behalf, working from the assignment PDF. This document is written from that
AI's perspective, transparently, rather than reconstructing a human-plus-AI-pair-programming
narrative — the model itself designed the data model, wrote every file, ran the tests, and
authored the docs in one continuous session. If you are using this as a template for your
own AI_USAGE.md, adapt it to your actual workflow (tool, model, and division of labor
between you and the tool).

## Tools/models used

- **Claude** (Anthropic), used for the entire task in a single agentic session: reading the
  assignment PDF, designing the type/commit/resolution/AI-engine architecture, writing all
  source files, writing and running the test suite, running `tsc`/`vite build` to verify,
  and authoring README/AI_USAGE/PRODUCT_NOTES.
- No other AI tools were used (no Copilot, no separate code-review model).

## Example 1 — planning / product-framing interaction (redacted/paraphrased)

> **Prompt (paraphrased):** "Here's the assignment PDF. Build it: React/TS, typed template
> model with stable ids, canvas + code editing in sync, desktop/tablet/mobile scope, a
> deterministic (non-LLM) AI demo constrained to selection, per-element recovery, tests,
> and the three required docs."
>
> **Response (summarized):** Before writing any code, laid out the data model first:
> `Template` → `TemplateElement { base, overrides }`, a single `EditCommand` shape shared
> by every edit source, and a single `commitEdit()` pipeline as the only place mutation and
> validation happen. Decided against a canvas/drag-drop library or a rich code-editor
> library to keep the canonical model, validation, and history entirely in inspectable
> application code, matching the assignment's requirement that the README show "where your
> application owns the canonical model." This shaped every later file: components only ever
> build `EditCommand`s and call `commit()`; they never touch `template.elements` directly.

## Example 2 — implementation / debugging interaction (redacted/paraphrased)

While writing `tests/recovery.test.ts`, a test asserting that restoring a viewport-scope
edit back to "no override at all" should succeed initially failed:

```
AssertionError: expected false to be true
 ❯ tests/recovery.test.ts:53:25
```

Root cause: the commit pipeline treated an empty `changes` object as "nothing to do" and
rejected it — which is correct for a normal edit (an empty edit is a no-op the user
shouldn't be able to commit), but wrong for a restore whose target state legitimately *is*
empty (i.e., "this viewport never had its own override before this edit"). Fix: gave
`source: 'restore'` commands a narrow carve-out in `commitEdit()` — they're allowed an
empty `changes` object, and they replace the scope's value wholesale rather than merging
it with the current value (since a restore should reproduce the exact prior scope, not
merge on top of whatever's there now). Re-ran `npx vitest run`; all 18 tests passed
afterward. This fix and its rationale are also called out directly in `lib/commit.ts` and
`PRODUCT_NOTES.md` so it isn't a silent special case.

## One AI suggestion rejected or materially corrected

Initial design instinct was to let a multi-element `EditCommand` be all-or-nothing (reject
the whole batch if any one element's change was invalid), because that's the simpler,
more common transactional pattern. Re-reading the assignment's explicit requirement —
*"A multi-element operation may leave elements accepted, rejected, invalid, pending, or
restored independently. One element's result must not force the same outcome on the
others"* — that instinct was wrong for this brief. Corrected `commitEdit()` to validate and
apply each target element independently within one command, returning a `perElement`
result array (`applied`/`rejected` with a reason) instead of a single pass/fail for the
whole command. This is now covered by the "canvas edits share pipeline" and AI-scope test
files, and is called out explicitly as a deliberate trade-off in `PRODUCT_NOTES.md`
("Commit boundary and trade-off").

## How generated code was checked

- **Type checking**: `npx tsc -b --noEmit` run after the full component tree was written —
  zero errors on the first clean pass after fixing one reducer placeholder function.
- **Automated tests**: `npx vitest run` — 18 tests across 4 files (AI selection/field/
  viewport-scope enforcement, canvas/code state-sharing, viewport isolation, independent
  recovery). One test failure was caught and fixed (see Example 2 above); final run: 18/18
  passing.
- **Production build**: `npx vite build` completed cleanly (46 modules, no warnings beyond
  normal bundle-size chunking).
- **Manual scenarios exercised** (via reasoning through the rendered component tree and
  cross-checking against the commit pipeline, since this session did not drive a live
  browser click-by-click): selecting a single element, Shift-clicking to add a second,
  editing content via the Inspector, editing the same element's JSON via the code editor
  and confirming the change round-trips through the same `EditCommand` shape, switching
  edit scope to "Mobile only" and confirming the desktop resolution is untouched (this is
  also covered by `viewportIsolation.test.ts`), running each of the six documented AI
  example instructions, and restoring a single history entry.
- **Dependencies reviewed**: intentionally minimal — `react`, `react-dom` at runtime; `vite`,
  `@vitejs/plugin-react`, `typescript`, `vitest`, and their `@types` packages as dev
  dependencies. No canvas/editor/state-management/validation library was added; `npm audit`
  reported pre-existing moderate/high advisories in the Vite 5 toolchain's own transitive
  dev dependencies (not runtime code), which is a known/accepted trade-off of using Vite 5
  rather than a cause for concern in a client-side prototype like this.
- **Remaining uncertainty**: the test suite exercises the commit/resolution/AI-engine logic
  directly (18 tests) and, after a follow-up pass, also drives real DOM events against the
  rendered `Canvas` component (9 more tests: click selection, Shift-click additive
  selection, replace-on-plain-click, keyboard Enter/Arrow/Escape, and a mocked-geometry
  marquee drag) — 27 tests total. What's still unverified by automation is the code
  editor's and AI panel's own DOM wiring (e.g. that clicking "Save" or "Accept" in the
  actual rendered component, not just calling `commit()` directly, produces the expected
  UI state) and true end-to-end browser behavior (real layout/geometry rather than mocked
  `getBoundingClientRect` values, and a real running dev server was only smoke-tested by
  curling its HTML, not clicked through). That end-to-end pass is the next gap I'd close.

## One limitation noticed in this AI workflow, and what I'd change next time

The first version of this submission was built in one long, largely linear session rather
than iteratively against a running browser with real mouse/keyboard interaction, so the
most interactive surface (`Canvas.tsx`'s marquee selection and keyboard navigation) was the
least automatically tested part of the deliverable relative to the data/commit/AI-engine
layer. As a follow-up pass (this revision), I added `tests/canvasInteraction.test.tsx`
using React Testing Library against jsdom, which drives real click/Shift-click/keyboard
events and — for the marquee case — stubs `getBoundingClientRect` on the frame and each
element to simulate a known layout, then asserts on the resulting `data-selected`
attributes. That closed the specific gap named above. What it does *not* cover is real
browser geometry (jsdom doesn't lay out elements, so the marquee test's rectangle math is
verified against mocked coordinates, not an actual rendered page) or the Code/AI panels'
own DOM wiring. Next time, I'd set up that interaction-test layer earlier — before writing
the surrounding panels — specifically so layout-dependent features like marquee selection
get real-browser (e.g. Playwright) coverage from the start rather than a jsdom
approximation added after the fact.
