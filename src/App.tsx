import React, { useState } from 'react';
import { TemplateProvider } from './state/TemplateContext';
import Toolbar from './components/Toolbar';
import ElementTree from './components/ElementTree';
import Canvas from './components/Canvas';
import Inspector from './components/Inspector';
import CodeEditor from './components/CodeEditor';
import AIDemoPanel from './components/AIDemoPanel';
import HistoryPanel from './components/HistoryPanel';

type SideTab = 'inspector' | 'code' | 'ai' | 'history';

function SidePanel() {
  const [tab, setTab] = useState<SideTab>('inspector');
  return (
    <div className="side-panel">
      <div className="tabs" role="tablist" aria-label="Editing surfaces">
        <button role="tab" aria-selected={tab === 'inspector'} onClick={() => setTab('inspector')}>
          Inspect
        </button>
        <button role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>
          Code
        </button>
        <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>
          AI demo
        </button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
          History
        </button>
      </div>
      {tab === 'inspector' && <Inspector />}
      {tab === 'code' && <CodeEditor />}
      {tab === 'ai' && <AIDemoPanel />}
      {tab === 'history' && <HistoryPanel />}
    </div>
  );
}

export default function App() {
  return (
    <TemplateProvider>
      <div className="app-shell">
        <Toolbar />
        <div className="main-grid">
          <ElementTree />
          <Canvas />
          <SidePanel />
        </div>
      </div>
    </TemplateProvider>
  );
}
