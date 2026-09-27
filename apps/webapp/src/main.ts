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
      <label class="button button-quiet file-button" for="open-file">Open .jff<input id="open-file" type="file" accept=".jff,.xml" /></label>
      <button class="button button-primary" id="save-file"><span class="button-icon">↧</span> Export .jff</button>
    </div>
  </header>

  <main class="workspace">
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
          <button class="button button-small" id="load-example" title="Load an example automaton">Example</button>
        </div>
      </div>
      <div class="canvas-shell" id="canvas-shell">
        <svg id="automaton-canvas" viewBox="0 0 1000 640" role="img" aria-label="Pannable automaton editing canvas" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#6f665c" /></marker>
            <marker id="arrowhead-selected" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#b02e0c" /></marker>
            <marker id="start-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 z" fill="#b02e0c" /></marker>
          </defs>
          <g id="graph-layer"></g>
        </svg>
        <div class="canvas-empty" id="canvas-empty"><div class="empty-orbit">◎</div><strong>Your canvas is ready</strong><span>Add a state or load an example machine.</span></div>
        <div class="canvas-coordinates" id="canvas-coordinates">0 states · 0 transitions</div>
      </div>
      <section class="transition-panel">
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

      <section class="tool-section simulator-section">
        <div class="section-heading"><span>SIMULATE INPUT</span><span class="tool-number">02</span></div>
        <label class="field-label" for="input-string">Input string</label>
        <div class="input-with-action"><input id="input-string" type="text" placeholder="Type input…" autocomplete="off" /><button id="run-machine" class="run-button" title="Run simulation">▶</button></div>
        <div class="simulator-options" id="simulator-options"></div>
        <div class="simulation-result" id="simulation-result"><div class="result-placeholder"><span class="result-pulse"></span>Awaiting input</div></div>
      </section>

      <div class="right-sidebar-footer"><span class="license-links"><a href="./LICENSE-JFLAP" target="_blank" rel="noreferrer">License</a><a href="https://github.com/LucaBonaldoIT/flap-lab/issues" target="_blank" rel="noreferrer">Contact</a></span></div>
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
  filename: string;
  machine: Machine;
  selectedState: State | null;
  selectedTransition: Transition | null;
  history: Machine[];
  historyIndex: number;
  viewBox: { x: number; y: number; width: number; height: number } | null;
}

const openTabs: OpenTab[] = [];
let history: Machine[] = [];
let historyIndex = 0;
let canvasPan: { pointerId: number; clientX: number; clientY: number; viewX: number; viewY: number; moved: boolean } | null = null;
let spacePanActive = false;
let currentFilename = 'Untitled machine';

const NAME_ADJECTIVES = ['Amber', 'Basalt', 'Bristling', 'Cobalt', 'Crystal', 'Dusk', 'Ember', 'Feral', 'Gilded', 'Hollow', 'Ivory', 'Juniper', 'Lattice', 'Misty', 'Nimbus', 'Oaken', 'Prism', 'Quartz', 'Rustic', 'Silent', 'Tidal', 'Umber', 'Velvet', 'Willow'];
const NAME_NOUNS = ['Automaton', 'Basin', 'Beacon', 'Cipher', 'Compass', 'Cyclone', 'Engine', 'Falcon', 'Furnace', 'Garden', 'Generator', 'Harbor', 'Junction', 'Lantern', 'Loom', 'Machine', 'Maze', 'Orchard', 'Prism', 'Relay', 'Spiral', 'Spire', 'Vortex', 'Weaver'];

function generateMachineName(): string {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
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

function storeActiveTab(): void {
  const tab = activeTab();
  if (!tab) return;
  tab.machine = machine; tab.selectedState = selectedState; tab.selectedTransition = selectedTransition;
  tab.history = history; tab.historyIndex = historyIndex;
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
    const inputField = document.getElementById('input-string') as HTMLInputElement | null;
    const tabs = openTabs.map((tab) => {
      const item: Record<string, unknown> = { id: tab.id, filename: tab.filename, jff: JFFCodec.encode(tab.machine), viewBox: tab.viewBox };
      if (tab.machine instanceof PushdownAutomaton) { item.acceptanceMode = tab.machine.acceptanceMode; item.singleInput = tab.machine.singleInput; }
      else if (tab.machine instanceof TuringMachine) item.acceptanceMode = tab.machine.acceptanceMode;
      return item;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, activeTabId, nextTab: tabCounter, input: inputField?.value ?? '', tabs }));
  } catch {
    // Storage unavailable or full — session continues without persistence.
  }
}

