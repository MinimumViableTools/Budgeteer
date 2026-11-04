'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../docs/js/core.js');
const { createStack, restore } = require('../docs/js/stack.js');
const { samplePlan } = require('../docs/js/sample.js');

const named = (name) => Object.assign(core.newPlan('month', 6), { name });
const names = (s) => s.list().map((e) => e.plan.name);

test('a stack always holds at least one plan, and a new empty stack starts with an empty plan', () => {
  const s = createStack();
  assert.equal(s.count(), 1); assert.equal(s.active().plan.name, 'New plan'); assert.equal(s.active().sample, false);
});

test('AC47 a new plan is one call, becomes the shown plan and leaves the others untouched', () => {
  const s = createStack({ entries: [{ id: 1, plan: samplePlan(), sample: true }] });
  const before = JSON.stringify(s.get(1).plan);
  const r = s.addEmpty();
  assert.equal(r.ok, true); assert.equal(s.count(), 2); assert.equal(s.activeId(), r.entry.id);
  assert.equal(JSON.stringify(s.get(1).plan), before);
  assert.equal(s.active().plan.resources.length, 0);
});

test('AC48 a copy has all content, a new name, its own data, and sits after the original', () => {
  const s = createStack({ entries: [{ id: 1, plan: samplePlan(), sample: true }, { id: 2, plan: named('Other') }] });
  const r = s.copy(1);
  assert.equal(r.ok, true); assert.deepEqual(names(s), ['Sample plan', 'Copy of Sample plan', 'Other']);
  assert.equal(s.activeId(), r.entry.id); assert.equal(r.entry.sample, false);
  const a = JSON.parse(JSON.stringify(s.get(1).plan)), b = JSON.parse(JSON.stringify(r.entry.plan));
  delete a.name; delete b.name; assert.deepEqual(b, a);
  r.entry.plan.resources[0].name = 'changed'; r.entry.plan.milestones[0].linked.push(9);
  assert.equal(s.get(1).plan.resources[0].name, 'Core team'); assert.deepEqual(s.get(1).plan.milestones[0].linked, [1, 2]);
  const long = createStack({ entries: [{ id: 1, plan: named('n'.repeat(40)) }] }).copy(1).entry.plan.name;
  assert.equal(long.length, 40); assert.ok(long.startsWith('Copy of nnn'));
  assert.equal(createStack({ entries: [{ id: 1, plan: named('A') }] }).copy().entry.plan.name, 'Copy of A', 'no id means the shown plan');
});

test('AC49 opening a card shows that plan and keeps every other plan as it was', () => {
  const s = createStack({ entries: [{ id: 1, plan: named('A') }, { id: 2, plan: named('B') }, { id: 3, plan: named('C') }], activeId: 1 });
  const events = []; s.subscribe((w) => events.push(w));
  assert.equal(s.open(3), true); assert.equal(s.active().plan.name, 'C');
  assert.equal(s.open(3), false, 'already open'); assert.equal(s.open(99), false);
  assert.deepEqual(events, ['active']);
  assert.deepEqual(names(s), ['A', 'B', 'C']);
});

test('the shown plan is kept current, and a rename ends the sample state', () => {
  const s = createStack({ entries: [{ id: 1, plan: samplePlan(), sample: true }] });
  const edited = Object.assign({}, s.active().plan, { budgets: { max: 1, stretch: 2 } });
  s.updateActive(edited); assert.equal(s.active().plan.budgets.max, 1); assert.equal(s.active().sample, true);
  s.updateActive(Object.assign({}, edited, { name: 'My plan' })); assert.equal(s.active().sample, false);
});

test('AC50 at most 10 plans: more are refused with a message, nothing changes', () => {
  const s = createStack();
  for (let i = 0; i < 9; i++) assert.equal(s.addEmpty().ok, true);
  assert.equal(s.count(), 10); assert.equal(s.full(), true);
  const r = s.addEmpty(); assert.equal(r.ok, false); assert.equal(r.error, 'The tray holds at most 10 plans. Close one first.');
  assert.equal(s.copy().ok, false); assert.equal(s.add(named('x')).ok, false); assert.equal(s.count(), 10);
});

test('AC51 closing a plan opens its neighbour and can be undone, at the same place', () => {
  const s = createStack({ entries: [{ id: 1, plan: named('A') }, { id: 2, plan: named('B') }, { id: 3, plan: named('C') }], activeId: 2 });
  const r = s.close(2);
  assert.equal(r.ok, true); assert.equal(r.wasActive, true); assert.deepEqual(names(s), ['A', 'C']); assert.equal(s.active().plan.name, 'C');
  assert.equal(s.canUndo(), true); assert.equal(s.lastClosedName(), 'B');
  const u = s.undoClose();
  assert.equal(u.ok, true); assert.deepEqual(names(s), ['A', 'B', 'C']); assert.equal(s.active().plan.name, 'B'); assert.equal(s.canUndo(), false);
  assert.equal(s.undoClose().ok, false, 'one undo per close');
  s.close(1); assert.equal(s.active().plan.name, 'B', 'closing another plan keeps the shown one');
  assert.equal(s.close(3).wasActive, false);
});

