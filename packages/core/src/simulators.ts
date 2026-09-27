import { Automaton, FiniteStateAutomaton, MealyMachine, MealyTransition, MooreMachine, MooreTransition, PDATransition, PushdownAutomaton, State, TMTransition, TuringMachine } from './model.js';

export const LAMBDA = /^(?:|λ|Λ|ε|\u03bb|\u03b5)$/u;

export interface SimulationOptions {
  maxConfigurations?: number;
}

export interface FSAConfiguration {
  state: State;
  remaining: string;
  path: State[];
}

function symbolsForLabel(label: string, input: string): string[] {
  const range = /^\[(.)-(.)\]$/u.exec(label);
  if (range) {
    const low = range[1]!.codePointAt(0)!;
    const high = range[2]!.codePointAt(0)!;
    return Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => String.fromCodePoint(low + index));
  }
  return input.startsWith(label) ? [label] : [];
}

export class FSASimulator {
  constructor(readonly automaton: FiniteStateAutomaton) {}

  simulate(input: string, options: SimulationOptions = {}): boolean {
    return this.run(input, options).accepted;
  }

  run(input: string, options: SimulationOptions = {}): { accepted: boolean; configurations: FSAConfiguration[] } {
    const start = this.automaton.initialState;
    if (!start) return { accepted: false, configurations: [] };
    const max = options.maxConfigurations ?? 100_000;
    const queue: FSAConfiguration[] = [{ state: start, remaining: input, path: [start] }];
    const seen = new Set<string>();
    const visited: FSAConfiguration[] = [];

    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (queue.length > max) throw new RangeError(`Simulation exceeded ${max} configurations.`);
      const config = queue[cursor]!;
      const key = `${config.state.id}\u0000${config.remaining}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visited.push(config);
      if (config.remaining.length === 0 && this.automaton.isFinalState(config.state)) return { accepted: true, configurations: visited };

      for (const transition of this.automaton.getTransitionsFrom(config.state)) {
        if (LAMBDA.test(transition.label)) {
          queue.push({ state: transition.to, remaining: config.remaining, path: [...config.path, transition.to] });
          continue;
        }
        for (const symbol of symbolsForLabel(transition.label, config.remaining)) {
          if (config.remaining.startsWith(symbol)) {
            queue.push({ state: transition.to, remaining: config.remaining.slice(symbol.length), path: [...config.path, transition.to] });
          }
        }
      }
    }
    return { accepted: false, configurations: visited };
  }
}

export interface PDAConfiguration {
  state: State;
  remaining: string;
  stack: string[];
  path: State[];
}

export class PDASimulator {
  constructor(readonly automaton: PushdownAutomaton, readonly initialStackSymbol = 'Z') {}

  simulate(input: string, options: SimulationOptions & { acceptance?: 'final-state' | 'empty-stack' | 'either' } = {}): boolean {
    return this.run(input, options).accepted;
  }

  run(input: string, options: SimulationOptions & { acceptance?: 'final-state' | 'empty-stack' | 'either' } = {}): { accepted: boolean; configurations: PDAConfiguration[] } {
    const start = this.automaton.initialState;
    if (!start) return { accepted: false, configurations: [] };
    const mode = options.acceptance ?? this.automaton.acceptanceMode;
    const max = options.maxConfigurations ?? 100_000;
    const queue: PDAConfiguration[] = [{ state: start, remaining: input, stack: this.initialStackSymbol ? [this.initialStackSymbol] : [], path: [start] }];
    const seen = new Set<string>();
    const configurations: PDAConfiguration[] = [];

    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (queue.length > max) throw new RangeError(`Simulation exceeded ${max} configurations.`);
      const current = queue[cursor]!;
      const key = `${current.state.id}\u0000${current.remaining}\u0000${current.stack.join('')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      configurations.push(current);
      if (current.remaining.length === 0 && ((mode !== 'empty-stack' && this.automaton.isFinalState(current.state)) || (mode !== 'final-state' && current.stack.length === 0))) {
        return { accepted: true, configurations };
      }

      for (const transition of this.automaton.getTransitionsFrom(current.state)) {
        const pda = transition as PDATransition;
        const nextInput = LAMBDA.test(pda.input) ? current.remaining : current.remaining.startsWith(pda.input) ? current.remaining.slice(pda.input.length) : null;
        if (nextInput === null) continue;
        const pop = LAMBDA.test(pda.pop) ? '' : pda.pop;
        const stackText = current.stack.join('');
        if (pop && !stackText.startsWith(pop)) continue;
        const nextStack = pop ? current.stack.slice(Array.from(pop).length) : [...current.stack];
        const push = LAMBDA.test(pda.push) ? '' : pda.push;
        nextStack.unshift(...Array.from(push));
        queue.push({ state: pda.to, remaining: nextInput, stack: nextStack, path: [...current.path, pda.to] });
      }
    }
    return { accepted: false, configurations };
  }
}

