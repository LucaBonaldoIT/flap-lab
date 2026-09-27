export class LemmaMath {
  static flipCoin(random = Math.random): number { return random() < 0.5 ? 0 : 2; }
  static fetchRandInt(min: number, max: number, random = Math.random): number {
    if (max < min) throw new RangeError(`Invalid random integer range ${min}..${max}.`);
    return Math.floor(random() * (max - min + 1)) + min;
  }
  static countInstances(value: string, symbol: string): number { return [...value].filter((char) => char === symbol).length; }
  static otherCharactersFound(value: string, alphabet: string[]): boolean { return [...value].some((char) => !alphabet.includes(char)); }
  static isMixture(value: string, order: string[]): boolean {
    let last = -1;
    for (const char of value) {
      const index = order.indexOf(char);
      if (index < 0 || index < last) return true;
      last = index;
    }
    return false;
  }
  static factorial(n: number): number { let result = 1; for (let value = 2; value <= n; value++) result *= value; return result; }
  static isFactorial(n: number): boolean { let value = 1; for (let factor = 1; value <= n; factor++) { if (value === n) return true; value *= factor + 1; } return false; }
}

export class PumpingCase {
  private userInput: number[] | null = null;
  private repetitions = -1;
  constructor(readonly label: string, readonly matches: (v: string, y: string) => boolean = () => true, readonly preset: (m: number) => number[] = () => []) {}
  isCase(v: string, y: string): boolean { return this.matches(v, y); }
  description(): string { return this.label; }
  getPreset(m: number): number[] { return this.preset(m); }
  getInput(m: number): number[] { return [...(this.userInput ?? this.getPreset(m))]; }
  setUserInput(input: number[]): void { this.userInput = [...input]; }
  setI(repetitions: number): void { this.repetitions = repetitions; }
  getI(): number { return this.repetitions; }
  reset(): void { this.userInput = null; this.repetitions = -1; }
}

export abstract class PumpingLemma {
  static readonly COMPUTER = 'Computer';
  static readonly HUMAN = 'Human';
  firstPlayer = PumpingLemma.HUMAN;
  m = -1;
  w = '';
  i = -1;
  partitionIsValid = true;
  explanation = '';
  decomposition: number[] = [];
  attempts: string[] = [];
  readonly allCases: PumpingCase[] = [];
  readonly doneCases: PumpingCase[] = [];
  readonly range: [number, number] = [1, 10];
  abstract readonly title: string;
  readonly id: string = '';
  abstract isInLang(value: string): boolean;
  abstract setDecomposition(lengths: number[], repetitions?: number): boolean;
  abstract createPumpedString(): string;
  protected abstract setSegments(): void;

  getTitle(): string { return this.title; }
  getHTMLTitle(): string { return this.title; }
  getFirstPlayer(): string { return this.firstPlayer; }
  setFirstPlayer(player: string): void { this.firstPlayer = player; }
  getM(): number { return this.m; }
  getW(): string { return this.w; }
  getI(): number { return this.i; }
  getRange(): number[] { return [...this.range]; }
  getDecomposition(): number[] { return [...this.decomposition]; }
  getAttempts(): string[] { return this.attempts; }
  getDoneCases(): PumpingCase[] { return this.doneCases; }
  getPartitionValidity(): boolean { return this.partitionIsValid; }
  getExplanation(): string { return this.explanation; }
  getDoneDescriptions(): string[] { return this.doneCases.map((item) => item.description()); }
  numCasesTotal(): number { return this.allCases.length; }
  setW(value: string): void { this.w = value; }
  setI(value: number): void { this.i = value; }
  setM(value: number): void { this.reset(); this.m = value; this.chooseW(); }
  addAttempt(value: string): void { this.attempts.push(value); }
  clearAttempts(): void { this.attempts.length = 0; }
  doAll(): void { for (const item of this.allCases) if (!this.doneCases.includes(item)) this.doneCases.push(item); }
  clearDoneCases(): void { this.doneCases.length = 0; for (const item of this.allCases) item.reset(); }
  clearCase(index: number): void { this.doneCases.splice(index, 1)[0]?.reset(); }
  getCase(index: number): PumpingCase { return this.doneCases[index]!; }
  reset(): void { this.m = -1; this.w = ''; this.i = -1; this.decomposition = []; this.setSegments(); }
  chooseM(random = Math.random): void { this.m = LemmaMath.fetchRandInt(this.range[0], this.range[1], random); this.chooseW(); }
  chooseW(): void { this.w = 'a'.repeat(Math.max(1, this.m)) + 'b'.repeat(Math.max(1, this.m)); }
  chooseI(random = Math.random): void { this.i = LemmaMath.flipCoin(random); }
  chooseDecomposition(random = Math.random): void {
    if (!this.w) return;
    const start = LemmaMath.fetchRandInt(0, Math.max(0, this.w.length - 1), random);
    const width = Math.max(1, Math.min(this.m, this.w.length - start));
    this.setDecomposition([start, width]);
  }
  addCase(lengths: number[], repetitions: number): number {
    if (!this.setDecomposition(lengths)) return -1;
    const [v, y] = this.getPumpingParts();
    const existing = this.doneCases.findIndex((item) => item.isCase(v, y));
    if (existing >= 0) return existing;
    const match = this.allCases.find((item) => item.isCase(v, y));
    if (!match) return -1;
    match.setI(repetitions); match.setUserInput(lengths); this.doneCases.push(match);
    return this.allCases.length;
  }
  replaceCase(lengths: number[], repetitions: number, index: number): boolean {
    const item = this.doneCases[index];
    if (!item || !this.setDecomposition(lengths)) return false;
    const [v, y] = this.getPumpingParts();
    if (!item.isCase(v, y)) return false;
    item.setI(repetitions); item.setUserInput(lengths); return true;
  }
  getDecompositionAsString(): string { return this.decomposition.join(', '); }
  protected getPumpingParts(): [string, string] { return ['', '']; }
  protected static repeat(value: string, count: number): string { return value.repeat(Math.max(0, count)); }
}

