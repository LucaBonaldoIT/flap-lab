import {
  Automaton,
  FSASimulator,
  FSATransition,
  FiniteStateAutomaton,
  JFFCodec,
  JFLAPStructure,
  MealyMachine,
  MealySimulator,
  MealyTransition,
  MooreMachine,
  MooreSimulator,
  MooreTransition,
  PDASimulator,
  PDATransition,
  PushdownAutomaton,
  State,
  TMTransition,
  TuringMachine,
  TuringMachineSimulator,
  Transition,
  cloneAutomaton,
} from '../../../packages/core/src/index.ts';
import './style.css';

type Machine = FiniteStateAutomaton | PushdownAutomaton | TuringMachine | MealyMachine | MooreMachine;
type MachineType = 'fa' | 'pda' | 'turing' | 'mealy' | 'moore';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Flap Lab home">
      <span class="brand-mark">F</span><span>Flap<span class="brand-light"> Lab</span></span>
    </a>
    <div class="document-tabs" id="document-tabs"></div>
    <div class="top-actions">
      <button class="button button-quiet history-button" id="undo-action" title="Undo (Ctrl/⌘ Z)" aria-label="Undo" disabled>↶</button>
      <button class="button button-quiet history-button" id="redo-action" title="Redo (Ctrl/⌘ Y)" aria-label="Redo" disabled>↷</button>
      <button class="button button-quiet" id="new-machine" title="Create a new machine">New</button>
      <label class="button button-quiet file-button" for="open-file">Open file<input id="open-file" type="file" /></label>
      <button class="button button-primary" id="save-file" title="Save (Ctrl/⌘ S)"><span class="button-icon">↧</span> Export .jff</button>
    </div>
  </header>

  <main class="workspace">
    <div class="start-overlay" id="start-overlay" hidden>
      <div class="start-menu" id="start-menu"></div>
    </div>
    <textarea id="text-editor" hidden spellcheck="false" placeholder="Type anything…"></textarea>
    <aside class="sidebar left-sidebar">
      <div class="sidebar-heading"><span class="eyebrow">WORKSPACE</span><span class="machine-count" id="machine-count">0 states</span></div>
      <label class="field-label" for="machine-type">Machine type</label>
      <div class="select-wrap"><select id="machine-type">
        <option value="fa">Finite-state automaton</option>
        <option value="pda">Pushdown automaton</option>
        <option value="turing">Turing machine</option>
        <option value="mealy">Mealy transducer</option>
        <option value="moore">Moore transducer</option>
      </select><span class="select-caret">⌄</span></div>
      <div id="machine-settings"></div>

      <div class="section-heading"><span>STATES</span><button class="icon-button" id="add-state" title="Add state">＋</button></div>
      <div class="state-list" id="state-list"><div class="empty-list">No states yet. Add one to begin.</div></div>

      <div class="editor-card" id="state-editor">
        <div class="editor-card-heading"><span class="editor-indicator"></span><span id="selected-title">SELECT A STATE</span></div>
        <div id="state-editor-fields" class="muted-hint">Select a state on the canvas to edit its properties.</div>
      </div>

      <div class="panel-resizer panel-resizer-left" id="panel-resizer-left"></div>
    </aside>

    <section class="canvas-column">
      <div class="canvas-toolbar">
        <div class="canvas-title"><span class="canvas-title-icon">◉</span><div><strong>Automaton canvas</strong><span id="canvas-subtitle">Click empty canvas to add a state · drag or scroll to pan · drag node to connect · Alt-drag or double-click to move</span></div></div>
        <div class="canvas-tools">
          <div class="zoom-controls" aria-label="Canvas zoom controls">
            <button class="button button-small zoom-button" id="zoom-out" title="Zoom out">−</button>
            <span class="zoom-level" id="zoom-level">100%</span>
            <button class="button button-small zoom-button" id="zoom-in" title="Zoom in">＋</button>
          </div>
          <button class="button button-small" id="fit-canvas" title="Fit automaton in view">Fit view</button>
          <div class="example-wrap">
            <button class="button button-small" id="load-example" title="Load an example automaton">Example</button>
            <div class="example-menu" id="example-menu" hidden>
              <button data-type="fa">aⁿbc · finite-state</button>
              <button data-type="pda">aⁿbⁿ · pushdown</button>
              <button data-type="turing">aⁿbⁿ · Turing machine</button>
              <button data-type="mealy">binary complement · Mealy</button>
              <button data-type="moore">parity checker · Moore</button>
            </div>
          </div>
        </div>
      </div>
      <div class="canvas-shell" id="canvas-shell">
        <svg id="automaton-canvas" viewBox="0 0 1000 640" role="img" aria-label="Pannable automaton editing canvas" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#6f665c" /></marker>
            <marker id="arrowhead-selected" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#b02e0c" /></marker>
            <marker id="arrowhead-step-incoming" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#a3d98a" /></marker>
            <marker id="arrowhead-step-outgoing" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#e3c25c" /></marker>
            <marker id="start-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#b02e0c" /></marker>
          </defs>
          <g id="graph-layer"></g>
        </svg>
        <div class="canvas-empty" id="canvas-empty"><div class="empty-orbit">◎</div><strong>Your canvas is ready</strong><span>Add a state or load an example machine.</span></div>
        <div class="canvas-coordinates" id="canvas-coordinates">0 states · 0 transitions</div>
      </div>
      <section class="transition-panel">
        <div class="panel-resizer panel-resizer-bottom" id="panel-resizer-bottom"></div>
        <div class="panel-heading"><div><span class="eyebrow">TRANSITIONS</span><span class="panel-count" id="transition-count">0</span></div><button class="text-button" id="clear-transitions">Clear all</button></div>
        <div class="transition-list" id="transition-list"><div class="transition-empty">Transitions you add will appear here.</div></div>
      </section>
    </section>

    <aside class="sidebar right-sidebar">
      <div class="sidebar-heading"><span class="eyebrow">TOOLS</span><span class="ready-indicator"><span></span> READY</span></div>
      <section class="tool-section selected-transition-section" id="selected-transition-section" hidden>
        <div class="section-heading"><span>EDIT SELECTED TRANSITION</span><span class="tool-number">EDGE</span></div>
        <div id="selected-transition-fields" class="form-stack"></div>
      </section>
      <section class="tool-section">
        <div class="section-heading"><span>ADD TRANSITION</span><span class="tool-number">01</span></div>
        <form id="transition-form" class="form-stack">
          <div class="two-fields">
            <label><span class="field-label">From</span><select id="transition-from" required></select></label>
            <label><span class="field-label">To</span><select id="transition-to" required></select></label>
          </div>
          <div class="transition-fields" id="transition-fields"></div>
          <button class="button button-add-transition" type="submit"><span>＋</span> Add transition</button>
        </form>
      </section>

      <section class="tool-section stepper-section">
        <div class="section-heading"><span>STEP THROUGH</span></div>
        <label class="field-label" for="step-input">Input string</label>
        <input id="step-input" type="text" placeholder="Type input…" autocomplete="off" />
        <div class="stepper-controls" id="stepper-controls" hidden>
          <button class="button" id="step-back" title="Previous step">‹</button>
          <span class="step-position" id="step-position">0/0</span>
          <button class="button" id="step-forward" title="Next step">›</button>
        </div>
        <div id="stepper-view"></div>
      </section>

      <section class="tool-section simulator-section">
        <div class="section-heading"><span>SIMULATE INPUT</span><span class="tool-number">02</span></div>
        <label class="field-label" for="input-string">Input string</label>
        <div class="input-ghost-wrap">
          <div class="input-ghost-mirror" id="input-ghost" aria-hidden="true"></div>
          <input id="input-string" type="text" placeholder="Type input…" autocomplete="off" />
        </div>
        <div class="simulator-options" id="simulator-options"></div>
        <div class="simulation-result" id="simulation-result" hidden></div>
      </section>

      <div class="right-sidebar-footer"><span class="license-links"><a href="./LICENSE-JFLAP" target="_blank" rel="noreferrer">License</a><a href="https://github.com/LucaBonaldoIT/flap-lab/issues" target="_blank" rel="noreferrer">Contact</a></span></div>
      <div class="panel-resizer panel-resizer-right" id="panel-resizer-right"></div>
    </aside>
  </main>
  <footer class="statusbar"><span id="status-message"><i class="status-led"></i> Ready — create a machine to start</span><span>FLAP LAB <b>·</b> MADE BY <a href="https://github.com/LucaBonaldoIT">LUCA BONALDO</a></span></footer>
  <div class="toast-region" id="toast-region" aria-live="polite"></div>
