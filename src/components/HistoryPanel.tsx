import React from 'react';
import { useTemplate } from '../state/TemplateContext';

export default function HistoryPanel() {
  const { history, selectedIds, restore, template } = useTemplate();

  const elementId = selectedIds[0];
  const entries = elementId ? history[elementId] ?? [] : [];

  return (
    <div>
      <p className="panel-title">History{elementId ? `: ${elementId}` : ''}</p>
      {!elementId && <p style={{ color: '#8a8074', fontSize: 12 }}>Select an element to see its revision history.</p>}
      {elementId && entries.length === 0 && <p style={{ color: '#8a8074', fontSize: 12 }}>No edits yet for this element.</p>}
      {[...entries].reverse().map((entry) => (
        <div className="history-entry" key={entry.id}>
          <div>
            <strong>{entry.source}</strong> · scope: {entry.viewportScope}
          </div>
          <div className="meta">
            v{entry.baseRevision} → v{entry.resultingRevision} · {new Date(entry.timestamp).toLocaleTimeString()}
          </div>
          <div className="meta">{entry.description}</div>
          <button className="btn secondary" onClick={() => restore(entry, 'before')}>
            Restore this element to before this edit
          </button>
        </div>
      ))}
    </div>
  );
}
