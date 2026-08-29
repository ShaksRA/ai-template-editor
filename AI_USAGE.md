# AI Usage

## Tools/models used

I used **Claude (Anthropic)** as a supporting AI assistant during the assignment, mainly when I needed a second perspective, help with implementation details, or wanted to validate an approach. I first worked through the requirements and overall structure myself, then used Claude selectively while building the data model, components, logic, and test cases. It was also useful for troubleshooting issues and improving the initial documentation drafts. I reviewed and modified the generated suggestions, made the final implementation decisions, and ran the tests myself to make sure everything worked as expected. The three required documents were also reviewed and finalized by me. Apart from Claude, I did not use any other AI coding or code-review tools.



## Example 1 — planning / product-framing interaction (redacted/paraphrased)

> **My prompt (paraphrased):** "Here's the assignment PDF. Build it: React/TS, typed
> template model with stable ids, canvas + code editing in sync, desktop/tablet/mobile
> scope, a deterministic (non-LLM) AI demo constrained to selection, per-element
> recovery, tests, and the three required docs."
>
> **What came back (summarized):** Before any code, it laid out the data model first —
> `Template` → `TemplateElement { base, overrides }`, a single `EditCommand` shape shared
> by every edit source, and one `commitEdit()` pipeline as the only place mutation and
> validation happen. It also decided against pulling in a canvas/drag-drop library or a
> rich code-editor library, to keep the canonical model, validation, and history
> entirely in application code I could point to directly — which matches the
> assignment's requirement to show "where your application owns the canonical model." I
> agreed with that direction and had it proceed on that basis; it shaped every later
> file, since components only ever build `EditCommand`s and call `commit()` rather than
> touching `template.elements` directly.

## Example 2 — implementation / debugging interaction (redacted/paraphrased)

While the test suite was being written, `tests/recovery.test.ts` had a failing case —
restoring a viewport-scope edit back to "no override at all" was expected to succeed but
didn't:

```
AssertionError: expected false to be true
 ❯ tests/recovery.test.ts:53:25
```

I asked Claude to debug it. Root cause: the commit pipeline treated an empty `changes`
object as "nothing to do" and rejected it — correct for a normal edit (an empty edit
shouldn't be committable), but wrong for a restore whose target state legitimately *is*
empty (i.e., "this viewport never had its own override before this edit"). The fix gave
`source: 'restore'` commands a narrow carve-out in `commitEdit()`: they're allowed an
empty `changes` object, and they replace the scope's value wholesale rather than merging
it with the current value, since a restore should reproduce the exact prior scope, not
merge on top of whatever's there now. I had it re-run `npx vitest run` to confirm — all
tests passed afterward — and asked it to leave the rationale in `lib/commit.ts` and
`PRODUCT_NOTES.md` directly, so it isn't a silent special case.

## One AI suggestion I rejected or materially corrected

The first pass made a multi-element `EditCommand` all-or-nothing — reject the whole
batch if any one element's change was invalid — which is the more common transactional
pattern. I pushed back on this after re-reading the assignment's explicit requirement:
*"A multi-element operation may leave elements accepted, rejected, invalid, pending, or
restored independently. One element's result must not force the same outcome on the
others."* That instinct didn't fit the brief, so I had it corrected: `commitEdit()` now
validates and applies each target element independently within one command, returning a
`perElement` result array (`applied`/`rejected` with a reason) instead of a single
pass/fail for the whole command. This is covered by the "canvas edits share pipeline"
and AI-scope test files, and I made sure it's called out explicitly as a deliberate
trade-off in `PRODUCT_NOTES.md` ("Commit boundary and trade-off").

## How I checked the generated code

- **Type checking**: ran `npx tsc -b --noEmit` myself after the component tree was
  written — zero errors on the first clean pass, after fixing one leftover reducer
  placeholder I'd flagged.
- **Automated tests**: ran `npx vitest run` — 18 tests across 4 files (AI selection/
  field/viewport-scope enforcement, canvas/code state-sharing, viewport isolation,
  independent recovery), then a further 9 DOM-level tests for the Canvas's click,
  Shift-click, keyboard, and marquee-drag interactions once I asked for that gap to be
  closed. One failure surfaced and was fixed along the way (Example 2 above); final run:
  27/27 passing.
- **Production build**: ran `npx vite build` — completed cleanly (46 modules, no
  warnings beyond normal bundle-size chunking).
- **Manual scenarios I walked through**: selecting a single element, Shift-clicking to
  add a second, editing content via the Inspector, editing the same element's JSON via
  the code editor and confirming the change round-trips through the same `EditCommand`
  shape, switching edit scope to "Mobile only" and confirming the desktop resolution
  stayed untouched, running each of the six documented AI example instructions, and
  restoring a single history entry. I also ran the app locally (`npm run dev`) and
  checked it against the desktop/tablet/mobile previews and each side-panel tab myself —
  that pass caught a real rendering bug (see below).
- **Dependencies reviewed**: intentionally minimal — `react`, `react-dom` at runtime;
  `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, and their `@types` packages as
  dev dependencies, plus `@testing-library/react`/`jsdom` added later for the Canvas
  interaction tests. No canvas/editor/state-management/validation library was added.
  `npm audit` reported pre-existing moderate/high advisories in the Vite 5 toolchain's
  own transitive dev dependencies (not runtime code) — a known trade-off of Vite 5, not
  a concern for a client-side prototype like this.
- **A real bug I caught by testing it myself**: running the app locally, I noticed the
  header and a few panel labels showed literal text like `\u2014` and `\u00b7` instead
  of an em dash and a middot. I traced it to Unicode escape sequences written directly
  inside JSX text nodes, where React treats them as plain text rather than interpreting
  the escape — they only resolve correctly inside actual JS string/template literals.
  I had it swap those to the literal characters across the affected components, then
  reran the full test suite and build, and grepped the built JS bundle to confirm no
  raw escape sequences shipped. This is the clearest example in this project of manual
  verification catching something the automated tests didn't.
- **Remaining uncertainty**: what's still unverified by automation is the Code editor's
  and AI panel's own DOM wiring (e.g. that clicking "Save" or "Accept" in the rendered
  component, not just calling `commit()` directly, produces the expected UI state), and
  true end-to-end browser behavior — the Canvas interaction tests run against jsdom with
  mocked layout, not a real rendered page. That end-to-end pass is the next gap I'd
  close.

## One limitation I noticed in this AI workflow, and what I'd change next time

The first version of this submission came out of one long, mostly linear session rather
than being built iteratively against a running browser with real mouse/keyboard
interaction, so the most interactive surface (`Canvas.tsx`'s marquee selection and
keyboard navigation) ended up the least automatically tested part of the deliverable —
and, as noted above, it's also where a real rendering bug slipped through until I
actually opened the app myself. I had that test gap closed in a follow-up pass
(`tests/canvasInteraction.test.tsx`, React Testing Library against jsdom, driving real
click/Shift-click/keyboard events and, for the marquee case, stubbing
`getBoundingClientRect` to simulate a known layout), but that only closed the logic gap
— it didn't replace actually running the app, which is what caught the escape-sequence
bug. Next time, I'd build in a manual "run it and click through every tab" checkpoint
earlier and more often, rather than leaning on the AI's own review of its output as the
primary check before I look at it myself.
