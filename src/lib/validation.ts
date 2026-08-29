import type { ElementType, PropertyValues, Template } from '../types';

/**
 * Field allow-list per element type. This is the single source of truth for
 * "what is an editable property boundary" — canvas controls, the code editor,
 * and the AI demo engine all get filtered through this, so an AI proposal
 * (or a hand-written code edit) can never smuggle in a field that doesn't
 * make sense for that element type.
 */
const ALLOWED_FIELDS: Record<ElementType, string[]> = {
  heading: ['content', 'style.color', 'style.fontSize', 'style.fontWeight', 'style.textAlign', 'order', 'visible'],
  text: ['content', 'style.color', 'style.fontSize', 'style.textAlign', 'order', 'visible'],
  button: [
    'content',
    'style.backgroundColor',
    'style.color',
    'style.borderRadius',
    'style.fontSize',
    'order',
    'visible',
  ],
  image: ['src', 'alt', 'size.width', 'size.height', 'order', 'visible'],
  container: ['style.backgroundColor', 'style.padding', 'order', 'visible'],
};

export function allowedFieldsFor(type: ElementType): string[] {
  return ALLOWED_FIELDS[type];
}

/** Flattens a PropertyValues partial into dotted field paths, e.g.
 * { style: { color: 'red' } } -> ['style.color']. Used to check a change
 * request against the allow-list without hand-rolling nested logic per field. */
function flattenPaths(changes: Partial<PropertyValues>): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(changes) as (keyof PropertyValues)[]) {
    const value = changes[key];
    if (value === undefined) continue;
    if ((key === 'style' || key === 'size') && typeof value === 'object' && value !== null) {
      for (const sub of Object.keys(value)) paths.push(`${key}.${sub}`);
    } else {
      paths.push(key);
    }
  }
  return paths;
}

export interface FieldValidationResult {
  valid: boolean;
  forbiddenFields: string[];
}

export function validateFields(type: ElementType, changes: Partial<PropertyValues>): FieldValidationResult {
  const allowed = new Set(allowedFieldsFor(type));
  const requested = flattenPaths(changes);
  const forbidden = requested.filter((p) => !allowed.has(p));
  return { valid: forbidden.length === 0, forbiddenFields: forbidden };
}

/** Basic shape/type checks on individual values so a code edit or an AI
 * proposal can't write e.g. a number into `content` or an out-of-range order. */
export function validateValueShapes(changes: Partial<PropertyValues>): string[] {
  const errors: string[] = [];
  if (changes.content !== undefined && typeof changes.content !== 'string') {
    errors.push('content must be a string');
  }
  if (changes.src !== undefined && typeof changes.src !== 'string') {
    errors.push('src must be a string');
  }
  if (changes.alt !== undefined && typeof changes.alt !== 'string') {
    errors.push('alt must be a string');
  }
  if (changes.order !== undefined && typeof changes.order !== 'number') {
    errors.push('order must be a number');
  }
  if (changes.visible !== undefined && typeof changes.visible !== 'boolean') {
    errors.push('visible must be a boolean');
  }
  if (changes.style !== undefined && (typeof changes.style !== 'object' || changes.style === null)) {
    errors.push('style must be an object');
  }
  if (changes.size !== undefined && (typeof changes.size !== 'object' || changes.size === null)) {
    errors.push('size must be an object');
  }
  return errors;
}

/** Validates a full element JSON payload coming from the code editor (which
 * edits an entire element's base+overrides at once, not just a partial
 * changes bag). Returns a list of human-readable errors; empty = valid. */
export function validateElementPayload(payload: unknown, expectedId: string): string[] {
  const errors: string[] = [];
  if (typeof payload !== 'object' || payload === null) {
    return ['Payload must be a JSON object'];
  }
  const p = payload as Record<string, unknown>;
  if (p.id !== expectedId) errors.push(`id must remain "${expectedId}" (element identity cannot be changed here)`);
  if (!['heading', 'text', 'button', 'image', 'container'].includes(p.type as string)) {
    errors.push('type must be one of heading, text, button, image, container');
  }
  if (typeof p.base !== 'object' || p.base === null) errors.push('base must be an object');
  if (typeof p.overrides !== 'object' || p.overrides === null) errors.push('overrides must be an object');

  if (errors.length === 0) {
    const type = p.type as ElementType;
    const baseCheck = validateFields(type, p.base as PropertyValues);
    if (!baseCheck.valid) errors.push(`base has forbidden fields for ${type}: ${baseCheck.forbiddenFields.join(', ')}`);
    const overrides = p.overrides as Record<string, PropertyValues>;
    for (const vp of Object.keys(overrides)) {
      if (!['desktop', 'tablet', 'mobile'].includes(vp)) {
        errors.push(`unknown viewport override key "${vp}"`);
        continue;
      }
      const check = validateFields(type, overrides[vp]);
      if (!check.valid) errors.push(`${vp} override has forbidden fields: ${check.forbiddenFields.join(', ')}`);
    }
  }
  return errors;
}

/** Validates a full-template JSON payload from the code editor's "template"
 * tab. Keeps ids stable — this surface is for editing values, not for
 * inventing or destroying element identities, which would break history. */
export function validateTemplatePayload(payload: unknown, existing: Template): string[] {
  const errors: string[] = [];
  if (typeof payload !== 'object' || payload === null) return ['Payload must be a JSON object'];
  const p = payload as Record<string, unknown>;
  if (p.id !== existing.id) errors.push('template id cannot change');
  const elements = p.elements as Record<string, unknown> | undefined;
  if (typeof elements !== 'object' || elements === null) {
    errors.push('elements must be an object');
    return errors;
  }
  const existingIds = new Set(Object.keys(existing.elements));
  const newIds = new Set(Object.keys(elements));
  for (const id of newIds) {
    if (!existingIds.has(id)) errors.push(`unknown element id "${id}" (elements cannot be created/renamed from the template editor)`);
  }
  for (const id of existingIds) {
    if (!newIds.has(id)) errors.push(`element "${id}" is missing (elements cannot be deleted from the template editor)`);
  }
  if (errors.length === 0) {
    for (const id of newIds) {
      errors.push(...validateElementPayload(elements[id], id).map((e) => `${id}: ${e}`));
    }
  }
  return errors;
}
