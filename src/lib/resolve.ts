import type { PropertyValues, Template, TemplateElement, ViewportName } from '../types';

/**
 * Resolution order (documented in PRODUCT_NOTES.md):
 *   resolved = shallow-merge(base, overrides[viewport])
 * where the override wins per top-level field (content, src, alt, order,
 * visible), and `style`/`size` are merged one level deeper so a single
 * overridden style field (e.g. fontSize on mobile) doesn't blow away the
 * rest of the base style.
 *
 * This is the ONLY place resolution happens, so canvas, code editor and AI
 * demo can never disagree about what a given viewport looks like.
 */
export function resolveElement(el: TemplateElement, viewport: ViewportName): PropertyValues {
  const override = el.overrides[viewport] ?? {};
  return {
    content: override.content ?? el.base.content,
    src: override.src ?? el.base.src,
    alt: override.alt ?? el.base.alt,
    order: override.order ?? el.base.order,
    visible: override.visible ?? el.base.visible ?? true,
    style: { ...el.base.style, ...override.style },
    size: { ...el.base.size, ...override.size },
  };
}

export function resolveTemplate(
  template: Template,
  viewport: ViewportName
): Array<{ element: TemplateElement; resolved: PropertyValues }> {
  const ids = [...template.rootOrder];
  const items = ids
    .map((id) => template.elements[id])
    .filter((el): el is TemplateElement => !!el)
    .map((el) => ({ element: el, resolved: resolveElement(el, viewport) }));

  // Order is itself a resolvable/overridable field, so re-sort per viewport.
  return items.sort((a, b) => (a.resolved.order ?? 0) - (b.resolved.order ?? 0));
}

/** Returns the current PropertyValues bag for a given scope, i.e. exactly the
 * slice a command targeting that scope would read/write. Used by the commit
 * pipeline to compute before/after history snapshots. */
export function getScopeValues(
  el: TemplateElement,
  scope: 'all' | ViewportName
): PropertyValues {
  if (scope === 'all') return el.base;
  return el.overrides[scope] ?? {};
}
