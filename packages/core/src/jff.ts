import { Automaton, FiniteStateAutomaton, FSATransition, MealyMachine, MealyTransition, MooreMachine, MooreTransition, PDATransition, Point, PushdownAutomaton, State, TMTransition, TuringDirection, TuringMachine } from './model.js';
import { ConvertedUnrestrictedGrammar, Grammar, Production, TuringChecker, UnboundGrammar } from './grammar.js';
import { LSystem } from './lsystem.js';
import { RegularExpression } from './regular-expression.js';
import { ContextFreePumpingLemma, createPumpingLemma, PumpingLemma, RegularPumpingLemma } from './pumping.js';

export type JFLAPStructure = Automaton | Grammar | LSystem | RegularExpression | PumpingLemma;

interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

function decodeXml(value: string): string {
  return value.replace(/&#x([\da-f]+);/giu, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, '&');
}

function encodeXml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&apos;');
}

function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: '#document', attributes: {}, children: [], text: '' };
  const stack = [root];
  const tokens = xml.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/gu) ?? [];
  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<?') || /^<!DOCTYPE/iu.test(token)) continue;
    if (token.startsWith('<![CDATA[')) { stack.at(-1)!.text += token.slice(9, -3); continue; }
    if (token.startsWith('</')) {
      if (stack.length === 1) throw new SyntaxError('Unexpected XML closing tag.');
      const element = stack.pop()!;
      const closing = token.slice(2, -1).trim();
      if (element.name !== closing) throw new SyntaxError(`Mismatched XML tag: expected </${element.name}> but found </${closing}>.`);
      continue;
    }
    if (token.startsWith('<')) {
      const match = /^<\s*([^\s/>]+)([\s\S]*?)\s*\/?>$/u.exec(token);
      if (!match) throw new SyntaxError(`Invalid XML tag: ${token}`);
      const name = match[1]!;
      const rawAttributes = match[2]!;
      const attributes: Record<string, string> = {};
      for (const attr of rawAttributes.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) attributes[attr[1]!] = decodeXml(attr[2] ?? attr[3] ?? '');
      const node: XmlElement = { name, attributes, children: [], text: '' };
      stack.at(-1)!.children.push(node);
      if (!token.endsWith('/>')) stack.push(node);
      continue;
    }
    stack.at(-1)!.text += decodeXml(token);
  }
  if (stack.length !== 1) throw new SyntaxError(`Unclosed XML tag <${stack.at(-1)!.name}>.`);
  const documentRoot = root.children[0];
  if (!documentRoot) throw new SyntaxError('JFLAP XML document is empty.');
  return documentRoot;
}

function children(element: XmlElement, name: string): XmlElement[] { return element.children.filter((child) => child.name === name); }
function child(element: XmlElement, name: string): XmlElement | undefined { return children(element, name)[0]; }
function text(element: XmlElement | undefined): string { return element?.text.trim() ?? ''; }
function number(element: XmlElement | undefined, fallback = 0): number {
  if (!element) return fallback;
  const value = Number(text(element));
  if (!Number.isFinite(value)) throw new SyntaxError(`Invalid numeric JFLAP value: ${text(element)}`);
  return value;
}

