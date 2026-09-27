import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FiniteStateAutomaton,
  FSASimulator,
  JFFCodec,
  MealyMachine,
  MealySimulator,
  MooreMachine,
  MooreSimulator,
  Production,
  ContextFreeGrammar,
  UnboundGrammar,
  CYKParser,
  RightLinearGrammar,
  RegularExpression,
  bruteParse,
  fsaToRegularExpression,
  rightLinearGrammarToFSA,
  toChomskyNormalForm,
  LSystem,
  Expander,
  cloneAutomaton,
  getLambdaClosure,
  getUnreachableStates,
  getUselessStates,
  LLParser,
  LRParser,
  JFLAP3Codec,
  createPumpingLemma,
  PDAToCFGConverter,
  CFGToPDALLConverter,
  SerializedCodec,
  Discretizer,
  Unrestricted,
  PDASimulator,
  PushdownAutomaton,
  TuringMachine,
  TuringMachineSimulator,
  determinize,
  equivalent,
  minimize,
} from '../dist/index.js';

test('FSA simulates nondeterminism, lambda edges, and cyclic graphs', () => {
  const fsa = new FiniteStateAutomaton();
  const q0 = fsa.createState();
  const q1 = fsa.createState();
  const q2 = fsa.createState();
  fsa.setInitialState(q0);
  fsa.addFinalState(q2);
  fsa.transition(q0, q0, 'λ');
  fsa.transition(q0, q1, 'a');
  fsa.transition(q1, q2, 'b');

  const sim = new FSASimulator(fsa);
  assert.equal(sim.simulate('ab'), true);
  assert.equal(sim.simulate('a'), false);
  assert.equal(sim.simulate('abb'), false);
});

test('JFF codec round-trips FSA state metadata and transitions', () => {
  const fsa = new FiniteStateAutomaton();
  const start = fsa.createState({ x: 10, y: 20 }, 3);
  const end = fsa.createState({ x: 90, y: 20 }, 9);
  end.label = 'end & done';
  fsa.setInitialState(start);
  fsa.addFinalState(end);
  fsa.transition(start, end, 'x');
  const reloaded = JFFCodec.decode(JFFCodec.encode(fsa));

  assert.ok(reloaded instanceof FiniteStateAutomaton);
  assert.equal(new FSASimulator(reloaded).simulate('x'), true);
  assert.equal(reloaded.getState(9)?.label, 'end & done');
  assert.deepEqual(reloaded.getState(3)?.point, { x: 10, y: 20 });
});

test('PDA simulator applies input, pop, and push operations', () => {
  const pda = new PushdownAutomaton();
  const q0 = pda.createState();
  const q1 = pda.createState();
  const q2 = pda.createState();
  pda.setInitialState(q0);
  pda.addFinalState(q2);
  pda.transition(q0, q1, 'a', 'Z', 'AZ');
  pda.transition(q1, q2, 'b', 'A', '');

  assert.equal(new PDASimulator(pda, 'Z').simulate('ab'), true);
  assert.equal(new PDASimulator(pda, 'Z').simulate('aa'), false);
});

test('Turing simulator writes symbols and follows tape movement', () => {
  const tm = new TuringMachine();
  const q0 = tm.createState();
  const q1 = tm.createState();
  tm.setInitialState(q0);
  tm.addFinalState(q1);
  tm.transition(q0, q1, 'a', 'b', 'S');
  const result = new TuringMachineSimulator(tm).run('a');

  assert.equal(result.accepted, true);
  assert.equal(result.configurations.at(-1)?.tapes[0]?.cells[0], 'b');
});

