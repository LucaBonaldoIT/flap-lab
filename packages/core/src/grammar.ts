import { FiniteStateAutomaton, State, VariableDependencyGraph } from './model.js';

const chars = (value: string): string[] => Array.from(value);
const unique = <T>(values: Iterable<T>): T[] => [...new Set(values)];

export class Production {
  constructor(private lhs: string, private rhs: string) {}
  getLHS(): string { return this.lhs; }
  getRHS(): string { return this.rhs; }
  setLHS(lhs: string): void { this.lhs = lhs; }
  setRHS(rhs: string): void { this.rhs = rhs; }
  getVariablesOnLHS(): string[] { return chars(this.lhs).filter(ProductionChecker.isVariable); }
  getVariablesOnRHS(): string[] { return chars(this.rhs).filter(ProductionChecker.isVariable); }
  getVariables(): string[] { return unique([...this.getVariablesOnRHS(), ...this.getVariablesOnLHS()]); }
  getTerminalsOnLHS(): string[] { return chars(this.lhs).filter(ProductionChecker.isTerminal); }
  getTerminalsOnRHS(): string[] { return chars(this.rhs).filter(ProductionChecker.isTerminal); }
  getTerminals(): string[] { return unique([...this.getTerminalsOnRHS(), ...this.getTerminalsOnLHS()]); }
  getSymbolsOnRHS(): string[] { return chars(this.rhs); }
  getSymbols(): string[] { return unique([...this.getVariables(), ...this.getTerminals()]).sort(); }
  equals(other: unknown): boolean { return other instanceof Production && this.lhs === other.lhs && this.rhs === other.rhs; }
  toString(): string { return `${this.lhs}→${this.rhs || 'λ'}`; }
  toJSON(): { lhs: string; rhs: string } { return { lhs: this.lhs, rhs: this.rhs }; }
}

export class ProductionChecker {
  static isVariable(char: string): boolean { return char.toUpperCase() === char && char.toLowerCase() !== char; }
  static isTerminal(char: string): boolean { return !ProductionChecker.isVariable(char); }
  static isRestrictedOnLHS(production: Production): boolean { return chars(production.getLHS()).length === 1 && production.getVariablesOnLHS().length === 1; }
  static isUnitProduction(production: Production): boolean { return ProductionChecker.isRestrictedOnLHS(production) && chars(production.getRHS()).length === 1 && production.getVariablesOnRHS().length === 1; }
  static isLambdaProduction(production: Production): boolean { return ProductionChecker.isRestrictedOnLHS(production) && production.getRHS().length === 0; }
  static isLinearProductionWithNoVariable(production: Production): boolean { return ProductionChecker.isRestrictedOnLHS(production) && production.getTerminalsOnRHS().length === chars(production.getRHS()).length; }
  static isRightLinearProductionWithVariable(production: Production): boolean {
    const vars = production.getVariablesOnRHS();
    return ProductionChecker.isRestrictedOnLHS(production) && vars.length === 1 && chars(production.getRHS()).at(-1) === vars[0];
  }
  static isLeftLinearProductionWithVariable(production: Production): boolean {
    const vars = production.getVariablesOnRHS();
    return ProductionChecker.isRestrictedOnLHS(production) && vars.length === 1 && chars(production.getRHS())[0] === vars[0];
  }
  static isRightLinear(production: Production): boolean { return ProductionChecker.isRightLinearProductionWithVariable(production) || ProductionChecker.isLinearProductionWithNoVariable(production); }
  static isLeftLinear(production: Production): boolean { return ProductionChecker.isLeftLinearProductionWithVariable(production) || ProductionChecker.isLinearProductionWithNoVariable(production); }
  static isLinear(production: Production): boolean { return ProductionChecker.isLeftLinear(production) || ProductionChecker.isRightLinear(production); }
  static areTerminalsOnRHS(production: Production): boolean { return production.getTerminalsOnRHS().length > 0; }
}

export abstract class Grammar {
  protected readonly productions: Production[] = [];
  protected readonly variables = new Set<string>();
  protected readonly terminals = new Set<string>();
  startVariable: string | null = null;

  abstract checkProduction(production: Production): void;
  abstract readonly kind: string;
  isConverted(): boolean { return false; }
  setStartVariable(variable: string | null): void { this.startVariable = variable; if (variable) this.variables.add(variable); }
  getStartVariable(): string | null { return this.startVariable; }
  addProduction(production: Production): void {
    this.checkProduction(production);
    if (this.productions.some((existing) => existing.equals(production))) return;
    this.productions.push(production);
    production.getVariables().forEach((variable) => this.variables.add(variable));
    production.getTerminals().forEach((terminal) => this.terminals.add(terminal));
  }
  addProductions(productions: Production[]): void { productions.forEach((production) => this.addProduction(production)); }
  removeProduction(production: Production): void {
    const index = this.productions.findIndex((item) => item.equals(production));
    if (index >= 0) this.productions.splice(index, 1);
    this.rebuildSymbols();
  }
  getProductions(): Production[] { return [...this.productions]; }
  getVariables(): string[] { return [...this.variables].sort(); }
  getTerminals(): string[] { return [...this.terminals].sort(); }
  isVariable(variable: string): boolean { return this.variables.has(variable); }
  isTerminal(terminal: string): boolean { return this.terminals.has(terminal); }
  isProduction(production: Production): boolean { return this.productions.some((item) => item.equals(production)); }
  isValidProduction(production: Production): boolean { try { this.checkProduction(production); return true; } catch { return false; } }
  clone(): Grammar {
    const copy = createGrammar(this.kind);
    copy.setStartVariable(this.startVariable);
    copy.addProductions(this.productions.map((production) => new Production(production.getLHS(), production.getRHS())));
    return copy;
  }
  toJSON(): { type: string; startVariable: string | null; productions: { lhs: string; rhs: string }[] } {
    return { type: this.kind, startVariable: this.startVariable, productions: this.productions.map((production) => production.toJSON()) };
  }
  toString(): string { return `V: ${this.getVariables().join(' ')}\nT: ${this.getTerminals().join(' ')}\nS: ${this.startVariable ?? ''}\nP:\n${this.productions.join('\n')}`; }
  private rebuildSymbols(): void {
    this.variables.clear(); this.terminals.clear();
    if (this.startVariable) this.variables.add(this.startVariable);
    for (const production of this.productions) {
      production.getVariables().forEach((variable) => this.variables.add(variable));
      production.getTerminals().forEach((terminal) => this.terminals.add(terminal));
    }
  }
}

