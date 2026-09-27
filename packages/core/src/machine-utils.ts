export class CharacterStack {
  private content: string[];
  constructor(stack?: CharacterStack | string) { this.content = stack instanceof CharacterStack ? [...stack.content] : stack ? [...stack] : []; }
  push(value: string): void { this.content.unshift(...value); }
  pop(count = 1): string | null {
    if (count < 0 || count > this.content.length) return null;
    return this.content.splice(0, count).join('');
  }
  peek(): string | undefined { return this.content[0]; }
  clear(): void { this.content = []; }
  height(): number { return this.content.length; }
  toString(): string { return this.content.join(''); }
  equals(other: CharacterStack): boolean { return this.toString() === other.toString(); }
}

export class Tape {
  private readonly cells = new Map<number, string>();
  private head = 0;
  constructor(input = '') { [...input].forEach((symbol, index) => { if (symbol !== Tape.BLANK) this.cells.set(index, symbol); }); }
  static readonly BLANK = ' ';
  readChar(): string { return this.cells.get(this.head) ?? Tape.BLANK; }
  read(): string { return this.readChar(); }
  writeChar(symbol: string): void { this.write(symbol); }
  write(symbol: string): void {
    if ([...symbol].length !== 1) throw new TypeError('Tape writes exactly one symbol at a time.');
    if (symbol === Tape.BLANK) this.cells.delete(this.head); else this.cells.set(this.head, symbol);
  }
  moveHead(direction: 'L' | 'R' | 'S' | string): void {
    if (direction === 'L') this.head--;
    else if (direction === 'R') this.head++;
    else if (direction !== 'S') throw new TypeError(`Unknown tape direction '${direction}'.`);
  }
  getTapeHead(): number { return this.head; }
  setTapeHead(index: number): void { this.head = index; }
  getContents(): string {
    if (!this.cells.size) return '';
    const min = Math.min(0, ...this.cells.keys()); const max = Math.max(...this.cells.keys());
    return Array.from({ length: max - min + 1 }, (_, offset) => this.cells.get(min + offset) ?? Tape.BLANK).join('');
  }
  getOutput(): string { return this.getContents().trim(); }
  clone(): Tape { const copy = new Tape(); for (const [index, symbol] of this.cells) copy.cells.set(index, symbol); copy.head = this.head; return copy; }
  toString(): string { return this.getContents(); }
}

export interface StateLayoutProvider { getPointForState(_automaton?: unknown): { x: number; y: number } }
export class StatePlacer implements StateLayoutProvider {
  constructor(private readonly random: () => number = Math.random) {}
  getPointForState(_automaton?: unknown): { x: number; y: number } { return { x: Math.floor(this.random() * 600), y: Math.floor(this.random() * 600) }; }
}
