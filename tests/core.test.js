'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../docs/js/core.js');
const { samplePlan } = require('../docs/js/sample.js');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg || a + ' vs ' + b);
function plan(overrides, resources) {
  return Object.assign({ version: 1, view: 'month', length: 6, scenario: 'max', budgets: { max: 95000, stretch: 125000 }, resources: resources || [], milestones: [] }, overrides || {});
}
const on = { max: true, stretch: true };

test('AC1 a fixed line costs the amount in every month', () => {
  const p = plan({}, [{ id: 1, name: 'Tool', type: 'subscription', mode: 'fixed', amount: 500, from: 1, to: null, on }]);
  const t = core.scenarioTotals(p, 'max');
  assert.deepEqual(t.monthly.map(core.sumByType), [500, 500, 500, 500, 500, 500]);
  assert.equal(t.total, 3000);
});

test('AC2 rate times days multiplies per period', () => {
  const p = plan({}, [{ id: 1, name: 'F', type: 'freelancer', mode: 'rateDays', rate: 600, days: 8, from: 1, to: null, on }]);
  assert.deepEqual(core.scenarioTotals(p, 'max').monthly.map(core.sumByType), [4800, 4800, 4800, 4800, 4800, 4800]);
});

test('AC3 a one-time line lands in exactly one month', () => {
  const p = plan({}, [{ id: 1, name: 'Buy', type: 'oneTime', mode: 'oneTime', amount: 2000, due: 3, on }]);
  assert.deepEqual(core.scenarioTotals(p, 'max').monthly.map(core.sumByType), [0, 0, 2000, 0, 0, 0]);
});

test('AC4 start and end limit a line, an empty end runs to the last month', () => {
  const r = { id: 1, name: 'X', type: 'subscription', mode: 'fixed', amount: 100, from: 3, to: 6, on };
  assert.deepEqual(core.scenarioTotals(plan({}, [r]), 'max').monthly.map(core.sumByType), [0, 0, 100, 100, 100, 100]);
  const open = Object.assign({}, r, { to: null });
  assert.deepEqual(core.scenarioTotals(plan({}, [open]), 'max').monthly.map(core.sumByType), [0, 0, 100, 100, 100, 100]);
  assert.deepEqual(core.scenarioTotals(plan({ length: 8 }, [open]), 'max').monthly.map(core.sumByType), [0, 0, 100, 100, 100, 100, 100, 100]);
});

test('AC5 and AC7 a resource that is off is excluded from that scenario only', () => {
  const p = samplePlan();
  assert.equal(core.scenarioTotals(p, 'max').total, 92100);
  assert.equal(core.scenarioTotals(p, 'stretch').total, 119300);
  const off = core.setResourceOn(p, 5, 'stretch', false);
  assert.equal(core.scenarioTotals(off, 'stretch').total, 111300);
  assert.equal(core.scenarioTotals(off, 'max').total, 92100);
  assert.equal(p.resources[4].on.stretch, true, 'the original plan is unchanged');
});

test('AC6 a value change on the shared list applies in both scenarios', () => {
  const p = samplePlan();
  p.resources[0].days = 12;
  assert.equal(core.scenarioTotals(p, 'max').total, 92100 + 2 * 1200 * 6);
  assert.equal(core.scenarioTotals(p, 'stretch').total, 119300 + 2 * 1200 * 6);
});

test('AC8 a new resource starts with template defaults, on in the viewed scenario only', () => {
  const p = Object.assign(samplePlan(), { scenario: 'stretch' });
  const res = core.addResource(p, 'freelancer');
  const r = res.resource;
  assert.equal(r.name, 'Freelancer'); assert.equal(r.rate, 650); assert.equal(r.days, 5);
  assert.deepEqual(r.on, { max: false, stretch: true });
  assert.equal(res.plan.resources.length, 7);
  const one = core.addResource(p, 'oneTime').resource;
  assert.equal(one.due, 3, 'the middle month of a 6-month plan');
  assert.equal(one.amount, 5000);
});

test('AC9 the monthly split by type adds up to the period totals', () => {
  const t = core.scenarioTotals(samplePlan(), 'stretch');
  const m5 = t.monthly[4];
  assert.equal(m5.internalDev, 12000); assert.equal(m5.freelancer, 2600 + 4800);
  assert.equal(m5.subscription, 450); assert.equal(m5.infrastructure, 300); assert.equal(m5.oneTime, 8000);
  assert.equal(core.sumByType(m5), 28150);
});