function restoreWorkspace(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as { activeTabId?: string; nextTab?: number; input?: string; tabs?: Array<Record<string, unknown>> };
    if (!Array.isArray(payload.tabs)) return false;
    for (const item of payload.tabs) {
      if (!item || typeof item.jff !== 'string' || typeof item.filename !== 'string' || typeof item.id !== 'string') continue;
      try {
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
        if (item.viewBox && typeof item.viewBox === 'object') {
          const view = item.viewBox as { x: number; y: number; width: number; height: number };
          if ([view.x, view.y, view.width, view.height].every((value) => typeof value === 'number')) activeTab()!.viewBox = view;
        }
      } catch { continue; }
    }
    if (!openTabs.length) return false;
    const storedActive = typeof payload.activeTabId === 'string' && openTabs.some((tab) => tab.id === payload.activeTabId) ? payload.activeTabId : openTabs.at(-1)!.id;
    activeTabId = '';
    activateTab(storedActive);
    if (Number.isFinite(payload.nextTab)) tabCounter = Math.max(tabCounter, Number(payload.nextTab));
    const inputField = document.getElementById('input-string') as HTMLInputElement | null;
    if (inputField && typeof payload.input === 'string') inputField.value = payload.input;
    return true;
  } catch { return false; }
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
  $('#add-state').classList.remove('is-active'); $('#canvas-shell').classList.remove('is-adding');
  if (target.viewBox) setCanvasView(target.viewBox.x, target.viewBox.y, target.viewBox.width, target.viewBox.height);
  renderTabs(); render(); updateHistoryButtons();
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
  plus.className = 'tab-new'; plus.type = 'button'; plus.title = 'New machine'; plus.textContent = '＋';
  plus.addEventListener('click', () => { $('#new-machine').click(); });
  region.append(plus);
}

function beginRename(): void {
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
  if (openTabs.length <= 1) return;
  const index = openTabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
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
    filename,
    machine: machineInstance,
    selectedState: null,
    selectedTransition: null,
    history: [],
    historyIndex: 0,
    viewBox: null,
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
  renderTabs();
  scheduleSave();
}

function applyLoadedMachine(machineInstance: Machine, filename: string): void {
  storeActiveTab();
  machine = machineInstance;
  selectedState = null; selectedTransition = null;
  setFilename(filename);
  renderTabs(); render(); commitHistory(); updateHistoryButtons();
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
  for (const state of machine.states) renderState(state);
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
  path.setAttribute('marker-end', groupIsSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)');
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
  label.textContent = groupedTransitions.map(transitionLabel).join(', ');
  label.addEventListener('click', (event) => { event.stopPropagation(); selectTransition(selectionTarget); });
  graphLayer.append(label);
}