test('JFF codec preserves PDA and multi-tape Turing transitions', () => {
  const pda = new PushdownAutomaton();
  const p0 = pda.createState();
  const p1 = pda.createState();
  pda.setInitialState(p0);
  pda.addFinalState(p1);
  pda.transition(p0, p1, 'a', 'Z', 'AZ');
  const decodedPda = JFFCodec.decode(JFFCodec.encode(pda));
  assert.ok(decodedPda instanceof PushdownAutomaton);
  assert.equal(new PDASimulator(decodedPda, 'Z').simulate('a'), true);

  const tm = new TuringMachine(2);
  const t0 = tm.createState();
  const t1 = tm.createState();
  tm.setInitialState(t0);
  tm.addFinalState(t1);
  tm.transition(t0, t1, ['a', 'b'], ['x', 'y'], ['R', 'L']);
  const decodedTm = JFFCodec.decode(JFFCodec.encode(tm));
  assert.ok(decodedTm instanceof TuringMachine);
  assert.equal(decodedTm.tapeCount, 2);
  assert.deepEqual(decodedTm.transitions[0]?.reads, ['a', 'b']);
  assert.deepEqual(decodedTm.transitions[0]?.directions, ['R', 'L']);
});

test('Turing simulation reports when a branch reaches the step bound', () => {
  const tm = new TuringMachine();
  const state = tm.createState();
  tm.setInitialState(state);
  tm.transition(state, state, '~', '~', 'R');
  const result = new TuringMachineSimulator(tm).run('', { maxSteps: 2 });
  assert.equal(result.accepted, false);
  assert.equal(result.halted, false);
});

test('Mealy and Moore machines produce output and retain their JFF-specific data', () => {
  const mealy = new MealyMachine();
  const m0 = mealy.createState();
  const m1 = mealy.createState();
  mealy.setInitialState(m0);
  mealy.transition(m0, m1, 'a', 'x');
  assert.equal(new MealySimulator(mealy).simulate('a'), 'x');
  assert.equal(new MealySimulator(JFFCodec.decode(JFFCodec.encode(mealy))).simulate('a'), 'x');

  const moore = new MooreMachine();
  const r0 = moore.createState();
  const r1 = moore.createState();
  moore.setOutput(r0, 'start');
  moore.setOutput(r1, 'done');
  moore.setInitialState(r0);
  moore.transition(r0, r1, 'a');
  assert.equal(new MooreSimulator(moore).simulate('a'), 'startdone');
  assert.equal(new MooreSimulator(JFFCodec.decode(JFFCodec.encode(moore))).simulate('a'), 'startdone');
});

test('FSA transformations preserve languages and remove equivalent DFA states', () => {
  const nfa = new FiniteStateAutomaton();
  const q0 = nfa.createState();
  const q1 = nfa.createState();
  const q2 = nfa.createState();
  const q3 = nfa.createState();
  nfa.setInitialState(q0);
  nfa.addFinalState(q2);
  nfa.addFinalState(q3);
  nfa.transition(q0, q1, 'λ');
  nfa.transition(q1, q2, 'a');
  nfa.transition(q1, q3, 'a');

  const dfa = determinize(nfa);
  const reduced = minimize(dfa);
  assert.equal(new FSASimulator(dfa).simulate('a'), true);
  assert.equal(new FSASimulator(dfa).simulate(''), false);
  assert.equal(equivalent(nfa, reduced), true);

  const redundant = new FiniteStateAutomaton();
  const start = redundant.createState();
  const finalA = redundant.createState();
  const finalB = redundant.createState();
  const reject = redundant.createState();
  redundant.setInitialState(start);
  redundant.addFinalState(finalA);
  redundant.addFinalState(finalB);
  redundant.transition(start, finalA, 'a');
  redundant.transition(start, finalB, 'b');
  redundant.transition(finalA, reject, 'a');
  redundant.transition(finalA, reject, 'b');
  redundant.transition(finalB, reject, 'a');
  redundant.transition(finalB, reject, 'b');
  redundant.transition(reject, reject, 'a');
  redundant.transition(reject, reject, 'b');
  assert.equal(minimize(redundant).states.length, 3);
});