test('test case: max scenario of the sample plan', () => {
  const t = core.scenarioTotals(samplePlan(), 'max');
  assert.deepEqual(t.monthly.map(core.sumByType), [15350, 15350, 15350, 15350, 15350, 15350]);
  assert.equal(t.total, 92100);
  assert.equal(t.passedMax, null); assert.equal(t.passedStretch, null);
  assert.equal(core.status(t.total, samplePlan().budgets), 'ok');
  const d = core.distance(t.total, 95000);
  assert.deepEqual(d, { amount: 2900, over: false });
});

test('test case: stretch scenario of the sample plan', () => {
  const t = core.scenarioTotals(samplePlan(), 'stretch');
  assert.deepEqual(t.monthly.map(core.sumByType), [15350, 15350, 20150, 20150, 28150, 20150]);
  assert.deepEqual(t.running, [15350, 30700, 50850, 71000, 99150, 119300]);
  assert.equal(t.total, 119300);
  assert.equal(t.passedMax, 5); assert.equal(t.passedStretch, null);
  assert.equal(core.status(t.total, samplePlan().budgets), 'warn');
});

test('AC11 the first month above a budget is found, equal is not above', () => {
  assert.equal(core.firstPassedMonth([10, 20, 30], 20), 3);
  assert.equal(core.firstPassedMonth([10, 20, 30], 30), null);
  assert.equal(core.firstPassedMonth([10, 20, 30], 5), 1);
});

test('AC12 status and distances for 119,300', () => {
  const b = { max: 95000, stretch: 125000 };
  assert.equal(core.status(119300, b), 'warn');
  assert.equal(core.STATUS_TEXT.warn, 'In stretch zone');
  assert.deepEqual(core.distance(119300, b.max), { amount: 24300, over: true });
  assert.deepEqual(core.distance(119300, b.stretch), { amount: 5700, over: false });
  assert.equal(core.status(95000, b), 'ok'); assert.equal(core.status(125001, b), 'over');
  const s = core.summary(samplePlan(), 'stretch');
  assert.match(s.paragraphs[0], /plan totals €119,300\. That is €24,300 over the max budget and €5,700 under the stretch budget\./);
});

test('AC15 a length above the cap is set to the cap with a message', () => {
  assert.deepEqual(core.clampLength(14, 'month'), { shown: 12, months: 12, message: 'A plan can have at most 12 months.' });
  assert.deepEqual(core.clampLength(6, 'quarter'), { shown: 4, months: 12, message: 'A plan can have at most 4 quarters.' });
  assert.deepEqual(core.clampLength(5, 'month'), { shown: 5, months: 5, message: '' });
  assert.equal(core.clampLength(0, 'month').shown, 1);
});

test('AC16 with nothing switched on the summary shows a hint', () => {
  const p = samplePlan(); p.resources.forEach(r => { r.on.max = false; });
  const s = core.summary(p, 'max');
  assert.equal(s.paragraphs.length, 1);
  assert.match(s.paragraphs[0], /No resources are switched on in the max scenario\. Switch one on or add one/);
});

test('AC19 grouping into quarters keeps every total, and nothing is stored differently', () => {
  const p = samplePlan(), before = JSON.stringify(p);
  const t = core.scenarioTotals(p, 'stretch');
  const q = core.groupForView(t.monthly, 'quarter');
  assert.equal(q.length, 2);
  assert.equal(core.sumByType(q[0]), 15350 + 15350 + 20150);
  assert.equal(core.sumByType(q[1]), 20150 + 28150 + 20150);
  assert.equal(q.reduce((s, b) => s + core.sumByType(b), 0), t.total);
  assert.equal(JSON.stringify(p), before);
  const asQuarters = Object.assign({}, p, { view: 'quarter' });
  assert.equal(core.scenarioTotals(asQuarters, 'stretch').total, t.total);
  assert.equal(core.periodCount(asQuarters), 2);
  assert.equal(core.canUseQuarterView(6), true); assert.equal(core.canUseQuarterView(4), false);
});