function renderState(state: State): void {
  const group = svgElement('g');
  group.classList.add('state-node');
  if (selectedState === state) group.classList.add('is-selected');
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
      fields.innerHTML = `<div class="muted-hint">${escapeHtml(selectedTransition.from.name)} → ${escapeHtml(selectedTransition.to.name)}<br /><br />${escapeHtml(transitionLabel(selectedTransition))}<br /><br />Press Backspace or Delete to remove this transition.</div>`;
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
  if (selectedTransition instanceof FSATransition) fields.innerHTML = fieldMarkup('Read', 'edit-edge-label', 'a', selectedTransition.label, 'Leave blank for a lambda transition.');
  else if (selectedTransition instanceof PDATransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-input', 'a', selectedTransition.input)}${fieldMarkup('Pop', 'edit-edge-pop', 'Z', selectedTransition.pop)}${fieldMarkup('Push', 'edit-edge-push', 'AZ', selectedTransition.push)}`;
  else if (selectedTransition instanceof TMTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-read', 'a | □', selectedTransition.reads.map((symbol) => symbol === ' ' ? '□' : symbol).join(' | '))}${fieldMarkup('Write', 'edit-edge-write', 'b | □', selectedTransition.writes.map((symbol) => symbol === ' ' ? '□' : symbol).join(' | '))}${fieldMarkup('Move', 'edit-edge-move', 'R | S', selectedTransition.directions.join(' | '))}`;
  else if (selectedTransition instanceof MooreTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-label', 'a', selectedTransition.label)}${fieldMarkup('Target state output', 'edit-edge-output', 'x', selectedTransition.output)}`;
  else if (selectedTransition instanceof MealyTransition) fields.innerHTML = `${fieldMarkup('Read', 'edit-edge-label', 'a', selectedTransition.label)}${fieldMarkup('Output', 'edit-edge-output', 'x', selectedTransition.output)}`;
  fields.insertAdjacentHTML('beforeend', '<button class="button button-add-transition" id="apply-edge-edit" type="button">Apply transition</button>');
  $('#apply-edge-edit').addEventListener('click', applySelectedTransitionEdit);
}

function applySelectedTransitionEdit(): void {
  const transition = selectedTransition;
  if (!transition) return;
  const value = (id: string): string => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
  const lambda = (input: string): string => /^(λ|Λ|ε)$/u.test(input) ? '' : input;
  try {
    if (transition instanceof FSATransition) transition.label = lambda(value('edit-edge-label'));
    else if (transition instanceof PDATransition) {
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
      transition.label = lambda(value('edit-edge-label'));
      if (machine instanceof MooreMachine) machine.setOutput(transition.to, lambda(value('edit-edge-output')));
    } else if (transition instanceof MealyTransition) {
      transition.label = lambda(value('edit-edge-label'));
      transition.setOutput(lambda(value('edit-edge-output')));
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

function render(): void {
  renderStateSelectors(); renderTransitionFields(); renderSimulatorOptions(); renderMachineSettings(); renderStateList(); renderStateEditor(); renderSelectedTransitionEditor(); renderTransitions(); renderGraph();
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

function runSimulation(): void {
  const input = ($('#input-string') as HTMLInputElement).value;
  const result = $('#simulation-result');
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
  result.className = `simulation-result ${success ? 'result-success' : 'result-failure'}`;
  result.innerHTML = `<div class="result-state"><span class="result-symbol">${success ? '✓' : '×'}</span><span>${escapeHtml(title)}</span></div><div class="result-detail">${escapeHtml(detail)}</div>`;
  setStatus(title, success ? 'success' : 'error');
}

function loadExample(): void {
  const example = new FiniteStateAutomaton();
  const q0 = example.createState({ x: 280, y: 300 }); q0.name = 'q0';
  const q1 = example.createState({ x: 500, y: 300 }); q1.name = 'q1';
  const q2 = example.createState({ x: 720, y: 300 }); q2.name = 'q2';
  example.setInitialState(q0); example.addFinalState(q2);
  example.transition(q0, q0, 'a'); example.transition(q0, q1, 'b'); example.transition(q1, q2, 'c');
  applyLoadedMachine(example, 'example.jff');
  render(); commitHistory(); setStatus('Loaded example: aⁿbc.'); showToast('Example automaton loaded');
}

function openJff(file: File): void {
  file.text().then((contents) => {
    const structure = JFFCodec.decode(contents);
    if (!(structure instanceof FiniteStateAutomaton || structure instanceof PushdownAutomaton || structure instanceof TuringMachine || structure instanceof MealyMachine || structure instanceof MooreMachine)) {
      throw new Error('This structure is valid JFLAP data but is not an automaton.');
    }
    applyLoadedMachine(structure, file.name);
    setStatus(`Opened ${file.name}.`, 'success'); showToast('JFLAP file opened');
  }).catch((error: unknown) => { setStatus(error instanceof Error ? error.message : 'Could not open file.', 'error'); showToast('Could not open that .jff file'); });
}

function saveJff(): void {
  try {
    const text = JFFCodec.encode(machine);
    const blob = new Blob([text], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    const base = currentFilename.replace(/\.(jff|xml)$/iu, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').trim();
    link.download = `${!base || base === 'Untitled machine' ? 'automaton' : base}.jff`;
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
  if (!shouldPan) return;
  event.preventDefault(); event.stopPropagation();
  const view = svg.viewBox.baseVal;
  canvasPan = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
  svg.classList.add('is-panning');
  svg.setPointerCapture(event.pointerId);
}, true);
$('#automaton-canvas').addEventListener('click', (event) => {
  if (suppressCanvasClick) { suppressCanvasClick = false; event.preventDefault(); return; }
  const target = event.target as Element;
  if (target.closest('.state-node, .edge-path, .edge-label')) return;
  if (moveModeState) { moveModeState = null; selectTransition(null); return; }
  addState(eventToCanvas(event));
  if (addStateMode) { $('#add-state').classList.remove('is-active'); $('#canvas-shell').classList.remove('is-adding'); }
});
document.addEventListener('pointermove', (event) => {
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
$('#run-machine').addEventListener('click', runSimulation);
$('#input-string').addEventListener('keydown', (event) => { if (event.key === 'Enter') runSimulation(); });
$('#input-string').addEventListener('input', scheduleSave);
$('#save-file').addEventListener('click', saveJff);
$('#open-file').addEventListener('change', (event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) openJff(file); (event.target as HTMLInputElement).value = ''; });
$('#new-machine').addEventListener('click', () => { openTab(makeMachine(($('#machine-type') as HTMLSelectElement).value as MachineType), generateMachineName()); render(); commitHistory(); setStatus('New machine created.'); });
$('#load-example').addEventListener('click', loadExample);
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
document.addEventListener('keyup', (event) => { if (event.code === 'Space') spacePanActive = false; });
if (!restoreWorkspace()) {
  openTab(new FiniteStateAutomaton(), generateMachineName());
  render();
  commitHistory();
}
updateGridBackground();
updateHistoryButtons();
window.addEventListener('beforeunload', persistWorkspace);
