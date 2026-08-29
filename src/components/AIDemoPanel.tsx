import React, { useState } from 'react';
import { useTemplate } from '../state/TemplateContext';
import { runAIDemo, EXAMPLE_INSTRUCTIONS } from '../lib/aiEngine';
import type { AIProposal, EditCommand } from '../types';

export default function AIDemoPanel() {
  const { template, selectedIds, editScope, commit, lastAIResult, setAIResult } = useTemplate();
  const [instruction, setInstruction] = useState('');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  function runDemo(text?: string) {
    const instr = text ?? instruction;
    const result = runAIDemo(template, instr, selectedIds, editScope, template.version);
    setAIResult(result);
    setResolvedIds(new Set());
    if (text) setInstruction(text);
  }

  function applyProposal(p: AIProposal) {
    const command: Omit<EditCommand, 'baseRevision'> = {
      source: 'ai',
      targetIds: [p.elementId],
      viewportScope: editScope,
      changes: { [p.elementId]: p.changes },
      description: `AI demo: ${instruction || lastAIResult?.matchedScenario}`,
    };
    commit(command);
    setResolvedIds((prev) => new Set(prev).add(p.elementId));
  }

  function rejectProposal(elementId: string) {
    setResolvedIds((prev) => new Set(prev).add(elementId));
  }

  return (
    <div>
      <p className="panel-title">AI demo (deterministic)</p>
      <div className="scope-note">
        Targets {selectedIds.length} selected element{selectedIds.length === 1 ? '' : 's'} · scope: <strong>{editScope}</strong>.
        Nothing changes until you accept a proposal below.
      </div>

      <div className="field-row">
        <label htmlFor="ai-instruction">Instruction</label>
        <textarea
          id="ai-instruction"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Change the color to blue"
        />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => runDemo()}>
          Run AI demo
        </button>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, cursor: 'pointer', color: '#8a8074' }}>Example instructions</summary>
        <div style={{ marginTop: 8 }}>
          {EXAMPLE_INSTRUCTIONS.map((ex) => (
            <button key={ex.label} className="example-chip" onClick={() => runDemo(ex.instruction)}>
              <strong>{ex.label}:</strong> "{ex.instruction}"
              <small>{ex.note}</small>
            </button>
          ))}
        </div>
      </details>

      {lastAIResult && !lastAIResult.ok && (
        <div className="error-box" role="alert">
          {lastAIResult.error}
        </div>
      )}

      {lastAIResult && lastAIResult.ok && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: '#8a8074' }}>
            Matched scenario: <strong>{lastAIResult.matchedScenario}</strong> · {lastAIResult.proposals.length} proposal(s)
          </p>
          {lastAIResult.proposals.map((p) => {
            const resolved = resolvedIds.has(p.elementId);
            return (
              <div className="proposal-card" key={p.elementId}>
                <div className="meta">
                  {p.elementId} · scope: {editScope}
                </div>
                <div>{p.explanation}</div>
                <div className="proposal-actions">
                  <button className="btn" disabled={resolved} onClick={() => applyProposal(p)}>
                    Accept
                  </button>
                  <button className="btn secondary" disabled={resolved} onClick={() => rejectProposal(p.elementId)}>
                    Reject
                  </button>
                  {resolved && <span className="status-tag status-applied">Reviewed</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
