import type { HistoryLog, Template } from '../types';

const TEMPLATE_KEY = 'scoped-ai-editor:template';
const HISTORY_KEY = 'scoped-ai-editor:history';

export function saveState(template: Template, history: HistoryLog) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage can fail (private mode, quota). The app still works in-memory;
    // we just silently skip persistence rather than crashing the editor.
  }
}

export function loadState(): { template: Template; history: HistoryLog } | null {
  try {
    const t = localStorage.getItem(TEMPLATE_KEY);
    const h = localStorage.getItem(HISTORY_KEY);
    if (!t) return null;
    return { template: JSON.parse(t), history: h ? JSON.parse(h) : {} };
  } catch {
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(TEMPLATE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