test('AC51 closing the last plan leaves an empty plan, and the closed plan can come back', () => {
  const s = createStack({ entries: [{ id: 1, plan: samplePlan(), sample: true }] });
  s.close(1);
  assert.equal(s.count(), 1); assert.equal(s.active().plan.name, 'New plan'); assert.equal(s.active().plan.resources.length, 0);
  s.undoClose(); assert.deepEqual(names(s), ['Sample plan', 'New plan']); assert.equal(s.active().plan.name, 'Sample plan');
  assert.equal(s.active().sample, true);
});

test('AC51 undo is refused when the tray is full, and the plan stays undoable', () => {
  const s = createStack({ entries: [{ id: 1, plan: named('A') }] });
  s.close(1);
  for (let i = 0; i < 9; i++) s.addEmpty();
  assert.equal(s.count(), 10);
  const u = s.undoClose(); assert.equal(u.ok, false); assert.match(u.error, /at most 10 plans/); assert.equal(s.canUndo(), true);
});

test('ids are never reused, also not after closing', () => {
  const s = createStack({ entries: [{ id: 5, plan: named('A') }] });
  const a = s.addEmpty().entry.id; s.close(a); const b = s.addEmpty().entry.id;
  assert.ok(a > 5 && b > a);
});

test('AC52 the stack goes into text and comes back: plans, names, order, shown plan and sample state', () => {
  const s = createStack({ entries: [{ id: 1, plan: samplePlan(), sample: true }] });
  s.copy(1); s.addEmpty(); s.open(1);
  const back = restore(s.serialize());
  assert.ok(back);
  assert.deepEqual(names(back), names(s)); assert.equal(back.activeId(), 1);
  assert.equal(back.get(1).sample, true); assert.equal(back.get(2).sample, false);
  assert.equal(core.scenarioTotals(back.get(1).plan, 'stretch').total, 119300);
  assert.deepEqual(back.list().map((e) => e.id), s.list().map((e) => e.id));
  const next = back.addEmpty().entry.id; assert.ok(next > 3);
  assert.equal(back.canUndo(), false, 'undo does not survive a reload');
});

test('AC52 broken or foreign storage text gives null and never throws', () => {
  const good = JSON.parse(createStack({ entries: [{ id: 1, plan: samplePlan() }] }).serialize());
  const cases = {
    'not JSON': 'hello', 'empty': '', 'null': 'null', 'number': '42', 'array': '[]', undefined: undefined,
    'wrong version': JSON.stringify(Object.assign({}, good, { v: 2 })),
    'no entries': JSON.stringify(Object.assign({}, good, { entries: [] })),
    'entries not a list': JSON.stringify(Object.assign({}, good, { entries: 'x' })),
    'duplicate id': JSON.stringify(Object.assign({}, good, { entries: [good.entries[0], good.entries[0]] })),
    'bad id': JSON.stringify(Object.assign({}, good, { entries: [Object.assign({}, good.entries[0], { id: 0 })] })),
    'fractional id': JSON.stringify(Object.assign({}, good, { entries: [Object.assign({}, good.entries[0], { id: 1.5 })] })),
    'invalid plan': JSON.stringify(Object.assign({}, good, { entries: [Object.assign({}, good.entries[0], { plan: { length: 99 } })] })),
    'more than 10': JSON.stringify(Object.assign({}, good, { entries: Array.from({ length: 11 }, (_, i) => Object.assign({}, good.entries[0], { id: i + 1 })) })),
    'too large': ' '.repeat(2100000)
  };
  for (const [name, text] of Object.entries(cases)) assert.equal(restore(text), null, name);
  const odd = restore(JSON.stringify(Object.assign({}, good, { activeId: 77 })));
  assert.equal(odd.activeId(), 1, 'an unknown shown plan falls back to the first');
});

test('the largest ten plans fit in the tab storage text', () => {
  const big = samplePlan(); big.length = 12;
  const s = createStack({ entries: [{ id: 1, plan: big }] });
  for (let i = 0; i < 9; i++) s.copy(1);
  assert.equal(s.count(), 10);
  assert.ok(s.serialize().length < 100000, 'size ' + s.serialize().length);
});