export abstract class RegularPumpingLemma extends PumpingLemma {
  x = ''; y = ''; z = '';
  override reset(): void { super.reset(); this.x = ''; this.y = ''; this.z = ''; }
  override getDecompositionAsString(): string { return `X = ${this.x || 'λ'}; Y = ${this.y || 'λ'}; Z = ${this.z || 'λ'}`; }
  override setDecomposition(lengths: number[], repetitions = this.i): boolean {
    if (lengths.length < 2) return false;
    const x = lengths[0]!; const y = lengths[1]!;
    if (x < 0 || y < 1 || x + y > this.m || x + y > this.w.length) return false;
    this.decomposition = [x, y]; this.i = repetitions;
    this.x = this.w.slice(0, x); this.y = this.w.slice(x, x + y); this.z = this.w.slice(x + y);
    return true;
  }
  override createPumpedString(): string { return this.x + RegularPumpingLemma.repeat(this.y, this.i) + this.z; }
  protected override setSegments(): void { this.x = ''; this.y = ''; this.z = ''; }
  protected override getPumpingParts(): [string, string] { return [this.y, this.y]; }
}

export abstract class ContextFreePumpingLemma extends PumpingLemma {
  u = ''; v = ''; x = ''; y = ''; z = '';
  override reset(): void { super.reset(); this.u = ''; this.v = ''; this.x = ''; this.y = ''; this.z = ''; }
  override getDecompositionAsString(): string { return `U = ${this.u || 'λ'}; V = ${this.v || 'λ'}; X = ${this.x || 'λ'}; Y = ${this.y || 'λ'}; Z = ${this.z || 'λ'}`; }
  override setDecomposition(lengths: number[], repetitions = this.i): boolean {
    if (lengths.length < 4) return false;
    const u = lengths[0]!; const v = lengths[1]!; const x = lengths[2]!; const y = lengths[3]!;
    if ([u, v, x, y].some((part) => part < 0) || v + x + y > this.m || v + y < 1 || u + v + x + y > this.w.length) return false;
    this.decomposition = [u, v, x, y]; this.i = repetitions;
    this.u = this.w.slice(0, u); this.v = this.w.slice(u, u + v); this.x = this.w.slice(u + v, u + v + x); this.y = this.w.slice(u + v + x, u + v + x + y); this.z = this.w.slice(u + v + x + y);
    return true;
  }
  override createPumpedString(): string { return this.u + RegularPumpingLemma.repeat(this.v, this.i) + this.x + RegularPumpingLemma.repeat(this.y, this.i) + this.z; }
  protected override setSegments(): void { this.u = ''; this.v = ''; this.x = ''; this.y = ''; this.z = ''; }
  protected override getPumpingParts(): [string, string] { return [this.v, this.y]; }
}

type LemmaSpec = { title: string; range?: [number, number]; regular?: boolean; language: (value: string) => boolean; witness?: (m: number) => string };
const ordered = (value: string, order: string): boolean => {
  let previous = -1;
  for (const char of value) { const index = order.indexOf(char); if (index < 0 || index < previous) return false; previous = index; }
  return true;
};
const counts = (value: string, symbol: string): number => LemmaMath.countInstances(value, symbol);
const repeatPairCount = (value: string): number => { let rest = value; let n = 0; while (rest.startsWith('ab')) { rest = rest.slice(2); n++; } return rest ? -1 : n; };

