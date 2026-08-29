# Product Notes

## Primary user, job, and "safe completed edit"

**Primary user**: a small-business owner (e.g. a bakery owner) adapting an existing
one-page site themselves, without a developer.

**Job to be done**: make a visual or structural change — by hand or by describing it in
text — and trust that (a) it only affected what they meant it to affect, (b) it didn't
silently break their site on another device size, and (c) if they don't like it, they can
undo just that one thing without losing other work they've since done.

**A safe completed edit** is one where: the change is confined to the elements the user
selected; it respects the viewport scope they chose (a mobile-only tweak never touches
desktop); nothing was overwritten without an explicit accept; and the change is individually
recoverable later, independent of any other edit made before or after it.

## Definitions

- **Element**: one entry in `template.elements`, addressed by a stable `id` that never
  changes for the life of the template (not derived from its content, class, or position).
- **Group (selection)**: an array of element ids, `selectedIds`. A group is not a new
  entity in the model — it's just "the current set of independent targets" for whatever
  edit happens next. Each element in a group is validated and committed independently.
- **Committed step**: one call to `commitEdit()` that results in at least one element
  actually changing. It bumps `template.version` by exactly 1 and produces one
  `HistoryEntry` per element that changed. A command where every element is rejected
  (bad field, bad shape) commits nothing and bumps nothing.
- **Viewport scope**: `'all' | 'desktop' | 'tablet' | 'mobile'`. `'all'` writes to an
  element's shared `base` values. A named viewport writes to that viewport's `overrides`
  bag only, leaving `base` and the other two viewports' overrides untouched.
- **Editable property boundary**: the field allow-list per element type in
  `lib/validation.ts` (`ALLOWED_FIELDS`). E.g. a `heading` may have its `content`,
  text color, font size, weight, alignment, order, and visibility changed, but not a
  `backgroundColor` or `size` — those aren't meaningful for a heading in this model.

## Commit boundary and trade-off

**Boundary**: the unit of commit is one element, one scope, one field-bag. A single
`EditCommand` can target many elements at once (e.g. an AI batch of 4 elements), but each
element's change is validated and applied independently — one bad element does not block
the others, and each produces its own `HistoryEntry`. This is what makes "partial
acceptance" and "independent recovery" both possible with one simple mechanism, instead of
needing separate transaction and undo systems.