`;

let machine: Machine = new FiniteStateAutomaton();
let selectedState: State | null = null;
let selectedTransition: Transition | null = null;
let addStateMode = false;
let draggingState: State | null = null;
let dragMode: 'connect' | 'move' | null = null;
let moveModeState: State | null = null;
let moveModeEntryDrag = false;
let lastTapState: State | null = null;
let lastTapTime = 0;
let dragOrigin = { x: 0, y: 0 };
let dragStateOrigin = { x: 0, y: 0 };
let dragPointer = { x: 0, y: 0 };
let dragMoved = false;
let suppressCanvasClick = false;
let activeTabId = 'tab-0';
let tabCounter = 0;

interface OpenTab {
  id: string;
  kind: 'automaton' | 'text' | 'start';
  filename: string;
  machine: Machine;
  selectedState: State | null;
  selectedTransition: Transition | null;
  history: Machine[];
  historyIndex: number;
  viewBox: { x: number; y: number; width: number; height: number } | null;
  input: string;
  stepInput: string;
  text: string;
  recentKey?: string;
}

const openTabs: OpenTab[] = [];
let history: Machine[] = [];
let historyIndex = 0;
let canvasPan: { pointerId: number; clientX: number; clientY: number; viewX: number; viewY: number; moved: boolean } | null = null;
const canvasPointers = new Map<number, { x: number; y: number }>();
let canvasPinch: { dist: number; width: number; height: number; center: { x: number; y: number } } | null = null;
let spacePanActive = false;
let currentFilename = 'Untitled machine';

const NAME_ADJECTIVES = ['Amber', 'Basalt', 'Bristling', 'Cobalt', 'Crystal', 'Dusk', 'Ember', 'Feral', 'Gilded', 'Hollow', 'Ivory', 'Juniper', 'Lattice', 'Misty', 'Nimbus', 'Oaken', 'Prism', 'Quartz', 'Rustic', 'Silent', 'Tidal', 'Umber', 'Velvet', 'Willow'];
const NAME_NOUNS = ['Automaton', 'Basin', 'Beacon', 'Cipher', 'Compass', 'Cyclone', 'Engine', 'Falcon', 'Furnace', 'Garden', 'Generator', 'Harbor', 'Junction', 'Lantern', 'Loom', 'Machine', 'Maze', 'Orchard', 'Prism', 'Relay', 'Spiral', 'Spire', 'Vortex', 'Weaver'];

function generateMachineName(extension: 'jff' | 'txt' = 'jff'): string {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)]!;
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)]!;
  return `${adjective.toLowerCase()}_${noun.toLowerCase()}.${extension}`;
}

function machineFingerprint(value: Machine): string {
  return JSON.stringify({
    machine: value.toJSON(),
    acceptanceMode: 'acceptanceMode' in value ? value.acceptanceMode : undefined,
    singleInput: value instanceof PushdownAutomaton ? value.singleInput : undefined,
  });
}

function activeTab(): OpenTab | undefined {
  return openTabs.find((tab) => tab.id === activeTabId);
}

function commitHistory(): void {
  if (machineFingerprint(history[historyIndex]!) === machineFingerprint(machine)) return;
  history = history.slice(0, historyIndex + 1);
  history.push(cloneAutomaton(machine));
  historyIndex = history.length - 1;
  updateHistoryButtons();
  scheduleSave();
}

function updateHistoryButtons(): void {
  $('#undo-action').toggleAttribute('disabled', historyIndex <= 0);
  $('#redo-action').toggleAttribute('disabled', historyIndex >= history.length - 1);
}

function restoreHistory(index: number): void {
  if (index < 0 || index >= history.length || index === historyIndex) return;
  historyIndex = index;
  machine = cloneAutomaton(history[historyIndex]!);
  selectedState = null; selectedTransition = null;
  render(); setStatus(index === history.length - 1 ? 'Redid change.' : 'Undid change.');
  scheduleSave();
}

let restoringWorkspace = false;

function storeActiveTab(): void {
  if (restoringWorkspace) return;
  const tab = activeTab();
  if (!tab) return;
  tab.machine = machine; tab.selectedState = selectedState; tab.selectedTransition = selectedTransition;
  tab.history = history; tab.historyIndex = historyIndex;
  tab.input = ($<HTMLInputElement>('#input-string')).value;
  tab.stepInput = ($<HTMLInputElement>('#step-input')).value;
  tab.text = ($<HTMLTextAreaElement>('#text-editor')).value;
  const view = svg.viewBox.baseVal;
  tab.viewBox = { x: view.x, y: view.y, width: view.width, height: view.height };
}

const STORAGE_KEY = 'flap-lab.workspace.v1';
let saveTimer = 0;

function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistWorkspace, 250);
}

function isMachineStructure(value: JFLAPStructure): value is Machine {
  return value instanceof FiniteStateAutomaton || value instanceof PushdownAutomaton || value instanceof TuringMachine || value instanceof MealyMachine || value instanceof MooreMachine;
}

function persistWorkspace(): void {
  try {
    storeActiveTab();
    let recents = loadRecents();
    let recentsChanged = false;
    for (const tab of openTabs) {
      if (!tab.recentKey) continue;
      const index = recents.findIndex((entry) => `${entry.kind}:${entry.name.toLowerCase()}` === tab.recentKey);
      if (index < 0) continue;
      const data = tab.kind === 'text' ? tab.text : JFFCodec.encode(tab.machine);
      if (recents[index]!.data !== data) { recents[index]!.data = data; recentsChanged = true; }
    }
    if (recentsChanged) {
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents)); } catch { recents = []; }
    }
    const tabs = openTabs.map((tab) => {
      const item: Record<string, unknown> = { id: tab.id, kind: tab.kind, filename: tab.filename, jff: JFFCodec.encode(tab.machine), viewBox: tab.viewBox, input: tab.input, stepInput: tab.stepInput, text: tab.text, recentKey: tab.recentKey };
      if (tab.machine instanceof PushdownAutomaton) { item.acceptanceMode = tab.machine.acceptanceMode; item.singleInput = tab.machine.singleInput; }
      else if (tab.machine instanceof TuringMachine) item.acceptanceMode = tab.machine.acceptanceMode;
      return item;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeTabId, nextTab: tabCounter, tabs }));
  } catch {
    // Storage unavailable or full — session continues without persistence.
  }
}

function restoreWorkspace(): boolean {
  try {
    restoringWorkspace = true;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as { activeTabId?: string; nextTab?: number; tabs?: Array<Record<string, unknown>> };
    if (!Array.isArray(payload.tabs)) return false;
    for (const item of payload.tabs) {
      if (!item || typeof item.filename !== 'string' || typeof item.id !== 'string') continue;
      try {
        if (item.kind === 'text') {
          const numericId = Number(String(item.id).slice(4));
          if (Number.isFinite(numericId)) tabCounter = Math.max(tabCounter, numericId);
          openTextTab(item.filename, typeof item.text === 'string' ? item.text : '', String(item.id));
          const restored = activeTab()!;
          if (typeof item.input === 'string') restored.input = item.input;
          if (typeof item.stepInput === 'string') restored.stepInput = item.stepInput;
          if (typeof item.recentKey === 'string') restored.recentKey = item.recentKey;
          continue;
        }
        if (item.kind === 'start') {
          const numericId = Number(String(item.id).slice(4));
          if (Number.isFinite(numericId)) tabCounter = Math.max(tabCounter, numericId);
          openStartTab(String(item.id));
          continue;
        }
        if (typeof item.jff !== 'string') continue;
        const structure = JFFCodec.decode(item.jff);
        if (!isMachineStructure(structure)) continue;
        if (structure instanceof PushdownAutomaton) {
          if (typeof item.singleInput === 'boolean') structure.singleInput = item.singleInput;
          if (typeof item.acceptanceMode === 'string') structure.acceptanceMode = item.acceptanceMode as PushdownAutomaton['acceptanceMode'];
        } else if (structure instanceof TuringMachine && typeof item.acceptanceMode === 'string') {
          structure.acceptanceMode = item.acceptanceMode as TuringMachine['acceptanceMode'];
        }
        const numericId = Number(String(item.id).slice(4));
        if (Number.isFinite(numericId)) tabCounter = Math.max(tabCounter, numericId);
        openTab(structure, item.filename, String(item.id));
        const restored = activeTab()!;
        if (typeof item.input === 'string') restored.input = item.input;
        if (typeof item.stepInput === 'string') restored.stepInput = item.stepInput;
        if (typeof item.recentKey === 'string') restored.recentKey = item.recentKey;
        if (item.viewBox && typeof item.viewBox === 'object') {
          const view = item.viewBox as { x: number; y: number; width: number; height: number };
          if ([view.x, view.y, view.width, view.height].every((value) => typeof value === 'number')) restored.viewBox = view;
        }
      } catch { continue; }
    }
    if (!openTabs.length) return false;
    const storedActive = typeof payload.activeTabId === 'string' && openTabs.some((tab) => tab.id === payload.activeTabId) ? payload.activeTabId : openTabs.at(-1)!.id;
    activeTabId = '';
    activateTab(storedActive);
    if (Number.isFinite(payload.nextTab)) tabCounter = Math.max(tabCounter, Number(payload.nextTab));
    return true;
  } catch { return false; }
  finally { restoringWorkspace = false; }
}

function refreshSimulations(): void {
  stepperSession = null;
  updateInputSuggestion();
  if (isTextMode() || activeTab()?.kind === 'start') {
    $('#simulation-result').hidden = true;
    renderStepper();
    return;
  }
  const input = $<HTMLInputElement>('#input-string').value;
  const stepInput = $<HTMLInputElement>('#step-input').value;
  if (input) runSimulation();
  else $('#simulation-result').hidden = true;
  if (stepInput) startStepping();
  else renderStepper();
}

function isTextMode(): boolean {
  return activeTab()?.kind === 'text';
}

const RECENTS_KEY = 'flap-lab.recents.v1';

interface RecentFile { name: string; kind: 'automaton' | 'text'; data: string; at: number; }

function loadRecents(): RecentFile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentFile[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === 'string' && typeof item.data === 'string') : [];
  } catch { return []; }
}

function addRecent(entry: { name: string; kind: 'automaton' | 'text'; data: string }): void {
  try {
    const list = loadRecents().filter((item) => !(item.name === entry.name && item.kind === entry.kind));
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 8)));
  } catch { /* ignore */ }
}

const PANELS_KEY = 'flap-lab.panels.v1';
const DEFAULT_PANELS: PanelSizes = { left: 250, right: 300, bottom: 178 };
const PANEL_LIMITS = { left: [180, 560], right: [200, 560], bottom: [80, 460] } as const;

interface PanelSizes { left: number; right: number; bottom: number; }

const desktopPanelsQuery = window.matchMedia('(min-width: 1051px) and (pointer: fine)');
let panelSizes: PanelSizes = loadPanelSizes();

function clampPanel(value: number, range: readonly [number, number]): number {
  return Math.min(range[1], Math.max(range[0], Math.round(value)));
}

function loadPanelSizes(): PanelSizes {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANELS_KEY) ?? 'null') as Partial<PanelSizes> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PANELS };
    return {
      left: clampPanel(Number(parsed.left ?? DEFAULT_PANELS.left), PANEL_LIMITS.left),
      right: clampPanel(Number(parsed.right ?? DEFAULT_PANELS.right), PANEL_LIMITS.right),
      bottom: clampPanel(Number(parsed.bottom ?? DEFAULT_PANELS.bottom), PANEL_LIMITS.bottom),
    };
  } catch { return { ...DEFAULT_PANELS }; }
}

function persistPanelSizes(): void {
  try { localStorage.setItem(PANELS_KEY, JSON.stringify(panelSizes)); } catch { /* ignore */ }
}

function applyPanelSizes(): void {
  const workspace = document.querySelector<HTMLElement>('.workspace');
  const bottomPanel = document.querySelector<HTMLElement>('.transition-panel');
  if (!workspace || !bottomPanel) return;
  if (!desktopPanelsQuery.matches) {
    workspace.style.removeProperty('grid-template-columns');
    bottomPanel.style.removeProperty('flex-basis');
    bottomPanel.style.removeProperty('max-height');
    return;
  }
  workspace.style.gridTemplateColumns = `${panelSizes.left}px minmax(400px, 1fr) ${panelSizes.right}px`;
  bottomPanel.style.flexBasis = `${panelSizes.bottom}px`;
  bottomPanel.style.maxHeight = `${panelSizes.bottom}px`;
}

function bindPanelResizer(handle: HTMLElement, axis: 'x' | 'y', panel: 'left' | 'right' | 'bottom', onMove: (event: PointerEvent, workspace: DOMRect) => void): void {
  handle.addEventListener('dblclick', () => {
    if (!desktopPanelsQuery.matches) return;
    panelSizes = { ...panelSizes, [panel]: DEFAULT_PANELS[panel] };
    applyPanelSizes();
    persistPanelSizes();
  });
  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || !desktopPanelsQuery.matches) return;
    event.preventDefault();
    const workspaceRect = document.querySelector('.workspace')!.getBoundingClientRect();
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    handle.classList.add('is-resizing');
    const move = (moveEvent: PointerEvent) => onMove(moveEvent, workspaceRect);
    const stop = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.removeProperty('user-select');
      handle.classList.remove('is-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      persistPanelSizes();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });
}

bindPanelResizer($('#panel-resizer-left'), 'x', 'left', (event, workspaceRect) => {
  panelSizes.left = clampPanel(event.clientX - workspaceRect.left, PANEL_LIMITS.left);
  applyPanelSizes();
});
bindPanelResizer($('#panel-resizer-right'), 'x', 'right', (event, workspaceRect) => {
  panelSizes.right = clampPanel(workspaceRect.right - event.clientX, PANEL_LIMITS.right);
  applyPanelSizes();
});
bindPanelResizer($('#panel-resizer-bottom'), 'y', 'bottom', (event) => {
  const bottomRect = $<HTMLElement>('.transition-panel').getBoundingClientRect();
  panelSizes.bottom = clampPanel(bottomRect.bottom - event.clientY, PANEL_LIMITS.bottom);
  applyPanelSizes();
});
desktopPanelsQuery.addEventListener('change', applyPanelSizes);

let startMenuView: 'main' | 'new' | 'all' = 'main';

function formatRecentTime(at: number): string {
  return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function recentButton(item: RecentFile, index: number): string {
  return `<button class="start-recent" data-index="${index}" type="button"><span class="start-recent-kind">${item.kind === 'text' ? 'TXT' : 'JFF'}</span><span class="start-recent-name">${escapeHtml(item.name)}</span><span class="start-recent-time">${formatRecentTime(item.at)}</span></button>`;
}

function renderStartMenu(): void {
  const menu = $('#start-menu');
  const recents = loadRecents();
  if (startMenuView === 'new') {
    menu.innerHTML = `
      <button class="start-back" data-view="main" type="button">‹ Back</button>
      <div class="start-title">New file</div>
      <button class="start-action" data-action="new-automaton" type="button"><span class="start-icon">◧</span> Automaton (.jff)</button>
      <button class="start-action" data-action="new-text" type="button"><span class="start-icon">≡</span> Text file (.txt)</button>`;
    return;
  }
  if (startMenuView === 'all') {
    menu.innerHTML = `
      <button class="start-back" data-view="main" type="button">‹ Back</button>
      <div class="start-title">All files</div>
      ${recents.map((item, index) => recentButton(item, index)).join('') || '<div class="start-recents-empty">No recent files yet</div>'}
      ${recents.length ? '<button class="start-clear" data-action="clear-recents" type="button">Clear all files</button>' : ''}`;
    return;
  }
  menu.innerHTML = `
    <div class="start-logo">F</div>
    <div class="start-title">Flap Lab</div>
    <button class="start-action" data-action="new" type="button"><span class="start-icon">＋</span> New file</button>
    <button class="start-action" data-action="open" type="button"><span class="start-icon">↧</span> Open file</button>
    <button class="start-action" data-action="clear-workspace" type="button"><span class="start-icon">✕</span> Clear workspace</button>
    <div class="start-section-label">RECENTS</div>
    ${recents.slice(0, 3).map((item, index) => recentButton(item, index)).join('') || '<div class="start-recents-empty">No recent files yet</div>'}
    ${recents.length > 3 ? '<button class="start-see-all" data-view="all" type="button">See all</button>' : ''}`;
}

function openStartTab(tabId?: string): void {
  const tab: OpenTab = {
    id: tabId ?? `tab-${++tabCounter}`,
    kind: 'start',
    filename: 'New file',
    machine: new FiniteStateAutomaton(),
    selectedState: null,
    selectedTransition: null,
    history: [],
    historyIndex: 0,
    viewBox: null,
    input: '',
    stepInput: '',
    text: '',
  };
  if (!tabId) tabCounter = Math.max(tabCounter, Number(tab.id.slice(4)) || 0);
  tab.history = [cloneAutomaton(tab.machine)];
  openTabs.push(tab);
  activeTabId = tab.id;
  machine = tab.machine;
  selectedState = null; selectedTransition = null;
  history = tab.history; historyIndex = 0;
  currentFilename = tab.filename;
  $<HTMLInputElement>('#input-string').value = '';
  $<HTMLInputElement>('#step-input').value = '';
  $<HTMLTextAreaElement>('#text-editor').value = '';
  stepperSession = null;
  $('#simulation-result').hidden = true;
  renderTabs();
  render();
  scheduleSave();
}

function convertToTextTab(filename: string, text: string): void {
  const tab = activeTab();
  if (!tab) return;
  tab.kind = 'text';
  tab.text = text;
  tab.machine = new FiniteStateAutomaton();
  tab.history = [cloneAutomaton(tab.machine)];
  tab.historyIndex = 0;
  history = tab.history; historyIndex = 0;
  selectedState = null; selectedTransition = null;
  stepperSession = null;
  tab.recentKey = `text:${filename.toLowerCase()}`;
  setFilename(filename);
  render();
  refreshSimulations();
}

function openTextTab(filename: string, text: string, tabId?: string): void {
  openTab(new FiniteStateAutomaton(), filename, tabId);
  const tab = activeTab();
  if (tab) { tab.kind = 'text'; tab.text = text; }
  currentFilename = filename;
  render();
  refreshSimulations();
}

function activateTab(id: string): void {
  if (id === activeTabId && openTabs.length) return;
  const previous = activeTab();
  if (previous) storeActiveTab();
  const target = openTabs.find((tab) => tab.id === id);
  if (!target) return;
  activeTabId = id;
  machine = target.machine;
  selectedState = target.selectedState; selectedTransition = target.selectedTransition;
  history = target.history; historyIndex = target.historyIndex;
  currentFilename = target.filename;
  draggingState = null; dragMode = null; dragMoved = false; canvasPan = null; addStateMode = false;
  moveModeState = null; moveModeEntryDrag = false;
  stepperSession = null;
  $<HTMLInputElement>('#input-string').value = target.input;
  $<HTMLInputElement>('#step-input').value = target.stepInput;
  $<HTMLTextAreaElement>('#text-editor').value = target.text;
  $('#add-state').classList.remove('is-active'); $('#canvas-shell').classList.remove('is-adding');
  if (target.viewBox) setCanvasView(target.viewBox.x, target.viewBox.y, target.viewBox.width, target.viewBox.height);
  renderTabs(); render(); updateHistoryButtons();
  refreshSimulations();
  setStatus(`Switched to ${target.filename}.`);
  scheduleSave();
}

function renderTabs(): void {
  const region = $('#document-tabs');
  region.replaceChildren();
  for (const tab of openTabs) {
    const tabElement = document.createElement('div');
    tabElement.className = `document-tab${tab.id === activeTabId ? ' is-active' : ''}`;
    tabElement.dataset.tabId = tab.id;
    tabElement.setAttribute('role', 'tab');
    tabElement.tabIndex = 0;
    tabElement.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');
    tabElement.addEventListener('click', () => { if (tab.id === activeTabId) beginRename(); else activateTab(tab.id); });
    tabElement.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (tab.id === activeTabId) beginRename(); else activateTab(tab.id); } });
    const label = document.createElement('button');
    label.className = 'tab-label'; label.type = 'button'; label.textContent = tab.filename;
    label.tabIndex = -1;
    tabElement.append(label);
    const close = document.createElement('button');
    close.className = 'tab-close'; close.type = 'button'; close.title = 'Close tab'; close.textContent = '×';
    close.addEventListener('click', (event) => { event.stopPropagation(); closeTab(tab.id); });
    tabElement.append(close);
    region.append(tabElement);
  }
  const plus = document.createElement('button');
  plus.className = 'tab-new'; plus.type = 'button'; plus.title = 'New file'; plus.textContent = '＋';
  plus.addEventListener('click', () => {
    const placeholder = openTabs.find((tab) => tab.kind === 'start');
    if (placeholder) activateTab(placeholder.id);
    else openStartTab();
  });
  region.append(plus);
}

function beginRename(): void {
  if (activeTab()?.kind === 'start') return;
  const button = document.querySelector('#document-tabs .is-active .tab-label');
  if (!(button instanceof HTMLButtonElement)) return;
  const input = document.createElement('input');
  input.className = 'tab-edit-input'; input.type = 'text'; input.value = currentFilename; input.setAttribute('aria-label', 'Machine filename');
  button.replaceWith(input); input.focus(); input.select();
  let finished = false;
  const finish = (save: boolean): void => {
    if (finished) return;
    finished = true;
    const tab = activeTab();
    const name = save ? input.value.trim() : currentFilename;
    if (tab) tab.filename = name || tab.filename;
    currentFilename = tab?.filename ?? currentFilename;
    renderTabs();
    scheduleSave();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function closeTab(id: string): void {
  const index = openTabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  if (openTabs.length === 1) {
    if (openTabs[0]!.kind === 'start') return;
    openTabs.length = 0;
    openStartTab();
    return;
  }
  const [closed] = openTabs.splice(index, 1);
  scheduleSave();
  if (closed!.id === activeTabId) {
    const next = openTabs[Math.max(0, index - 1)]!;
    activeTabId = '';
    activateTab(next.id);
  } else renderTabs();
}

function openTab(machineInstance: Machine, filename: string, tabId?: string): void {
  const existing = openTabs.find((tab) => tab.id === activeTabId);
  if (existing) storeActiveTab();
  const tab: OpenTab = {
    id: tabId ?? `tab-${++tabCounter}`,
    kind: 'automaton',
    filename,
    machine: machineInstance,
    selectedState: null,
    selectedTransition: null,
    history: [],
    historyIndex: 0,
    viewBox: null,
    input: '',
    stepInput: '',
    text: '',
  };
  if (!tabId) tabCounter = Math.max(tabCounter, Number(tab.id.slice(4)) || 0);
  tab.history = [cloneAutomaton(tab.machine)];
  openTabs.push(tab);
  activeTabId = tab.id;
  machine = tab.machine;
  selectedState = null; selectedTransition = null;
  history = tab.history; historyIndex = 0;
  currentFilename = filename;
  selectedState = null; selectedTransition = null;
  $<HTMLInputElement>('#input-string').value = '';
  $<HTMLInputElement>('#step-input').value = '';
  stepperSession = null;
  $('#simulation-result').hidden = true;
  renderTabs();
  scheduleSave();
}

function applyLoadedMachine(machineInstance: Machine, filename: string): void {
  storeActiveTab();
  machine = machineInstance;
  selectedState = null; selectedTransition = null;
  const tab = activeTab();
  if (tab) tab.kind = 'automaton';
  setFilename(filename);
  renderTabs(); render(); commitHistory(); updateHistoryButtons();
  $<HTMLInputElement>('#input-string').value = activeTab()?.input ?? '';
  $<HTMLInputElement>('#step-input').value = activeTab()?.stepInput ?? '';
  refreshSimulations();
}

function setFilename(filename: string): void {
  currentFilename = filename;
  const tab = activeTab();
  if (tab) tab.filename = filename;
  renderTabs();
  scheduleSave();
}

const svg = $('#automaton-canvas') as unknown as SVGSVGElement;
const graphLayer = $('#graph-layer') as unknown as SVGGElement;
const stateList = $('#state-list');
const transitionList = $('#transition-list');
const transitionFields = $('#transition-fields');

function updateGridBackground(): void {
  const shell = document.querySelector<HTMLElement>('.canvas-shell');
  if (!shell) return;
  const view = svg.viewBox.baseVal;
  const scale = svgUnitScale();
  const size = Math.max(16, Math.min(96, 48 * scale));
  const px = (-view.x * scale) % size - 6;
  const py = (-view.y * scale) % size - 6;
  shell.style.backgroundSize = `${size}px ${size}px`;
  shell.style.backgroundPosition = `${px}px ${py}px`;
}

function setCanvasView(x: number, y: number, width = svg.viewBox.baseVal.width, height = svg.viewBox.baseVal.height): void {
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  const level = document.getElementById('zoom-level');
  if (level) level.textContent = `${Math.round(1000 / width * 100)}%`;
  updateGridBackground();
  scheduleSave();
}

function zoomAt(factor: number, clientX?: number, clientY?: number): void {
  const rect = svg.getBoundingClientRect(); const view = svg.viewBox.baseVal;
  const focus = screenToCanvas(clientX ?? rect.left + rect.width / 2, clientY ?? rect.top + rect.height / 2);
  const width = Math.max(120, Math.min(5000, view.width / factor));
  const height = view.height * width / view.width;
  const relativeX = (focus.x - view.x) / view.width; const relativeY = (focus.y - view.y) / view.height;
  setCanvasView(focus.x - relativeX * width, focus.y - relativeY * height, width, height);
}

function makeMachine(type: MachineType): Machine {
  switch (type) {
    case 'pda': return new PushdownAutomaton();
    case 'turing': return new TuringMachine();
    case 'mealy': return new MealyMachine();
    case 'moore': return new MooreMachine();
    default: return new FiniteStateAutomaton();
  }
}

function machineType(value: Automaton): MachineType { return value.kind as MachineType; }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function transitionLabel(transition: Transition): string {
  if (transition instanceof FSATransition) return transition.label || 'λ';
  if (transition instanceof PDATransition) return `${transition.input || 'λ'}, ${transition.pop || 'λ'} → ${transition.push || 'λ'}`;
  if (transition instanceof TMTransition) return transition.reads.map((read, index) => `${read === ' ' ? '□' : read} / ${transition.writes[index] === ' ' ? '□' : transition.writes[index]} ${transition.directions[index]}`).join(' | ');
  if (transition instanceof MooreTransition) return `${transition.label || 'λ'} · ${transition.output || 'λ'}`;
  if (transition instanceof MealyTransition) return `${transition.label || 'λ'} / ${transition.output || 'λ'}`;
  return '';
}

function fieldMarkup(label: string, id: string, placeholder: string, value = '', help = ''): string {
  return `<label class="transition-field"><span class="field-label">${label}</span><input id="${id}" type="text" placeholder="${placeholder}" value="${escapeHtml(value)}" autocomplete="off" />${help ? `<span class="field-help">${help}</span>` : ''}</label>`;
}

function renderTransitionFields(): void {
  const kind = machine.kind;
  if (kind === 'fa') transitionFields.innerHTML = fieldMarkup('Read', 'transition-label', 'a', '', 'Use λ or leave blank for an empty move.');
  else if (kind === 'pda') transitionFields.innerHTML = `${fieldMarkup('Read', 'transition-input', 'a', '', 'λ means consume no input.')}${fieldMarkup('Pop', 'transition-pop', 'Z')}${fieldMarkup('Push', 'transition-push', 'AZ', '', 'The first symbol is placed on top.')}`;
  else if (kind === 'turing') transitionFields.innerHTML = `${fieldMarkup('Read', 'transition-read', 'a', '', 'Separate tape symbols with |.')}${fieldMarkup('Write', 'transition-write', 'b', '', 'Use □ for a blank symbol.')}${fieldMarkup('Move', 'transition-move', 'R', '', 'Use L, R, or S per tape.')}`;
  else if (kind === 'mealy') transitionFields.innerHTML = `${fieldMarkup('Read', 'transition-label', 'a')}${fieldMarkup('Output', 'transition-output', 'x')}`;
  else transitionFields.innerHTML = `${fieldMarkup('Read', 'transition-label', 'a')}${fieldMarkup('Target state output', 'transition-output', 'x', '', 'Moore output belongs to the destination state.')}`;
}

function renderSimulatorOptions(): void {
  const options = $('#simulator-options');
  if (machine instanceof PushdownAutomaton) options.innerHTML = `<label class="option-label">Acceptance<select id="acceptance-mode"><option value="final-state">Final state</option><option value="empty-stack">Empty stack</option><option value="either">Final state or empty stack</option></select></label><label class="option-label">Initial stack<input id="initial-stack" type="text" value="Z" maxlength="16" /></label>`;
  else if (machine instanceof TuringMachine) options.innerHTML = `<label class="option-label">Acceptance<select id="acceptance-mode"><option value="final-state">Final state</option><option value="halting">Halting state</option><option value="either">Final state or halting</option></select></label><label class="option-label">Step limit<input id="step-limit" type="number" min="1" value="1000" /></label>`;
  else options.innerHTML = '';
}

function renderMachineSettings(): void {
  const settings = $('#machine-settings');
  if (machine instanceof TuringMachine) {
    settings.innerHTML = `<div class="machine-setting"><label class="field-label" for="tape-count">Tapes</label><div class="inline-setting"><input class="control-input" id="tape-count" type="number" min="1" max="5" value="${machine.tapeCount}" /><button class="icon-button" id="apply-tapes" title="Apply tape count">↵</button></div></div>`;
    $('#apply-tapes').addEventListener('click', () => {
      const tapeCount = Number(($('#tape-count') as HTMLInputElement).value);
      if (!Number.isInteger(tapeCount) || tapeCount < 1 || tapeCount > 5) { setStatus('Turing machines support 1–5 tapes.', 'error'); return; }
      if (machine.transitions.length && !window.confirm('Changing the tape count clears the current machine. Continue?')) return;
      machine = new TuringMachine(tapeCount); selectedState = null; selectedTransition = null; setFilename(generateMachineName()); render();
      commitHistory(); updateHistoryButtons();
      setStatus(`Created ${tapeCount}-tape Turing machine.`);
    });
  } else if (machine instanceof PushdownAutomaton) {
    const pda = machine;
    settings.innerHTML = `<label class="check-row pda-setting"><input id="single-input-pda" type="checkbox" ${pda.singleInput ? 'checked' : ''} /><span class="custom-check"></span><span>Single-symbol stack operations</span></label>`;
    $('#single-input-pda').addEventListener('change', (event) => { pda.singleInput = (event.target as HTMLInputElement).checked; commitHistory(); });
  } else settings.innerHTML = '';
}

function renderStateSelectors(): void {
  const options = machine.states.map((state) => `<option value="${state.id}">${escapeHtml(state.name)}</option>`).join('');
  $('#transition-from').innerHTML = options || '<option value="">Add a state first</option>';
  $('#transition-to').innerHTML = options || '<option value="">Add a state first</option>';
}

function stateClass(state: State): string {
  if (machine.initialState === state && machine.isFinalState(state)) return 'state-both';
  if (machine.initialState === state) return 'state-initial';
  if (machine.isFinalState(state)) return 'state-final';
  return '';
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function renderGraph(): void {
  graphLayer.replaceChildren();
  const grouped = new Map<string, Transition[]>();
  for (const transition of machine.transitions) {
    const key = `${transition.from.id}:${transition.to.id}`;
    const group = grouped.get(key) ?? [];
    group.push(transition); grouped.set(key, group);
  }
  for (const transitions of grouped.values()) renderTransition(transitions[0]!, transitions);
  if (draggingState && dragMode === 'connect' && dragMoved) {
    const preview = svgElement('path');
    preview.classList.add('edge-preview');
    preview.setAttribute('d', `M ${dragStateOrigin.x} ${dragStateOrigin.y} L ${dragPointer.x} ${dragPointer.y}`);
    graphLayer.append(preview);
  }
  for (const state of machine.states) renderState(state, steppingState());
  for (const state of machine.states) if (machine.initialState === state) renderInitialArrow(state);
  $('#canvas-empty').classList.toggle('is-hidden', machine.states.length > 0);
  $('#canvas-coordinates').textContent = `${machine.states.length} ${machine.states.length === 1 ? 'state' : 'states'} · ${machine.transitions.length} ${machine.transitions.length === 1 ? 'transition' : 'transitions'}`;
  $('#machine-count').textContent = `${machine.states.length} ${machine.states.length === 1 ? 'state' : 'states'}`;
}

function renderTransition(transition: Transition, groupedTransitions: Transition[] = [transition]): void {
  const groupIsSelected = groupedTransitions.includes(selectedTransition as Transition);
  const selectionTarget = groupedTransitions.includes(selectedTransition as Transition) ? selectedTransition! : transition;
  const from = transition.from.point; const to = transition.to.point;
  const path = svgElement('path');
  path.classList.add('edge-path');
  if (groupIsSelected) path.classList.add('is-selected');
  const pairKey = `${transition.from.id}:${transition.to.id}`;
  if (stepIncomingKeys.has(pairKey)) path.classList.add('is-step-incoming');
  if (stepOutgoingKeys.has(pairKey)) path.classList.add('is-step-outgoing');
  const marker = groupIsSelected ? 'url(#arrowhead-selected)' : stepIncomingKeys.has(pairKey) ? 'url(#arrowhead-step-incoming)' : stepOutgoingKeys.has(pairKey) ? 'url(#arrowhead-step-outgoing)' : 'url(#arrowhead)';
  path.setAttribute('marker-end', marker);
  let labelX: number; let labelY: number;
  if (transition.from === transition.to) {
    path.setAttribute('d', `M ${from.x - 22} ${from.y - 29} C ${from.x - 82} ${from.y - 112}, ${from.x + 82} ${from.y - 112}, ${from.x + 22} ${from.y - 29}`);
    labelX = from.x; labelY = from.y - 104;
  } else {
    const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length; const uy = dy / length;
    const startX = from.x + ux * 38; const startY = from.y + uy * 38;
    const endX = to.x - ux * 40; const endY = to.y - uy * 40;
    const curve = transition.from.id > transition.to.id ? 26 : -26;
    const controlX = transition.control?.x ?? (startX + endX) / 2 - uy * curve;
    const controlY = transition.control?.y ?? (startY + endY) / 2 + ux * curve;
    path.setAttribute('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`);
    labelX = (startX + 2 * controlX + endX) / 4;
    labelY = (startY + 2 * controlY + endY) / 4 - 11;
  }
  path.addEventListener('click', (event) => { event.stopPropagation(); selectTransition(selectionTarget); });
  const hitArea = svgElement('path');
  hitArea.classList.add('edge-hit-area');
  hitArea.setAttribute('d', path.getAttribute('d') ?? '');
  hitArea.addEventListener('click', (event) => { event.stopPropagation(); selectTransition(selectionTarget); });
  graphLayer.append(hitArea);
  graphLayer.append(path);
  const label = svgElement('text');
  label.classList.add('edge-label'); label.setAttribute('x', String(labelX)); label.setAttribute('y', String(labelY));
  if (groupIsSelected) label.classList.add('is-selected');
  if (stepIncomingKeys.has(pairKey)) label.classList.add('is-step-incoming');
  if (stepOutgoingKeys.has(pairKey)) label.classList.add('is-step-outgoing');
  label.textContent = groupedTransitions.map(transitionLabel).join(', ');
  label.addEventListener('click', (event) => { event.stopPropagation(); selectTransition(selectionTarget); });
  graphLayer.append(label);
}

