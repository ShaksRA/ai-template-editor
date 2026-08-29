import React, { useEffect, useState } from 'react';
import { useTemplate } from '../state/TemplateContext';
import { getScopeValues } from '../lib/resolve';
import { allowedFieldsFor } from '../lib/validation';
import type { EditCommand, PropertyValues } from '../types';

/** Manual canvas editing surface. Operates on the *first* selected element
 * (multi-element manual edits apply the same field change to every selected
 * element that has that field). Scope (all/desktop/tablet/mobile) comes from
 * the toolbar's edit-scope selector. */
export default function Inspector() {
  const { template, selectedIds, editScope, commit } = useTemplate();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setOkMsg(null);
  }, [selectedIds, editScope]);

  if (selectedIds.length === 0) {
    return (
      <div>
        <p className="panel-title">Inspector</p>
        <p style={{ color: '#8a8074', fontSize: 12 }}>Select one or more elements on the canvas or in the element list to edit them.</p>
      </div>
    );
  }

  const primary = template.elements[selectedIds[0]];
  const currentValues = getScopeValues(primary, editScope);
  const allowed = new Set(allowedFieldsFor(primary.type));

  function applyChange(field: string, changes: Partial<PropertyValues>) {
    const targets = selectedIds.filter((id) => allowed.has(field) || true);
    // Only include targets whose type actually allows this field.
    const validTargets = targets.filter((id) => {
      const el = template.elements[id];
      return allowedFieldsFor(el.type).includes(field);
    });
    if (validTargets.length === 0) {
      setError(`"${field}" is not editable on the selected element type(s).`);
      setOkMsg(null);
      return;
    }
    const command: Omit<EditCommand, 'baseRevision'> = {
      source: 'canvas',
      targetIds: validTargets,
      viewportScope: editScope,
      changes: Object.fromEntries(validTargets.map((id) => [id, changes])),
      description: `Manual canvas edit: ${field}`,
    };
    const result = commit(command);
    if (!result.ok) {
      setError(result.fatalReason ?? 'Edit rejected.');
      setOkMsg(null);
    } else {
      const rejected = result.perElement.filter((p) => p.status === 'rejected');
      if (rejected.length > 0) {
        setError(rejected.map((r) => `${r.elementId}: ${r.reason}`).join('\n'));
      } else {
        setError(null);
      }
      setOkMsg(`Applied to ${result.perElement.filter((p) => p.status === 'applied').length} element(s), scope: ${editScope}.`);
    }
  }

  return (
    <div>
      <p className="panel-title">Inspector</p>
      <div className="scope-note">
        Editing {selectedIds.length} element{selectedIds.length > 1 ? 's' : ''} · scope: <strong>{editScope}</strong>
        {editScope !== 'all' && ' — other viewports stay untouched.'}
      </div>

      {allowed.has('content') && (
        <div className="field-row">
          <label htmlFor="insp-content">Content</label>
          <textarea
            id="insp-content"
            rows={2}
            defaultValue={currentValues.content ?? ''}
            onBlur={(e) => applyChange('content', { content: e.target.value })}
          />
        </div>
      )}

      {allowed.has('style.color') && (
        <div className="field-row field-row-inline">
          <label htmlFor="insp-color">Text color</label>
          <input
            id="insp-color"
            type="color"
            defaultValue={currentValues.style?.color ?? '#000000'}
            onChange={(e) => applyChange('style.color', { style: { color: e.target.value } })}
          />
        </div>
      )}

      {allowed.has('style.backgroundColor') && (
        <div className="field-row field-row-inline">
          <label htmlFor="insp-bg">Background color</label>
          <input
            id="insp-bg"
            type="color"
            defaultValue={currentValues.style?.backgroundColor ?? '#ffffff'}
            onChange={(e) => applyChange('style.backgroundColor', { style: { backgroundColor: e.target.value } })}
          />
        </div>
      )}

      {allowed.has('style.fontSize') && (
        <div className="field-row">
          <label htmlFor="insp-fontsize">Font size</label>
          <select
            id="insp-fontsize"
            defaultValue={currentValues.style?.fontSize ?? '16px'}
            onChange={(e) => applyChange('style.fontSize', { style: { fontSize: e.target.value } })}
          >
            {['14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {allowed.has('style.textAlign') && (
        <div className="field-row">
          <label htmlFor="insp-align">Text align</label>
          <select
            id="insp-align"
            defaultValue={currentValues.style?.textAlign ?? 'left'}
            onChange={(e) => applyChange('style.textAlign', { style: { textAlign: e.target.value as any } })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      {allowed.has('style.borderRadius') && (
        <div className="field-row">
          <label htmlFor="insp-radius">Corner radius</label>
          <select
            id="insp-radius"
            defaultValue={currentValues.style?.borderRadius ?? '8px'}
            onChange={(e) => applyChange('style.borderRadius', { style: { borderRadius: e.target.value } })}
          >
            {['0px', '4px', '8px', '16px', '999px'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {allowed.has('size.width') && (
        <div className="field-row">
          <label htmlFor="insp-width">Width</label>
          <select
            id="insp-width"
            defaultValue={currentValues.size?.width ?? '100%'}
            onChange={(e) => applyChange('size.width', { size: { width: e.target.value } })}
          >
            {['25%', '40%', '60%', '80%', '100%'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {allowed.has('order') && (
        <div className="field-row field-row-inline">
          <label htmlFor="insp-order">Order</label>
          <input
            id="insp-order"
            type="number"
            step="0.5"
            defaultValue={currentValues.order ?? 0}
            onChange={(e) => applyChange('order', { order: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="field-row field-row-inline">
        <label htmlFor="insp-visible">Visible on this scope</label>
        <input
          id="insp-visible"
          type="checkbox"
          checked={currentValues.visible ?? true}
          onChange={(e) => applyChange('visible', { visible: e.target.checked })}
        />
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {okMsg && !error && <div className="ok-box" role="status">{okMsg}</div>}
    </div>
  );
}