**Trade-off I chose deliberately**: there is no cross-element transaction (no "all 4 or
none"). If a user wants an atomic multi-element change, they don't get a rollback of the
whole batch if one element fails — they get 3 applied + 1 rejected, with a clear per-element
reason. I chose this because the assignment explicitly requires "one element's result must
not force the same outcome on the others," and a true atomic-batch mode would work against
that requirement. The cost is that a user could end up with a half-applied AI batch; the AI
panel surfaces per-element accept/reject specifically so that's a visible, deliberate state
rather than a silent partial failure.

A second, smaller trade-off: restoring an element/scope back to a state where that scope
had *no* override (i.e. `before` was `{}`) is treated as a valid "clear the override"
outcome, not a no-op. This needed a small carve-out in the commit pipeline (restore commands
replace the scope's value wholesale instead of merging) — documented in `lib/commit.ts`.

## Canvas/code shared state, and override resolution

The canvas (`Inspector.tsx`) and the code editor (`CodeEditor.tsx`) both end up building
the same `EditCommand` shape and calling the same `commit()` function from
`TemplateContext`. Neither surface mutates state directly. The code editor additionally
diffs a saved element/template payload into one or more scope-level commands (base, plus
any non-empty viewport override) so that a code save produces the same kind of
per-scope history entries a canvas edit would — a person watching the History tab can't
tell whether a given entry came from a drag or from typed JSON, which is intentional: they
should trust both equally.

**Resolution order** (`lib/resolve.ts`): `resolved = base` with each present field in
`overrides[viewport]` overwriting the matching field, and `style`/`size` merged one level
deeper so a single overridden field (e.g. mobile `fontSize`) doesn't discard the rest of
the base style object. This is computed in exactly one function, so canvas, code, and the
AI engine's idea of "the current value" can never drift apart.

## How the AI demo paths stay inside selection/scope, and how invalid output is handled

`runAIDemo()` takes the current template, the raw instruction text, the current
`selectedIds`, the current `viewportScope`, and the `template.version` the caller last saw.
Before matching any scenario it checks, in order: stale revision → reject; empty selection
→ reject; empty instruction → reject; unknown selected id → reject. Only then does it match
a scenario by instruction keywords + selected element types + scope, and every scenario
function reads only from the passed-in `selected` elements (not from the whole template) —
so it is structurally unable to invent a proposal for something outside the selection.
As a second safety net (in case a future scenario is authored carelessly), the result is
re-filtered afterward against `selectedIds` and against the same field allow-list the
commit pipeline uses. If a scenario matches but produces zero valid proposals for the
current selection's types (e.g. "resize" matched but only a heading was selected), that
also comes back as a safe failure with an explanatory reason, rather than an empty silent
success.

## Review, partial-acceptance, and recovery policy

Every AI proposal is rendered as its own card with Accept/Reject. Accepting one element
commits only that element (as a normal `source: 'ai'` `EditCommand`); rejecting one marks
it reviewed and discards it — nothing is written to the template for a rejected element.
There is no "accept all" by design: the assignment's safety bar is per-element review, and
a bulk-accept button would undermine that by making it just as easy to skip reading each
proposal.

Recovery is per-element, per-scope, and always forward-moving: restoring creates a new
`HistoryEntry` with `source: 'restore'` rather than deleting or rewriting history, so the
history log itself is an honest, append-only record of everything that happened —
including undos.

## The one additional capability I chose

**Explicit "hidden on this viewport" indicator in the canvas** (see `ElementRenderer.tsx`):
when an element's resolved `visible` is `false` for the current preview, instead of just
disappearing (which would make it impossible to select and un-hide), it renders as a
dashed, labeled placeholder in place. This came directly out of building the "hide on
mobile" AI/manual scenario: a genuinely hidden element is exactly the kind of change that's
easy to "forget you made" and hard to recover from if you can no longer see or click it.

**User problem**: hiding something (manually or via AI) on one viewport is a legitimate,
required capability — but a naive implementation (just don't render it) makes that element
unselectable and its history/restore controls unreachable from the canvas on that viewport.

**Why this**: it's small, it directly protects the "never left unsure about what changed"
half of the problem statement, and it reuses the exact same selection/history machinery
every other element uses — no special-cased UI.

**How I'd test whether it helped**: give a small group of test users a template with one
hidden mobile element and ask them, on the mobile preview only, to "find and re-show
whatever's hidden." Success = they select the placeholder and use the Inspector's visible
checkbox or History restore without being told where to look. I'd compare completion time
and success rate against a version where hidden elements are simply absent from the DOM.

## Cuts, assumptions, and next three priorities

**Cuts / assumptions**:
- The code editor is a plain `<textarea>`, not a syntax-highlighting editor (no
  Monaco/CodeMirror dependency) — JSON errors are reported as text, not inline squiggles.
- "Position" is modeled as an `order` field (render order) rather than free-form x/y
  coordinates, since the template is a normal document-flow page, not an absolute-position
  canvas. Free drag-to-reposition was cut in favor of getting reorder + resize + all other
  required behaviors solid within the time box.
- No true drag-and-drop reordering in the canvas; reordering is via the Inspector's Order
  field or the AI "move up/down" scenario. Drag-to-reorder is next priority #2 below.
- No undo/redo keyboard shortcuts (Cmd+Z) — recovery is explicit, via the History tab.
- Marquee selection hit-tests DOM bounding boxes rather than a virtualized/synthetic canvas
  coordinate system, which is simpler but means it only works for elements currently
  rendered on screen (acceptable for a one-page template of this size). This math is
  covered by `tests/canvasInteraction.test.tsx` against mocked geometry, but not against a
  real browser's actual layout (no Playwright/end-to-end pass yet).

**Next three improvements, in priority order**:
1. A real-browser end-to-end pass (e.g. Playwright) for the Canvas's marquee selection and
   the Code/AI panel's Save/Accept buttons — the current DOM-level tests use jsdom with
   mocked `getBoundingClientRect` values, which verifies the selection *logic* but not
   actual rendered layout.
2. Drag-and-drop reordering directly in the canvas (currently only via Inspector/AI),
   still going through the same `commitEdit` pipeline so it stays consistent with every
   other edit source.
3. A visual diff (not just text) in the AI proposal card — show the before/after rendered
   side by side, not only a text explanation, before the user accepts.