function renderState(state: State, stepping: State | null = null): void {
  const group = svgElement('g');
  group.classList.add('state-node');
  if (selectedState === state) group.classList.add('is-selected');
  if (stepping === state) group.classList.add('is-stepping');
  if (moveModeState === state) group.classList.add('is-move-mode');
  if (stateClass(state)) group.classList.add(stateClass(state));
  group.dataset.stateId = String(state.id);
  group.setAttribute('transform', `translate(${state.point.x} ${state.point.y})`);
  group.setAttribute('tabindex', '0');
  group.setAttribute('role', 'button');
  group.setAttribute('aria-label', `${state.name}${machine.isFinalState(state) ? ', final' : ''}${machine.initialState === state ? ', initial' : ''}`);
  const outer = svgElement('circle'); outer.classList.add('state-circle'); outer.setAttribute('r', '34');
  group.append(outer);
  if (machine.isFinalState(state)) { const inner = svgElement('circle'); inner.classList.add('final-ring'); inner.setAttribute('r', '28'); group.append(inner); }
  const name = svgElement('text'); name.classList.add('state-name'); name.setAttribute('y', state.label || state.output ? '-3' : '5'); name.textContent = state.name; group.append(name);
  const subLabel = state.label ?? (machine instanceof MooreMachine ? state.output : undefined);
  if (subLabel) { const label = svgElement('text'); label.classList.add('state-sub-label'); label.setAttribute('y', '15'); label.textContent = subLabel; group.append(label); }
  group.addEventListener('click', (event) => { event.stopPropagation(); if (addStateMode) return; selectState(state); });
  group.addEventListener('pointerdown', (event) => {
    if (addStateMode || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); selectState(state);
    const now = performance.now();
    if (moveModeState !== state && lastTapState === state && now - lastTapTime < 400) {
      lastTapState = null; lastTapTime = 0;
      enterMoveMode(state);
      moveModeEntryDrag = true;
    } else {
      lastTapState = state; lastTapTime = now;
    }
    draggingState = state; dragMode = event.altKey || moveModeState === state ? 'move' : 'connect'; dragOrigin = eventToCanvas(event); dragStateOrigin = { ...state.point }; dragPointer = dragOrigin; dragMoved = false; suppressCanvasClick = false;
  });
  group.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectState(state); }
  });
  graphLayer.append(group);
}