export class ContextFreeGrammar extends Grammar {
  readonly kind = 'cfg';
  checkProduction(production: Production): void {
    if (!ProductionChecker.isRestrictedOnLHS(production)) throw new TypeError('A context-free production must have one variable on the left hand side.');
  }
}

export class UnrestrictedGrammar extends Grammar {
  readonly kind: string = 'unrestricted';
  checkProduction(production: Production): void { if (!production.getLHS()) throw new TypeError('The left hand side cannot be empty.'); }
  override addProduction(production: Production): void {
    if (!this.productions.length && !ProductionChecker.isRestrictedOnLHS(production)) throw new TypeError('The first production must have a single variable on the left hand side.');
    super.addProduction(production);
  }
}

export class ConvertedUnrestrictedGrammar extends UnrestrictedGrammar {
  override readonly kind: string = 'converted-unrestricted';
  override isConverted(): boolean { return true; }
}

export class UnboundGrammar extends Grammar {
  readonly kind = 'unbound';
  constructor() { super(); this.startVariable = 'S'; this.variables.add('S'); }
  checkProduction(_production: Production): void {}
}

export class RegularGrammar extends Grammar {
  readonly kind: string = 'regular';
  private direction: -1 | 0 | 1 = 0;
  get linearity(): -1 | 0 | 1 { return this.direction; }
  checkProduction(production: Production): void {
    if (!ProductionChecker.isRestrictedOnLHS(production)) throw new TypeError('The left hand side must be one variable.');
    if (!ProductionChecker.isLinear(production)) throw new TypeError('The production is neither left nor right linear.');
    if (this.direction !== 0 && !ProductionChecker.isLinearProductionWithNoVariable(production)) {
      if (this.direction === 1 && !ProductionChecker.isRightLinear(production)) throw new TypeError('Cannot mix left-linear and right-linear productions.');
      if (this.direction === -1 && !ProductionChecker.isLeftLinear(production)) throw new TypeError('Cannot mix right-linear and left-linear productions.');
    }
  }
  override addProduction(production: Production): void {
    super.addProduction(production);
    if (!ProductionChecker.isLinearProductionWithNoVariable(production)) this.direction = ProductionChecker.isRightLinear(production) ? 1 : -1;
  }
}

export class RightLinearGrammar extends RegularGrammar {
  override readonly kind: string = 'right-linear';
  override checkProduction(production: Production): void {
    if (!ProductionChecker.isRightLinear(production)) throw new TypeError('The production is not right-linear.');
  }
}

export function createGrammar(kind: string): Grammar {
  if (kind === 'cfg' || kind === 'context-free') return new ContextFreeGrammar();
  if (kind === 'regular') return new RegularGrammar();
  if (kind === 'right-linear') return new RightLinearGrammar();
  if (kind === 'converted-unrestricted') return new ConvertedUnrestrictedGrammar();
  if (kind === 'unrestricted') return new UnrestrictedGrammar();
  return new UnboundGrammar();
}

export class GrammarChecker {
  static isRegularGrammar(grammar: Grammar): boolean { return GrammarChecker.isLeftLinearGrammar(grammar) || GrammarChecker.isRightLinearGrammar(grammar); }
  static isRightLinearGrammar(grammar: Grammar): boolean { return grammar.getProductions().every(ProductionChecker.isRightLinear); }
  static isLeftLinearGrammar(grammar: Grammar): boolean { return grammar.getProductions().every(ProductionChecker.isLeftLinear); }
  static isContextFreeGrammar(grammar: Grammar): boolean { return grammar.getProductions().every(ProductionChecker.isRestrictedOnLHS); }
  static getProductionsOnVariable(variable: string, grammar: Grammar): Production[] { return grammar.getProductions().filter((production) => production.getLHS() === variable); }
  static getNonUnitProductionsOnVariable(variable: string, grammar: Grammar): Production[] { return GrammarChecker.getProductionsOnVariable(variable, grammar).filter((production) => !ProductionChecker.isUnitProduction(production)); }
  static getProductionsWithVariable(variable: string, grammar: Grammar): Production[] { return grammar.getProductions().filter((production) => production.getVariables().includes(variable)); }
  static getProductionsWithVariableOnRHS(variable: string, grammar: Grammar): Production[] { return grammar.getProductions().filter((production) => production.getVariablesOnRHS().includes(variable)); }
  static isProductionInGrammar(production: Production, grammar: Grammar): boolean { return grammar.isProduction(production); }
  static getUnresolvedVariables(grammar: Grammar): string[] {
    const defined = new Set(grammar.getProductions().flatMap((production) => production.getVariablesOnLHS()));
    return grammar.getVariables().filter((variable) => !defined.has(variable));
  }
}

