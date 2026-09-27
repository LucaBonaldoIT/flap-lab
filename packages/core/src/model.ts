export type Point = { x: number; y: number };
export type AutomatonKind = 'fa' | 'pda' | 'turing' | 'mealy' | 'moore' | 'vdg';
export type StateChange = 'add' | 'remove' | 'initial' | 'final' | 'update';
export type AutomatonListener = (change: StateChange, state: State) => void;

export class State {
  id: number;
  point: Point;
  name: string;
  label?: string;
  output?: string;

  constructor(id: number, point: Point = { x: 0, y: 0 }, name = `q${id}`) {
    this.id = id;
    this.point = { ...point };
    this.name = name;
  }
}

export abstract class Transition {
  control?: Point;

  protected constructor(public from: State, public to: State) {}
  abstract readonly kind: AutomatonKind;
  abstract toJSON(): Record<string, unknown>;
}

export class FSATransition extends Transition {
  readonly kind = 'fa' as const;
  constructor(from: State, to: State, public label = '') { super(from, to); }
  override toJSON(): Record<string, unknown> {
    return { kind: this.kind, from: this.from.id, to: this.to.id, label: this.label };
  }
}

export class MealyTransition extends Transition {
  readonly kind: AutomatonKind = 'mealy';
  constructor(from: State, to: State, public label = '', private transitionOutput = '') { super(from, to); }
  get output(): string { return this.transitionOutput; }
  setOutput(output: string): void { this.transitionOutput = output; }
  override toJSON(): Record<string, unknown> {
    return { kind: this.kind, from: this.from.id, to: this.to.id, label: this.label, output: this.output };
  }
}

export class MooreTransition extends MealyTransition {
  override readonly kind: AutomatonKind = 'moore';
  constructor(from: State, to: State, label = '', output = '') {
    super(from, to, label, output);
    to.output = output;
  }
  override get output(): string { return this.to.output ?? ''; }
  override setOutput(output: string): void { this.to.output = output; }
  override toJSON(): Record<string, unknown> {
    return { kind: this.kind, from: this.from.id, to: this.to.id, label: this.label, output: this.output };
  }
}

export class PDATransition extends Transition {
  readonly kind = 'pda' as const;
  constructor(
    from: State,
    to: State,
    public input = '',
    public pop = '',
    public push = '',
  ) { super(from, to); }
  override toJSON(): Record<string, unknown> {
    return { kind: this.kind, from: this.from.id, to: this.to.id, input: this.input, pop: this.pop, push: this.push };
  }
}

export type TuringDirection = 'L' | 'R' | 'S';

export class TMTransition extends Transition {
  readonly kind = 'turing' as const;
  readonly reads: string[];
  readonly writes: string[];
  readonly directions: TuringDirection[];

  constructor(
    from: State,
    to: State,
    reads: string | string[],
    writes: string | string[],
    directions: TuringDirection | TuringDirection[],
  ) {
    super(from, to);
    this.reads = (Array.isArray(reads) ? reads : [reads]).map((v) => v || ' ');
    this.writes = (Array.isArray(writes) ? writes : [writes]).map((v) => v || ' ');
    this.directions = Array.isArray(directions) ? [...directions] : [directions];
    if (!this.reads.length || this.reads.length !== this.writes.length || this.reads.length !== this.directions.length) {
      throw new TypeError('Turing transition read, write, and direction arrays must have equal non-zero lengths.');
    }
    if (this.directions.some((direction) => !['L', 'R', 'S'].includes(direction))) {
      throw new TypeError('Turing directions must be L, R, or S.');
    }
  }

  get tapes(): number { return this.reads.length; }
  override toJSON(): Record<string, unknown> {
    return { kind: this.kind, from: this.from.id, to: this.to.id, reads: this.reads, writes: this.writes, directions: this.directions };
  }
}

export class VDGTransition extends Transition {
  readonly kind = 'vdg' as const;
  constructor(from: State, to: State) { super(from, to); }
  override toJSON(): Record<string, unknown> { return { kind: this.kind, from: this.from.id, to: this.to.id }; }
}

export abstract class Automaton<T extends Transition = Transition> {
  readonly states: State[] = [];
  readonly transitions: T[] = [];
  readonly finalStates = new Set<State>();
  initialState: State | null = null;
  readonly notes: Array<{ text: string; point: Point }> = [];
  protected readonly listeners = new Set<AutomatonListener>();

  abstract readonly kind: AutomatonKind;

  createState(point: Point = { x: 0, y: 0}, id?: number): State {
    const stateId = id ?? this.nextStateId();
    if (this.getState(stateId)) throw new RangeError(`State id ${stateId} already exists.`);
    const state = new State(stateId, point);
    this.states.push(state);
    this.states.sort((a, b) => a.id - b.id);
    this.emit('add', state);
    return state;
  }

  addState(state: State): State {
    if (this.getState(state.id)) throw new RangeError(`State id ${state.id} already exists.`);
    this.states.push(state);
    this.states.sort((a, b) => a.id - b.id);
    this.emit('add', state);
    return state;
  }

  removeState(state: State): void {
    if (!this.states.includes(state)) return;
    for (const transition of [...this.transitions]) {
      if (transition.from === state || transition.to === state) this.removeTransition(transition);
    }
    this.states.splice(this.states.indexOf(state), 1);
    this.finalStates.delete(state);
    if (this.initialState === state) this.initialState = null;
    this.emit('remove', state);
  }

  getState(id: number): State | undefined { return this.states.find((state) => state.id === id); }

