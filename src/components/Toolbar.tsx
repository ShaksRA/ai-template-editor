import React from 'react';
import { useTemplate } from '../state/TemplateContext';
import type { ViewportName, ViewportScope } from '../types';

const VIEWPORTS: { key: ViewportName; label: string }[] = [
  { key: 'desktop', label: 'Desktop' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'mobile', label: 'Mobile' },
];

const SCOPES: { key: ViewportScope; label: string }[] = [
  { key: 'all', label: 'All views' },
  { key: 'desktop', label: 'Desktop only' },
  { key: 'tablet', label: 'Tablet only' },
  { key: 'mobile', label: 'Mobile only' },
];

export default function Toolbar() {
  const { viewport, setViewport, editScope, setEditScope, template, reset } = useTemplate();

  return (
    <div className="toolbar">
      <h1>Scoped AI Template Editor — {template.name}</h1>
      <span style={{ fontSize: 11, opacity: 0.7 }}>v{template.version}</span>

      <div className="spacer" />

      <div role="group" aria-label="Preview viewport" className="pill-group">
        {VIEWPORTS.map((v) => (
          <button key={v.key} aria-pressed={viewport === v.key} onClick={() => setViewport(v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      <label htmlFor="edit-scope-select" className="sr-only">
        Edit scope
      </label>
      <select
        id="edit-scope-select"
        value={editScope}
        onChange={(e) => setEditScope(e.target.value as ViewportScope)}
        style={{ borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
        aria-label="Edit scope: which views a manual edit applies to"
      >
        {SCOPES.map((s) => (
          <option key={s.key} value={s.key}>
            Edit scope: {s.label}
          </option>
        ))}
      </select>

      <button
        className="toolbar-btn"
        onClick={() => {
          if (confirm('Reset will discard the current template and all revision history. Continue?')) reset();
        }}
      >
        Reset
      </button>
    </div>
  );
}