export function removeLambdaProductions(grammar: Grammar): Grammar {
  const productions = grammar.getProductions();
  const nullable = new Set(productions.filter(ProductionChecker.isLambdaProduction).map((production) => production.getLHS()));
  let changed = true;
  while (changed) {
    changed = false;
    for (const production of productions) {
      if (chars(production.getRHS()).length && chars(production.getRHS()).every((symbol) => ProductionChecker.isVariable(symbol) && nullable.has(symbol)) && !nullable.has(production.getLHS())) {
        nullable.add(production.getLHS()); changed = true;
      }
    }
  }
  const result = new ContextFreeGrammar();
  const start = grammar.getStartVariable();
  let newStart = start;
  if (start && nullable.has(start)) {
    newStart = freshVariable(grammar.getVariables());
    result.setStartVariable(newStart);
    result.addProduction(new Production(newStart, start));
    result.addProduction(new Production(newStart, ''));
  } else result.setStartVariable(start);
  for (const production of productions) {
    const symbols = chars(production.getRHS());
    const nullablePositions = symbols.map((symbol, index) => ProductionChecker.isVariable(symbol) && nullable.has(symbol) ? index : -1).filter((index) => index >= 0);
    if (nullablePositions.length > 20) throw new RangeError('Lambda elimination would produce over one million variants.');
    for (let mask = 0; mask < 2 ** nullablePositions.length; mask++) {
      const removed = new Set(nullablePositions.filter((_, bit) => (mask & (1 << bit)) !== 0));
      const rhs = symbols.filter((_, index) => !removed.has(index)).join('');
      if (rhs) result.addProduction(new Production(production.getLHS(), rhs));
    }
  }
  return result;
}

export function removeUnitProductions(grammar: Grammar): Grammar {
  const result = new ContextFreeGrammar();
  result.setStartVariable(grammar.getStartVariable());
  const productions = grammar.getProductions();
  for (const variable of grammar.getVariables()) {
    const closure = new Set([variable]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const production of productions) {
        if (closure.has(production.getLHS()) && ProductionChecker.isUnitProduction(production) && !closure.has(production.getRHS())) {
          closure.add(production.getRHS()); changed = true;
        }
      }
    }
    for (const target of closure) {
      for (const production of productions) {
        if (production.getLHS() === target && !ProductionChecker.isUnitProduction(production)) result.addProduction(new Production(variable, production.getRHS()));
      }
    }
  }
  return result;
}

export function removeUselessProductions(grammar: Grammar): Grammar {
  const productions = grammar.getProductions();
  const generating = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const production of productions) {
      if (production.getVariablesOnRHS().every((variable) => generating.has(variable)) && !generating.has(production.getLHS())) {
        generating.add(production.getLHS()); changed = true;
      }
    }
  }
  const reachable = new Set<string>(grammar.getStartVariable() ? [grammar.getStartVariable()!] : []);
  changed = true;
  while (changed) {
    changed = false;
    for (const production of productions) {
      if (reachable.has(production.getLHS()) && production.getVariablesOnRHS().every((variable) => generating.has(variable))) {
        for (const variable of production.getVariablesOnRHS()) if (!reachable.has(variable)) { reachable.add(variable); changed = true; }
      }
    }
  }
  const result = new ContextFreeGrammar();
  result.setStartVariable(grammar.getStartVariable());
  for (const production of productions) {
    if (generating.has(production.getLHS()) && reachable.has(production.getLHS()) && production.getVariablesOnRHS().every((variable) => generating.has(variable) && reachable.has(variable))) result.addProduction(new Production(production.getLHS(), production.getRHS()));
  }
  return result;
}

export function toChomskyNormalForm(grammar: Grammar): ContextFreeGrammar {
  const withoutLambda = removeLambdaProductions(grammar);
  const withoutUnits = removeUnitProductions(withoutLambda);
  const useful = removeUselessProductions(withoutUnits);
  const result = new ContextFreeGrammar();
  result.setStartVariable(useful.getStartVariable());
  const terminalVariables = new Map<string, string>();
  for (const production of useful.getProductions()) {
    const symbols = chars(production.getRHS());
    if (symbols.length < 2) { result.addProduction(new Production(production.getLHS(), production.getRHS())); continue; }
    const mapped = symbols.map((symbol) => {
      if (ProductionChecker.isVariable(symbol)) return symbol;
      let variable = terminalVariables.get(symbol);
      if (!variable) {
        variable = freshVariable([...useful.getVariables(), ...terminalVariables.values(), ...result.getVariables()]);
        terminalVariables.set(symbol, variable);
        result.addProduction(new Production(variable, symbol));
      }
      return variable;
    });
    let lhs = production.getLHS();
    while (mapped.length > 2) {
      const variable = freshVariable([...useful.getVariables(), ...terminalVariables.values(), ...result.getVariables()]);
      result.addProduction(new Production(lhs, mapped[0]! + variable));
      lhs = variable;
      mapped.shift();
    }
    result.addProduction(new Production(lhs, mapped.join('')));
  }
  return result;
}

function freshVariable(existing: string[]): string {
  for (const variable of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!existing.includes(variable)) return variable;
  throw new RangeError('No unused single-character variable is available.');
}