function renderInitialArrow(state: State): void {
  const arrow = svgElement('path');
  arrow.classList.add('initial-arrow'); arrow.setAttribute('marker-end', 'url(#start-arrow)');
  arrow.setAttribute('d', `M ${state.point.x - 82} ${state.point.y} L ${state.point.x - 42} ${state.point.y}`);
  graphLayer.append(arrow);
}

function renderStateList(): void {
  stateList.replaceChildren();
  if (!machine.states.length) { stateList.innerHTML = '<div class="empty-list">No states yet. Add one to begin.</div>'; return; }
  for (const state of machine.states) {
    const button = document.createElement('button'); button.className = `state-list-item${selectedState === state ? ' is-active' : ''}`;
    const dot = document.createElement('span'); dot.className = `state-list-dot ${stateClass(state)}`;
    const name = document.createElement('span'); name.className = 'state-list-name'; name.textContent = state.name;
    const detail = document.createElement('span'); detail.className = 'state-list-id'; detail.textContent = String(state.id);
    button.append(dot, name, detail); button.addEventListener('click', () => selectState(state)); stateList.append(button);
  }
}

function renderStateEditor(): void {
  $('#selected-title').textContent = selectedState ? selectedState.name.toUpperCase() : 'SELECT A STATE';
  const fields = $('#state-editor-fields');
  if (!selectedState) {
    if (selectedTransition) {
      $('#selected-title').textContent = 'TRANSITION SELECTED';
      const transition = selectedTransition;
      const label = transition instanceof FSATransition || transition instanceof MealyTransition
        ? labelGroup(transition).map((item) => item || 'λ').join(', ') || 'λ'
        : transitionLabel(transition);
      fields.innerHTML = `<div class="muted-hint transition-inspector-row">${escapeHtml(label)}: ${escapeHtml(transition.from.name)} → ${escapeHtml(transition.to.name)}</div><button class="button button-danger-ghost" id="delete-transition">Delete transition</button>`;
      $('#delete-transition').addEventListener('click', () => {
        machine.removeTransition(transition as never);
        if (selectedTransition === transition) selectedTransition = null;
        render(); commitHistory(); setStatus(`Deleted transition ${transitionLabel(transition)}.`);
      });
    } else fields.innerHTML = '<div class="muted-hint">Select a state or transition on the canvas to inspect it.</div>';
    return;
  }
  const state = selectedState;
  fields.innerHTML = `
    <label class="field-label" for="state-name">Name</label><input class="control-input" id="state-name" value="${escapeHtml(state.name)}" maxlength="32" />
    <label class="field-label state-label-field" for="state-label">Label <span>optional</span></label><input class="control-input state-label-field" id="state-label" value="${escapeHtml(state.label ?? '')}" placeholder="Description" maxlength="40" />
    ${machine instanceof MooreMachine ? `<label class="field-label" for="state-output">Output</label><input class="control-input" id="state-output" value="${escapeHtml(state.output ?? '')}" placeholder="Output symbol" maxlength="32" />` : ''}
    <div class="state-flags"><label class="check-row"><input id="state-initial" type="checkbox" ${machine.initialState === state ? 'checked' : ''} /><span class="custom-check"></span><span>Initial state</span></label><label class="check-row"><input id="state-final" type="checkbox" ${machine.isFinalState(state) ? 'checked' : ''} /><span class="custom-check"></span><span>Final state</span></label></div>
    <button class="button button-danger-ghost" id="delete-state">Delete state</button>`;
  $('#state-name').addEventListener('input', (event) => {
    state.name = (event.target as HTMLInputElement).value || `q${state.id}`;
    $('#selected-title').textContent = state.name.toUpperCase();
    renderStateSelectors(); renderStateList(); renderTransitions(); renderGraph();
  });
  $('#state-label').addEventListener('input', (event) => { const value = (event.target as HTMLInputElement).value; if (value) state.label = value; else delete state.label; renderGraph(); });
  $('#state-initial').addEventListener('change', (event) => { machine.setInitialState((event.target as HTMLInputElement).checked ? state : machine.initialState === state ? null : machine.initialState); render(); commitHistory(); });
  $('#state-final').addEventListener('change', (event) => { if ((event.target as HTMLInputElement).checked) machine.addFinalState(state); else machine.removeFinalState(state); render(); commitHistory(); });
  $('#delete-state').addEventListener('click', () => { machine.removeState(state); selectedState = null; render(); commitHistory(); setStatus(`Deleted ${state.name}.`); });
  if (machine instanceof MooreMachine) {
    const moore = machine;
    $('#state-output').addEventListener('change', (event) => { moore.setOutput(state, (event.target as HTMLInputElement).value); renderGraph(); commitHistory(); });
  }
  $('#state-name').addEventListener('change', commitHistory);
  $('#state-label').addEventListener('change', commitHistory);
}

