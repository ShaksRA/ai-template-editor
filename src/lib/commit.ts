import type {
  CommitElementResult,
  CommitResult,
  EditCommand,
  HistoryEntry,
  PropertyValues,
  Template,
  TemplateElement,
} from '../types';
import { getScopeValues } from './resolve';
import { validateFields, validateValueShapes } from './validation';

function deepMergeScope(current: PropertyValues, changes: Partial<PropertyValues>): PropertyValues {
  return {
    ...current,
    ...changes,
    style: { ...current.style, ...changes.style },
    size: { ...current.size, ...changes.size },
  };
}

function applyToElement(el: TemplateElement, scope: EditCommand['viewportScope'], next: PropertyValues): TemplateElement {
  if (scope === 'all') {
    return { ...el, base: next };
  }
  return { ...el, overrides: { ...el.overrides, [scope]: next } };
}

let historyCounter = 0;
function makeHistoryId() {
  historyCounter += 1;
  return `h_${Date.now()}_${historyCounter}`;
}

/**
 * The single commit pipeline. Every edit — manual canvas drag, a saved code
 * edit, an accepted AI proposal, or a restore — becomes an EditCommand and
 * passes through here. This is what guarantees:
 *   - unknown ids / stale revisions never reach state (rejected before any
 *     mutation happens)
 *   - forbidden fields for an element type never reach state
 *   - a multi-element command can partially succeed: one element's invalid
 *     change does not block another element's valid change
 *   - every applied change produces exactly one HistoryEntry, scoped to the
 *     element + viewport scope that was actually touched
 */
export function commitEdit(template: Template, command: EditCommand): CommitResult {
  if (command.targetIds.length === 0) {
    return { ok: false, fatalReason: 'No target elements specified.', template, perElement: [], historyEntries: [] };
  }

  if (command.baseRevision !== template.version) {
    return {
      ok: false,
      fatalReason: `Stale revision: command was built against v${command.baseRevision}, template is now v${template.version}. Refresh and retry.`,
      template,
      perElement: [],
      historyEntries: [],
    };
  }

  const unknown = command.targetIds.filter((id) => !template.elements[id]);
  if (unknown.length > 0) {
    return {
      ok: false,
      fatalReason: `Unknown element id(s): ${unknown.join(', ')}`,
      template,
      perElement: [],
      historyEntries: [],
    };
  }

  let nextElements = { ...template.elements };
  const perElement: CommitElementResult[] = [];
  const historyEntries: HistoryEntry[] = [];
  let anyApplied = false;

  for (const id of command.targetIds) {
    const el = template.elements[id];
    const changes = command.changes[id];

    const isRestore = command.source === 'restore';

    if (!changes || (Object.keys(changes).length === 0 && !isRestore)) {
      perElement.push({ elementId: id, status: 'rejected', reason: 'No changes provided for this element.' });
      continue;
    }

    const fieldCheck = validateFields(el.type, changes);
    if (!fieldCheck.valid) {
      perElement.push({
        elementId: id,
        status: 'rejected',
        reason: `Forbidden field(s) for ${el.type}: ${fieldCheck.forbiddenFields.join(', ')}`,
      });
      continue;
    }

    const shapeErrors = validateValueShapes(changes);
    if (shapeErrors.length > 0) {
      perElement.push({ elementId: id, status: 'rejected', reason: shapeErrors.join('; ') });
      continue;
    }

    const before = getScopeValues(el, command.viewportScope);
    const after = isRestore ? { ...changes } : deepMergeScope(before, changes);
    const updatedEl = applyToElement(el, command.viewportScope, after);
    nextElements[id] = updatedEl;
    anyApplied = true;

    perElement.push({ elementId: id, status: 'applied' });
    historyEntries.push({
      id: makeHistoryId(),
      timestamp: Date.now(),
      elementId: id,
      viewportScope: command.viewportScope,
      source: command.source,
      description: command.description,
      baseRevision: template.version,
      resultingRevision: template.version + (anyApplied ? 1 : 0), // corrected below
      before,
      after,
    });
  }

  if (!anyApplied) {
    return { ok: false, fatalReason: 'No element in this command produced a valid change.', template, perElement, historyEntries: [] };
  }

  const nextVersion = template.version + 1;
  // Fix up resultingRevision now that we know the final version number.
  const finalHistoryEntries = historyEntries.map((h) => ({ ...h, resultingRevision: nextVersion }));

  const nextTemplate: Template = { ...template, elements: nextElements, version: nextVersion };

  return { ok: true, template: nextTemplate, perElement, historyEntries: finalHistoryEntries };
}

/** Builds a restore command that puts one element's one scope back to a
 * prior history entry's `before` (or `after`, for redo-style use) value. */
export function buildRestoreCommand(
  template: Template,
  entry: HistoryEntry,
  direction: 'before' | 'after' = 'before'
): EditCommand {
  const target = direction === 'before' ? entry.before : entry.after;
  return {
    source: 'restore',
    targetIds: [entry.elementId],
    viewportScope: entry.viewportScope,
    baseRevision: template.version,
    changes: { [entry.elementId]: target },
    description: `Restore ${entry.elementId} (${entry.viewportScope}) to revision v${
      direction === 'before' ? entry.baseRevision : entry.resultingRevision
    }`,
  };
}