export interface CYKResult { accepted: boolean; table: Set<string>[][]; }
export class CYKParser {
  private trace = new Map<string, { production: Production; split?: number }>();
  private lastInput = '';
  private lastAccepted = false;
  constructor(readonly grammar: Grammar) {}
  solve(input: string): boolean { return this.run(input).accepted; }
  run(input: string): CYKResult {
    this.trace.clear(); this.lastInput = input;
    const table = Array.from({ length: chars(input).length }, () => [] as Set<string>[]);
    const symbols = chars(input);
    if (!symbols.length) {
      this.lastAccepted = this.grammar.getProductions().some((p) => p.getLHS() === this.grammar.getStartVariable() && !p.getRHS());
      return { accepted: this.lastAccepted, table };
    }
    const productions = this.grammar.getProductions();
    for (let i = 0; i < symbols.length; i++) {
      table[i]![0] = new Set();
      for (const production of productions) if (production.getRHS() === symbols[i]) {
        table[i]![0]!.add(production.getLHS());
        this.trace.set(`${i},1,${production.getLHS()}`, { production });
      }
    }
    for (let length = 2; length <= symbols.length; length++) {
      for (let start = 0; start <= symbols.length - length; start++) {
        const variables = new Set<string>();
        for (let split = 1; split < length; split++) {
          const left = table[start]![split - 1]!;
          const right = table[start + split]![length - split - 1]!;
          for (const production of productions) if (left.has(chars(production.getRHS())[0] ?? '') && right.has(chars(production.getRHS())[1] ?? '') && chars(production.getRHS()).length === 2) {
            variables.add(production.getLHS());
            this.trace.set(`${start},${length},${production.getLHS()}`, { production, split });
          }
        }
        table[start]![length - 1] = variables;
      }
    }
    this.lastAccepted = table[0]![symbols.length - 1]!.has(this.grammar.getStartVariable() ?? '');
    return { accepted: this.lastAccepted, table };
  }
  getTrace(): Production[] {
    const startVariable = this.grammar.getStartVariable();
    if (!this.lastAccepted || !this.lastInput.length || !startVariable) return [];
    const trace: Production[] = [];
    const visit = (start: number, length: number, variable: string): void => {
      const item = this.trace.get(`${start},${length},${variable}`);
      if (!item) return;
      trace.push(item.production);
      if (item.split !== undefined) {
        const rhs = chars(item.production.getRHS());
        visit(start, item.split, rhs[0]!);
        visit(start + item.split, length - item.split, rhs[1]!);
      }
    };
    visit(0, [...this.lastInput].length, startVariable);
    return trace;
  }
}

export interface BruteParseOptions { maxConfigurations?: number; maxLength?: number; }
export function bruteParse(grammar: Grammar, input: string, options: BruteParseOptions = {}): { accepted: boolean; derivation: string[]; explored: number } {
  const limit = options.maxConfigurations ?? 100_000;
  const maxLength = options.maxLength ?? Math.max(input.length * 3 + 10, 20);
  const queue: Array<{ form: string; history: string[] }> = [{ form: grammar.getStartVariable() ?? '', history: [grammar.getStartVariable() ?? ''] }];
  const visited = new Set<string>();
  const productions = grammar.getProductions();
  while (queue.length) {
    if (visited.size >= limit) throw new RangeError(`Brute-force parse exceeded ${limit} configurations.`);
    const current = queue.shift()!;
    if (visited.has(current.form)) continue;
    visited.add(current.form);
    if (current.form === input) return { accepted: true, derivation: current.history, explored: visited.size };
    for (const production of productions) {
      const lhs = production.getLHS();
      for (let from = current.form.indexOf(lhs); from >= 0; from = current.form.indexOf(lhs, from + 1)) {
        const form = current.form.slice(0, from) + production.getRHS() + current.form.slice(from + lhs.length);
        if (form.length <= maxLength && !visited.has(form)) queue.push({ form, history: [...current.history, form] });
      }
    }
  }
  return { accepted: false, derivation: [], explored: visited.size };
}

export class BruteParser {
  constructor(readonly grammar: Grammar, readonly target: string) {}
  parse(options: BruteParseOptions = {}) { return bruteParse(this.grammar, this.target, options); }
  static get(grammar: Grammar, target: string): BruteParser { return Unrestricted.isUnrestricted(grammar) ? new UnrestrictedBruteParser(grammar, target) : new RestrictedBruteParser(grammar, target); }
}
export class RestrictedBruteParser extends BruteParser {}
export class UnrestrictedBruteParser extends BruteParser {}

export type ParseAction = { kind: 'shift'; state: number } | { kind: 'reduce'; production: Production } | { kind: 'accept' };
export type ParseTable = { actions: Map<number, Map<string, ParseAction[]>>; gotos: Map<number, Map<string, number>>; conflicts: string[] };

export function firstSets(grammar: Grammar): Map<string, Set<string>> {
  const first = new Map(grammar.getVariables().map((variable) => [variable, new Set<string>()]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const production of grammar.getProductions()) {
      const lhsFirst = first.get(production.getLHS());
      if (!lhsFirst) continue;
      const rhs = chars(production.getRHS());
      if (!rhs.length) { if (!lhsFirst.has('')) { lhsFirst.add(''); changed = true; } continue; }
      let nullablePrefix = true;
      for (const symbol of rhs) {
        const symbolFirst = first.get(symbol) ?? new Set([symbol]);
        for (const item of symbolFirst) if (item !== '' && !lhsFirst.has(item)) { lhsFirst.add(item); changed = true; }
        if (!symbolFirst.has('')) { nullablePrefix = false; break; }
      }
      if (nullablePrefix && !lhsFirst.has('')) { lhsFirst.add(''); changed = true; }
    }
  }
  return first;
}