const SPECS: Record<string, LemmaSpec> = {
  'reg/AnBn': { title: 'a^n b^n', regular: true, language: (s) => ordered(s, 'ab') && counts(s, 'a') === counts(s, 'b') },
  'reg/AnBk': { title: 'a^n b^k : n is odd or k is even', regular: true, language: (s) => ordered(s, 'ab') && (counts(s, 'a') % 2 === 1 || counts(s, 'b') % 2 === 0) },
  'reg/AnBkCnk': { title: 'a^n b^k c^(n+k)', regular: true, language: (s) => ordered(s, 'abc') && counts(s, 'a') + counts(s, 'b') === counts(s, 'c') },
  'reg/AnEven': { title: 'a^(2n)', regular: true, language: (s) => [...s].every((c) => c === 'a') && s.length % 2 === 0 },
  'reg/AnBlAk': { title: 'a^n b^m a^k : n > 5, m > 3, k <= m', regular: true, language: (s) => { const match = /^(a*)(b*)(a*)$/u.exec(s); return !!match && match[1]!.length > 5 && match[2]!.length > 3 && match[3]!.length <= match[2]!.length; } },
  'reg/ABnAk': { title: '(ab)^n a^k : n > k', regular: true, language: (s) => { const match = /^(ab)+a*$/u.exec(s); if (!match) return false; const n = (s.match(/ab/gu) ?? []).length; return n > [...s.slice(2 * n)].length; } },
  'reg/AB2n': { title: '(ab)^(2n), n > 0', regular: true, language: (s) => { const n = repeatPairCount(s); return n > 0 && n % 2 === 0; } },
  'reg/NaNb': { title: 'n(a) < n(b)', regular: true, language: (s) => [...s].every((c) => c === 'a' || c === 'b') && counts(s, 'a') < counts(s, 'b') },
  'reg/Palindrome': { title: 'w w^R : w ∈ {a,b}*', regular: true, language: (s) => [...s].every((c) => c === 'a' || c === 'b') && s.length % 2 === 0 && s === [...s].reverse().join('') },
  'reg/B5W': { title: 'b^5w : 2n(a)(w) = 3n(b)(w)', regular: true, language: (s) => s.startsWith('bbbbb') && [...s].every((c) => c === 'a' || c === 'b') && 2 * counts(s.slice(5), 'a') === 3 * counts(s.slice(5), 'b') },
  'reg/B5Wmod': { title: 'b^5w : 2n(a)+5n(b) ≡ 0 mod 3', regular: true, language: (s) => s.startsWith('bbbbb') && [...s].every((c) => c === 'a' || c === 'b') && (2 * counts(s.slice(5), 'a') + 5 * counts(s.slice(5), 'b')) % 3 === 0 },
  'reg/BkABnBAn': { title: 'b^k(ab)^n(ba)^n', regular: true, language: (s) => { const match = /^(b+)((?:ab)+)((?:ba)+)$/u.exec(s); return !!match && match[1]!.length >= 4 && match[2]!.length / 2 === match[3]!.length / 2; } },
  'reg/BBABAnAn': { title: 'bba(ba)^n a^n', regular: true, language: (s) => { if (!s.startsWith('bba')) return false; let rest = s.slice(3); let n = 0; while (rest.startsWith('ba')) { rest = rest.slice(2); n++; } while (rest.startsWith('a')) { rest = rest.slice(1); n--; } return n === 1 && !rest; } },
  'cf/AnBn': { title: 'a^n b^n', language: (s) => ordered(s, 'ab') && counts(s, 'a') === counts(s, 'b') },
  'cf/AnBnCn': { title: 'a^n b^n c^n', language: (s) => ordered(s, 'abc') && counts(s, 'a') === counts(s, 'b') && counts(s, 'a') === counts(s, 'c') },
  'cf/AiBjCk': { title: 'a^i b^j c^k : i > j and i > k', language: (s) => ordered(s, 'abc') && counts(s, 'a') > counts(s, 'b') && counts(s, 'a') > counts(s, 'c') },
  'cf/NaNbNc': { title: 'n(a) < n(b) < n(c)', language: (s) => [...s].every((c) => 'abc'.includes(c)) && counts(s, 'a') < counts(s, 'b') && counts(s, 'b') < counts(s, 'c') },
  'cf/AnBjAnBj': { title: 'a^n b^j a^n b^j', language: (s) => { if (s.length % 2) return false; const half = s.slice(0, s.length / 2); return half === s.slice(s.length / 2) && ordered(half, 'ab'); } },
  'cf/WW': { title: 'ww : w ∈ {a,b}*', language: (s) => [...s].every((c) => c === 'a' || c === 'b') && s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2) },
  'cf/WW1WrEquals': { title: 'w w^R', language: (s) => s.length > 0 && [...s].every((c) => c === 'a' || c === 'b') && s.length % 2 === 0 && s === [...s].reverse().join('') },
  'cf/WW1WrGrtrThanEq': { title: 'w w^R, length ≥ 5', language: (s) => [...s].every((c) => c === 'a' || c === 'b') && s.length >= 5 },
  'cf/AkBnCnDj': { title: 'a^i b^j c^j d^k : i != k', language: (s) => { const match = /^(a*)(b*)(c*)(d*)$/u.exec(s); return !!match && match[2]!.length === match[3]!.length && match[1]!.length !== match[4]!.length; } },
  'cf/W1CW2CW3CW4': { title: 'w1 c w2 c w3 c w4 where w1=w2 or w3=w4', language: (s) => { const p = s.split('c'); return p.length === 4 && p.every((part) => part.length > 0 && [...part].every((c) => c === 'a' || c === 'b')) && (p[0] === p[1] || p[2] === p[3]); } },
  'cf/W1BnW2': { title: 'w1 b^n w2 : na(w1) < na(w2) and na(w1) < n', language: (s) => {
    if (![...s].every((char) => char === 'a' || char === 'b')) return false;
    for (let start = 0; start < s.length; start++) if (s[start] === 'b') {
      let end = start; while (s[end] === 'b') end++;
      const beforeA = counts(s.slice(0, end), 'a'); const afterA = counts(s.slice(end), 'a');
      if (beforeA < afterA && end - start > beforeA) return true;
      start = end - 1;
    }
    return false;
  } },
  'cf/W1VVrW2': { title: 'w1 v v^R w2', language: (s) => { if (![...s].every((c) => c === 'a' || c === 'b')) return false; for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++) { const v = s.slice(a, b); if (s.slice(b).startsWith([...v].reverse().join(''))) return true; } return false; } },
  'cf/NagNbeNc': { title: 'a^g b^e c^n with g > e', language: (s) => { const match = /^(a*)(b*)(c*)$/u.exec(s); return !!match && match[1]!.length > match[2]!.length; } },
};