export interface TransducerConfiguration {
  state: State;
  remaining: string;
  output: string;
  path: State[];
}

abstract class TransducerSimulator<T extends MealyTransition | MooreTransition> {
  protected constructor(readonly automaton: MealyMachine | MooreMachine) {}

  run(input: string, options: SimulationOptions = {}): { outputs: string[]; configurations: TransducerConfiguration[] } {
    const start = this.automaton.initialState;
    if (!start) return { outputs: [], configurations: [] };
    const max = options.maxConfigurations ?? 100_000;
    const initialOutput = this.initialOutput(start);
    const queue: TransducerConfiguration[] = [{ state: start, remaining: input, output: initialOutput, path: [start] }];
    const seen = new Set<string>();
    const configurations: TransducerConfiguration[] = [];
    const outputs = new Set<string>();
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (queue.length > max) throw new RangeError(`Simulation exceeded ${max} configurations.`);
      const current = queue[cursor]!;
      const key = `${current.state.id}\u0000${current.remaining}\u0000${current.output}`;
      if (seen.has(key)) continue;
      seen.add(key);
      configurations.push(current);
      if (!current.remaining.length) {
        outputs.add(current.output);
        continue;
      }
      for (const raw of this.automaton.getTransitionsFrom(current.state)) {
        const transition = raw as T;
        if (LAMBDA.test(transition.label)) {
          queue.push({ state: transition.to, remaining: current.remaining, output: current.output + this.transitionOutput(transition), path: [...current.path, transition.to] });
        } else if (current.remaining.startsWith(transition.label)) {
          queue.push({ state: transition.to, remaining: current.remaining.slice(transition.label.length), output: current.output + this.transitionOutput(transition), path: [...current.path, transition.to] });
        }
      }
    }
    return { outputs: [...outputs], configurations };
  }

  simulate(input: string, options: SimulationOptions = {}): string | string[] {
    const outputs = this.run(input, options).outputs;
    return outputs.length === 1 ? outputs[0]! : outputs;
  }

  protected abstract initialOutput(state: State): string;
  protected abstract transitionOutput(transition: T): string;
}

export class MealySimulator extends TransducerSimulator<MealyTransition> {
  constructor(automaton: MealyMachine) { super(automaton); }
  protected initialOutput(_state: State): string { return ''; }
  protected transitionOutput(transition: MealyTransition): string { return LAMBDA.test(transition.output) ? '' : transition.output; }
}

export class MooreSimulator extends TransducerSimulator<MooreTransition> {
  constructor(automaton: MooreMachine) { super(automaton); }
  protected initialOutput(state: State): string { return this.automaton instanceof MooreMachine ? this.automaton.getOutput(state) : ''; }
  protected transitionOutput(transition: MooreTransition): string { return transition.output; }
}

