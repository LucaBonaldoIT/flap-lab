import { FiniteStateAutomaton } from './model.js';

export interface ExpressionChange { expression: RegularExpression; oldValue: string; newValue: string; }
export type ExpressionListener = (event: ExpressionChange) => void;
type RegexNode = { kind: 'empty' } | { kind: 'epsilon' } | { kind: 'literal'; value: string } | { kind: 'concat' | 'union'; parts: RegexNode[] } | { kind: 'star'; child: RegexNode };

const EMPTY: RegexNode = { kind: 'empty' };
const EPSILON: RegexNode = { kind: 'epsilon' };

class ExpressionParser {
  private cursor = 0;
  constructor(private readonly source: string) {}
  parse(): RegexNode {
    const value = this.union();
    if (this.cursor !== this.source.length) throw new SyntaxError(`Unexpected regular-expression character '${this.source[this.cursor]}'.`);
    return value;
  }
  private union(): RegexNode {
    const alternatives = [this.concatenation()];
    while (this.source[this.cursor] === '+') { this.cursor++; alternatives.push(this.concatenation()); }
    return alternatives.length === 1 ? alternatives[0]! : { kind: 'union', parts: alternatives };
  }
  private concatenation(): RegexNode {
    const parts: RegexNode[] = [];
    while (this.cursor < this.source.length && this.source[this.cursor] !== ')' && this.source[this.cursor] !== '+') parts.push(this.repetition());
    if (!parts.length) throw new SyntaxError('Missing regular-expression operand.');
    return parts.length === 1 ? parts[0]! : { kind: 'concat', parts };
  }
  private repetition(): RegexNode {
    let node = this.atom();
    while (this.source[this.cursor] === '*') { this.cursor++; node = { kind: 'star', child: node }; }
    return node;
  }
  private atom(): RegexNode {
    const token = this.source[this.cursor++];
    if (token === undefined) throw new SyntaxError('Expected a regular-expression symbol.');
    if (token === '(') {
      const nested = this.union();
      if (this.source[this.cursor++] !== ')') throw new SyntaxError('Unclosed parenthesis in regular expression.');
      return nested;
    }
    if (token === ')') throw new SyntaxError('Unexpected closing parenthesis in regular expression.');
    if (token === '!' || token === 'λ' || token === 'ε') return EPSILON;
    if (token === '\\') {
      const escaped = this.source[this.cursor++];
      if (escaped === undefined) throw new SyntaxError('Trailing escape in regular expression.');
      return { kind: 'literal', value: escaped };
    }
    return { kind: 'literal', value: token };
  }
}

export class RegularExpression {
  private listeners = new Set<ExpressionListener>();
  constructor(private expression = '') {}
  asString(): string { return this.expression; }
  toString(): string { return this.asString(); }
  change(expression: string): void {
    if (expression === this.expression) return;
    const oldValue = this.expression;
    this.expression = expression;
    for (const listener of this.listeners) listener({ expression: this, oldValue, newValue: expression });
  }
  addExpressionListener(listener: ExpressionListener): void { this.listeners.add(listener); }
  removeExpressionListener(listener: ExpressionListener): void { this.listeners.delete(listener); }
  asCheckedString(): string {
    if (!this.expression) throw new SyntaxError('The expression must be nonempty.');
    new ExpressionParser(this.expression).parse();
    return this.expression;
  }
  toAutomaton(): FiniteStateAutomaton { return regularExpressionToFSA(this.asCheckedString()); }
}

export function parseRegularExpression(expression: string): RegularExpression { return new RegularExpression(expression); }

export function regularExpressionToFSA(expression: string): FiniteStateAutomaton {
  const ast = new ExpressionParser(expression).parse();
  const fsa = new FiniteStateAutomaton();
  const build = (node: RegexNode): [number, number] => {
    const from = fsa.createState();
    const to = fsa.createState();
    switch (node.kind) {
      case 'empty': break;
      case 'epsilon': fsa.transition(from, to, ''); break;
      case 'literal': fsa.transition(from, to, node.value); break;
      case 'concat': {
        const pieces = node.parts.map(build);
        fsa.transition(from, fsa.getState(pieces[0]![0])!, '');
        for (let index = 0; index < pieces.length - 1; index++) fsa.transition(fsa.getState(pieces[index]![1])!, fsa.getState(pieces[index + 1]![0])!, '');
        fsa.transition(fsa.getState(pieces.at(-1)![1])!, to, '');
        break;
      }
      case 'union':
        for (const part of node.parts) {
          const [start, end] = build(part);
          fsa.transition(from, fsa.getState(start)!, '');
          fsa.transition(fsa.getState(end)!, to, '');
        }
        break;
      case 'star': {
        const [start, end] = build(node.child);
        fsa.transition(from, to, '');
        fsa.transition(from, fsa.getState(start)!, '');
        fsa.transition(fsa.getState(end)!, fsa.getState(start)!, '');
        fsa.transition(fsa.getState(end)!, to, '');
        break;
      }
    }
    return [from.id, to.id];
  };
  const [start, finish] = build(ast);
  fsa.setInitialState(fsa.getState(start)!);
  fsa.addFinalState(fsa.getState(finish)!);
  return fsa;
}