export class JFFCodec {
  static decode(xml: string): JFLAPStructure {
    const root = parseXml(xml);
    const type = text(child(root, 'type'));
    const automatonNode = child(root, 'automaton') ?? root;
    if (type === 're') return new RegularExpression(text(child(root, 'expression')));
    if (type === 'regular pumping lemma' || type === 'context-free pumping lemma') {
      const lemma = createPumpingLemma(text(child(root, 'name')));
      lemma.setFirstPlayer(text(child(root, 'first_player')));
      lemma.setM(number(child(root, 'm')));
      lemma.setW(text(child(root, 'w')));
      lemma.setI(number(child(root, 'i'), -1));
      if (lemma instanceof RegularPumpingLemma) {
        lemma.setDecomposition([number(child(root, 'xLength')), number(child(root, 'yLength'))], lemma.getI());
      } else if (lemma instanceof ContextFreePumpingLemma) {
        lemma.setDecomposition([number(child(root, 'uLength')), number(child(root, 'vLength')), number(child(root, 'xLength')), number(child(root, 'yLength'))], lemma.getI());
        for (const caseNode of children(root, 'case')) {
          const lengths = ['caseULength', 'caseVLength', 'caseXLength', 'caseYLength'].map((tag) => number(child(caseNode, tag)));
          lemma.addCase(lengths, number(child(caseNode, 'caseI'), -1));
        }
      }
      for (const attempt of children(root, 'attempt')) lemma.addAttempt(text(attempt));
      return lemma;
    }
    if (type === 'lsystem') {
      const rules = new UnboundGrammar();
      for (const production of children(root, 'production')) {
        const lhs = text(child(production, 'left'));
        for (const replacement of children(production, 'right')) rules.addProduction(new Production(lhs, text(replacement)));
      }
      const values = new Map<string, string>();
      for (const parameter of children(root, 'parameter')) {
        const name = text(child(parameter, 'name'));
        if (name) values.set(name, text(child(parameter, 'value')));
      }
      return new LSystem(text(child(root, 'axiom')), rules, values);
    }
    if (type === 'edu/duke/cs/jflap/grammar' || type === 'grammar') {
      const grammar = new UnboundGrammar();
      for (const production of children(root, 'production')) grammar.addProduction(new Production(text(child(production, 'left')), text(child(production, 'right'))));
      if (TuringChecker.check(grammar)) {
        const converted = new ConvertedUnrestrictedGrammar();
        converted.setStartVariable(grammar.getStartVariable());
        converted.addProductions(grammar.getProductions().map((production) => new Production(production.getLHS(), production.getRHS())));
        return converted;
      }
      return grammar;
    }
    const tapeCount = Math.max(1, number(child(root, 'tapes'), 1));
    let automaton: Automaton;
    if (type === 'fa') automaton = new FiniteStateAutomaton();
    else if (type === 'mealy') automaton = new MealyMachine();
    else if (type === 'moore') automaton = new MooreMachine();
    else if (type === 'pda') automaton = new PushdownAutomaton();
    else if (type === 'turing') automaton = new TuringMachine(tapeCount);
    else throw new TypeError(`Unsupported JFLAP file type: ${type || '(missing type)'}.`);

    const states = new Map<number, State>();
    for (const node of children(automatonNode, 'state')) {
      const id = Number(node.attributes.id);
      if (!Number.isInteger(id) || id < 0) throw new SyntaxError(`Invalid JFLAP state id: ${node.attributes.id ?? ''}.`);
      if (states.has(id)) throw new SyntaxError(`Duplicate JFLAP state id ${id}.`);
      const point: Point = { x: number(child(node, 'x')), y: number(child(node, 'y')) };
      const state = automaton.createState(point, id);
      state.name = node.attributes.name || `q${id}`;
      const label = child(node, 'label');
      if (label) state.label = text(label);
      const output = child(node, 'output');
      if (output) state.output = text(output);
      states.set(id, state);
      if (child(node, 'initial')) automaton.setInitialState(state);
      if (child(node, 'final')) automaton.addFinalState(state);
    }

    for (const node of children(automatonNode, 'transition')) {
      const from = states.get(number(child(node, 'from'), Number.NaN));
      const to = states.get(number(child(node, 'to'), Number.NaN));
      if (!from || !to) throw new SyntaxError('JFLAP transition references a missing state.');
      if (automaton instanceof FiniteStateAutomaton) {
        const transition = automaton.transition(from, to, text(child(node, 'read')));
        const controlX = child(node, 'controlx');
        const controlY = child(node, 'controly');
        if (controlX && controlY) transition.control = { x: number(controlX), y: number(controlY) };
      } else if (automaton instanceof PushdownAutomaton) {
        automaton.transition(from, to, text(child(node, 'read')), text(child(node, 'pop')), text(child(node, 'push')));
      } else if (automaton instanceof TuringMachine) {
        const reads = children(node, 'read');
        const writes = children(node, 'write');
        const moves = children(node, 'move');
        const readArray = Array.from({ length: automaton.tapeCount }, (_, i) => text(reads.find((item) => Number(item.attributes.tape || 1) === i + 1)));
        const writeArray = Array.from({ length: automaton.tapeCount }, (_, i) => text(writes.find((item) => Number(item.attributes.tape || 1) === i + 1)));
        const moveArray = Array.from({ length: automaton.tapeCount }, (_, i) => (text(moves.find((item) => Number(item.attributes.tape || 1) === i + 1)) || 'R') as TuringDirection);
        automaton.transition(from, to, readArray, writeArray, moveArray);
      } else if (automaton instanceof MealyMachine) {
        automaton.transition(from, to, text(child(node, 'read')), text(child(node, 'transout')));
      } else if (automaton instanceof MooreMachine) {
        automaton.transition(from, to, text(child(node, 'read')));
      }
    }
    for (const note of children(automatonNode, 'note')) {
      const noteText = child(note, 'text');
      if (noteText) automaton.notes.push({ text: text(noteText), point: { x: number(child(note, 'x')), y: number(child(note, 'y')) } });
    }
    return automaton;
  }

