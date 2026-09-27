import { FiniteStateAutomaton, State } from './model.js';
import { LAMBDA } from './simulators.js';

function epsilonClosure(automaton: FiniteStateAutomaton, states: Iterable<State>): Set<State> {
  const closure = new Set(states);
  const pending = [...closure];
  while (pending.length) {
    const state = pending.pop()!;
    for (const transition of automaton.getTransitionsFrom(state)) {
      if (LAMBDA.test(transition.label) && !closure.has(transition.to)) {
        closure.add(transition.to);
        pending.push(transition.to);
      }
    }
  }
  return closure;
}

function subsetKey(states: Iterable<State>): string {
  return [...states].map((state) => state.id).sort((a, b) => a - b).join(',');
}

function alphabetOf(automaton: FiniteStateAutomaton): string[] {
  return [...new Set(automaton.transitions.map(({ label }) => label).filter((label) => !LAMBDA.test(label)))].sort();
}

/** Converts an NFA (including lambda moves) to an equivalent DFA by subset construction. */
export function determinize(source: FiniteStateAutomaton): FiniteStateAutomaton {
  const result = new FiniteStateAutomaton();
  if (!source.initialState) return result;
  const alphabet = alphabetOf(source);
  const initial = epsilonClosure(source, [source.initialState]);
  const subsets = new Map<string, { members: Set<State>; state: State }>();
  const pending: string[] = [];

  const createSubset = (members: Set<State>): { members: Set<State>; state: State } => {
    const key = subsetKey(members);
    const existing = subsets.get(key);
    if (existing) return existing;
    const state = result.createState();
    state.name = `{${[...members].map((item) => item.name).sort().join(', ')}}`;
    if ([...members].some((item) => source.isFinalState(item))) result.addFinalState(state);
    const subset = { members, state };
    subsets.set(key, subset);
    pending.push(key);
    return subset;
  };

  const start = createSubset(initial);
  result.setInitialState(start.state);
  while (pending.length) {
    const key = pending.shift()!;
    const subset = subsets.get(key)!;
    for (const symbol of alphabet) {
      const destinations = new Set<State>();
      for (const state of subset.members) {
        for (const transition of source.getTransitionsFrom(state)) {
          if (transition.label === symbol) destinations.add(transition.to);
        }
      }
      if (!destinations.size) continue;
      const target = createSubset(epsilonClosure(source, destinations));
      result.transition(subset.state, target.state, symbol);
    }
  }
  return result;
}

function deterministicTransition(automaton: FiniteStateAutomaton, state: State, symbol: string): State | undefined {
  return automaton.getTransitionsFrom(state).find((transition) => transition.label === symbol)?.to;
}

function assertDeterministic(automaton: FiniteStateAutomaton): void {
  for (const state of automaton.states) {
    const seen = new Map<string, State>();
    for (const transition of automaton.getTransitionsFrom(state)) {
      if (LAMBDA.test(transition.label)) throw new TypeError('Expected a DFA, but found a lambda transition.');
      const previous = seen.get(transition.label);
      if (previous && previous !== transition.to) throw new TypeError('Expected a DFA, but found nondeterministic transitions.');
      seen.set(transition.label, transition.to);
    }
  }
}

/** Minimizes a deterministic finite automaton; missing edges are treated as a rejecting sink. */
export function minimize(source: FiniteStateAutomaton): FiniteStateAutomaton {
  assertDeterministic(source);
  const dfa = determinize(source);
  const result = new FiniteStateAutomaton();
  if (!dfa.initialState) return result;
  const alphabet = alphabetOf(dfa);
  const sink = Symbol('sink');
  const all: Array<State | typeof sink> = [...dfa.states];
  if (dfa.states.some((state) => alphabet.some((symbol) => !deterministicTransition(dfa, state, symbol)))) all.push(sink);
  const accepting = new Set<State | typeof sink>(dfa.finalStates);
  let partitions: Array<Set<State | typeof sink>> = [];
  const finals = new Set(all.filter((state) => accepting.has(state)));
  const nonfinals = new Set(all.filter((state) => !accepting.has(state)));
  if (finals.size) partitions.push(finals);
  if (nonfinals.size) partitions.push(nonfinals);

  const partitionIndex = (state: State | typeof sink, groups: Array<Set<State | typeof sink>>): number => groups.findIndex((group) => group.has(state));
  const targetFor = (state: State | typeof sink, symbol: string): State | typeof sink => {
    if (state === sink) return sink;
    return deterministicTransition(dfa, state, symbol) ?? sink;
  };
  let changed = true;
  while (changed) {
    changed = false;
    const refined: Array<Set<State | typeof sink>> = [];
    for (const group of partitions) {
      const buckets = new Map<string, Set<State | typeof sink>>();
      for (const state of group) {
        const signature = alphabet.map((symbol) => partitionIndex(targetFor(state, symbol), partitions)).join(',');
        const bucket = buckets.get(signature) ?? new Set<State | typeof sink>();
        bucket.add(state);
        buckets.set(signature, bucket);
      }
      refined.push(...buckets.values());
      if (buckets.size > 1) changed = true;
    }
    partitions = refined;
  }

  const groups = new Map<number, State>();
  partitions.forEach((partition, index) => {
    const sourceStates = [...partition].filter((state): state is State => state !== sink);
    const point = sourceStates.length ? sourceStates[0]!.point : { x: 0, y: 0 };
    const state = result.createState(point);
    state.name = `{${sourceStates.map((item) => item.name).join(', ') || '∅'}}`;
    if ([...partition].some((item) => accepting.has(item))) result.addFinalState(state);
    groups.set(index, state);
  });
  const startPartition = partitionIndex(dfa.initialState, partitions);
  result.setInitialState(groups.get(startPartition)!);
  partitions.forEach((partition, index) => {
    const representative = [...partition][0]!;
    for (const symbol of alphabet) {
      const target = targetFor(representative, symbol);
      const to = groups.get(partitionIndex(target, partitions));
      if (to) result.transition(groups.get(index)!, to, symbol);
    }
  });
  return result;
}

/** Returns whether two NFAs recognize the same language. */
export function equivalent(left: FiniteStateAutomaton, right: FiniteStateAutomaton): boolean {
  const a = determinize(left);
  const b = determinize(right);
  const alphabet = [...new Set([...alphabetOf(a), ...alphabetOf(b)])].sort();
  const startA = a.initialState;
  const startB = b.initialState;
  const queue: Array<[State | null, State | null]> = [[startA, startB]];
  const visited = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [stateA, stateB] = queue[cursor]!;
    const key = `${stateA?.id ?? '∅'}:${stateB?.id ?? '∅'}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if ((stateA ? a.isFinalState(stateA) : false) !== (stateB ? b.isFinalState(stateB) : false)) return false;
    for (const symbol of alphabet) {
      queue.push([
        stateA ? deterministicTransition(a, stateA, symbol) ?? null : null,
        stateB ? deterministicTransition(b, stateB, symbol) ?? null : null,
      ]);
    }
  }
  return true;
}

export class NFAToDFA { convertToDFA(automaton: FiniteStateAutomaton): FiniteStateAutomaton { return determinize(automaton); } }
export class Minimizer { minimize(automaton: FiniteStateAutomaton): FiniteStateAutomaton { return minimize(automaton); } }
export class FSAEqualityChecker { areEquivalent(left: FiniteStateAutomaton, right: FiniteStateAutomaton): boolean { return equivalent(left, right); } }
export class DFAEqualityChecker extends FSAEqualityChecker {}
