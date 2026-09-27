import {
  Automaton,
  FiniteStateAutomaton,
  FSATransition,
  MealyMachine,
  MealyTransition,
  MooreMachine,
  MooreTransition,
  PDATransition,
  PushdownAutomaton,
  State,
  TMTransition,
  TuringMachine,
  Transition,
  VDGTransition,
  VariableDependencyGraph,
} from './model.js';
import { LAMBDA } from './simulators.js';

export function getLambdaClosure(automaton: Automaton, state: State): State[] {
  const result = new Set<State>([state]);
  const pending = [state];
  while (pending.length) {
    const current = pending.pop()!;
    for (const transition of automaton.getTransitionsFrom(current)) {
      const lambda = transition instanceof FSATransition || transition instanceof MealyTransition || transition instanceof MooreTransition
        ? LAMBDA.test(transition.label)
        : transition instanceof PDATransition
          ? LAMBDA.test(transition.input) && LAMBDA.test(transition.pop) && LAMBDA.test(transition.push)
          : false;
      if (lambda && !result.has(transition.to)) { result.add(transition.to); pending.push(transition.to); }
    }
  }
  return [...result];
}

export function getAlphabet(automaton: Automaton): string[] {
  const symbols: string[] = [];
  for (const transition of automaton.transitions) {
    const labels = transition instanceof FSATransition || transition instanceof MealyTransition || transition instanceof MooreTransition
      ? [transition.label]
      : transition instanceof PDATransition
        ? [transition.input]
        : transition instanceof TMTransition
          ? transition.reads
          : [];
    for (const label of labels) if (!LAMBDA.test(label) && !symbols.includes(label)) symbols.push(label);
  }
  return symbols;
}

function prefixOverlap(left: string, right: string): boolean { return left.startsWith(right) || right.startsWith(left); }
function transitionPairOverlaps(first: Transition, second: Transition): boolean {
  if ((first instanceof FSATransition && second instanceof FSATransition)
    || (first instanceof MealyTransition && second instanceof MealyTransition)
    || (first instanceof MooreTransition && second instanceof MooreTransition)) return prefixOverlap(first.label, second.label);
  if (first instanceof PDATransition && second instanceof PDATransition) return prefixOverlap(first.input, second.input) && prefixOverlap(first.pop, second.pop);
  if (first instanceof TMTransition && second instanceof TMTransition) {
    return first.reads.every((a, index) => {
      const b = second.reads[index] ?? '';
      return a === '~' || b === '~' || a === b || a.startsWith('!') && a.slice(1) !== b || b.startsWith('!') && b.slice(1) !== a;
    });
  }
  return false;
}

export function getNondeterministicStates(automaton: Automaton): State[] {
  return automaton.states.filter((state) => {
    const transitions = automaton.getTransitionsFrom(state);
    for (let left = 0; left < transitions.length; left++) for (let right = left + 1; right < transitions.length; right++) {
      if (transitionPairOverlaps(transitions[left]!, transitions[right]!)) return true;
    }
    return false;
  });
}

export function isNFA(automaton: Automaton): boolean { return automaton instanceof FiniteStateAutomaton && getNondeterministicStates(automaton).length > 0; }

export function getUnreachableStates(automaton: Automaton): State[] {
  const reachable = new Set<State>();
  if (automaton.initialState) {
    const pending = [automaton.initialState]; reachable.add(automaton.initialState);
    while (pending.length) for (const transition of automaton.getTransitionsFrom(pending.pop()!)) {
      if (!reachable.has(transition.to)) { reachable.add(transition.to); pending.push(transition.to); }
    }
  }
  return automaton.states.filter((state) => !reachable.has(state));
}

export function getUselessStates(automaton: Automaton): Set<State> {
  if (!automaton.initialState) throw new TypeError('Automaton has no initial state.');
  const reachable = new Set(automaton.states.filter((state) => !getUnreachableStates(automaton).includes(state)));
  const coReachable = new Set(automaton.finalStates);
  const pending = [...coReachable];
  while (pending.length) {
    const state = pending.pop()!;
    for (const transition of automaton.getTransitionsTo(state)) if (!coReachable.has(transition.from)) { coReachable.add(transition.from); pending.push(transition.from); }
  }
  return new Set(automaton.states.filter((state) => !reachable.has(state) || !coReachable.has(state)));
}