test('AC23 euro format is fixed and independent of the browser language', () => {
  assert.equal(core.formatEuro(92100), '€92,100');
  assert.equal(core.formatEuro(1234567), '€1,234,567');
  assert.equal(core.formatEuro(0), '€0');
  assert.equal(core.formatEuro(-5700), '-€5,700');
  assert.equal(core.formatEuro(99.6), '€100');
  assert.equal(core.parseAmount('1,200'), 1200);
  assert.equal(core.parseAmount(''), 0);
});

test('AC27 a 21st resource is refused with a message, the plan stays the same', () => {
  let p = plan({}, []);
  for (let i = 0; i < 20; i++) p = core.addResource(p, 'subscription').plan;
  assert.equal(p.resources.length, 20);
  const res = core.addResource(p, 'subscription');
  assert.equal(res.plan, p);
  assert.equal(res.error, 'A plan can have at most 20 resources. Remove one first.');
});

test('AC29 and AC30 milestone input is validated, limits are enforced', () => {
  const p = samplePlan();
  assert.equal(core.validateMilestone({ name: '  ', value: 'x' }).ok, false);
  assert.ok(core.validateMilestone({ name: '', value: '' }).errors.name);
  assert.equal(core.validateMilestone({ name: 'a'.repeat(41), value: '' }).ok, false);
  assert.equal(core.validateMilestone({ name: 'a'.repeat(40), value: 'b'.repeat(140) }).ok, true);
  assert.equal(core.validateMilestone({ name: 'x', value: 'b'.repeat(141) }).ok, false);
  assert.equal(core.validateMilestone({ name: 'x', value: 'b'.repeat(100) }).remaining, 40);
  const added = core.addMilestone(p, { name: ' Launch ', value: 'We are live.', due: 6, linked: [1], importance: 'nice' });
  assert.equal(added.plan.milestones.length, 4);
  assert.equal(added.milestone.name, 'Launch'); assert.equal(added.milestone.importance, 'nice'); assert.equal(added.milestone.id, 4);
  let q = p;
  for (let i = p.milestones.length; i < 8; i++) q = core.addMilestone(q, { name: 'M' + i, value: '', due: 1, linked: [] }).plan;
  assert.equal(q.milestones.length, 8);
  const refused = core.addMilestone(q, { name: 'Ninth', value: '', due: 1, linked: [] });
  assert.equal(refused.plan, q);
  assert.equal(refused.error, 'A plan can have at most 8 milestones. Remove one first.');
});

test('AC31 a switched-off linked resource blocks a milestone and is named', () => {
  const p = samplePlan();
  const m = core.milestoneStatus(p, p.milestones[2], 'max');
  assert.equal(m.reached, false);
  assert.deepEqual(m.reasons.map(r => r.kind), ['resource']);
  assert.equal(m.reasonText, 'Extra freelancer is switched off');
  assert.equal(core.milestoneStatus(p, p.milestones[2], 'stretch').reached, true);
});

test('test case: milestones of the sample plan in max and stretch', () => {
  const p = samplePlan();
  const max = p.milestones.map(m => core.milestoneStatus(p, m, 'max').reached);
  const str = p.milestones.map(m => core.milestoneStatus(p, m, 'stretch').reached);
  assert.deepEqual(max, [true, false, false]);
  assert.deepEqual(str, [true, true, true]);
});

test('AC32 the budget rule uses the period in which the budget is first passed', () => {
  const p = samplePlan(); p.budgets.stretch = 100000;
  const t = core.scenarioTotals(p, 'stretch');
  assert.equal(core.firstPassedMonth(t.running, 100000), 6);
  assert.equal(core.milestoneStatus(p, p.milestones[1], 'stretch').reached, true, 'due M5, passed in M6');
  const beta = core.milestoneStatus(p, p.milestones[2], 'stretch');
  assert.equal(beta.reached, false);
  assert.equal(beta.reasonText, 'budget passed in M6');
  /* due exactly in the period of passing is not reached, one earlier is */
  const q = plan({ budgets: { max: 30000, stretch: 125000 } }, samplePlan().resources);
  q.resources.forEach(r => { r.on.max = true; });
  const ms = (due) => ({ id: 9, name: 'm', value: '', due: due, linked: [], importance: 'must' });
  const run = core.scenarioTotals(q, 'max').running;
  const passed = core.firstPassedMonth(run, 30000);
  assert.equal(core.milestoneStatus(q, ms(passed - 1), 'max').reached, true);
  const hit = core.milestoneStatus(q, ms(passed), 'max');
  assert.equal(hit.reached, false); assert.equal(hit.reasons[0].text, 'budget passed in M' + passed);
});

