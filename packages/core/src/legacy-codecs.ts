import { Automaton, FiniteStateAutomaton, PushdownAutomaton, State, TuringDirection, TuringMachine } from './model.js';
import { Production, UnboundGrammar } from './grammar.js';
import { RegularExpression } from './regular-expression.js';
import { decodeJFF, encodeJFF, JFLAPStructure } from './jff.js';

export class ParseError extends SyntaxError {}
export class EncodeError extends Error {}
export class DataError extends Error {}

/** Reads the text-oriented JFLAP 3 formats (.FA, .PDA, .TM, .TTM, .GRM, .REX). */
export function decodeJFLAP3(contents: string, filename: string): JFLAPStructure {
  const extension = filename.slice(filename.lastIndexOf('.')).toUpperCase();
  if (extension === '.REX') return new RegularExpression(contents.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).at(-1) ?? '');
  if (extension === '.GRM') {
    const grammar = new UnboundGrammar();
    contents.split(/\r?\n/u).forEach((line, index) => {
      const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split(/\s+/u);
      if (parts.length < 2 || parts.length > 3 || parts[1] !== '->') throw new ParseError(`Line ${index + 1} is not formatted properly.`);
      grammar.addProduction(new Production(parts[0]!, parts[2] ?? ''));
    });
    return grammar;
  }

  const lines = contents.split(/\r?\n/u);
  let cursor = 0;
  const next = (): string => { const line = lines[cursor++]; if (line === undefined) throw new ParseError('Unexpected end of JFLAP 3 file.'); return line.trim(); };
  const type = next();
  let automaton: Automaton; let groupSize: number; let targetIndex: number;
  if (type === 'One-Way-FSA' && ['.FA', '.'].includes(extension)) { automaton = new FiniteStateAutomaton(); groupSize = 2; targetIndex = 1; }
  else if (type === 'PDAP' && extension === '.PDA') {
    const mode = next();
    if (!['FINAL', 'EMPTY', 'FINAL+EMPTY'].includes(mode)) throw new ParseError(`Invalid PDA acceptance mode ${mode}.`);
    const acceptance = mode === 'EMPTY' ? 'empty-stack' : mode === 'FINAL+EMPTY' ? 'either' : 'final-state';
    automaton = new PushdownAutomaton(false, acceptance); groupSize = 5; targetIndex = 3;
  }
  else if (type === 'REGTM' && (extension === '.TM' || extension === '.TTM')) {
    if (next() !== 'TAPE') throw new ParseError('Expected TAPE marker.');
    const tapeCount = Number(next()); if (tapeCount !== 1 && tapeCount !== 2) throw new ParseError('JFLAP 3 supports only one or two tapes.');
    automaton = new TuringMachine(tapeCount); groupSize = 1 + 3 * tapeCount; targetIndex = 1;
  } else throw new ParseError(`Unrecognized JFLAP 3 structure type '${type}'.`);

  const stateCount = Number(next());
  if (!Number.isInteger(stateCount) || stateCount < 0) throw new ParseError('Invalid state count.');
  next(); // Alphabet metadata.
  if (!(automaton instanceof FiniteStateAutomaton)) next(); // Stack/tape metadata.
  const states: State[] = Array.from({ length: stateCount }, () => automaton.createState());
  const initialId = Number(next());
  if (initialId < 1 || initialId > states.length) throw new ParseError('Invalid initial-state id.');
  automaton.setInitialState(states[initialId - 1]!);
  const finalIds = next().split(/\s+/u).map(Number);
  if (finalIds.at(-1) !== 0) throw new ParseError('Final-state list must end with 0.');
  for (const id of finalIds.slice(0, -1)) {
    if (id < 1 || id > states.length) throw new ParseError(`Invalid final-state id ${id}.`);
    automaton.addFinalState(states[id - 1]!);
  }

  for (let from = 0; from < stateCount; from++) {
    const tokens = next().split(/\s+/u);
    if (tokens.at(-1) !== 'EOL' || (tokens.length - 1) % groupSize !== 0) throw new ParseError(`Transition row ${from + 1} is malformed.`);
    for (let offset = 0; offset < tokens.length - 1; offset += groupSize) {
      const group = tokens.slice(offset, offset + groupSize);
      const toId = Number(group[targetIndex]);
      const to = states[toId - 1]; if (!to) throw new ParseError(`Transition references invalid state ${toId}.`);
      if (automaton instanceof FiniteStateAutomaton) automaton.transition(states[from]!, to, group[0] === 'null' ? '' : group[0]!);
      else if (automaton instanceof PushdownAutomaton) automaton.transition(states[from]!, to, group[0] === 'null' ? '' : group[0]!, group[1] === 'null' ? '' : group[1]!, group[4] === 'null' ? '' : group[4]!);
      else if (automaton instanceof TuringMachine) {
        const readIndexes = automaton.tapeCount === 1 ? [0] : [0, 4];
        const writeIndexes = automaton.tapeCount === 1 ? [2] : [2, 5];
        const moveIndexes = automaton.tapeCount === 1 ? [3] : [3, 6];
        const reads = readIndexes.map((index) => group[index] === 'B' ? ' ' : group[index]!);
        const writes = writeIndexes.map((index) => group[index] === 'B' ? ' ' : group[index]!);
        const directions = moveIndexes.map((index) => group[index]!.toUpperCase() as TuringDirection);
        automaton.transition(states[from]!, to, reads, writes, directions);
      }
    }
  }
  for (let index = 0; index < stateCount; index++) {
    const position = next().split(/\s+/u);
    const x = Number(position[1]); const y = Number(position[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new ParseError(`Bad coordinates for state ${index + 1}.`);
    states[index]!.point = { x, y };
  }
  return automaton;
}

export class JFLAP3Codec {
  static decode(contents: string, filename: string): JFLAPStructure { return decodeJFLAP3(contents, filename); }
}

/** JSON persistence replacing Java ObjectOutputStream for portable JS data. */
export class SerializedCodec {
  encode(structure: JFLAPStructure): string {
    return JSON.stringify({ format: 'flap-lab-core', version: 1, jff: encodeJFF(structure) });
  }
  decode(serialized: string): JFLAPStructure {
    let payload: unknown;
    try { payload = JSON.parse(serialized); } catch { throw new ParseError('Invalid serialized JSON.'); }
    if (!payload || typeof payload !== 'object' || !('jff' in payload) || typeof payload.jff !== 'string') throw new ParseError('Unrecognized serialized JFLAP structure.');
    return decodeJFF(payload.jff);
  }
  canEncode(_structure: JFLAPStructure): boolean { return true; }
}

export class CodecRegistry {
  private readonly decoders = new Map<string, (contents: string, filename: string) => JFLAPStructure>();
  constructor() {
    this.decoders.set('.jff', (contents) => decodeJFF(contents));
    this.decoders.set('.xml', (contents) => decodeJFF(contents));
    this.decoders.set('.json', (contents) => new SerializedCodec().decode(contents));
  }
  add(extension: string, decoder: (contents: string, filename: string) => JFLAPStructure): void { this.decoders.set(extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`, decoder); }
  getDecoders(): string[] { return [...this.decoders.keys()]; }
  decode(contents: string, filename: string): JFLAPStructure {
    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    const decoder = this.decoders.get(extension);
    if (decoder) return decoder(contents, filename);
    return decodeJFLAP3(contents, filename);
  }
  static decode(contents: string, filename: string): JFLAPStructure {
    return new CodecRegistry().decode(contents, filename);
  }
}