export function followSets(grammar: Grammar): Map<string, Set<string>> {
  const first = firstSets(grammar);
  const follow = new Map(grammar.getVariables().map((variable) => [variable, new Set<string>()]));
  if (grammar.getStartVariable()) follow.get(grammar.getStartVariable()!)?.add('$');
  let changed = true;
  while (changed) {
    changed = false;
    for (const production of grammar.getProductions()) {
      const rhs = chars(production.getRHS());
      for (let index = 0; index < rhs.length; index++) {
        const variable = rhs[index]!;
        if (!ProductionChecker.isVariable(variable)) continue;
        const target = follow.get(variable);
        if (!target) continue;
        let suffixNullable = true;
        for (const symbol of rhs.slice(index + 1)) {
          const symbolFirst = first.get(symbol) ?? new Set([symbol]);
          for (const item of symbolFirst) if (item !== '' && !target.has(item)) { target.add(item); changed = true; }
          if (!symbolFirst.has('')) { suffixNullable = false; break; }
        }
        if (suffixNullable) for (const item of follow.get(production.getLHS()) ?? []) if (!target.has(item)) { target.add(item); changed = true; }
      }
    }
  }
  return follow;
}

export function generateLL1Table(grammar: Grammar): { table: Map<string, Map<string, Production>>; conflicts: string[] } {
  const first = firstSets(grammar); const follow = followSets(grammar);
  const table = new Map<string, Map<string, Production>>(); const conflicts: string[] = [];
  const add = (variable: string, terminal: string, production: Production): void => {
    const row = table.get(variable) ?? new Map<string, Production>();
    const existing = row.get(terminal);
    if (existing && !existing.equals(production)) conflicts.push(`${variable}, ${terminal}: ${existing} / ${production}`);
    else row.set(terminal, production);
    table.set(variable, row);
  };
  for (const production of grammar.getProductions()) {
    const rhsFirst = firstSequence(chars(production.getRHS()), first);
    for (const terminal of rhsFirst) if (terminal !== '') add(production.getLHS(), terminal, production);
    if (rhsFirst.has('')) for (const terminal of follow.get(production.getLHS()) ?? []) add(production.getLHS(), terminal, production);
  }
  return { table, conflicts: unique(conflicts) };
}

function firstSequence(sequence: string[], first: Map<string, Set<string>>): Set<string> {
  if (!sequence.length) return new Set(['']);
  const result = new Set<string>(); let nullable = true;
  for (const symbol of sequence) {
    const set = first.get(symbol) ?? new Set([symbol]);
    for (const item of set) if (item !== '') result.add(item);
    if (!set.has('')) { nullable = false; break; }
  }
  if (nullable) result.add('');
  return result;
}

export interface LLParseResult { accepted: boolean; productions: Production[]; steps: Array<{ stack: string[]; remaining: string }> }
export function parseLL1(grammar: Grammar, input: string): LLParseResult {
  const generated = generateLL1Table(grammar);
  if (generated.conflicts.length) throw new TypeError(`Grammar is not LL(1): ${generated.conflicts.join('; ')}`);
  const stack = ['$'];
  if (grammar.getStartVariable()) stack.push(grammar.getStartVariable()!);
  const tokens = [...input, '$']; const productions: Production[] = []; const steps: LLParseResult['steps'] = [];
  let cursor = 0;
  while (stack.length) {
    if (steps.length > 100_000) throw new RangeError('LL parser exceeded its step limit.');
    steps.push({ stack: [...stack], remaining: tokens.slice(cursor).join('') });
    const top = stack.pop()!; const lookahead = tokens[cursor] ?? '$';
    if (top === '$') return { accepted: lookahead === '$' && cursor === tokens.length - 1, productions, steps };
    if (!ProductionChecker.isVariable(top)) {
      if (top !== lookahead) return { accepted: false, productions, steps };
      cursor++; continue;
    }
    const production = generated.table.get(top)?.get(lookahead);
    if (!production) return { accepted: false, productions, steps };
    productions.push(production);
    for (const symbol of chars(production.getRHS()).reverse()) stack.push(symbol);
  }
  return { accepted: false, productions, steps };
}