export function cloneAutomaton<T extends Automaton>(source: T): T {
  let clone: Automaton;
  if (source instanceof FiniteStateAutomaton) clone = new FiniteStateAutomaton();
  else if (source instanceof PushdownAutomaton) clone = new PushdownAutomaton(source.singleInput, source.acceptanceMode);
  else if (source instanceof TuringMachine) clone = new TuringMachine(source.tapeCount, source.acceptanceMode);
  else if (source instanceof MealyMachine) clone = new MealyMachine();
  else if (source instanceof MooreMachine) clone = new MooreMachine();
  else if (source instanceof VariableDependencyGraph) clone = new VariableDependencyGraph();
  else throw new TypeError('Unsupported automaton type.');
  const states = new Map<State, State>();
  for (const state of source.states) {
    const copy = clone.createState(state.point, state.id);
    copy.name = state.name;
    if (state.label !== undefined) copy.label = state.label;
    if (state.output !== undefined) copy.output = state.output;
    states.set(state, copy);
  }
  if (source.initialState) clone.setInitialState(states.get(source.initialState)!);
  for (const state of source.finalStates) clone.addFinalState(states.get(state)!);
  for (const transition of source.transitions) {
    let copy: Transition;
    const from = states.get(transition.from)!; const to = states.get(transition.to)!;
    if (transition instanceof FSATransition) copy = new FSATransition(from, to, transition.label);
    else if (transition instanceof MooreTransition) copy = new MooreTransition(from, to, transition.label, transition.output);
    else if (transition instanceof MealyTransition) copy = new MealyTransition(from, to, transition.label, transition.output);
    else if (transition instanceof PDATransition) copy = new PDATransition(from, to, transition.input, transition.pop, transition.push);
    else if (transition instanceof TMTransition) copy = new TMTransition(from, to, transition.reads, transition.writes, transition.directions);
    else if (transition instanceof VDGTransition) copy = new VDGTransition(from, to);
    else throw new TypeError('Unsupported transition type.');
    if (transition.control) copy.control = { ...transition.control };
    clone.addTransition(copy as never);
  }
  clone.notes.push(...source.notes.map((note) => ({ text: note.text, point: { ...note.point } })));
  return clone as T;
}

export function cleanAutomaton<T extends Automaton>(automaton: T): T {
  const copy = cloneAutomaton(automaton);
  const useless = getUselessStates(copy);
  for (const state of [...useless]) if (state !== copy.initialState) copy.removeState(state);
  if (copy.initialState && useless.has(copy.initialState)) for (const transition of [...copy.transitions]) copy.removeTransition(transition as never);
  return copy;
}

export function renameStates(automaton: Automaton): void {
  const available = new Set(Array.from({ length: automaton.states.length }, (_, index) => index));
  const reassign = new Set(automaton.states);
  for (const state of automaton.states) if (available.delete(state.id)) reassign.delete(state);
  const ids = [...available].sort((a, b) => a - b);
  [...reassign].forEach((state, index) => { state.id = ids[index]!; });
  automaton.states.sort((a, b) => a.id - b.id);
}

export function isAlphanumeric(value: string): boolean { return /^[\p{L}\p{N}]*$/u.test(value); }

export class ClosureTaker {
  static getClosure(state: State, automaton: Automaton): State[] { return getLambdaClosure(automaton, state); }
}
export class UnreachableStatesDetector {
  constructor(readonly automaton: Automaton) {}
  getUnreachableStates(): State[] { return getUnreachableStates(this.automaton); }
}
export class UselessStatesDetector {
  static getUselessStates(automaton: Automaton): Set<State> { return getUselessStates(automaton); }
  static cleanAutomaton<T extends Automaton>(automaton: T): T { return cleanAutomaton(automaton); }
}
export class AutomatonChecker { isNFA(automaton: Automaton): boolean { return isNFA(automaton); } }
export class AlphabetRetriever { getAlphabet(automaton: Automaton): string[] { return getAlphabet(automaton); } }
export class FSAAlphabetRetriever extends AlphabetRetriever {}
export class FSANondeterminismDetector {
  areNondeterministic(first: Transition, second: Transition): boolean { return transitionPairOverlaps(first, second); }
  getNondeterministicStates(automaton: Automaton): State[] { return getNondeterministicStates(automaton); }
}
export class PDANondeterminismDetector extends FSANondeterminismDetector {
  override areNondeterministic(first: Transition, second: Transition): boolean {
    return first instanceof PDATransition && second instanceof PDATransition
      && prefixOverlap(first.input, second.input) && prefixOverlap(first.pop, second.pop);
  }
}
export class TMNondeterminismDetector extends FSANondeterminismDetector {}
export class NondeterminismDetectorFactory {
  static getNondeterminismDetector(automaton: Automaton): FSANondeterminismDetector {
    if (automaton instanceof PushdownAutomaton) return new PDANondeterminismDetector();
    if (automaton instanceof TuringMachine) return new TMNondeterminismDetector();
    return new FSANondeterminismDetector();
  }
}
export class LambdaCheckerFactory {
  static isLambdaTransition(transition: Transition): boolean {
    if (transition instanceof FSATransition || transition instanceof MealyTransition || transition instanceof MooreTransition) return LAMBDA.test(transition.label);
    if (transition instanceof PDATransition) return LAMBDA.test(transition.input) && LAMBDA.test(transition.pop) && LAMBDA.test(transition.push);
    return false;
  }
}