test('CFG transformations, CYK parsing, and bounded derivations work together', () => {
  const grammar = new ContextFreeGrammar();
  grammar.setStartVariable('S');
  grammar.addProduction(new Production('S', 'AB'));
  grammar.addProduction(new Production('A', 'a'));
  grammar.addProduction(new Production('B', 'b'));
  assert.equal(new CYKParser(grammar).solve('ab'), true);
  assert.equal(new CYKParser(grammar).solve('aa'), false);
  assert.equal(bruteParse(grammar, 'ab').accepted, true);

  const cyk = new CYKParser(grammar);
  assert.equal(cyk.solve('ab'), true);
  assert.deepEqual(cyk.getTrace().map((production) => production.getLHS()), ['S', 'A', 'B']);

  const cnf = toChomskyNormalForm(grammar);
  assert.equal(new CYKParser(cnf).solve('ab'), true);
  assert.ok(cnf.getProductions().every((production) => {
    const rhs = [...production.getRHS()];
    return rhs.length === 1 || (rhs.length === 2 && rhs.every((symbol) => symbol === symbol.toUpperCase()));
  }));
});

test('LL(1) and SLR parsers construct tables and parse valid strings', () => {
  const grammar = new ContextFreeGrammar();
  grammar.setStartVariable('S');
  grammar.addProduction(new Production('S', 'aA'));
  grammar.addProduction(new Production('S', 'b'));
  grammar.addProduction(new Production('A', 'c'));
  assert.equal(new LLParser(grammar).parse('ac').accepted, true);
  assert.equal(new LLParser(grammar).parse('b').accepted, true);
  assert.equal(new LLParser(grammar).parse('a').accepted, false);
  assert.equal(new LRParser(grammar).parse('ac').accepted, true);
  assert.equal(new LRParser(grammar).parse('b').accepted, true);
  assert.equal(new LRParser(grammar).parse('bc').accepted, false);
});

test('right-linear grammar conversion and regular-expression operations preserve language', () => {
  const grammar = new RightLinearGrammar();
  grammar.setStartVariable('S');
  grammar.addProduction(new Production('S', 'aS'));
  grammar.addProduction(new Production('S', 'b'));
  const fsa = rightLinearGrammarToFSA(grammar);
  const simulator = new FSASimulator(fsa);
  assert.equal(simulator.simulate('aaab'), true);
  assert.equal(simulator.simulate('aaa'), false);

  const expression = new RegularExpression('(a+b)*b');
  const fromExpression = expression.toAutomaton();
  const expressionSimulator = new FSASimulator(fromExpression);
  assert.equal(expressionSimulator.simulate('abab'), true);
  assert.equal(expressionSimulator.simulate('aba'), false);
  const converted = new RegularExpression(fsaToRegularExpression(fsa)).toAutomaton();
  assert.equal(new FSASimulator(converted).simulate('aab'), true);
  assert.equal(new FSASimulator(converted).simulate('aaa'), false);
});

test('JFF grammar codec retains productions', () => {
  const grammar = new ContextFreeGrammar();
  grammar.setStartVariable('S');
  grammar.addProduction(new Production('S', 'aA'));
  grammar.addProduction(new Production('A', ''));
  const decoded = JFFCodec.decode(JFFCodec.encode(grammar));
  assert.deepEqual(decoded.getProductions().map((production) => [production.getLHS(), production.getRHS()]), [['S', 'aA'], ['A', '']]);
});

test('L-system expansion is cached, deterministic for a seed, and JFF round-trips', () => {
  const rules = new UnboundGrammar();
  rules.addProduction(new Production('F', 'F F'));
  const system = new LSystem('F', rules, { angle: 60 });
  const expander = new Expander(system, 12);
  assert.deepEqual(expander.expansionForLevel(2), ['F', 'F', 'F', 'F']);
  const restored = JFFCodec.decode(JFFCodec.encode(system));
  assert.ok(restored instanceof LSystem);
  assert.deepEqual(new Expander(restored, 12).expansionForLevel(2), ['F', 'F', 'F', 'F']);
  assert.equal(restored.values.get('angle'), '60');
});

test('automata helper functions compute closures, reachability, usefulness, and clones', () => {
  const fsa = new FiniteStateAutomaton();
  const q0 = fsa.createState();
  const q1 = fsa.createState();
  const q2 = fsa.createState();
  const q3 = fsa.createState();
  fsa.setInitialState(q0);
  fsa.addFinalState(q2);
  fsa.transition(q0, q1, 'λ');
  fsa.transition(q1, q2, 'a');
  fsa.transition(q3, q3, 'b');

  assert.deepEqual(getLambdaClosure(fsa, q0), [q0, q1]);
  assert.deepEqual(getUnreachableStates(fsa), [q3]);
  assert.ok(getUselessStates(fsa).has(q3));
  const copy = cloneAutomaton(fsa);
  assert.equal(new FSASimulator(copy).simulate('a'), true);
  assert.notEqual(copy.states[0], fsa.states[0]);
});