export interface TapeSnapshot { cells: Record<number, string>; head: number }
export interface TMConfiguration { state: State; tapes: TapeSnapshot[]; steps: number; path: State[] }

function tapeValue(tape: TapeSnapshot, index: number): string { return tape.cells[index] ?? ' '; }

function tmReadMatches(symbol: string, tape: TapeSnapshot): boolean {
  const value = tapeValue(tape, tape.head);
  if (symbol === '~') return true;
  if (symbol.startsWith('!')) return value !== symbol.slice(1);
  return value === symbol;
}

export class TuringMachineSimulator {
  constructor(readonly automaton: TuringMachine) {}

  run(input: string, options: { maxSteps?: number; maxConfigurations?: number; acceptance?: 'final-state' | 'halting' | 'either' } = {}): { accepted: boolean; halted: boolean; configurations: TMConfiguration[] } {
    const start = this.automaton.initialState;
    if (!start) return { accepted: false, halted: true, configurations: [] };
    const maxSteps = options.maxSteps ?? 10_000;
    const maxConfigurations = options.maxConfigurations ?? 100_000;
    const acceptance = options.acceptance ?? this.automaton.acceptanceMode;
    const initialTape: TapeSnapshot = { cells: Object.fromEntries(Array.from(input).map((symbol, index) => [index, symbol])), head: 0 };
    const tapes = Array.from({ length: this.automaton.tapeCount }, (_, index) => index === 0 ? initialTape : { cells: {}, head: 0 });
    const queue: TMConfiguration[] = [{ state: start, tapes, steps: 0, path: [start] }];
    const seen = new Set<string>();
    const configurations: TMConfiguration[] = [];
    let reachedStepLimit = false;

    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (queue.length > maxConfigurations) throw new RangeError(`Simulation exceeded ${maxConfigurations} configurations.`);
      const current = queue[cursor]!;
      const key = `${current.state.id}|${current.tapes.map((tape) => `${tape.head}:${Object.keys(tape.cells).sort((a,b) => Number(a)-Number(b)).map((i) => `${i}=${tape.cells[Number(i)]}`).join(',')}`).join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      configurations.push(current);
      if (this.automaton.isFinalState(current.state) && acceptance !== 'halting') return { accepted: true, halted: true, configurations };
      const applicable = this.automaton.getTransitionsFrom(current.state).filter((transition) => {
        const tm = transition as TMTransition;
        return tm.reads.every((symbol, index) => tmReadMatches(symbol, current.tapes[index]!));
      });
      if (current.steps >= maxSteps) {
        if (applicable.length) reachedStepLimit = true;
        continue;
      }
      if (!applicable.length && acceptance !== 'final-state') return { accepted: true, halted: true, configurations };

      for (const transition of applicable) {
        const tm = transition as TMTransition;
        const nextTapes = current.tapes.map((tape, index) => {
          const cells = { ...tape.cells };
          const write = tm.writes[index]!;
          if (write === ' ') delete cells[tape.head]; else cells[tape.head] = write;
          const direction = tm.directions[index]!;
          return { cells, head: tape.head + (direction === 'L' ? -1 : direction === 'R' ? 1 : 0) };
        });
        queue.push({ state: tm.to, tapes: nextTapes, steps: current.steps + 1, path: [...current.path, tm.to] });
      }
    }
    return { accepted: false, halted: !reachedStepLimit, configurations };
  }
}

export function getSimulator(automaton: Automaton) {
  if (automaton instanceof FiniteStateAutomaton) return new FSASimulator(automaton);
  if (automaton instanceof PushdownAutomaton) return new PDASimulator(automaton);
  if (automaton instanceof TuringMachine) return new TuringMachineSimulator(automaton);
  if (automaton instanceof MealyMachine) return new MealySimulator(automaton);
  if (automaton instanceof MooreMachine) return new MooreSimulator(automaton);
  throw new TypeError('No simulator is available for this automaton.');
}
