import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import type {
  AIResult,
  CommitResult,
  EditCommand,
  HistoryEntry,
  HistoryLog,
  Template,
  ViewportName,
  ViewportScope,
} from '../types';
import { commitEdit, buildRestoreCommand } from '../lib/commit';
import { initialTemplate } from '../templateData';
import { loadState, saveState, clearState } from '../lib/persistence';

interface State {
  template: Template;
  history: HistoryLog;
  selectedIds: string[];
  viewport: ViewportName;
  editScope: ViewportScope;
  lastCommit: CommitResult | null;
  lastAIResult: AIResult | null;
}

type Action =
  | { type: 'SELECT'; ids: string[] }
  | { type: 'SET_VIEWPORT'; viewport: ViewportName }
  | { type: 'SET_EDIT_SCOPE'; scope: ViewportScope }
  | { type: 'COMMIT'; command: EditCommand }
  | { type: 'RESTORE'; entry: HistoryEntry; direction: 'before' | 'after' }
  | { type: 'RESET' }
  | { type: 'SET_AI_RESULT'; result: AIResult | null };

function appendHistory(history: HistoryLog, entries: HistoryEntry[]): HistoryLog {
  const next = { ...history };
  for (const entry of entries) {
    next[entry.elementId] = [...(next[entry.elementId] ?? []), entry];
  }
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selectedIds: action.ids };
    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_EDIT_SCOPE':
      return { ...state, editScope: action.scope };
    case 'COMMIT': {
      const result = commitEdit(state.template, action.command);
      if (!result.ok) {
        return { ...state, lastCommit: result };
      }
      return {
        ...state,
        template: result.template,
        history: appendHistory(state.history, result.historyEntries),
        lastCommit: result,
      };
    }
    case 'RESTORE': {
      const command = buildRestoreCommand(state.template, action.entry, action.direction);
      const result = commitEdit(state.template, command);
      if (!result.ok) return { ...state, lastCommit: result };
      return {
        ...state,
        template: result.template,
        history: appendHistory(state.history, result.historyEntries),
        lastCommit: result,
      };
    }
    case 'SET_AI_RESULT':
      return { ...state, lastAIResult: action.result };
    case 'RESET':
      return {
        ...state,
        template: initialTemplate,
        history: {},
        selectedIds: [],
        lastCommit: null,
        lastAIResult: null,
      };
    default:
      return state;
  }
}

function initState(): State {
  const persisted = loadState();
  return {
    template: persisted?.template ?? initialTemplate,
    history: persisted?.history ?? {},
    selectedIds: [],
    viewport: 'desktop',
    editScope: 'all',
    lastCommit: null,
    lastAIResult: null,
  };
}

interface Ctx extends State {
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  setViewport: (v: ViewportName) => void;
  setEditScope: (s: ViewportScope) => void;
  commit: (command: Omit<EditCommand, 'baseRevision'>) => CommitResult;
  restore: (entry: HistoryEntry, direction?: 'before' | 'after') => CommitResult;
  reset: () => void;
  setAIResult: (r: AIResult | null) => void;
}

const TemplateCtx = createContext<Ctx | null>(null);

export function TemplateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  // Ref mirror so commit()/restore() can return the fresh result synchronously
  // to callers (e.g. AI panel needs to know pass/fail per element right away).
  const resultRef = useRef<CommitResult | null>(null);

  const select = useCallback((ids: string[]) => dispatch({ type: 'SELECT', ids }), []);

  const toggleSelect = useCallback(
    (id: string, additive: boolean) => {
      if (!additive) {
        dispatch({ type: 'SELECT', ids: [id] });
        return;
      }
      const isSelected = state.selectedIds.includes(id);
      const next = isSelected ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
      dispatch({ type: 'SELECT', ids: next });
    },
    [state.selectedIds]
  );

  const setViewport = useCallback((viewport: ViewportName) => dispatch({ type: 'SET_VIEWPORT', viewport }), []);
  const setEditScope = useCallback((scope: ViewportScope) => dispatch({ type: 'SET_EDIT_SCOPE', scope }), []);

  const commit = useCallback(
    (partial: Omit<EditCommand, 'baseRevision'>): CommitResult => {
      const command: EditCommand = { ...partial, baseRevision: state.template.version };
      const result = commitEdit(state.template, command);
      resultRef.current = result;
      dispatch({ type: 'COMMIT', command });
      return result;
    },
    [state.template]
  );

  const restore = useCallback(
    (entry: HistoryEntry, direction: 'before' | 'after' = 'before'): CommitResult => {
      const command = buildRestoreCommand(state.template, entry, direction);
      const result = commitEdit(state.template, command);
      dispatch({ type: 'RESTORE', entry, direction });
      return result;
    },
    [state.template]
  );

  const reset = useCallback(() => {
    clearState();
    dispatch({ type: 'RESET' });
  }, []);

  const setAIResult = useCallback((r: AIResult | null) => dispatch({ type: 'SET_AI_RESULT', result: r }), []);

  // Persist on every template/history change.
  React.useEffect(() => {
    saveState(state.template, state.history);
  }, [state.template, state.history]);

  const value = useMemo<Ctx>(
    () => ({ ...state, select, toggleSelect, setViewport, setEditScope, commit, restore, reset, setAIResult }),
    [state, select, toggleSelect, setViewport, setEditScope, commit, restore, reset, setAIResult]
  );

  return <TemplateCtx.Provider value={value}>{children}</TemplateCtx.Provider>;
}

export function useTemplate() {
  const ctx = useContext(TemplateCtx);
  if (!ctx) throw new Error('useTemplate must be used within TemplateProvider');
  return ctx;
}