test('AC33 without linked resources only the budget decides', () => {
  const p = samplePlan();
  const m = { id: 9, name: 'budget only', value: '', due: 6, linked: [], importance: 'nice' };
  assert.equal(core.milestoneStatus(p, m, 'max').reached, true);
  p.budgets.max = 50000;
  assert.equal(core.milestoneStatus(p, m, 'max').reached, false);
});

test('AC35 the summary names must-have goals first, then nice-to-have, or says all are reached', () => {
  const p = samplePlan();
  const s = core.summary(p, 'max');
  assert.deepEqual(s.milestones.notReached.map(x => x.name), ['Public beta', 'Security audit passed']);
  assert.equal(s.milestones.notReached[0].reasonText, 'Extra freelancer is switched off');
  assert.equal(s.milestones.notReached[0].value, 'First external users can sign up and use the product.');
  assert.match(s.paragraphs[s.paragraphs.length - 1], /with the current max budget and resources, 2 of 3 goals are not reached/);
  const all = core.summary(p, 'stretch');
  assert.deepEqual(all.milestones.notReached, []);
  assert.match(all.paragraphs[all.paragraphs.length - 1], /all 3 goals are reached/);
});

test('AC36 removing a resource removes its links and keeps the milestone', () => {
  const p = samplePlan();
  const q = core.removeResource(p, 6);
  assert.equal(q.resources.length, 5);
  assert.deepEqual(q.milestones[2].linked, [1]);
  assert.equal(q.milestones.length, 3);
  assert.equal(core.milestoneStatus(q, q.milestones[2], 'max').reached, true);
  assert.deepEqual(p.milestones[2].linked, [1, 6], 'the original is unchanged');
});

test('late links are found for a milestone due before the resource starts', () => {
  const p = samplePlan();
  assert.deepEqual(core.lateLinks(p, { due: 2, linked: [6, 1] }), ['Extra freelancer']);
  assert.deepEqual(core.lateLinks(p, { due: 4, linked: [5] }), ['Security audit']);
  assert.deepEqual(core.lateLinks(p, { due: 6, linked: [6, 5] }), []);
});

test('AC38 per-quarter values are three times the monthly value and convert back', () => {
  assert.equal(core.shownValue(450, 'quarter'), 1350);
  assert.equal(core.shownValue(450, 'month'), 450);
  assert.equal(core.storedValue(1500, 'quarter'), 500);
  close(core.storedValue(core.shownValue(10, 'quarter'), 'quarter'), 10);
  close(core.storedValue(1000, 'quarter'), 1000 / 3);
});

test('AC39 and AC40 labels and snapping for precise months in the quarter view', () => {
  assert.equal(core.monthLabel(2, 'quarter'), 'Q1 (M2)');
  assert.equal(core.monthLabel(5, 'quarter'), 'Q2 (M5)');
  assert.equal(core.monthLabel(6, 'quarter'), 'Q2');
  assert.equal(core.monthLabel(5, 'month'), 'M5');
  assert.equal(core.monthShort(5, 'quarter'), 'Q2');
  assert.equal(core.snapStart(2), 4); assert.equal(core.snapEnd(2), 6);
  assert.equal(core.snapOneTimeDue(2), 4); assert.equal(core.snapMilestoneDue(2), 6);
  assert.equal(core.isAligned('start', 4), true); assert.equal(core.isAligned('start', 2), false);
  assert.equal(core.isAligned('end', 6), true); assert.equal(core.isAligned('end', null), true); assert.equal(core.isAligned('end', 5), false);
  assert.equal(core.isAligned('milestone', 6), true); assert.equal(core.isAligned('milestone', 5), false);
});

test('AC41 a plan created in the quarter view is stored in months', () => {
  const p = core.newPlan('quarter', 2);
  assert.equal(p.length, 6); assert.equal(p.view, 'quarter'); assert.equal(core.periodCount(p), 2);
  assert.equal(core.newPlan('quarter', 9).length, 12);
  assert.equal(core.periodCount(Object.assign({}, p, { view: 'month' })), 6);
});