interface LRItem { production: number; dot: number }
export function generateSLRTable(grammar: Grammar): ParseTable {
  const original = grammar.getProductions();
  let augmentedStart = 'Z';
  while (grammar.getVariables().includes(augmentedStart)) augmentedStart = String.fromCharCode(augmentedStart.charCodeAt(0) - 1);
  const allProductions = [new Production(augmentedStart, grammar.getStartVariable() ?? ''), ...original];
  const follow = followSets(grammar);
  const key = (items: LRItem[]): string => items.map((item) => `${item.production}.${item.dot}`).sort().join('|');
  const closure = (input: LRItem[]): LRItem[] => {
    const items = new Map(input.map((item) => [`${item.production}.${item.dot}`, item]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of [...items.values()]) {
        const symbol = chars(allProductions[item.production]!.getRHS())[item.dot];
        if (!symbol || !ProductionChecker.isVariable(symbol)) continue;
        allProductions.forEach((production, index) => {
          if (index && production.getLHS() === symbol) {
            const id = `${index}.0`; if (!items.has(id)) { items.set(id, { production: index, dot: 0 }); changed = true; }
          }
        });
      }
    }
    return [...items.values()];
  };
  const states: LRItem[][] = [closure([{ production: 0, dot: 0 }])];
  const transitions = new Map<string, number>();
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    const symbols = unique(states[stateIndex]!.flatMap((item) => chars(allProductions[item.production]!.getRHS())[item.dot] ?? []));
    for (const symbol of symbols) {
      const moved = states[stateIndex]!.filter((item) => chars(allProductions[item.production]!.getRHS())[item.dot] === symbol).map((item) => ({ production: item.production, dot: item.dot + 1 }));
      const target = closure(moved); const targetKey = key(target);
      let targetIndex = states.findIndex((state) => key(state) === targetKey);
      if (targetIndex < 0) { targetIndex = states.length; states.push(target); }
      transitions.set(`${stateIndex},${symbol}`, targetIndex);
    }
  }
  const actions = new Map<number, Map<string, ParseAction[]>>(); const gotos = new Map<number, Map<string, number>>(); const conflicts: string[] = [];
  const addAction = (state: number, symbol: string, action: ParseAction): void => {
    const row = actions.get(state) ?? new Map<string, ParseAction[]>(); const values = row.get(symbol) ?? [];
    if (!values.some((value) => value.kind === action.kind && (value.kind !== 'shift' || action.kind !== 'shift' || value.state === action.state) && (value.kind !== 'reduce' || action.kind !== 'reduce' || value.production.equals(action.production)))) values.push(action);
    row.set(symbol, values); actions.set(state, row);
    if (values.length > 1) conflicts.push(`state ${state}, ${symbol}`);
  };
  states.forEach((items, state) => {
    for (const item of items) {
      const production = allProductions[item.production]!; const rhs = chars(production.getRHS()); const next = rhs[item.dot];
      if (next) {
        const target = transitions.get(`${state},${next}`)!;
        if (ProductionChecker.isVariable(next)) { const row = gotos.get(state) ?? new Map<string, number>(); row.set(next, target); gotos.set(state, row); }
        else addAction(state, next, { kind: 'shift', state: target });
      } else if (item.production === 0) addAction(state, '$', { kind: 'accept' });
      else for (const terminal of follow.get(production.getLHS()) ?? []) addAction(state, terminal, { kind: 'reduce', production: original[item.production - 1]! });
    }
  });
  return { actions, gotos, conflicts: unique(conflicts) };
}

interface LR1Item { production: number; dot: number; lookahead: string }
export function generateLR1Table(grammar: Grammar): ParseTable {
  const original = grammar.getProductions();
  const augmentedStart = freshVariable(grammar.getVariables());
  const allProductions = [new Production(augmentedStart, grammar.getStartVariable() ?? ''), ...original];
  const first = firstSets(grammar);
  const itemKey = (item: LR1Item): string => `${item.production}.${item.dot}.${item.lookahead}`;
  const stateKey = (items: LR1Item[]): string => items.map(itemKey).sort().join('|');
  const closure = (input: LR1Item[]): LR1Item[] => {
    const items = new Map(input.map((item) => [itemKey(item), item]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of [...items.values()]) {
        const rhs = chars(allProductions[item.production]!.getRHS());
        const symbol = rhs[item.dot];
        if (!symbol || !ProductionChecker.isVariable(symbol)) continue;
        const lookaheads = firstSequence([...rhs.slice(item.dot + 1), item.lookahead], first);
        allProductions.forEach((production, index) => {
          if (!index || production.getLHS() !== symbol) return;
          for (const lookahead of lookaheads) {
            if (!lookahead) continue;
            const added = { production: index, dot: 0, lookahead };
            if (!items.has(itemKey(added))) { items.set(itemKey(added), added); changed = true; }
          }
        });
      }
    }
    return [...items.values()];
  };
  const states: LR1Item[][] = [closure([{ production: 0, dot: 0, lookahead: '$' }])];
  const transitions = new Map<string, number>();
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    const symbols = unique(states[stateIndex]!.flatMap((item) => chars(allProductions[item.production]!.getRHS())[item.dot] ?? []));
    for (const symbol of symbols) {
      const moved = states[stateIndex]!.filter((item) => chars(allProductions[item.production]!.getRHS())[item.dot] === symbol).map((item) => ({ ...item, dot: item.dot + 1 }));
      const target = closure(moved); const key = stateKey(target);
      let targetIndex = states.findIndex((state) => stateKey(state) === key);
      if (targetIndex < 0) { targetIndex = states.length; states.push(target); }
      transitions.set(`${stateIndex},${symbol}`, targetIndex);
    }
  }
  const actions = new Map<number, Map<string, ParseAction[]>>(); const gotos = new Map<number, Map<string, number>>(); const conflicts: string[] = [];
  const add = (state: number, symbol: string, action: ParseAction): void => {
    const row = actions.get(state) ?? new Map<string, ParseAction[]>(); const values = row.get(symbol) ?? [];
    if (!values.some((value) => value.kind === action.kind && (value.kind !== 'shift' || action.kind !== 'shift' || value.state === action.state) && (value.kind !== 'reduce' || action.kind !== 'reduce' || value.production.equals(action.production)))) values.push(action);
    row.set(symbol, values); actions.set(state, row);
    if (values.length > 1) conflicts.push(`state ${state}, ${symbol}`);
  };
  states.forEach((items, state) => {
    for (const item of items) {
      const production = allProductions[item.production]!; const rhs = chars(production.getRHS()); const symbol = rhs[item.dot];
      if (symbol) {
        const target = transitions.get(`${state},${symbol}`)!;
        if (ProductionChecker.isVariable(symbol)) { const row = gotos.get(state) ?? new Map<string, number>(); row.set(symbol, target); gotos.set(state, row); }
        else add(state, symbol, { kind: 'shift', state: target });
      } else if (item.production === 0) add(state, '$', { kind: 'accept' });
      else add(state, item.lookahead, { kind: 'reduce', production: original[item.production - 1]! });
    }
  });
  return { actions, gotos, conflicts: unique(conflicts) };
}

