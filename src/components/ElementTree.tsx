import React from 'react';
import { useTemplate } from '../state/TemplateContext';

export default function ElementTree() {
  const { template, selectedIds, toggleSelect } = useTemplate();
  const ids = template.rootOrder;

  return (
    <div className="tree-panel">
      <p className="panel-title">Elements</p>
      <div role="listbox" aria-multiselectable="true" aria-label="Element list">
        {ids.map((id) => {
          const el = template.elements[id];
          const selected = selectedIds.includes(id);
          return (
            <button
              key={id}
              role="option"
              aria-selected={selected}
              className="tree-item"
              onClick={(e) => toggleSelect(id, e.shiftKey || e.metaKey || e.ctrlKey)}
            >
              {id}
              <span className="type-badge">{el.type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