  static encode(structure: JFLAPStructure): string {
    if (structure instanceof PumpingLemma) {
      const cf = structure instanceof ContextFreePumpingLemma;
      const values: Array<[string, string]> = [
        ['name', structure.getTitle()], ['first_player', structure.getFirstPlayer()], ['m', String(structure.getM())],
        ['w', structure.getW()], ['i', String(structure.getI())],
      ];
      if (cf) values.push(['uLength', String(structure.u.length)], ['vLength', String(structure.v.length)]);
      if (structure instanceof RegularPumpingLemma) values.push(['xLength', String(structure.x.length)], ['yLength', String(structure.y.length)]);
      else if (cf) values.push(['xLength', String(structure.x.length)], ['yLength', String(structure.y.length)]);
      const lines = ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>', '<structure>', `  <type>${cf ? 'context-free pumping lemma' : 'regular pumping lemma'}</type>`, ...values.map(([tag, value]) => `  <${tag}>${encodeXml(value)}</${tag}>`)];
      for (const attempt of structure.getAttempts()) lines.push(`  <attempt>${encodeXml(attempt)}</attempt>`);
      if (cf) for (const item of structure.getDoneCases()) {
        const parts = item.getInput(structure.getM());
        lines.push('  <case>', `    <caseULength>${parts[0] ?? 0}</caseULength>`, `    <caseVLength>${parts[1] ?? 0}</caseVLength>`, `    <caseXLength>${parts[2] ?? 0}</caseXLength>`, `    <caseYLength>${parts[3] ?? 0}</caseYLength>`, `    <caseI>${item.getI()}</caseI>`, '  </case>');
      }
      lines.push('</structure>');
      return lines.join('\n');
    }
    if (structure instanceof RegularExpression) {
      return ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>', '<structure>', '  <type>re</type>', `  <expression>${encodeXml(structure.asString())}</expression>`, '</structure>'].join('\n');
    }
    if (structure instanceof LSystem) {
      const lines = ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>', '<structure>', '  <type>lsystem</type>', `  <axiom>${encodeXml(structure.getAxiom().join(' '))}</axiom>`];
      for (const symbol of structure.getSymbolsWithReplacements()) {
        lines.push('  <production>', `    <left>${encodeXml(symbol)}</left>`);
        for (const replacement of structure.getReplacements(symbol)) lines.push(`    <right>${encodeXml(replacement.join(' '))}</right>`);
        lines.push('  </production>');
      }
      for (const [name, value] of structure.values) lines.push('  <parameter>', `    <name>${encodeXml(name)}</name>`, `    <value>${encodeXml(String(value))}</value>`, '  </parameter>');
      lines.push('</structure>');
      return lines.join('\n');
    }
    if (structure instanceof Grammar) {
      const lines = ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>', '<structure>', '  <type>edu/duke/cs/jflap/grammar</type>'];
      for (const production of structure.getProductions()) lines.push('  <production>', `    <left>${encodeXml(production.getLHS())}</left>`, `    <right>${encodeXml(production.getRHS())}</right>`, '  </production>');
      lines.push('</structure>');
      return lines.join('\n');
    }
    const automaton = structure;
    const type = automaton.kind;
    const lines = ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>', '<structure>', `  <type>${type}</type>`];
    if (automaton instanceof TuringMachine && automaton.tapeCount > 1) lines.push(`  <tapes>${automaton.tapeCount}</tapes>`);
    lines.push('  <automaton>');
    for (const state of automaton.states) {
      lines.push(`    <state id="${state.id}" name="${encodeXml(state.name)}">`);
      lines.push(`      <x>${state.point.x}</x>`, `      <y>${state.point.y}</y>`);
      if (state.label !== undefined) lines.push(`      <label>${encodeXml(state.label)}</label>`);
      if (state.output !== undefined) lines.push(`      <output>${encodeXml(state.output)}</output>`);
      if (automaton.initialState === state) lines.push('      <initial/>');
      if (automaton.isFinalState(state)) lines.push('      <final/>');
      lines.push('    </state>');
    }
    for (const transition of automaton.transitions) {
      lines.push('    <transition>', `      <from>${transition.from.id}</from>`, `      <to>${transition.to.id}</to>`);
      if (transition.control) lines.push(`      <controlx>${transition.control.x}</controlx>`, `      <controly>${transition.control.y}</controly>`);
      if (transition instanceof FSATransition) lines.push(`      <read>${encodeXml(transition.label)}</read>`);
      else if (transition instanceof MooreTransition) lines.push(`      <read>${encodeXml(transition.label)}</read>`, `      <transout>${encodeXml(transition.output)}</transout>`);
      else if (transition instanceof MealyTransition) lines.push(`      <read>${encodeXml(transition.label)}</read>`, `      <transout>${encodeXml(transition.output)}</transout>`);
      else if (transition instanceof PDATransition) lines.push(`      <read>${encodeXml(transition.input)}</read>`, `      <pop>${encodeXml(transition.pop)}</pop>`, `      <push>${encodeXml(transition.push)}</push>`);
      else if (transition instanceof TMTransition) {
        transition.reads.forEach((symbol, index) => {
          const tapeAttribute = transition.reads.length > 1 ? ` tape="${index + 1}"` : '';
          lines.push(`      <read${tapeAttribute}>${encodeXml(symbol === ' ' ? '' : symbol)}</read>`);
          lines.push(`      <write${tapeAttribute}>${encodeXml(transition.writes[index] === ' ' ? '' : transition.writes[index]!)}</write>`);
          lines.push(`      <move${tapeAttribute}>${transition.directions[index]}</move>`);
        });
      }
      lines.push('    </transition>');
    }
    for (const note of automaton.notes) lines.push(`    <note><text>${encodeXml(note.text)}</text><x>${note.point.x}</x><y>${note.point.y}</y></note>`);
    lines.push('  </automaton>', '</structure>');
    return lines.join('\n');
  }
}

export const decodeJFF = (xml: string): JFLAPStructure => JFFCodec.decode(xml);
export const encodeJFF = (structure: JFLAPStructure): string => JFFCodec.encode(structure);
