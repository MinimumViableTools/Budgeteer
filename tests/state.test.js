'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../docs/js/core.js');
const { createStore } = require('../docs/js/state.js');
const { samplePlan } = require('../docs/js/sample.js');

test('every action notifies once with the kind of change, and the old plan is not touched', () => {
  const original = samplePlan(), before = JSON.stringify(original), s = createStore(original), seen = [];
  s.subscribe(c => seen.push(c.kind));
  s.setBudget('max', 90000); s.setScenario('max'); s.setResourceOn(1, 'max', false); s.addResource('subscription');
  assert.deepEqual(seen, ['value', 'structure', 'value', 'structure']);
  assert.equal(JSON.stringify(original), before);
  assert.equal(s.getPlan().budgets.max, 90000);
});

test('unsubscribe stops notifications', () => {
  const s = createStore(samplePlan()); let n = 0;
  const off = s.subscribe(() => n++); s.setBudget('max', 1); off(); s.setBudget('max', 2);
  assert.equal(n, 1);
});

test('AC15 the length is clamped with a message, in months and in quarters', () => {
  const s = createStore(samplePlan());
  s.setLength(14);
  assert.equal(s.getPlan().length, 12); assert.equal(s.getNotice(), 'A plan can have at most 12 months.');
  s.setView('quarter'); assert.equal(s.getPlan().view, 'quarter');
  s.setLength(9);
  assert.equal(s.getPlan().length, 12); assert.equal(s.getNotice(), 'A plan can have at most 4 quarters.');
  s.setLength(2);
  assert.equal(s.getPlan().length, 6); assert.equal(s.getNotice(), '');
});

test('AC19 the quarter view needs a multiple of 3 months, and switching changes no stored value', () => {
  const s = createStore(samplePlan());
  const before = JSON.stringify(Object.assign({}, s.getPlan(), { view: 'x' }));
  s.setView('quarter'); s.setView('month');
  assert.equal(JSON.stringify(Object.assign({}, s.getPlan(), { view: 'x' })), before);
  s.setLength(4); s.setView('quarter');
  assert.equal(s.getPlan().view, 'month');
  assert.match(s.getNotice(), /multiple of 3 months/);
});

test('AC5 and AC8 switches and new resources follow the viewed scenario', () => {
  const s = createStore(samplePlan());
  s.setResourceOn(1, 'stretch', false);
  assert.deepEqual(s.getPlan().resources[0].on, { max: true, stretch: false });
  s.setScenario('max'); s.addResource('freelancer');
  assert.deepEqual(s.getPlan().resources[6].on, { max: true, stretch: true });
  assert.match(s.getNotice(), /Added Freelancer to both scenarios/);
  s.setScenario('stretch'); s.addResource('subscription');
  assert.deepEqual(s.getPlan().resources[7].on, { max: false, stretch: true });
  assert.match(s.getNotice(), /Added Subscription to the stretch scenario only/);
});

test('AC27 the 21st resource is refused with a notice', () => {
  const s = createStore(core.newPlan('month', 6));
  for (let i = 0; i < 22; i++) s.addResource('subscription');
  assert.equal(s.getPlan().resources.length, 20);
  assert.equal(s.getNotice(), 'A plan can have at most 20 resources. Remove one first.');
});

test('resource edits are clamped to sensible values', () => {
  const s = createStore(samplePlan());
  s.updateResource(1, { rate: -5, days: 'abc' });
  assert.equal(s.getPlan().resources[0].rate, 0); assert.equal(s.getPlan().resources[0].days, 0);
  s.updateResource(5, { due: 99 }); assert.equal(s.getPlan().resources[4].due, 12);
  s.updateResource(6, { to: null }); assert.equal(s.getPlan().resources[5].to, null);
  s.updateResource(6, { from: 0 }); assert.equal(s.getPlan().resources[5].from, 1);
  s.setBudget('max', -3); assert.equal(s.getPlan().budgets.max, 0);
  s.renameResource(1, 'x'.repeat(60)); assert.equal(s.getPlan().resources[0].name.length, 40);
});

test('changing the cost mode keeps sensible defaults', () => {
  const s = createStore(samplePlan());
  s.changeResourceMode(3, 'oneTime');
  const r = s.getPlan().resources[2];
  assert.equal(r.mode, 'oneTime'); assert.equal(r.due, 3); assert.equal(r.amount, 450);
  s.changeResourceMode(3, 'rateDays');
  assert.equal(s.getPlan().resources[2].rate, 600);
});

test('AC29 AC36 milestones are saved, edited and deleted, and removing a resource keeps them', () => {
  const s = createStore(samplePlan());
  const bad = s.saveMilestone({ name: '', value: '', due: 2, linked: [], importance: 'must' });
  assert.equal(bad.ok, false); assert.ok(bad.errors.name);
  assert.equal(s.saveMilestone({ name: 'Launch', value: 'We are live.', due: 6, linked: [1], importance: 'nice' }).ok, true);
  assert.equal(s.getPlan().milestones.length, 4);
  const id = s.getPlan().milestones[3].id;
  s.saveMilestone({ name: 'Launch day', value: 'Live.', due: 5, linked: [1, 2], importance: 'must' }, id);
  assert.equal(s.getPlan().milestones[3].name, 'Launch day'); assert.equal(s.getPlan().milestones[3].due, 5);
  s.removeResource(2);
  assert.deepEqual(s.getPlan().milestones[3].linked, [1]);
  s.deleteMilestone(id);
  assert.equal(s.getPlan().milestones.length, 3);
  for (let i = 0; i < 6; i++) s.saveMilestone({ name: 'm' + i, value: '', due: 1, linked: [], importance: 'must' });
  assert.equal(s.getPlan().milestones.length, 8);
  assert.equal(s.saveMilestone({ name: 'ninth', value: '', due: 1, linked: [], importance: 'must' }).ok, false);
  assert.match(s.getNotice(), /at most 8 milestones/);
});

test('loadPlan replaces the plan and carries a message', () => {
  const s = createStore(samplePlan()); let kind = '';
  s.subscribe(c => { kind = c.kind; });
  s.loadPlan(core.newPlan('month', 6), 'Started an empty plan.');
  assert.equal(kind, 'structure'); assert.equal(s.getPlan().resources.length, 0); assert.equal(s.getNotice(), 'Started an empty plan.');
});