function unionRegex(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null || left === right) return left;
  return `${left}+${right}`;
}
function concatRegex(...parts: Array<string | null>): string | null {
  if (parts.some((part) => part === null)) return null;
  return (parts as string[]).filter((part) => part !== '!' && part !== '').map((part) => part.includes('+') ? `(${part})` : part).join('') || '!';
}
function starRegex(value: string | null): string { if (value === null || value === '!') return '!'; return `(${value})*`; }

/** Converts an FSA to an equivalent JFLAP-style regular expression using state elimination. */
export function fsaToRegularExpression(automaton: FiniteStateAutomaton): string {
  const originalStates = [...automaton.states];
  const start = Math.max(-1, ...originalStates.map((state) => state.id)) + 1;
  const finish = start + 1;
  const matrix = new Map<string, string | null>();
  const key = (from: number, to: number): string => `${from},${to}`;
  const setUnion = (from: number, to: number, expression: string): void => { matrix.set(key(from, to), unionRegex(matrix.get(key(from, to)) ?? null, expression)); };
  if (automaton.initialState) setUnion(start, automaton.initialState.id, '!');
  for (const final of automaton.finalStates) setUnion(final.id, finish, '!');
  const states = [...originalStates.map((state) => state.id), start, finish];
  for (const transition of automaton.transitions) setUnion(transition.from.id, transition.to.id, transition.label || '!');
  for (const eliminated of originalStates) {
    const loop = starRegex(matrix.get(key(eliminated.id, eliminated.id)) ?? null);
    for (const from of states) {
      if (from === eliminated.id) continue;
      const incoming = matrix.get(key(from, eliminated.id)) ?? null;
      if (incoming === null) continue;
      for (const to of states) {
        if (to === eliminated.id) continue;
        const outgoing = matrix.get(key(eliminated.id, to)) ?? null;
        const via = concatRegex(incoming, loop, outgoing);
        if (via !== null) setUnion(from, to, via);
      }
    }
    for (const state of states) { matrix.delete(key(state, eliminated.id)); matrix.delete(key(eliminated.id, state)); }
  }
  return matrix.get(key(start, finish)) ?? '!';
}

export class FSAToRegularExpressionConverter {
  convertToRegularExpression(automaton: FiniteStateAutomaton): RegularExpression { return new RegularExpression(fsaToRegularExpression(automaton)); }
}
export class REToFSAConverter { convertToAutomaton(expression: string | RegularExpression): FiniteStateAutomaton { return regularExpressionToFSA(typeof expression === 'string' ? expression : expression.asCheckedString()); } }

export class Discretizer {
  static delambda(value: string): string { return /^(?:!|λ|ε)$/u.test(value) ? '' : value; }
  static or(expression: string): string[] {
    const parts: string[] = []; let start = 0; let depth = 0; let escaped = false;
    for (let index = 0; index < expression.length; index++) {
      const char = expression[index]!;
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === '+' && depth === 0) { parts.push(Discretizer.delambda(expression.slice(start, index))); start = index + 1; }
    }
    parts.push(Discretizer.delambda(expression.slice(start)));
    return parts;
  }
  static cat(expression: string): string[] {
    const parts: string[] = []; let start = 0; let depth = 0; let escaped = false;
    for (let index = 0; index < expression.length; index++) {
      const char = expression[index]!;
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '(') { if (depth === 0 && index > start) { parts.push(Discretizer.delambda(expression.slice(start, index))); start = index; } depth++; }
      else if (char === ')') {
        depth--;
        if (depth === 0 && expression[index + 1] !== '*') { parts.push(Discretizer.delambda(expression.slice(start, index + 1))); start = index + 1; }
      } else if (char === '*' && depth === 0) { if (index + 1 > start) { parts.push(Discretizer.delambda(expression.slice(start, index + 1))); start = index + 1; } }
      else if (char === '+' && depth === 0) throw new SyntaxError('Top-level union cannot be split as concatenation.');
    }
    if (start < expression.length) parts.push(Discretizer.delambda(expression.slice(start)));
    return parts;
  }
}