class ConfiguredRegularLemma extends RegularPumpingLemma {
  readonly title: string;
  override readonly id: string;
  constructor(readonly key: string, private readonly spec: LemmaSpec) { super(); this.id = key; this.title = spec.title; this.partitionIsValid = spec.regular ?? false; if (spec.range) this.range.splice(0, 2, ...spec.range); this.allCases.push(new PumpingCase('regular decomposition')); }
  isInLang(value: string): boolean { return this.spec.language(value); }
  override chooseW(): void { const value = this.spec.witness?.(this.m); if (value !== undefined) this.w = value; else super.chooseW(); }
}
class ConfiguredContextFreeLemma extends ContextFreePumpingLemma {
  readonly title: string;
  override readonly id: string;
  constructor(readonly key: string, private readonly spec: LemmaSpec) { super(); this.id = key; this.title = spec.title; this.partitionIsValid = false; if (spec.range) this.range.splice(0, 2, ...spec.range); this.allCases.push(new PumpingCase('context-free decomposition')); }
  isInLang(value: string): boolean { return this.spec.language(value); }
  override chooseW(): void { const value = this.spec.witness?.(this.m); if (value !== undefined) this.w = value; else super.chooseW(); }
}

type LemmaConstructor = new () => PumpingLemma;
const constructors = new Map<string, LemmaConstructor>();
for (const [key, spec] of Object.entries(SPECS)) {
  const Constructor = key.startsWith('reg/')
    ? class extends ConfiguredRegularLemma { constructor() { super(key, spec); } }
    : class extends ConfiguredContextFreeLemma { constructor() { super(key, spec); } };
  constructors.set(key, Constructor);
}
export const PumpingLemmas = {
  regular: Object.fromEntries([...constructors].filter(([key]) => key.startsWith('reg/')).map(([key, Constructor]) => [key.slice(4), Constructor])) as Record<string, LemmaConstructor>,
  contextFree: Object.fromEntries([...constructors].filter(([key]) => key.startsWith('cf/')).map(([key, Constructor]) => [key.slice(3), Constructor])) as Record<string, LemmaConstructor>,
};

export function createPumpingLemma(name: string): PumpingLemma {
  const key = name.includes('/') ? name : (Object.entries(SPECS).find(([, spec]) => spec.title === name)?.[0] ?? `reg/${name}`);
  const spec = SPECS[key];
  if (!spec) throw new RangeError(`Unknown pumping lemma '${name}'.`);
  const Constructor = constructors.get(key)!;
  return new Constructor();
}

export const pumpingLemmaNames = (): string[] => Object.keys(SPECS);
export class PumpingLemmaFactory {
  static createPumpingLemma(type: string, name: string): PumpingLemma {
    const lemma = createPumpingLemma(name);
    const expectsRegular = type.toLowerCase().startsWith('reg');
    if (expectsRegular !== (lemma instanceof RegularPumpingLemma)) throw new TypeError(`Pumping lemma '${name}' does not match type '${type}'.`);
    return lemma;
  }
}