test('the summary reads in quarters when the quarter view is on', () => {
  const p = Object.assign(samplePlan(), { view: 'quarter' });
  const s = core.summary(p, 'stretch');
  assert.match(s.paragraphs[0], /over 2 quarters/);
  assert.match(s.paragraphs[1], /most expensive quarter is Q2 at €68,450/);
  assert.match(s.paragraphs[1], /passes the max budget in Q2/);
});

test('the largest share and the most expensive month in the max scenario', () => {
  const s = core.summary(samplePlan(), 'max');
  assert.match(s.paragraphs[1], /Internal dev is the largest share at 78% \(€72,000\)/);
  assert.match(s.paragraphs[1], /most expensive month is M1 at €15,350/);
  assert.doesNotMatch(s.paragraphs[1], /passes/);
});

test('a resource that starts or is due after the plan ends is found', () => {
  assert.equal(core.outsidePlan({ mode: 'oneTime', due: 7 }, 6), true);
  assert.equal(core.outsidePlan({ mode: 'oneTime', due: 6 }, 6), false);
  assert.equal(core.outsidePlan({ mode: 'fixed', from: 7, to: null }, 6), true);
  assert.equal(core.outsidePlan({ mode: 'rateDays', from: 3, to: 4 }, 6), false);
});

test('quarter labels show the month unless it is where an edit would put it', () => {
  assert.equal(core.monthLabel(3, 'quarter', 'start'), 'Q1 (M3)');
  assert.equal(core.monthLabel(4, 'quarter', 'start'), 'Q2');
  assert.equal(core.monthLabel(3, 'quarter', 'end'), 'Q1');
  assert.equal(core.monthLabel(4, 'quarter', 'end'), 'Q2 (M4)');
  assert.equal(core.monthLabel(2, 'quarter'), 'Q1 (M2)');
  assert.equal(core.monthLabel(3, 'month', 'start'), 'M3');
});

test('period choices: months in the month view, with an empty end', () => {
  const p = samplePlan();
  const start = core.periodChoices(p, 'start', 3);
  assert.deepEqual(start.map(c => c.label), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
  assert.deepEqual(start.filter(c => c.selected).map(c => c.value), ['3']);
  const end = core.periodChoices(p, 'end', null);
  assert.equal(end[0].label, 'End of plan'); assert.equal(end[0].selected, true); assert.equal(end.length, 7);
  assert.deepEqual(core.periodChoices(p, 'end', 6).filter(c => c.selected).map(c => c.value), ['6']);
});

test('AC39 AC40 period choices in the quarter view keep a precise month until a quarter is picked', () => {
  const p = Object.assign(samplePlan(), { view: 'quarter' });
  const s2 = core.periodChoices(p, 'start', 2);
  assert.deepEqual(s2.map(c => c.label), ['Q1 (M2)', 'Q1', 'Q2']); assert.deepEqual(s2.filter(c => c.selected).map(c => c.value), ['keep']);
  const s4 = core.periodChoices(p, 'start', 4);
  assert.deepEqual(s4.map(c => c.label), ['Q1', 'Q2']); assert.deepEqual(s4.filter(c => c.selected).map(c => c.value), ['q2']);
  const e5 = core.periodChoices(p, 'end', 5); assert.equal(e5[1].label, 'Q2 (M5)');
  const open = core.periodChoices(p, 'end', null); assert.equal(open[0].selected, true); assert.equal(open.length, 3);
  const o5 = core.periodChoices(p, 'oneTime', 5); assert.equal(o5[0].label, 'Q2 (M5)');
  const m5 = core.periodChoices(p, 'milestone', 5); assert.equal(m5[0].label, 'Q2 (M5)'); assert.equal(core.periodChoices(p, 'milestone', 6).filter(c => c.selected)[0].value, 'q2');
});

test('picking a choice gives the month: quarters snap, keep changes nothing, empty is the end of the plan', () => {
  assert.equal(core.monthFromChoice('start', 'q2'), 4); assert.equal(core.monthFromChoice('end', 'q2'), 6);
  assert.equal(core.monthFromChoice('oneTime', 'q2'), 4); assert.equal(core.monthFromChoice('milestone', 'q2'), 6);
  assert.equal(core.monthFromChoice('start', 'keep'), undefined); assert.equal(core.monthFromChoice('end', ''), null);
  assert.equal(core.monthFromChoice('start', '5'), 5);
});