  setInitialState(state: State | null): void {
    this.assertMember(state);
    this.initialState = state;
    if (state) this.emit('initial', state);
  }

  addFinalState(state: State): void {
    this.assertMember(state);
    this.finalStates.add(state);
    this.emit('final', state);
  }

  removeFinalState(state: State): void {
    this.finalStates.delete(state);
    this.emit('final', state);
  }

  isFinalState(state: State): boolean { return this.finalStates.has(state); }

  getTransitionsFrom(state: State): T[] { return this.transitions.filter((transition) => transition.from === state); }
  getTransitionsTo(state: State): T[] { return this.transitions.filter((transition) => transition.to === state); }

  addTransition(transition: T): T {
    this.assertMember(transition.from);
    this.assertMember(transition.to);
    if (transition.kind !== this.kind) throw new TypeError(`Cannot add ${transition.kind} transition to ${this.kind} automaton.`);
    if (!this.transitions.some((item) => JSON.stringify(item.toJSON()) === JSON.stringify(transition.toJSON()))) {
      this.transitions.push(transition);
    }
    return transition;
  }

  removeTransition(transition: T): void {
    const index = this.transitions.indexOf(transition);
    if (index >= 0) this.transitions.splice(index, 1);
  }

  onChange(listener: AutomatonListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  abstract toJSON(): Record<string, unknown>;

  protected assertMember(state: State | null): void {
    if (state && !this.states.includes(state)) throw new TypeError('State does not belong to this automaton.');
  }
  private nextStateId(): number {
    let id = 0;
    while (this.getState(id)) id++;
    return id;
  }
  private emit(change: StateChange, state: State): void {
    for (const listener of this.listeners) listener(change, state);
  }
}

export class FiniteStateAutomaton extends Automaton<FSATransition> {
  readonly kind = 'fa' as const;
  transition(from: State, to: State, label = ''): FSATransition { return this.addTransition(new FSATransition(from, to, label)); }
  override toJSON(): Record<string, unknown> {
    return { type: this.kind, states: this.states, initialState: this.initialState?.id ?? null, finalStates: [...this.finalStates].map((state) => state.id), transitions: this.transitions.map((transition) => transition.toJSON()) };
  }
}

export class MealyMachine extends Automaton<MealyTransition> {
  readonly kind = 'mealy' as const;
  transition(from: State, to: State, label = '', output = ''): MealyTransition {
    return this.addTransition(new MealyTransition(from, to, label, output));
  }
  override toJSON(): Record<string, unknown> {
    return { type: this.kind, states: this.states, initialState: this.initialState?.id ?? null, transitions: this.transitions.map((transition) => transition.toJSON()) };
  }
}

export class MooreMachine extends Automaton<MooreTransition> {
  readonly kind = 'moore' as const;
  setOutput(state: State, output: string): void { this.assertMember(state); state.output = output; }
  getOutput(state: State): string { return state.output ?? ''; }
  transition(from: State, to: State, label = '', output = to.output ?? ''): MooreTransition {
    return this.addTransition(new MooreTransition(from, to, label, output));
  }
  override toJSON(): Record<string, unknown> {
    return { type: this.kind, states: this.states, initialState: this.initialState?.id ?? null, transitions: this.transitions.map((transition) => transition.toJSON()) };
  }
}

export class PushdownAutomaton extends Automaton<PDATransition> {
  readonly kind = 'pda' as const;
  constructor(public singleInput = false, public acceptanceMode: 'final-state' | 'empty-stack' | 'either' = 'final-state') { super(); }
  transition(from: State, to: State, input = '', pop = '', push = ''): PDATransition {
    if (this.singleInput && (Array.from(pop).length > 1 || Array.from(push).length > 1)) {
      throw new TypeError('Single-input PDA stack operations must each use at most one symbol.');
    }
    return this.addTransition(new PDATransition(from, to, input, pop, push));
  }
  override toJSON(): Record<string, unknown> {
    return { type: this.kind, singleInput: this.singleInput, states: this.states, initialState: this.initialState?.id ?? null, finalStates: [...this.finalStates].map((state) => state.id), transitions: this.transitions.map((transition) => transition.toJSON()) };
  }
}

export class TuringMachine extends Automaton<TMTransition> {
  readonly kind = 'turing' as const;
  constructor(public tapeCount = 1, public acceptanceMode: 'final-state' | 'halting' | 'either' = 'final-state') {
    super();
    if (!Number.isInteger(tapeCount) || tapeCount < 1) throw new RangeError('A Turing machine needs at least one tape.');
  }
  transition(from: State, to: State, reads: string | string[], writes: string | string[], directions: TuringDirection | TuringDirection[]): TMTransition {
    const transition = new TMTransition(from, to, reads, writes, directions);
    if (transition.tapes !== this.tapeCount) throw new TypeError(`Transition has ${transition.tapes} tapes; machine has ${this.tapeCount}.`);
    return this.addTransition(transition);
  }
  override toJSON(): Record<string, unknown> {
    return { type: this.kind, tapeCount: this.tapeCount, states: this.states, initialState: this.initialState?.id ?? null, finalStates: [...this.finalStates].map((state) => state.id), transitions: this.transitions.map((transition) => transition.toJSON()) };
  }
}

export class VariableDependencyGraph extends Automaton<VDGTransition> {
  readonly kind = 'vdg' as const;
  transition(from: State, to: State): VDGTransition { return this.addTransition(new VDGTransition(from, to)); }
  override toJSON(): Record<string, unknown> { return { type: this.kind, states: this.states, initialState: this.initialState?.id ?? null, transitions: this.transitions.map((transition) => transition.toJSON()) }; }
}