function renderTransitions(): void {
  transitionList.replaceChildren();
  $('#transition-count').textContent = String(machine.transitions.length);
  if (!machine.transitions.length) { transitionList.innerHTML = '<div class="transition-empty">Transitions you add will appear here.</div>'; return; }
  for (const transition of machine.transitions) {
    const row = document.createElement('div'); row.className = `transition-row${selectedTransition === transition ? ' is-selected' : ''}`;
    const from = document.createElement('span'); from.className = 'transition-endpoint'; from.textContent = transition.from.name;
    const arrow = document.createElement('span'); arrow.className = 'transition-row-arrow'; arrow.textContent = '→';
    const to = document.createElement('span'); to.className = 'transition-endpoint'; to.textContent = transition.to.name;
    const label = document.createElement('span'); label.className = 'transition-row-label'; label.textContent = transitionLabel(transition);
    row.addEventListener('click', () => selectTransition(transition));
    const remove = document.createElement('button'); remove.className = 'remove-transition'; remove.title = 'Remove transition'; remove.textContent = '×';
    remove.addEventListener('click', (event) => { event.stopPropagation(); machine.removeTransition(transition as never); if (selectedTransition === transition) selectedTransition = null; render(); commitHistory(); });
    row.append(from, arrow, to, label, remove); transitionList.append(row);
  }
}