export function parseLR1(grammar: Grammar, input: string): LRParseResult {
  return parseWithTable(generateLR1Table(grammar), input, 100_000);
}

export interface LRParseResult { accepted: boolean; reductions: Production[]; states: number[]; }
export function parseSLR(grammar: Grammar, input: string): LRParseResult {
  return parseWithTable(generateSLRTable(grammar), input, 100_000);
}
function parseWithTable(table: ParseTable, input: string, maxSteps: number): LRParseResult {
  const states = [0]; const symbols: string[] = []; const reductions: Production[] = []; const tokens = [...input, '$']; let cursor = 0;
  for (let steps = 0; steps < maxSteps; steps++) {
    const state = states.at(-1)!; const lookahead = tokens[cursor] ?? '$'; const choices = table.actions.get(state)?.get(lookahead) ?? [];
    if (choices.length !== 1) return { accepted: false, reductions, states };
    const action = choices[0]!;
    if (action.kind === 'accept') return { accepted: true, reductions, states };
    if (action.kind === 'shift') { symbols.push(lookahead); states.push(action.state); cursor++; continue; }
    const rhs = chars(action.production.getRHS());
    symbols.splice(Math.max(0, symbols.length - rhs.length), rhs.length);
    states.splice(Math.max(1, states.length - rhs.length), rhs.length);
    const next = table.gotos.get(states.at(-1)!)?.get(action.production.getLHS());
    if (next === undefined) return { accepted: false, reductions, states };
    symbols.push(action.production.getLHS()); states.push(next); reductions.push(action.production);
  }
  throw new RangeError('SLR parser exceeded its step limit.');
}

export class LLParseTableGenerator { constructor(readonly grammar: Grammar) {} generate() { return generateLL1Table(this.grammar); } }
export class LRParseTableGenerator { constructor(readonly grammar: Grammar) {} generate() { return generateLR1Table(this.grammar); } }
export class LLParser { constructor(readonly grammar: Grammar) {} parse(input: string) { return parseLL1(this.grammar, input); } }
export class LRParser { constructor(readonly grammar: Grammar) {} parse(input: string) { return parseLR1(this.grammar, input); } }

export function rightLinearGrammarToFSA(grammar: Grammar): FiniteStateAutomaton {
  if (!GrammarChecker.isRightLinearGrammar(grammar)) throw new TypeError('Grammar must be right-linear.');
  const fsa = new FiniteStateAutomaton();
  const variables = new Map<string, State>();
  for (const variable of grammar.getVariables()) {
    const state = fsa.createState(); state.label = variable; variables.set(variable, state);
    if (variable === grammar.getStartVariable()) fsa.setInitialState(state);
  }
  const final = fsa.createState(); fsa.addFinalState(final);
  for (const production of grammar.getProductions()) {
    const lhs = variables.get(production.getLHS())!;
    const rhs = production.getRHS();
    const vars = production.getVariablesOnRHS();
    const target = vars.length ? variables.get(vars[0]!)! : final;
    const label = vars.length ? rhs.slice(0, -vars[0]!.length) : rhs;
    fsa.transition(lhs, target, label);
  }
  return fsa;
}

export function fsaToRightLinearGrammar(automaton: FiniteStateAutomaton): RightLinearGrammar {
  const grammar = new RightLinearGrammar();
  const stateVariables = new Map<State, string>();
  automaton.states.forEach((state, index) => stateVariables.set(state, String.fromCharCode(65 + index % 26)));
  grammar.setStartVariable(automaton.initialState ? stateVariables.get(automaton.initialState)! : null);
  for (const state of automaton.states) {
    for (const transition of automaton.getTransitionsFrom(state)) {
      grammar.addProduction(new Production(stateVariables.get(state)!, transition.label + stateVariables.get(transition.to)!));
    }
    if (automaton.isFinalState(state)) grammar.addProduction(new Production(stateVariables.get(state)!, ''));
  }
  return grammar;
}

export class FSAToRegularGrammarConverter {
  convertToGrammar(automaton: FiniteStateAutomaton): RightLinearGrammar { return fsaToRightLinearGrammar(automaton); }
}

export class CNFConverter {
  constructor(readonly grammar: Grammar) {}
  convert(): ContextFreeGrammar { return toChomskyNormalForm(this.grammar); }
  isChomsky(production: Production): boolean {
    const symbols = chars(production.getRHS());
    return (symbols.length === 1 && this.grammar.isTerminal(symbols[0]!)) || (symbols.length === 2 && symbols.every((symbol) => this.grammar.isVariable(symbol)));
  }
  static separateString(value: string): string[] { return chars(value); }
}

