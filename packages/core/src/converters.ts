import { FiniteStateAutomaton, PushdownAutomaton, State, TMTransition, TuringMachine, Transition } from './model.js';
import { ContextFreeGrammar, Grammar, Production, RightLinearGrammar, UnrestrictedGrammar, rightLinearGrammarToFSA } from './grammar.js';

export class PDAToCFGConverter {
  hasSingleFinalState(automaton: PushdownAutomaton): boolean {
    return automaton.finalStates.size === 1 && automaton.transitions.every((transition) => transition.to !== [...automaton.finalStates][0] || transition.pop.endsWith('Z'));
  }
  hasTransitionsInCorrectForm(automaton: PushdownAutomaton): boolean {
    return automaton.transitions.every((transition) => [...transition.pop].length === 1 && ([...transition.push].length === 0 || [...transition.push].length === 2));
  }
  isInCorrectFormForConversion(automaton: PushdownAutomaton): boolean { return this.hasSingleFinalState(automaton) && this.hasTransitionsInCorrectForm(automaton); }

  convertToContextFreeGrammar(automaton: PushdownAutomaton): ContextFreeGrammar {
    if (!this.isInCorrectFormForConversion(automaton)) throw new TypeError('PDA must have one final state, pop one stack symbol per transition, and push zero or two symbols.');
    const grammar = new ContextFreeGrammar();
    grammar.setStartVariable('S');
    const mapping = new Map<string, string>();
    let nextVariable = 0;
    const final = [...automaton.finalStates][0]!;
    const variableFor = (from: State, stack: string, to: State): string => {
      const key = `(${from.name}${stack}${to.name})`;
      let variable = mapping.get(key);
      if (!variable) {
        if (key === `(${automaton.initialState?.name}Z${final.name})`) variable = 'S';
        else {
          while (String.fromCharCode(65 + nextVariable) === 'S') nextVariable++;
          if (nextVariable >= 26) throw new RangeError('PDA-to-CFG conversion exceeds the 25 single-letter nonterminals available in JFLAP.');
          variable = String.fromCharCode(65 + nextVariable++);
        }
        mapping.set(key, variable);
      }
      return variable;
    };

    for (const transition of automaton.transitions) {
      const input = transition.input === 'λ' || transition.input === 'ε' ? '' : transition.input;
      const popped = [...transition.pop][0]!;
      if (!transition.push) {
        grammar.addProduction(new Production(variableFor(transition.from, popped, transition.to), input));
        continue;
      }
      const [top, bottom] = [...transition.push];
      for (const stackTarget of automaton.states) {
        const lhs = variableFor(transition.from, popped, stackTarget);
        for (const intermediate of automaton.states) {
          const first = variableFor(transition.to, top!, intermediate);
          const second = variableFor(intermediate, bottom!, stackTarget);
          grammar.addProduction(new Production(lhs, input + first + second));
        }
      }
    }
    return grammar;
  }
}

/** Peter Linz-style unrestricted-grammar construction for a Turing machine. */
export class TuringToGrammarConverter {
  private readonly readable = new Set<string>();
  private readonly writable = new Set<string>();
  private static readonly blank = '=';
  private static readonly variableStart = 'V(';
  private static readonly variableEnd = ')';

  createProductionsForInit(state: State, transitions: Transition[]): Production[] {
    const productions = [new Production('S', `V(==)S`), new Production('S', `SV(==)`), new Production('S', 'T')];
    this.readable.add('=');
    for (const transition of transitions) {
      if (!(transition instanceof TMTransition)) continue;
      for (let tape = 0; tape < transition.tapes; tape++) {
        const read = this.normalise(transition.reads[tape]!); const write = this.normalise(transition.writes[tape]!);
        this.writable.add(write);
        if (!this.readable.has(read)) {
          this.readable.add(read);
          productions.push(new Production('T', `TV(${read}${read})`), new Production('T', `V(${read}${state.id}${read})`));
        }
      }
    }
    productions.push(new Production('=', ''));
    return productions;
  }

  createProductionsForTransition(transition: TMTransition, states: State[]): Production[] {
    const productions: Production[] = [];
    const from = transition.from.id; const to = transition.to.id;
    for (let tape = 0; tape < transition.tapes; tape++) {
      const direction = transition.directions[tape]!;
      const read = this.normalise(transition.reads[tape]!); const write = this.normalise(transition.writes[tape]!);
      for (const left of this.readable) for (const right of this.readable) for (const symbol of this.writable) {
        if (direction === 'R') {
          const lhsA = `V(${left}${from}${read})`; const lhsB = `V(${right}${symbol})`;
          const rhsA = `V(${left}${write})`; const rhsB = `V(${right}${to}${symbol})`;
          productions.push(new Production(lhsA + lhsB, rhsA + rhsB));
          if (states.some((state) => state.id === to)) productions.push(new Production(`V(${right}${to}${symbol})`, right), new Production(`V(${left}${symbol})${right}`, left + right), new Production(`${right}V(${left}${symbol})`, right + left));
        } else if (direction === 'L') {
          const lhsA = `V(${right}${symbol})`; const lhsB = `V(${left}${from}${read})`;
          const rhsA = `V(${right}${to}${symbol})`; const rhsB = `V(${left}${write})`;
          productions.push(new Production(lhsA + lhsB, rhsA + rhsB));
          if (states.some((state) => state.id === to)) productions.push(new Production(`V(${right}${to}${symbol})`, right), new Production(`${right}V(${left}${symbol})`, right + left), new Production(`V(${left}${symbol})${right}`, left + right));
        }
      }
    }
    return productions;
  }

  convertToUnrestrictedGrammar(machine: TuringMachine): UnrestrictedGrammar {
    if (!machine.initialState) throw new TypeError('Turing machine needs an initial state before conversion.');
    const result = new UnrestrictedGrammar();
    const transitions = machine.transitions;
    result.addProductions(this.createProductionsForInit(machine.initialState, transitions));
    for (const transition of transitions) if (transition instanceof TMTransition) result.addProductions(this.createProductionsForTransition(transition, machine.states));
    return result;
  }

  private normalise(symbol: string): string { return symbol === ' ' || symbol === '□' ? '=' : symbol; }
}

export class ContextFreeGrammarToPDAConverter {
  convertToAutomaton(grammar: Grammar): PushdownAutomaton {
    if (!(grammar instanceof ContextFreeGrammar) || !grammar.getStartVariable()) throw new TypeError('A context-free grammar with a start variable is required.');
    const pda = new PushdownAutomaton();
    const initial = pda.createState(); const work = pda.createState(); const final = pda.createState();
    pda.setInitialState(initial); pda.addFinalState(final);
    pda.transition(initial, work, '', 'Z', `${grammar.getStartVariable()}Z`);
    pda.transition(work, final, '', 'Z', '');
    for (const production of grammar.getProductions()) pda.transition(work, work, '', production.getLHS(), production.getRHS());
    for (const terminal of grammar.getTerminals()) pda.transition(work, work, terminal, terminal, '');
    return pda;
  }
}

export class CFGToPDALLConverter extends ContextFreeGrammarToPDAConverter {}
export class CFGToPDALRConverter extends ContextFreeGrammarToPDAConverter {}

export class RightLinearGrammarToFSAConverter {
  convertToAutomaton(grammar: Grammar): FiniteStateAutomaton {
    if (!(grammar instanceof RightLinearGrammar)) throw new TypeError('A right-linear grammar is required.');
    return rightLinearGrammarToFSA(grammar);
  }
}