test('JFLAP 3 text codecs decode grammars, regular expressions, and finite automata', () => {
  const grammar = JFLAP3Codec.decode('# grammar\nS -> aA\nA -> b', 'example.GRM');
  assert.equal(grammar.getProductions().length, 2);
  assert.equal(JFLAP3Codec.decode('# expression\na+b', 'example.REX').asString(), 'a+b');

  const fa = JFLAP3Codec.decode([
    'One-Way-FSA',
    '2',
    'a',
    '1',
    '2 0',
    'a 2 EOL',
    'EOL',
    'state1 10 20',
    'state2 30 40',
  ].join('\n'), 'example.FA');
  assert.ok(fa instanceof FiniteStateAutomaton);
  assert.equal(new FSASimulator(fa).simulate('a'), true);
  assert.deepEqual(fa.states[0]?.point, { x: 10, y: 20 });
});

test('pumping lemma helpers split, pump, and recognize built-in languages', () => {
  const lemma = createPumpingLemma('reg/AnBn');
  lemma.setM(3);
  assert.equal(lemma.isInLang('aaabbb'), true);
  assert.equal(lemma.isInLang('aabbb'), false);
  lemma.setW('aaabbb');
  assert.equal(lemma.setDecomposition([0, 2], 0), true);
  assert.equal(lemma.createPumpedString(), 'abbb');

  const cf = createPumpingLemma('cf/AnBnCn');
  assert.equal(cf.isInLang('aaabbbccc'), true);
  assert.equal(cf.isInLang('aaabbccc'), false);

  lemma.addAttempt('previous decomposition');
  const restored = JFFCodec.decode(JFFCodec.encode(lemma));
  assert.equal(restored.getTitle(), lemma.getTitle());
  assert.equal(restored.getW(), lemma.getW());
  assert.equal(restored.createPumpedString(), lemma.createPumpedString());
  assert.deepEqual(restored.getAttempts(), ['previous decomposition']);
});

test('PDA-to-CFG conversion handles the normalized pop-to-empty case', () => {
  const pda = new PushdownAutomaton();
  const start = pda.createState();
  const final = pda.createState();
  pda.setInitialState(start);
  pda.addFinalState(final);
  pda.transition(start, final, 'a', 'Z', '');
  const grammar = new PDAToCFGConverter().convertToContextFreeGrammar(pda);
  assert.equal(grammar.getStartVariable(), 'S');
  assert.ok(grammar.getProductions().some((production) => production.getLHS() === 'S' && production.getRHS() === 'a'));
});

test('CFG-to-PDA conversion simulates a simple derivation', () => {
  const grammar = new ContextFreeGrammar();
  grammar.setStartVariable('S');
  grammar.addProduction(new Production('S', 'aA'));
  grammar.addProduction(new Production('A', 'b'));
  const pda = new CFGToPDALLConverter().convertToAutomaton(grammar);
  assert.equal(new PDASimulator(pda).simulate('ab'), true);
  assert.equal(new PDASimulator(pda).simulate('a'), false);
});

test('portable serialized codec and regular-expression discretizer work', () => {
  const fsa = new FiniteStateAutomaton();
  const start = fsa.createState(); const final = fsa.createState();
  fsa.setInitialState(start); fsa.addFinalState(final); fsa.transition(start, final, 'a');
  const codec = new SerializedCodec();
  const decoded = codec.decode(codec.encode(fsa));
  assert.equal(new FSASimulator(decoded).simulate('a'), true);
  assert.deepEqual(Discretizer.or('a+(b+c)'), ['a', '(b+c)']);
  assert.deepEqual(Discretizer.cat('a(b+c)*'), ['a', '(b+c)*']);
  assert.equal(Unrestricted.minimumLength('ABc', new Set(['A', 'c'])), 1);
});
