import { Grammar, Production } from './grammar.js';

export type LSystemValues = Record<string, string | number> | Map<string, string | number>;
export class LSystem {
  readonly axiom: string[];
  readonly values: ReadonlyMap<string, string | number>;
  private readonly replacements = new Map<string, string[][]>();
  private stochastic = false;

  constructor(axiom = '', rules?: Grammar, values: LSystemValues = {}) {
    this.axiom = LSystem.tokenify(axiom);
    this.values = values instanceof Map ? new Map(values) : new Map(Object.entries(values));
    for (const production of rules?.getProductions() ?? []) this.addRule(production);
  }

  static tokenify(value: string): string[] { return value.trim() ? value.trim().split(/\s+/u) : []; }
  addRule(production: Production): void {
    const current = this.replacements.get(production.getLHS()) ?? [];
    const replacement = LSystem.tokenify(production.getRHS());
    if (current.length && JSON.stringify(current.at(-1)) !== JSON.stringify(replacement)) this.stochastic = true;
    current.push(replacement);
    this.replacements.set(production.getLHS(), current);
  }
  getAxiom(): string[] { return [...this.axiom]; }
  getReplacements(symbol: string): string[][] { return (this.replacements.get(symbol) ?? []).map((list) => [...list]); }
  getSymbolsWithReplacements(): Set<string> { return new Set(this.replacements.keys()); }
  nondeterministic(): boolean { return this.stochastic; }
}

export class Expander {
  private readonly cache: string[][];
  private seed: number;
  private readonly contexts: Array<{ tokens: string[]; center: number; outputs: string[][] }> = [];

  constructor(readonly lsystem: LSystem, seed = Date.now()) {
    this.seed = seed >>> 0;
    this.cache = [lsystem.getAxiom()];
    this.initializeContexts();
  }

  expansionForLevel(level: number, maxSymbols = 1_000_000): string[] {
    if (!Number.isInteger(level) || level < 0) throw new RangeError(`Expansion level ${level} is invalid.`);
    while (this.cache.length <= level) {
      const next = this.expand(this.cache.at(-1)!);
      if (next.length > maxSymbols) throw new RangeError(`L-system expansion exceeds ${maxSymbols} symbols.`);
      this.cache.push(next);
    }
    return [...this.cache[level]!];
  }

  private randomIndex(length: number): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let value = this.seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const random = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    return Math.floor(random * length);
  }

  private initializeContexts(): void {
    for (const symbol of this.lsystem.getSymbolsWithReplacements()) {
      const tokens = LSystem.tokenify(symbol);
      let center = 0;
      let contextTokens = tokens;
      if (tokens.length > 1) {
        const parsed = Number(tokens[0]);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed + 1 >= tokens.length) continue;
        center = parsed;
        contextTokens = tokens.slice(1);
      }
      this.contexts.push({ tokens: contextTokens, center, outputs: this.lsystem.getReplacements(symbol) });
    }
  }

  private expand(symbols: string[]): string[] {
    const output: string[] = [];
    for (let index = 0; index < symbols.length; index++) {
      const symbol = symbols[index]!;
      const matches = this.contexts.length
        ? this.contexts.filter((context) => context.tokens.every((token, offset) => symbols[index - context.center + offset] === token))
        : [];
      const options = this.contexts.length ? matches.flatMap((context) => context.outputs) : this.lsystem.getReplacements(symbol);
      if (!options.length) { output.push(symbol); continue; }
      output.push(...options[this.randomIndex(options.length)]!);
    }
    return output;
  }
}