function renderSelectedTransitionEditor(): void {
  const section = $('#selected-transition-section');
  const fields = $('#selected-transition-fields');
  section.hidden = selectedTransition === null;
  if (!selectedTransition) { fields.replaceChildren(); return; }
  if (selectedTransition instanceof FSATransition) fields.innerHTML = fieldMarkup('Read', 'edit-edge-label', 'a, b, c', labelGroup(selectedTransition).map((label) => label || 'λ').join(', '), 'Separate symbols with commas. Use λ or leave blank for an empty move.');
  else if (selectedTransition instanceof PDATransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-input', 'a', selectedTransition.input)}${fieldMarkup('Pop', 'edit-edge-pop', 'Z', selectedTransition.pop)}${fieldMarkup('Push', 'edit-edge-push', 'AZ', selectedTransition.push)}`;
  else if (selectedTransition instanceof TMTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-read', 'a | □', selectedTransition.reads.map((symbol) => symbol === ' ' ? '□' : symbol).join(' | '))}${fieldMarkup('Write', 'edit-edge-write', 'b | □', selectedTransition.writes.map((symbol) => symbol === ' ' ? '□' : symbol).join(' | '))}${fieldMarkup('Move', 'edit-edge-move', 'R | S', selectedTransition.directions.join(' | '))}`;
  else if (selectedTransition instanceof MooreTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-label', 'a, b, c', labelGroup(selectedTransition).map((label) => label || 'λ').join(', '), 'Separate symbols with commas.')}${fieldMarkup('Target state output', 'edit-edge-output', 'x', selectedTransition.output)}`;
  else if (selectedTransition instanceof MealyTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-label', 'a, b, c', labelGroup(selectedTransition).map((label) => label || 'λ').join(', '), 'Separate symbols with commas.')}${fieldMarkup('Output', 'edit-edge-output', 'x', selectedTransition.output)}`;
  fields.insertAdjacentHTML('beforeend', '<button class="button button-add-transition" id="apply-edge-edit" type="button">Apply transition</button>');
  $('#apply-edge-edit').addEventListener('click', applySelectedTransitionEdit);
}

function labelGroup(transition: Transition): string[] {
  return machine.transitions
    .filter((item) => item.from === transition.from && item.to === transition.to)
    .map((item) => (item instanceof FSATransition || item instanceof MealyTransition ? item.label : undefined) ?? '')
    .filter((label) => label !== undefined);
}

function splitSymbols(raw: string): string[] {
  return raw.split(',').map((item) => item.trim()).map((item) => /^(λ|Λ|ε)$/u.test(item) ? '' : item);
}

function applySelectedTransitionEdit(): void {
  const transition = selectedTransition;
  if (!transition) return;
  const value = (id: string): string => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
  const lambda = (input: string): string => /^(λ|Λ|ε)$/u.test(input) ? '' : input;
  try {
    if (transition instanceof FSATransition) {
      const symbols = splitSymbols(value('edit-edge-label'));
      const from = transition.from; const to = transition.to;
      if (!(machine instanceof FiniteStateAutomaton)) throw new Error('Transition does not match the machine type.');
      const automaton = machine;
      for (const item of [...automaton.transitions]) if (item.from === from && item.to === to && item instanceof FSATransition) automaton.removeTransition(item);
      const rebuilt = symbols.map((symbol) => automaton.transition(from, to, symbol));
      selectedTransition = rebuilt[0] ?? null;
    } else if (transition instanceof PDATransition) {
      const input = lambda(value('edit-edge-input')); const pop = lambda(value('edit-edge-pop')); const push = lambda(value('edit-edge-push'));
      if (machine instanceof PushdownAutomaton && machine.singleInput && ([...pop].length > 1 || [...push].length > 1)) throw new Error('Single-symbol stack operations must contain at most one symbol.');
      transition.input = input; transition.pop = pop; transition.push = push;
    } else if (transition instanceof TMTransition) {
      const symbols = (id: string): string[] => value(id).split('|').map((item) => item.trim()).map((item) => item === '□' || item === 'B' || !item ? ' ' : item);
      const reads = symbols('edit-edge-read'); const writes = symbols('edit-edge-write');
      const directions = value('edit-edge-move').split('|').map((item) => item.trim().toUpperCase());
      if (reads.length !== transition.tapes || writes.length !== transition.tapes || directions.length !== transition.tapes) throw new Error(`Enter exactly ${transition.tapes} tape values, separated by |.`);
      if ([...reads, ...writes].some((item) => [...item].length !== 1) || directions.some((item) => !['L', 'R', 'S'].includes(item))) throw new Error('Use one symbol per tape and directions L, R, or S.');
      transition.reads.splice(0, transition.reads.length, ...reads);
      transition.writes.splice(0, transition.writes.length, ...writes);
      transition.directions.splice(0, transition.directions.length, ...directions as Array<'L' | 'R' | 'S'>);
    } else if (transition instanceof MooreTransition) {
      if (!(machine instanceof MooreMachine)) throw new Error('Transition does not match the machine type.');
      const automaton = machine;
      automaton.setOutput(transition.to, lambda(value('edit-edge-output')));
      const symbols = splitSymbols(value('edit-edge-label'));
      const from = transition.from; const to = transition.to;
      for (const item of [...automaton.transitions]) if (item.from === from && item.to === to && item instanceof MooreTransition) automaton.removeTransition(item);
      const rebuilt = symbols.map((symbol) => automaton.transition(from, to, symbol));
      selectedTransition = rebuilt[0] ?? null;
    } else if (transition instanceof MealyTransition) {
      const output = lambda(value('edit-edge-output'));
      const symbols = splitSymbols(value('edit-edge-label'));
      const from = transition.from; const to = transition.to;
      if (!(machine instanceof MealyMachine)) throw new Error('Transition does not match the machine type.');
      const automaton = machine;
      for (const item of [...automaton.transitions]) if (item.from === from && item.to === to && item instanceof MealyTransition) automaton.removeTransition(item);
      const rebuilt = symbols.map((symbol) => automaton.transition(from, to, symbol, output));
      selectedTransition = rebuilt[0] ?? null;
    }
    render(); commitHistory(); setStatus('Transition updated.', 'success');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not update transition.', 'error'); }
}

function createBlankTransition(from: State, to: State): void {
  const previousCount = machine.transitions.length;
  let candidate: Transition;
  if (machine instanceof FiniteStateAutomaton) candidate = machine.transition(from, to, '');
  else if (machine instanceof PushdownAutomaton) candidate = machine.transition(from, to, '', '', '');
  else if (machine instanceof TuringMachine) candidate = machine.transition(from, to, Array(machine.tapeCount).fill(' '), Array(machine.tapeCount).fill(' '), Array(machine.tapeCount).fill('R'));
  else if (machine instanceof MealyMachine) candidate = machine.transition(from, to, '', '');
  else candidate = machine.transition(from, to, '', '');
  selectedState = null;
  selectedTransition = machine.transitions.length > previousCount
    ? candidate
    : machine.transitions.find((transition) => transition.from === from && transition.to === to) ?? candidate;
  render(); commitHistory();
  setStatus('Transition created. Add its label in the selected-transition editor.', 'success');
}

function applyTextInputAttributes(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')) {
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
  }
}

function render(): void {
  const kind = activeTab()?.kind;
  const textMode = kind === 'text';
  const startMode = kind === 'start';
  const workspace = document.querySelector('.workspace');
  if (workspace) {
    workspace.classList.toggle('is-text-mode', textMode);
    workspace.classList.toggle('is-start-mode', startMode);
  }
  const editor = $<HTMLTextAreaElement>('#text-editor');
  editor.hidden = !textMode;
  if (textMode) editor.value = activeTab()?.text ?? '';
  const overlay = $('#start-overlay');
  if (startMode) { renderStartMenu(); overlay.hidden = false; } else { overlay.hidden = true; startMenuView = 'main'; }
  renderStateSelectors(); renderTransitionFields(); renderSimulatorOptions(); renderMachineSettings(); renderStateList(); renderStateEditor(); renderSelectedTransitionEditor(); renderTransitions(); renderGraph();
  applyTextInputAttributes();
  $<HTMLSelectElement>('#machine-type').value = machineType(machine);
  $('#canvas-subtitle').textContent = addStateMode ? 'Click anywhere on the canvas to place a state' : 'Click empty canvas to add a state · drag or scroll to pan · drag node to connect · Alt-drag or double-click to move';
}

function selectState(state: State | null): void {
  if (moveModeState && moveModeState !== state) { moveModeState = null; renderGraph(); }
  selectedState = state; selectedTransition = null; render();
}

function enterMoveMode(state: State): void {
  moveModeState = state; selectedState = state; selectedTransition = null;
  renderGraph();
  setStatus(`Move mode — drag ${state.name} to move. It exits automatically after the move, or on click / Escape.`);
}
function selectTransition(transition: Transition | null): void { selectedTransition = transition; selectedState = null; render(); }

function setStatus(message: string, state: 'ready' | 'success' | 'error' = 'ready'): void {
  const status = $('#status-message');
  status.innerHTML = `<i class="status-led status-${state}"></i>${escapeHtml(message)}`;
}

function showToast(message: string): void {
  const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message;
  $('#toast-region').append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function addState(point?: { x: number; y: number }): void {
  const view = svg.viewBox.baseVal;
  const center = point ?? { x: view.x + view.width / 2 + (machine.states.length % 4) * 16, y: view.y + view.height / 2 + (machine.states.length % 3) * 16 };
  const state = machine.createState(center);
  selectedState = state; selectedTransition = null; addStateMode = false; render(); commitHistory(); setStatus(`Added ${state.name}.`);
}

function svgUnitScale(): number {
  const bounds = svg.getBoundingClientRect(); const view = svg.viewBox.baseVal;
  return Math.min(bounds.width / view.width, bounds.height / view.height);
}

function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const bounds = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const scale = svgUnitScale();
  const offsetX = (bounds.width - view.width * scale) / 2;
  const offsetY = (bounds.height - view.height * scale) / 2;
  return {
    x: Math.round(view.x + (clientX - bounds.left - offsetX) / scale),
    y: Math.round(view.y + (clientY - bounds.top - offsetY) / scale),
  };
}
function eventToCanvas(event: PointerEvent | MouseEvent): { x: number; y: number } { return screenToCanvas(event.clientX, event.clientY); }

function addTransition(event: SubmitEvent): void {
  event.preventDefault();
  const from = machine.getState(Number(($('#transition-from') as HTMLSelectElement).value));
  const to = machine.getState(Number(($('#transition-to') as HTMLSelectElement).value));
  if (!from || !to) { setStatus('Add two states before creating a transition.', 'error'); return; }
  const value = (id: string): string => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
  const lambda = (input: string): string => /^(λ|Λ|ε)$/u.test(input) ? '' : input;
  try {
    if (machine instanceof FiniteStateAutomaton) machine.transition(from, to, lambda(value('transition-label')));
    else if (machine instanceof PushdownAutomaton) machine.transition(from, to, lambda(value('transition-input')), lambda(value('transition-pop')), lambda(value('transition-push')));
    else if (machine instanceof TuringMachine) {
      const parseTapes = (input: string): string[] => input.split('|').map((part) => part.trim()).map((symbol) => symbol === '□' || symbol === 'B' ? ' ' : symbol);
      const reads = parseTapes(value('transition-read')); const writes = parseTapes(value('transition-write'));
      const directions = parseTapes(value('transition-move')).map((direction) => direction.toUpperCase() as 'L' | 'R' | 'S');
      machine.transition(from, to, reads, writes, directions);
    } else if (machine instanceof MealyMachine) machine.transition(from, to, lambda(value('transition-label')), lambda(value('transition-output')));
    else if (machine instanceof MooreMachine) {
      machine.setOutput(to, lambda(value('transition-output')));
      machine.transition(from, to, lambda(value('transition-label')));
    }
    render(); commitHistory(); setStatus(`Added transition ${from.name} → ${to.name}.`, 'success');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not add transition.', 'error'); }
}

function steppingState(): State | null {
  if (!stepperSession) return null;
  if (stepperSession.machine !== machine) { stepperSession = null; return null; }
  return stepperSession.views[stepperSession.index]?.state ?? null;
}

function simulateInput(input: string): { success: boolean; result: string; output?: string } {  if (machine instanceof FiniteStateAutomaton) {
    return { success: new FSASimulator(machine).run(input).accepted, result: '' };
  }
  if (machine instanceof PushdownAutomaton) {
    const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'empty-stack' | 'either' | undefined;
    const initialStackSymbol = ($('#initial-stack') as HTMLInputElement | null)?.value ?? 'Z';
    return { success: new PDASimulator(machine, initialStackSymbol).run(input, acceptance ? { acceptance } : {}).accepted, result: '' };
  }
  if (machine instanceof TuringMachine) {
    const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'halting' | 'either' | undefined;
    const maxSteps = Number(($('#step-limit') as HTMLInputElement | null)?.value ?? 1000);
    const simulation = new TuringMachineSimulator(machine).run(input, acceptance ? { acceptance, maxSteps } : { maxSteps });
    return { success: simulation.accepted, result: simulation.accepted ? 'accepted' : simulation.halted ? 'halted' : 'limit' };
  }
  if (machine instanceof MealyMachine) {
    const outputs = new MealySimulator(machine).run(input).outputs;
    return { success: outputs.length > 0, result: 'transduced', output: outputs.join(' · ') };
  }
  const outputs = new MooreSimulator(machine).run(input).outputs;
  return { success: outputs.length > 0, result: 'transduced', output: outputs.join(' · ') };
}

function renderSimulationTable(state: 'success' | 'mixed' | 'failure', title: string, outcomes: Array<{ input: string; success: boolean; result: string; output?: string }>): void {
  const result = $('#simulation-result');
  result.hidden = false;
  result.className = `simulation-result ${state === 'success' ? 'result-success' : state === 'mixed' ? 'result-mixed' : 'result-failure'}`;
  const transducer = outcomes.some((item) => item.output !== undefined);
  const header = transducer ? '<tr><th>Input</th><th>Result</th><th>Output</th></tr>' : '<tr><th>Input</th><th>Result</th></tr>';
  const rows = outcomes.map((item) => {
    const input = item.input || 'λ';
    const symbol = item.success ? '✓' : '×';
    const cells = transducer ? `<td class="result-cell-input">${escapeHtml(input)}</td><td>${symbol} ${escapeHtml(item.result || (item.success ? 'accepted' : 'rejected'))}</td><td>${escapeHtml(item.output || '—')}</td>` : `<td class="result-cell-input">${escapeHtml(input)}</td><td>${symbol} ${escapeHtml(item.result || (item.success ? 'accepted' : 'rejected'))}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');
  result.innerHTML = `<div class="result-state"><span class="result-symbol">${state === 'failure' ? '×' : '✓'}</span><span>${escapeHtml(title)}</span></div><table class="result-table"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
  setStatus(title, state === 'success' ? 'success' : state === 'failure' ? 'error' : 'ready');
}

let simulationTimer = 0;
let steppingTimer = 0;

interface StepperView { state: State; remaining: string; note: string; fromState: State | null; outgoing: Transition[]; }
const stepIncomingKeys = new Set<string>();
const stepOutgoingKeys = new Set<string>();

function symbolRangeMatches(label: string, next: string): boolean {
  const range = /^\[(.)-(.)\]$/u.exec(label);
  return Boolean(range && next >= range[1]! && next <= range[2]!);
}

function tmReadMatchesSymbol(symbol: string, value: string | undefined): boolean {
  if (symbol === '~') return true;
  if (symbol.startsWith('!')) return value !== symbol.slice(1);
  return value === symbol;
}

function scheduleRun(immediate = false): void {
  window.clearTimeout(simulationTimer);
  if (immediate) runSimulation();
  else simulationTimer = window.setTimeout(runSimulation, 350);
}

function scheduleStep(immediate = false): void {
  window.clearTimeout(steppingTimer);
  if (immediate) startStepping();
  else steppingTimer = window.setTimeout(startStepping, 350);
}
let stepperSession: { machine: Machine; views: StepperView[]; accepted: boolean; index: number; input: string } | null = null;

function startStepping(): void {
  const input = ($('#step-input') as HTMLInputElement).value;
  try {
    let views: StepperView[] = [];
    let accepted = false;
    if (machine instanceof FiniteStateAutomaton) {
      const automaton = machine;
      const run = new FSASimulator(automaton).run(input);
      let previous: State | null = null;
      views = run.configurations.map((config) => {
        const next = config.remaining[0];
        const view: StepperView = {
          state: config.state,
          remaining: config.remaining,
          note: '',
          fromState: previous,
          outgoing: automaton.transitions.filter((transition) => transition.from === config.state && (transition.label === '' || (next !== undefined && (transition.label === next || symbolRangeMatches(transition.label, next))))),
        };
        previous = config.state;
        return view;
      });
      accepted = run.accepted;
    } else if (machine instanceof PushdownAutomaton) {
      const automaton = machine;
      const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'empty-stack' | 'either' | undefined;
      const initialStackSymbol = ($('#initial-stack') as HTMLInputElement | null)?.value ?? 'Z';
      const run = new PDASimulator(automaton, initialStackSymbol).run(input, acceptance ? { acceptance } : {});
      let previous: State | null = null;
      views = run.configurations.map((config) => {
        const stackText = config.stack.join('');
        const next = config.remaining[0];
        const view: StepperView = {
          state: config.state,
          remaining: config.remaining,
          note: `stack: ${stackText || 'empty'}`,
          fromState: previous,
          outgoing: automaton.transitions.filter((transition) => transition.from === config.state && (transition.input === '' || (next !== undefined && transition.input === next)) && (transition.pop === '' || stackText.startsWith(transition.pop))),
        };
        previous = config.state;
        return view;
      });
      accepted = run.accepted;
    } else if (machine instanceof TuringMachine) {
      const automaton = machine;
      const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'halting' | 'either' | undefined;
      const maxSteps = Number(($('#step-limit') as HTMLInputElement | null)?.value ?? 1000);
      const run = new TuringMachineSimulator(automaton).run(input, acceptance ? { acceptance, maxSteps } : { maxSteps });
      let previous: State | null = null;
      views = run.configurations.map((config) => {
        const tape = config.tapes[0]!;
        const text = Object.entries(tape.cells).sort(([a], [b]) => Number(a) - Number(b)).map(([, symbol]) => symbol).join('');
        const view: StepperView = {
          state: config.state,
          remaining: text || '□',
          note: `step ${config.steps} · head ${tape.head}`,
          fromState: previous,
          outgoing: automaton.transitions.filter((transition) => transition.from === config.state && transition.reads.every((symbol, index) => {
            const stepTape = config.tapes[index]!;
            return tmReadMatchesSymbol(symbol, stepTape.cells[stepTape.head] ?? ' ');
          })),
        };
        previous = config.state;
        return view;
      });
      accepted = run.accepted;
    } else if (machine instanceof MealyMachine) {
      const automaton = machine;
      const run = new MealySimulator(automaton).run(input);
      let previous: State | null = null;
      views = run.configurations.map((config) => {
        const next = config.remaining[0];
        const view: StepperView = {
          state: config.state,
          remaining: config.remaining,
          note: `output: ${config.output || '—'}`,
          fromState: previous,
          outgoing: automaton.transitions.filter((transition) => transition.from === config.state && (transition.label === '' || (next !== undefined && (transition.label === next || symbolRangeMatches(transition.label, next))))),
        };
        previous = config.state;
        return view;
      });
      accepted = run.outputs.length > 0;
    } else if (machine instanceof MooreMachine) {
      const automaton = machine;
      const run = new MooreSimulator(automaton).run(input);
      let previous: State | null = null;
      views = run.configurations.map((config) => {
        const next = config.remaining[0];
        const view: StepperView = {
          state: config.state,
          remaining: config.remaining,
          note: `output: ${config.output || '—'}`,
          fromState: previous,
          outgoing: automaton.transitions.filter((transition) => transition.from === config.state && (transition.label === '' || (next !== undefined && (transition.label === next || symbolRangeMatches(transition.label, next))))),
        };
        previous = config.state;
        return view;
      });
      accepted = run.outputs.length > 0;
    }
    if (!views.length) { setStatus('Add an initial state to step through the machine.', 'error'); return; }
    stepperSession = { machine, views, accepted, index: 0, input };
    renderStepper();
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not step through the input.', 'error'); }
}

function renderStepper(): void {
  const region = $('#stepper-view');
  const controls = $('#stepper-controls');
  if (!stepperSession || stepperSession.machine !== machine) {
    stepperSession = null;
    stepIncomingKeys.clear(); stepOutgoingKeys.clear();
    region.innerHTML = ''; controls.hidden = true;
    return;
  }
  const { views, index, accepted } = stepperSession;
  const step = views[index]!;
  const isLast = index === views.length - 1;
  stepIncomingKeys.clear(); stepOutgoingKeys.clear();
  if (index > 0) stepIncomingKeys.add(`${views[index - 1]!.state.id}:${step.state.id}`);
  for (const transition of step.outgoing) stepOutgoingKeys.add(`${transition.from.id}:${transition.to.id}`);
  $('#step-position').textContent = `${index + 1}/${views.length}`;
  $('#step-back').toggleAttribute('disabled', index <= 0);
  $('#step-forward').toggleAttribute('disabled', isLast);
  const note = isLast ? (accepted ? 'Accepted ✓' : 'Rejected ×') : step.note;
  const noteClass = isLast ? (accepted ? 'step-note step-accepted' : 'step-note step-rejected') : 'step-note';
  const inputLine = stepperSession.machine instanceof TuringMachine
    ? `<span class="step-remaining">tape: ${escapeHtml(step.remaining || '□')}</span>`
    : `<span class="step-input-line"><span class="step-eaten">${escapeHtml(stepperSession.input.slice(0, stepperSession.input.length - step.remaining.length))}</span><span class="step-rest">${escapeHtml(step.remaining || 'λ')}</span></span>`;
  region.innerHTML = `<div class="step-card"><span class="step-state-name">${escapeHtml(step.state.name)}</span>${inputLine}<span class="${noteClass}">${escapeHtml(note)}</span></div>`;
  controls.hidden = false;
  renderGraph();
}

let inputSuggestion: { start: number; completion: string } | null = null;

function updateInputSuggestion(): void {
  const field = $<HTMLInputElement>('#input-string');
  const mirror = document.getElementById('input-ghost');
  inputSuggestion = null;
  let ghost = '';
  const value = field.value;
  const caret = field.selectionStart ?? value.length;
  if (caret === value.length) {
    const boundary = Math.max(value.lastIndexOf(','), value.lastIndexOf('#'), value.lastIndexOf('\n'));
    const at = value.lastIndexOf('@');
    if (at > boundary && at < caret) {
      const token = value.slice(at + 1, caret);
      if (!token.includes(' ')) {
        const candidates = loadRecents().filter((item) => item.kind === 'text');
        const match = token ? candidates.find((item) => item.name.toLowerCase().startsWith(token.toLowerCase())) : candidates[0];
        if (match) {
          const completion = match.name.slice(token.length);
          if (completion) { inputSuggestion = { start: caret, completion }; ghost = completion; }
        }
      }
    }
  }
  if (mirror) mirror.innerHTML = inputSuggestion ? `<span class="ghost-hidden">${escapeHtml(value.slice(0, caret))}</span><span class="ghost-rest">${escapeHtml(inputSuggestion.completion)}</span>` : '';
}

function completeInputSuggestion(): void {
  const field = $<HTMLInputElement>('#input-string');
  if (!inputSuggestion) return;
  const start = inputSuggestion.start;
  field.value = field.value.slice(0, start) + inputSuggestion.completion;
  const position = start + inputSuggestion.completion.length;
  field.setSelectionRange(position, position);
  inputSuggestion = null;
  updateInputSuggestion();
}

function resolveSimulateInputs(raw: string, depth = 0): string[] {
  if (depth > 5) throw new Error('@file references are nested too deeply.');
  const cleaned = raw.split('\n').map((line) => line.split('#')[0]).join('');
  const result: string[] = [];
  for (const part of cleaned.split(',')) {
    const token = part.trim();
    if (token.startsWith('@')) {
      const name = token.slice(1).trim();
      if (!name) continue;
      const key = `text:${name.toLowerCase()}`;
      const openText = openTabs.find((tab) => tab.kind === 'text' && (tab.recentKey ?? `text:${tab.filename.toLowerCase()}`) === key);
      const data = openText ? openText.text : loadRecents().find((item) => item.kind === 'text' && item.name.toLowerCase() === name.toLowerCase())?.data;
      if (data === undefined) throw new Error(`Referenced file "${token}" not found. Open it once so it can be used.`);
      result.push(...resolveSimulateInputs(data, depth + 1));
    } else {
      result.push(token);
    }
  }
  return result;
}

function runSimulation(): void {
  const raw = ($('#input-string') as HTMLInputElement).value;
  try {
    const inputs = resolveSimulateInputs(raw);
    if (inputs.length === 1) {
      runSingleSimulation(inputs[0]!);
      return;
    }
    const outcomes = inputs.map((input) => ({ input, ...simulateInput(input) }));
    const accepted = outcomes.filter((item) => item.success).length;
    const allAccepted = accepted === outcomes.length;
    const noneAccepted = accepted === 0;
    const title = allAccepted ? `Inputs accepted (${accepted}/${outcomes.length})` : noneAccepted ? `Inputs rejected (0/${outcomes.length})` : `Mixed results (${accepted}/${outcomes.length})`;
    renderSimulationTable(allAccepted ? 'success' : noneAccepted ? 'failure' : 'mixed', title, outcomes);
  } catch (error) { renderSimulationResult(false, 'Simulation error', error instanceof Error ? error.message : String(error)); }
}

function runSingleSimulation(input: string): void {
  try {
    if (machine instanceof FiniteStateAutomaton) {
      const simulation = new FSASimulator(machine).run(input);
      renderSimulationResult(simulation.accepted, simulation.accepted ? 'Input accepted' : 'Input rejected', `${simulation.configurations.length} configurations explored.`);
    } else if (machine instanceof PushdownAutomaton) {
      const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'empty-stack' | 'either' | undefined;
      const initialStackSymbol = ($('#initial-stack') as HTMLInputElement | null)?.value ?? 'Z';
      const simulation = new PDASimulator(machine, initialStackSymbol).run(input, acceptance ? { acceptance } : {});
      const final = simulation.configurations.at(-1);
      renderSimulationResult(simulation.accepted, simulation.accepted ? 'Input accepted' : 'Input rejected', `${simulation.configurations.length} configurations explored.${final ? ` Final stack: ${final.stack.join('') || 'empty'}.` : ''}`);
    } else if (machine instanceof TuringMachine) {
      const acceptance = ($('#acceptance-mode') as HTMLSelectElement | null)?.value as 'final-state' | 'halting' | 'either' | undefined;
      const maxSteps = Number(($('#step-limit') as HTMLInputElement | null)?.value ?? 1000);
      const simulation = new TuringMachineSimulator(machine).run(input, acceptance ? { acceptance, maxSteps } : { maxSteps });
      const final = simulation.configurations.at(-1);
      const tape = final?.tapes[0];
      const tapeText = tape ? Object.entries(tape.cells).sort(([a], [b]) => Number(a) - Number(b)).map(([, symbol]) => symbol).join('') : '';
      renderSimulationResult(simulation.accepted, simulation.accepted ? 'Machine accepted' : simulation.halted ? 'Machine halted · rejected' : 'Step limit reached', `${final?.steps ?? 0} steps${tapeText ? ` · tape: ${tapeText}` : ''}.`);
    } else if (machine instanceof MealyMachine) {
      const outputs = new MealySimulator(machine).run(input).outputs;
      renderSimulationResult(outputs.length > 0, outputs.length ? 'Transduction complete' : 'No path for input', outputs.length ? `Output: ${outputs.join(' · ')}` : 'No accepting run consumed the full input.');
    } else if (machine instanceof MooreMachine) {
      const outputs = new MooreSimulator(machine).run(input).outputs;
      renderSimulationResult(outputs.length > 0, outputs.length ? 'Transduction complete' : 'No path for input', outputs.length ? `Output: ${outputs.join(' · ')}` : 'No run consumed the full input.');
    }
  } catch (error) { renderSimulationResult(false, 'Simulation error', error instanceof Error ? error.message : String(error)); }
}

function renderSimulationResult(success: boolean, title: string, detail: string): void {
  const result = $('#simulation-result');
  result.hidden = false;
  result.className = `simulation-result ${success ? 'result-success' : 'result-failure'}`;
  result.innerHTML = `<div class="result-state"><span class="result-symbol">${success ? '✓' : '×'}</span><span>${escapeHtml(title)}</span></div><div class="result-detail">${escapeHtml(detail)}</div>`;
  setStatus(title, success ? 'success' : 'error');
}

function buildFaExample(): FiniteStateAutomaton {
  const example = new FiniteStateAutomaton();
  const q0 = example.createState({ x: 280, y: 300 }); q0.name = 'q0';
  const q1 = example.createState({ x: 500, y: 300 }); q1.name = 'q1';
  const q2 = example.createState({ x: 720, y: 300 }); q2.name = 'q2';
  example.setInitialState(q0); example.addFinalState(q2);
  example.transition(q0, q0, 'a'); example.transition(q0, q1, 'b'); example.transition(q1, q2, 'c');
  return example;
}

function buildPdaExample(): PushdownAutomaton {
  const pda = new PushdownAutomaton();
  const q0 = pda.createState({ x: 340, y: 300 }); q0.name = 'q0';
  const q1 = pda.createState({ x: 660, y: 300 }); q1.name = 'q1';
  pda.setInitialState(q0); pda.addFinalState(q1);
  pda.transition(q0, q0, 'a', '', 'A');
  pda.transition(q0, q1, 'b', 'A', '');
  pda.transition(q1, q1, 'b', 'A', '');
  return pda;
}

function buildTuringExample(): TuringMachine {
  const tm = new TuringMachine();
  const q0 = tm.createState({ x: 240, y: 300 }); q0.name = 'q0';
  const q1 = tm.createState({ x: 450, y: 180 }); q1.name = 'q1';
  const q2 = tm.createState({ x: 450, y: 430 }); q2.name = 'q2';
  const q3 = tm.createState({ x: 660, y: 300 }); q3.name = 'q3';
  const q4 = tm.createState({ x: 870, y: 300 }); q4.name = 'q4';
  tm.setInitialState(q0); tm.addFinalState(q4);
  tm.transition(q0, q1, ['a'], ['X'], ['R']);
  tm.transition(q0, q3, ['X'], ['X'], ['R']);
  tm.transition(q0, q3, ['Y'], ['Y'], ['R']);
  tm.transition(q1, q1, ['a'], ['a'], ['R']);
  tm.transition(q1, q2, ['b'], ['Y'], ['L']);
  tm.transition(q2, q2, ['a'], ['a'], ['L']);
  tm.transition(q2, q2, ['Y'], ['Y'], ['L']);
  tm.transition(q2, q0, ['X'], ['X'], ['R']);
  tm.transition(q3, q3, ['Y'], ['Y'], ['R']);
  tm.transition(q3, q4, [' '], [' '], ['R']);
  return tm;
}

function buildMealyExample(): MealyMachine {
  const mealy = new MealyMachine();
  const q0 = mealy.createState({ x: 500, y: 300 }); q0.name = 'q0';
  mealy.setInitialState(q0);
  mealy.transition(q0, q0, '0', '1');
  mealy.transition(q0, q0, '1', '0');
  return mealy;
}

function buildMooreExample(): MooreMachine {
  const moore = new MooreMachine();
  const q0 = moore.createState({ x: 400, y: 300 }); q0.name = 'q0';
  const q1 = moore.createState({ x: 640, y: 300 }); q1.name = 'q1';
  moore.setInitialState(q0);
  moore.setOutput(q0, '0');
  moore.setOutput(q1, '1');
  moore.transition(q0, q0, '0');
  moore.transition(q0, q1, '1');
  moore.transition(q1, q1, '0');
  moore.transition(q1, q0, '1');
  return moore;
}

const EXAMPLES: Record<MachineType, { filename: string; title: string; input: string; stepInput: string; build: () => Machine }> = {
  fa: { filename: 'example-anbc.jff', title: 'aⁿbc', input: 'abc, aac, cba', stepInput: 'abc', build: buildFaExample },
  pda: { filename: 'example-anbn-pda.jff', title: 'aⁿbⁿ (pushdown)', input: 'ab, aabb, abb', stepInput: 'aabb', build: buildPdaExample },
  turing: { filename: 'example-anbn-turing.jff', title: 'aⁿbⁿ (Turing machine)', input: 'ab, aabb, aab', stepInput: 'aabb', build: buildTuringExample },
  mealy: { filename: 'example-complement-mealy.jff', title: 'binary complement (Mealy)', input: '0110, 1001', stepInput: '0110', build: buildMealyExample },
  moore: { filename: 'example-parity-moore.jff', title: 'parity checker (Moore)', input: '101, 100', stepInput: '101', build: buildMooreExample },
};

function loadExample(type: MachineType): void {
  const entry = EXAMPLES[type];
  applyLoadedMachine(entry.build(), entry.filename);
  $<HTMLInputElement>('#input-string').value = entry.input;
  $<HTMLInputElement>('#step-input').value = entry.stepInput;
  stepperSession = null;
  runSimulation();
  startStepping();
  setStatus(`Loaded example: ${entry.title}.`); showToast('Example machine loaded');
}

function openJff(file: File): void {
  file.text().then((contents) => {
    const structure = JFFCodec.decode(contents);
    if (!isMachineStructure(structure)) {
      throw new Error('This structure is valid JFLAP data but is not an automaton.');
    }
    applyLoadedMachine(structure, file.name);
    setStatus(`Opened ${file.name}.`, 'success'); showToast('JFLAP file opened');
    addRecent({ name: file.name, kind: 'automaton', data: contents });
    const tab = activeTab();
    if (tab) tab.recentKey = `automaton:${file.name.toLowerCase()}`;
  }).catch((error: unknown) => { setStatus(error instanceof Error ? error.message : 'Could not open file.', 'error'); showToast('Could not open that .jff file'); });
}

function openFile(file: File): void {
  const name = file.name.toLowerCase();
  if (name.endsWith('.jff') || name.endsWith('.xml')) { openJff(file); return; }
  if (name.endsWith('.txt')) {
    file.text().then((contents) => {
      convertToTextTab(file.name, contents);
      setStatus(`Opened ${file.name}.`, 'success'); showToast('Text file opened');
      addRecent({ name: file.name, kind: 'text', data: contents });
      const tab = activeTab();
      if (tab) tab.recentKey = `text:${name}`;
    }).catch(() => { setStatus('Could not read that file.', 'error'); });
    return;
  }
  setStatus('Only .jff and .txt files are supported.', 'error');
  showToast('Unsupported file type');
}

function saveJff(): void {
  try {
    if (isTextMode()) {
      const text = $<HTMLTextAreaElement>('#text-editor').value;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      const base = currentFilename.replace(/\.(txt)$/iu, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').trim();
      link.download = `${base || 'untitled'}.txt`;
      link.click(); URL.revokeObjectURL(url);
      setStatus('Exported text file.', 'success'); showToast('Text file exported');
      return;
    }
    const text = JFFCodec.encode(machine);
    const blob = new Blob([text], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    const base = currentFilename.replace(/\.(jff|xml)$/iu, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').trim();
    link.download = `${base || 'automaton'}.jff`;
    link.click(); URL.revokeObjectURL(url);
    setStatus('Exported JFLAP XML.', 'success'); showToast('JFF file exported');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export file.', 'error'); }
}

$('#machine-type').addEventListener('change', (event) => {
  openTab(makeMachine((event.target as HTMLSelectElement).value as MachineType), generateMachineName());
  render(); commitHistory(); setStatus('New machine created.');
});
$('#add-state').addEventListener('click', () => { addStateMode = !addStateMode; $('#add-state').classList.toggle('is-active', addStateMode); $('#canvas-shell').classList.toggle('is-adding', addStateMode); $('#canvas-subtitle').textContent = addStateMode ? 'Click anywhere on the canvas to place a state' : 'Drag empty canvas or scroll to pan · drag node to connect · Alt-drag to move'; });
svg.addEventListener('pointerdown', (event) => {
  const target = event.target as Element;
  const onMachineItem = Boolean(target.closest('.state-node, .edge-path, .edge-hit-area, .edge-label'));
  const shouldPan = event.button === 1 || spacePanActive || (event.button === 0 && !onMachineItem && !addStateMode);
  canvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (canvasPointers.size === 2) {
    canvasPan = null; draggingState = null; dragMode = null;
    svg.classList.remove('is-panning');
    const [left, right] = [...canvasPointers.values()];
    const view = svg.viewBox.baseVal;
    canvasPinch = {
      dist: Math.hypot(left!.x - right!.x, left!.y - right!.y) || 1,
      width: view.width,
      height: view.height,
      center: screenToCanvas((left!.x + right!.x) / 2, (left!.y + right!.y) / 2),
    };
    return;
  }
  if (!shouldPan) { canvasPointers.delete(event.pointerId); return; }
  event.preventDefault(); event.stopPropagation();
  const view = svg.viewBox.baseVal;
  canvasPan = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
  svg.classList.add('is-panning');
  svg.setPointerCapture(event.pointerId);
}, true);
$('#automaton-canvas').addEventListener('dblclick', (event) => event.preventDefault());
$('#automaton-canvas').addEventListener('click', (event) => {
  if (suppressCanvasClick) { suppressCanvasClick = false; event.preventDefault(); return; }
  const target = event.target as Element;
  if (target.closest('.state-node, .edge-path, .edge-label')) return;
  if (moveModeState) { moveModeState = null; selectTransition(null); return; }
  addState(eventToCanvas(event));
  if (addStateMode) { $('#add-state').classList.remove('is-active'); $('#canvas-shell').classList.remove('is-adding'); }
});
document.addEventListener('pointermove', (event) => {
  if (canvasPointers.has(event.pointerId)) canvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (canvasPinch && canvasPointers.size >= 2) {
    const [left, right] = [...canvasPointers.values()];
    const factor = (Math.hypot(left!.x - right!.x, left!.y - right!.y) || 1) / canvasPinch.dist;
    const width = Math.max(120, Math.min(5000, canvasPinch.width / factor));
    const height = canvasPinch.height * width / canvasPinch.width;
    setCanvasView(canvasPinch.center.x - width / 2, canvasPinch.center.y - height / 2, width, height);
    return;
  }
  if (canvasPan) {
    const dx = event.clientX - canvasPan.clientX; const dy = event.clientY - canvasPan.clientY;
    if (Math.hypot(dx, dy) > 2) canvasPan.moved = true;
    const scale = svgUnitScale();
    setCanvasView(canvasPan.viewX - dx / scale, canvasPan.viewY - dy / scale);
    return;
  }
  if (!draggingState) return;
  const point = eventToCanvas(event);
  dragPointer = point;
  if (Math.hypot(point.x - dragOrigin.x, point.y - dragOrigin.y) > 7) dragMoved = true;
  if (!dragMoved) return;
  if (dragMode === 'move') {
    draggingState.point = { x: dragStateOrigin.x + point.x - dragOrigin.x, y: dragStateOrigin.y + point.y - dragOrigin.y };
  }
  renderGraph();
});
document.addEventListener('pointerup', (event) => {
  if (canvasPinch) {
    canvasPointers.delete(event.pointerId);
    if (canvasPointers.size < 2) {
      canvasPinch = null;
      suppressCanvasClick = true;
      window.setTimeout(() => { suppressCanvasClick = false; }, 0);
    }
    return;
  }
  canvasPointers.delete(event.pointerId);
  if (canvasPan && event.pointerId === canvasPan.pointerId) {
    if (canvasPan.moved) {
      suppressCanvasClick = true;
      window.setTimeout(() => { suppressCanvasClick = false; }, 0);
    }
    canvasPan = null; svg.classList.remove('is-panning');
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    return;
  }
  if (!draggingState) return;
  const source = draggingState;
  if (dragMoved) {
    suppressCanvasClick = true;
    window.setTimeout(() => { suppressCanvasClick = false; }, 0);
  }
  if (dragMoved && dragMode === 'move') {
    setStatus(`Moved ${source.name}.`); commitHistory();
    moveModeEntryDrag = false;
    if (moveModeState === source) moveModeState = null;
  } else if (!dragMoved && dragMode === 'move' && moveModeState === source) {
    if (moveModeEntryDrag) moveModeEntryDrag = false;
    else { moveModeState = null; setStatus('Move mode off.'); }
  } else if (dragMoved && dragMode === 'connect') {
    const point = eventToCanvas(event);
    const target = machine.states
      .map((state) => ({ state, distance: Math.hypot(state.point.x - point.x, state.point.y - point.y) }))
      .filter(({ distance }) => distance <= 52)
      .sort((left, right) => left.distance - right.distance)[0]?.state;
    if (target) createBlankTransition(source, target);
    else {
      const view = svg.viewBox.baseVal;
      const destination = machine.createState({
        x: Math.max(view.x + 36, Math.min(view.x + view.width - 36, point.x)),
        y: Math.max(view.y + 36, Math.min(view.y + view.height - 36, point.y)),
      });
      createBlankTransition(source, destination);
      setStatus(`Added ${destination.name} and connected a transition.`);
    }
  }
  draggingState = null; dragMode = null; dragMoved = false;
  if (!moveModeState) renderGraph();
});
svg.addEventListener('wheel', (event) => {
  event.preventDefault();
  const view = svg.viewBox.baseVal;
  if (event.ctrlKey || event.metaKey) { zoomAt(Math.exp(-event.deltaY * .002), event.clientX, event.clientY); return; }
  const scale = svgUnitScale();
  let dx = event.deltaX; let dy = event.deltaY;
  if (event.shiftKey && !dx) { dx = dy; dy = 0; }
  setCanvasView(view.x + dx / scale, view.y + dy / scale);
}, { passive: false });
$('#transition-form').addEventListener('submit', addTransition);
$('#input-string').addEventListener('input', () => { updateInputSuggestion(); scheduleRun(); });
$('#input-string').addEventListener('keydown', (event) => {
  if (inputSuggestion && (event.key === 'Tab' || event.key === 'Enter')) {
    event.preventDefault();
    completeInputSuggestion();
    scheduleRun(true);
    return;
  }
  if (event.key === 'Enter') scheduleRun(true);
});
$('#step-input').addEventListener('input', () => scheduleStep());
$('#step-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') scheduleStep(true); });
$('#step-forward').addEventListener('click', () => { if (stepperSession && stepperSession.index < stepperSession.views.length - 1) { stepperSession.index++; renderStepper(); } });
$('#step-back').addEventListener('click', () => { if (stepperSession && stepperSession.index > 0) { stepperSession.index--; renderStepper(); } });
$('#input-string').addEventListener('input', scheduleSave);
let textSaveTimer = 0;
$('#text-editor').addEventListener('input', () => {
  const tab = activeTab();
  if (tab) tab.text = ($<HTMLTextAreaElement>('#text-editor')).value;
  window.clearTimeout(textSaveTimer);
  textSaveTimer = window.setTimeout(persistWorkspace, 600);
});
$('#save-file').addEventListener('click', saveJff);
$('#open-file').addEventListener('change', (event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) openFile(file); (event.target as HTMLInputElement).value = ''; });
$('#start-menu').addEventListener('click', (event) => {
  const button = (event.target as Element).closest('button');
  if (!button) return;
  const view = button.getAttribute('data-view');
  if (view === 'main') { startMenuView = 'main'; renderStartMenu(); return; }
  if (view === 'all') { startMenuView = 'all'; renderStartMenu(); return; }
  const action = button.getAttribute('data-action');
  if (action === 'new') { startMenuView = 'new'; renderStartMenu(); return; }
  if (action === 'open') { $('#open-file').click(); return; }
  if (action === 'clear-recents') {
    if (!window.confirm('Clear all recent files? Files still open in tabs will be kept.')) return;
    const openKeys = new Set(openTabs.map((tab) => tab.recentKey).filter(Boolean));
    try {
      const kept = loadRecents().filter((entry) => openKeys.has(`${entry.kind}:${entry.name.toLowerCase()}`));
      localStorage.setItem(RECENTS_KEY, JSON.stringify(kept));
    } catch { /* ignore */ }
    renderStartMenu();
    setStatus('Recent files cleared. Files still open were kept.');
    return;
  }
  if (action === 'clear-workspace') {
    if (!window.confirm('Clear the workspace? All open tabs and recent files will be closed and removed.')) return;
    openTabs.length = 0;
    history = []; historyIndex = 0;
    selectedState = null; selectedTransition = null;
    stepperSession = null;
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
    openStartTab();
    setStatus('Workspace cleared.');
    return;
  }
  if (action === 'new-automaton') {
    const tab = activeTab();
    if (!tab || tab.kind !== 'start') return;
    tab.kind = 'automaton';
    tab.history = [cloneAutomaton(tab.machine)];
    tab.historyIndex = 0;
    history = tab.history; historyIndex = 0;
    const name = generateMachineName();
    setFilename(name);
    tab.recentKey = `automaton:${name.toLowerCase()}`;
    addRecent({ name, kind: 'automaton', data: JFFCodec.encode(machine) });
    render(); commitHistory(); updateHistoryButtons(); setStatus('New machine created.');
    return;
  }
  if (action === 'new-text') {
    const name = generateMachineName('txt');
    convertToTextTab(name, '');
    addRecent({ name, kind: 'text', data: '' });
    setStatus('New text file created.');
    return;
  }
  const index = button.getAttribute('data-index');
  if (index === null) return;
  const recent = loadRecents()[Number(index)];
  if (!recent) return;
  const key = `${recent.kind}:${recent.name.toLowerCase()}`;
  const existing = openTabs.find((tab) => tab.recentKey === key);
  if (existing) { activateTab(existing.id); return; }
  if (recent.kind === 'text') {
    convertToTextTab(recent.name, recent.data);
    const tab = activeTab();
    if (tab) tab.recentKey = key;
  } else {
    try {
      const structure = JFFCodec.decode(recent.data);
      if (!isMachineStructure(structure)) throw new Error('Not an automaton');
      applyLoadedMachine(structure, recent.name);
      const tab = activeTab();
      if (tab) tab.recentKey = key;
      setStatus(`Opened ${recent.name}.`, 'success');
    } catch { setStatus('That recent file could not be opened.', 'error'); }
  }
});
$('#new-machine').addEventListener('click', () => {
  const name = generateMachineName();
  openTab(makeMachine(($('#machine-type') as HTMLSelectElement).value as MachineType), name);
  const tab = activeTab();
  if (tab) tab.recentKey = `automaton:${name.toLowerCase()}`;
  addRecent({ name, kind: 'automaton', data: JFFCodec.encode(machine) });
  render(); commitHistory(); setStatus('New machine created.');
});
$('#load-example').addEventListener('click', (event) => { event.stopPropagation(); $('#example-menu').hidden = !$('#example-menu').hidden; });
$('#example-menu').addEventListener('click', (event) => {
  const button = (event.target as Element).closest('button[data-type]');
  if (!button) return;
  $('#example-menu').hidden = true;
  loadExample(button.getAttribute('data-type') as MachineType);
});
document.addEventListener('click', (event) => {
  const menu = $('#example-menu');
  if (!menu.hidden && !(event.target as Element).closest('.example-wrap')) menu.hidden = true;
});
$('#zoom-in').addEventListener('click', () => zoomAt(1.2));
$('#zoom-out').addEventListener('click', () => zoomAt(1 / 1.2));
$('#fit-canvas').addEventListener('click', () => {
  if (!machine.states.length) return;
  const xs = machine.states.map((state) => state.point.x); const ys = machine.states.map((state) => state.point.y);
  const minX = Math.min(...xs) - 120; const minY = Math.min(...ys) - 100;
  const width = Math.max(420, Math.max(...xs) - Math.min(...xs) + 240);
  const height = Math.max(320, Math.max(...ys) - Math.min(...ys) + 200);
  setCanvasView(minX, minY, width, height);
});
$('#clear-transitions').addEventListener('click', () => { for (const transition of [...machine.transitions]) machine.removeTransition(transition as never); render(); commitHistory(); setStatus('All transitions cleared.'); });
$('#undo-action').addEventListener('click', () => restoreHistory(historyIndex - 1));
$('#redo-action').addEventListener('click', () => restoreHistory(historyIndex + 1));
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
  if (event.code === 'Space' && !(target instanceof HTMLButtonElement)) { spacePanActive = true; event.preventDefault(); return; }
  if ((event.key === 'Backspace' || event.key === 'Delete') && selectedState) {
    event.preventDefault();
    const deletedName = selectedState.name;
    machine.removeState(selectedState);
    selectedState = null;
    moveModeState = null;
    render(); commitHistory(); setStatus(`Deleted ${deletedName} and its transitions.`);
    return;
  }
  if ((event.key === 'Backspace' || event.key === 'Delete') && selectedTransition) {
    event.preventDefault();
    const label = transitionLabel(selectedTransition);
    machine.removeTransition(selectedTransition as never);
    selectedTransition = null;
    render(); commitHistory(); setStatus(`Deleted transition ${label}.`);
    return;
  }
  if (event.key === 'Escape' && moveModeState) { moveModeState = null; moveModeEntryDrag = false; renderGraph(); setStatus('Move mode off.'); return; }
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  if (key === '+' || key === '=') { event.preventDefault(); zoomAt(1.2); return; }
  if (key === '-') { event.preventDefault(); zoomAt(1 / 1.2); return; }
  if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); restoreHistory(historyIndex + 1); }
  else if (key === 'z') { event.preventDefault(); restoreHistory(historyIndex - 1); }
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveJff(); }
});
document.addEventListener('keyup', (event) => { if (event.code === 'Space') spacePanActive = false; });
if (!restoreWorkspace()) {
  openStartTab();
}
updateGridBackground();
updateHistoryButtons();
applyPanelSizes();
window.addEventListener('beforeunload', persistWorkspace);
document.addEventListener('gesturestart', (event) => {
  if ((event.target as Element).closest('.canvas-shell')) event.preventDefault();
});
document.addEventListener('gesturechange', (event) => {
  if ((event.target as Element).closest('.canvas-shell')) event.preventDefault();
});