export class LambdaProductionRemover {
  getLambdaProductionlessGrammar(grammar: Grammar): Grammar { return removeLambdaProductions(grammar); }
  getCompleteLambdaSet(grammar: Grammar): Set<string> {
    const nullable = new Set(grammar.getProductions().filter(ProductionChecker.isLambdaProduction).map((production) => production.getLHS()));
    let changed = true;
    while (changed) {
      changed = false;
      for (const production of grammar.getProductions()) if (chars(production.getRHS()).length && chars(production.getRHS()).every((symbol) => ProductionChecker.isVariable(symbol) && nullable.has(symbol)) && !nullable.has(production.getLHS())) { nullable.add(production.getLHS()); changed = true; }
    }
    return nullable;
  }
}

export class UnitProductionRemover {
  getUnitProductions(grammar: Grammar): Production[] { return grammar.getProductions().filter(ProductionChecker.isUnitProduction); }
  getNonUnitProductions(grammar: Grammar): Production[] { return grammar.getProductions().filter((production) => !ProductionChecker.isUnitProduction(production)); }
  getVariableDependencyGraph(grammar: Grammar): VariableDependencyGraph {
    const graph = new VariableDependencyGraph(); const states = new Map<string, State>();
    for (const variable of grammar.getVariables()) { const state = graph.createState(); state.name = variable; states.set(variable, state); }
    for (const production of this.getUnitProductions(grammar)) {
      const from = states.get(production.getLHS()); const to = states.get(production.getRHS());
      if (from && to) graph.transition(from, to);
    }
    return graph;
  }
  getDependencies(variable: string, grammar: Grammar): string[] {
    const graph = this.getVariableDependencyGraph(grammar); const start = graph.states.find((state) => state.name === variable);
    if (!start) return [];
    const reached = new Set<State>([start]); const pending = [start];
    while (pending.length) for (const transition of graph.getTransitionsFrom(pending.pop()!)) if (!reached.has(transition.to)) { reached.add(transition.to); pending.push(transition.to); }
    return [...reached].filter((state) => state !== start).map((state) => state.name);
  }
  getUnitProductionlessGrammar(grammar: Grammar): Grammar { return removeUnitProductions(grammar); }
}

export class UselessProductionRemover {
  getCompleteUsefulVariableSet(grammar: Grammar): Set<string> {
    const useful = new Set<string>(); let changed = true;
    while (changed) {
      changed = false;
      for (const production of grammar.getProductions()) if (production.getVariablesOnRHS().every((variable) => useful.has(variable)) && !useful.has(production.getLHS())) { useful.add(production.getLHS()); changed = true; }
    }
    return useful;
  }
  getUselessProductionlessGrammar(grammar: Grammar): Grammar { return removeUselessProductions(grammar); }
}

export class ProductionComparator {
  constructor(readonly startVariable: string) { if (!startVariable) throw new TypeError('A start variable is required.'); }
  compare(left: Production, right: Production): number {
    if (left.getLHS() === this.startVariable && right.getLHS() !== this.startVariable) return -1;
    if (right.getLHS() === this.startVariable && left.getLHS() !== this.startVariable) return 1;
    return left.getLHS().localeCompare(right.getLHS()) || left.getRHS().localeCompare(right.getRHS());
  }
}

export class TuringChecker {
  static check(value: unknown): boolean {
    if (!(value instanceof Grammar)) return false;
    const productions = value.getProductions();
    return productions.length >= 3 && productions[0]!.getLHS() === 'S' && productions[0]!.getRHS() === 'V(==)S'
      && productions[1]!.getLHS() === 'S' && productions[1]!.getRHS() === 'SV(==)'
      && productions[2]!.getLHS() === 'S' && productions[2]!.getRHS() === 'T';
  }
}

export class Unrestricted {
  static minimumLength(value: string, smaller: Set<string>): number { return chars(value).filter((symbol) => !smaller.has(symbol)).length; }
  static smallerSymbols(grammar: Grammar): Set<string> {
    const smaller = new Set<string>(); let changed = true;
    while (changed) {
      changed = false;
      for (const production of grammar.getProductions()) {
        const lhs = chars(production.getLHS()); const rhs = chars(production.getRHS());
        if (Unrestricted.minimumLength(production.getLHS(), smaller) <= Unrestricted.minimumLength(production.getRHS(), smaller)) continue;
        for (const symbol of unique(lhs)) if (!smaller.has(symbol) && lhs.filter((item) => item === symbol).length > rhs.filter((item) => item === symbol).length) { smaller.add(symbol); changed = true; }
      }
    }
    return smaller;
  }
  static isUnrestricted(grammar: Grammar): boolean { return grammar.getProductions().some((production) => chars(production.getLHS()).length !== 1); }
  static optimize(grammar: Grammar): UnrestrictedGrammar | null {
    const productions = grammar.getProductions(); const terminating = new Set<string>(); const useful = new Set<Production>(); let changed = true;
    for (const production of productions) if (!production.getVariablesOnRHS().length) { useful.add(production); production.getSymbols().forEach((symbol) => terminating.add(symbol)); }
    while (changed) {
      changed = false;
      for (const production of productions) if (!useful.has(production) && production.getVariablesOnRHS().every((variable) => terminating.has(variable))) {
        useful.add(production); production.getSymbols().forEach((symbol) => terminating.add(symbol)); changed = true;
      }
    }
    const start = grammar.getStartVariable();
    if (!start || !productions.some((production) => production.getLHS() === start && useful.has(production))) return null;
    const result = new UnrestrictedGrammar(); result.setStartVariable(start);
    for (const production of productions) if (useful.has(production)) result.addProduction(new Production(production.getLHS(), production.getRHS()));
    return result;
  }
}
