'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../docs/js/core.js');
const charts = require('../docs/js/charts.js');
const { samplePlan } = require('../docs/js/sample.js');

test('the axis uses round steps and leaves headroom', () => {
  assert.equal(charts.niceStep(100, 4), 25 > 100 / 4 ? 25 : 25);
  const a = charts.axis(28150, 4);
  assert.equal(a.step, 10000); assert.equal(a.top, 40000);
  assert.deepEqual(a.ticks, [0, 10000, 20000, 30000, 40000]);
  const b = charts.axis(15350, 4);
  assert.ok(b.top >= 15350 * 1.12 - 1e-9 && b.top - b.step < 15350 * 1.12);
  assert.deepEqual(charts.axis(0, 4).ticks.length > 1, true);
  const c = charts.axis(7, 4); assert.ok(c.step > 0 && c.top >= 7);
  for (const v of [1, 99, 100, 101, 2499, 2501, 480000, 1234567]) {
    const x = charts.axis(v, 4), norm = x.step / Math.pow(10, Math.floor(Math.log10(x.step)));
    assert.ok([1, 2, 2.5, 5, 10].some(m => Math.abs(norm - m) < 1e-9), 'step ' + x.step + ' for ' + v);
    assert.ok(x.top > v, 'headroom for ' + v);
  }
});

test('labels are pushed apart and kept inside the range', () => {
  const near = charts.spreadLabels([{ y: 100 }, { y: 104 }, { y: 108 }], 17, 10, 300);
  assert.deepEqual(near.map(x => x.y), [100, 117, 134]);
  const low = charts.spreadLabels([{ y: 296 }, { y: 299 }], 17, 10, 300);
  assert.ok(low[1].y <= 300 && low[1].y - low[0].y >= 17);
  const top = charts.spreadLabels([{ y: 2 }], 17, 10, 300); assert.equal(top[0].y, 10);
  const far = charts.spreadLabels([{ y: 30 }, { y: 200 }], 17, 10, 300); assert.deepEqual(far.map(x => x.y), [30, 200]);
});

function bars(svg) { return [...svg.matchAll(/<rect data-bar="(\d+)" data-type="(\w+)" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map(m => ({ i: +m[1], type: m[2], y: +m[3], h: +m[4] })); }

test('AC9 one bar per period, split by type, heights proportional to the values', () => {
  const plan = samplePlan(), model = charts.buildCostModel(plan, 'stretch', 640);
  assert.equal(model.periods.length, 6);
  assert.deepEqual(model.periods.map(p => p.total), [15350, 15350, 20150, 20150, 28150, 20150]);
  const svg = charts.costChart(model), b = bars(svg);
  assert.ok(b.length > 6);
  const m5 = b.filter(x => x.i === 4);
  assert.deepEqual(m5.map(x => x.type), ['internalDev', 'freelancer', 'subscription', 'infrastructure', 'oneTime']);
  const ax = charts.axis(28150, 4), ph = 350 - 64 - 40;
  const sum = m5.reduce((s, x) => s + x.h, 0);
  assert.ok(Math.abs(sum - 28150 / ax.top * ph) < 1.5, 'stack height ' + sum);
  const oneTime = m5.find(x => x.type === 'oneTime'); assert.ok(Math.abs(oneTime.h - 8000 / ax.top * ph) < 0.6);
  assert.equal(b.filter(x => x.i === 0 && x.type === 'oneTime').length, 0, 'no empty segments');
});

test('AC9 the quarter view draws one bar per quarter with the same total', () => {
  const plan = Object.assign(samplePlan(), { view: 'quarter' });
  const model = charts.buildCostModel(plan, 'stretch', 640);
  assert.deepEqual(model.periods.map(p => p.label), ['Q1', 'Q2']);
  assert.equal(model.periods.reduce((s, p) => s + p.total, 0), 119300);
  assert.equal(new Set(bars(charts.costChart(model)).map(x => x.i)).size, 2);
});

test('AC25 the text alternative gives every period total', () => {
  const alt = charts.costAlt(charts.buildCostModel(samplePlan(), 'max', 640));
  assert.equal(alt, 'Cost per month in the max scenario: M1 €15,350, M2 €15,350, M3 €15,350, M4 €15,350, M5 €15,350, M6 €15,350.');
});

test('narrow charts keep labels readable: value labels are thinned, axis labels skip every second period', () => {
  const plan = Object.assign(samplePlan(), { length: 12 });
  const wide = charts.costChart(charts.buildCostModel(plan, 'stretch', 900));
  const narrow = charts.costChart(charts.buildCostModel(plan, 'stretch', 300));
  const count = (svg, re) => (svg.match(re) || []).length;
  assert.equal(count(wide, />M\d+</g), 12);
  assert.ok(count(narrow, />M\d+</g) <= 6);
  assert.ok(count(narrow, />\d+(\.\d)?k</g) < count(wide, />\d+(\.\d)?k</g));
  assert.ok(count(narrow, />\d+(\.\d)?k</g) >= 1, 'the highest bar keeps its label');
});

test('names in titles are escaped and the chart never contains raw markup from a plan', () => {
  const plan = samplePlan(); plan.resources[0].name = '<script>alert(1)</script>';
  const svg = charts.costChart(charts.buildCostModel(plan, 'stretch', 640));
  assert.ok(!svg.includes('<script'));
  assert.equal(charts.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('an empty plan still draws an axis and no bars', () => {
  const plan = core.newPlan('month', 6), model = charts.buildCostModel(plan, 'max', 640);
  const svg = charts.costChart(model);
  assert.equal(bars(svg).length, 0); assert.ok(svg.includes('<svg'));
});
