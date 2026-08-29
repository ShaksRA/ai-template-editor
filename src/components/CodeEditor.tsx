import React, { useEffect, useState } from 'react';
import { useTemplate } from '../state/TemplateContext';
import { validateElementPayload, validateTemplatePayload } from '../lib/validation';
import type { EditCommand, PropertyValues, TemplateElement, ViewportName } from '../types';

type Mode = 'element' | 'template';

export default function CodeEditor() {
  const { template, selectedIds, commit } = useTemplate();
  const [mode, setMode] = useState<Mode>('element');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const primaryId = selectedIds[0];
  const primary = primaryId ? template.elements[primaryId] : null;

  useEffect(() => {
    setError(null);
    setOkMsg(null);
    if (mode === 'element' && primary) {
      setDraft(JSON.stringify(primary, null, 2));
    } else if (mode === 'template') {
      setDraft(JSON.stringify(template, null, 2));
    } else {
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, primaryId, template.version]);

  function handleSave() {
    setError(null);
    setOkMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}. The last valid state has not been changed.`);
      return;
    }

    if (mode === 'element') {
      if (!primary) {
        setError('No element selected.');
        return;
      }
      const errs = validateElementPayload(parsed, primary.id);
      if (errs.length > 0) {
        setError(`Invalid element payload:\n- ${errs.join('\n- ')}\nThe last valid state has not been changed.`);
        return;
      }
      const p = parsed as TemplateElement;
      // Diff base + each viewport override into per-scope commands so history
      // stays scoped correctly, same as a canvas edit would.
      const commands: Array<Omit<EditCommand, 'baseRevision'>> = [];
      commands.push({
        source: 'code',
        targetIds: [primary.id],
        viewportScope: 'all',
        changes: { [primary.id]: p.base },
        description: 'Code edit: base values',
      });
      (['desktop', 'tablet', 'mobile'] as ViewportName[]).forEach((vp) => {
        const override = p.overrides[vp];
        if (override && Object.keys(override).length > 0) {
          commands.push({
            source: 'code',
            targetIds: [primary.id],
            viewportScope: vp,
            changes: { [primary.id]: override as Partial<PropertyValues> },
            description: `Code edit: ${vp} override`,
          });
        }
      });

      let lastFail: string | null = null;
      let applied = 0;
      for (const cmd of commands) {
        const result = commit(cmd);
        if (!result.ok) {
          lastFail = result.fatalReason ?? 'Commit rejected.';
        } else {
          applied += result.perElement.filter((r) => r.status === 'applied').length;
        }
      }
      if (lastFail && applied === 0) {
        setError(lastFail);
      } else {
        setOkMsg(`Saved. ${applied} scope-level change(s) committed.`);
      }
    } else {
      const errs = validateTemplatePayload(parsed, template);
      if (errs.length > 0) {
        setError(`Invalid template payload:\n- ${errs.slice(0, 8).join('\n- ')}${errs.length > 8 ? `\n(+${errs.length - 8} more)` : ''}\nThe last valid state has not been changed.`);
        return;
      }
      const p = parsed as typeof template;
      const commands: Array<Omit<EditCommand, 'baseRevision'>> = [];
      for (const id of Object.keys(p.elements)) {
        const nextEl = p.elements[id];
        commands.push({
          source: 'code',
          targetIds: [id],
          viewportScope: 'all',
          changes: { [id]: nextEl.base },
          description: 'Code edit: template base values',
        });
        (['desktop', 'tablet', 'mobile'] as ViewportName[]).forEach((vp) => {
          const override = nextEl.overrides[vp];
          if (override && Object.keys(override).length > 0) {
            commands.push({
              source: 'code',
              targetIds: [id],
              viewportScope: vp,
              changes: { [id]: override as Partial<PropertyValues> },
              description: `Code edit: template ${vp} override`,
            });
          }
        });
      }
      let applied = 0;
      let lastFail: string | null = null;
      for (const cmd of commands) {
        const result = commit(cmd);
        if (!result.ok) lastFail = result.fatalReason ?? 'Commit rejected.';
        else applied += result.perElement.filter((r) => r.status === 'applied').length;
      }
      if (lastFail && applied === 0) setError(lastFail);
      else setOkMsg(`Saved. ${applied} scope-level change(s) committed across the template.`);
    }
  }

  return (
    <div>
      <p className="panel-title">Code editor</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'element'} onClick={() => setMode('element')} disabled={!primary}>
          Selected element
        </button>
        <button role="tab" aria-selected={mode === 'template'} onClick={() => setMode('template')}>
          Full template
        </button>
      </div>

      {mode === 'element' && !primary && (
        <p style={{ color: '#8a8074', fontSize: 12 }}>Select an element to edit its JSON directly.</p>
      )}

      {(mode === 'template' || primary) && (
        <>
          <label htmlFor="code-textarea" className="sr-only">
            {mode === 'element' ? `JSON for element ${primaryId}` : 'JSON for full template'}
          </label>
          <textarea
            id="code-textarea"
            className="code-textarea"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="btn-row">
            <button className="btn" onClick={handleSave}>
              Save
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setDraft(mode === 'element' && primary ? JSON.stringify(primary, null, 2) : JSON.stringify(template, null, 2));
                setError(null);
                setOkMsg(null);
              }}
            >
              Revert draft
            </button>
          </div>
        </>
      )}

      {error && <div className="error-box" role="alert">{error}</div>}
      {okMsg && !error && <div className="ok-box" role="status">{okMsg}</div>}
    </div>
  );
}
