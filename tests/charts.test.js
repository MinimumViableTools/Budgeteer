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
  assert.ok(alt.startsWith('Cost per month in the max scenario: M1 €15,350, M2 €15,350, M3 €15,350, M4 €15,350, M5 €15,350, M6 €15,350.'));
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

function attr(svg, re) { return [...svg.matchAll(re)]; }

test('AC11 the period in which a budget is first passed is marked, once per budget', () => {
  const plan = samplePlan(), m = charts.buildCostModel(plan, 'stretch', 640);
  assert.deepEqual(m.passes, [{ index: 4, kind: 'max' }]);
  const svg = charts.costChart(m);
  assert.equal(attr(svg, /data-pass="4"/g).length, 1);
  assert.ok(svg.includes('>Passes max<'));
  assert.deepEqual(charts.buildCostModel(plan, 'max', 640).passes, [], 'the max scenario never passes a budget: its own running total is the one that counts');
});

test('AC11 max and stretch passed in the same period read "Passes max + stretch"', () => {
  const plan = samplePlan(); plan.budgets = { max: 20000, stretch: 21000 };
  const m = charts.buildCostModel(plan, 'stretch', 640);
  assert.equal(m.passes.length, 1); assert.equal(m.passes[0].kind, 'both');
  assert.ok(charts.costChart(m).includes('>Passes max + stretch<'));
});

test('AC11 passes in neighbouring periods do not overlap their labels', () => {
  const plan = samplePlan(); plan.budgets = { max: 60000, stretch: 80000 }; /* running totals 71,000 in M4 and 99,150 in M5 */
  const m = charts.buildCostModel(plan, 'stretch', 640);
  assert.deepEqual(m.passes.map(x => x.index), [3, 4]);
  const ys = attr(charts.costChart(m), /data-passlabel="\d" x="[\d.]+" y="(\d+)"/g).map(x => +x[1]);
  assert.equal(new Set(ys).size, 2, 'the second label moves up a row');
});

test('quarter view: the pass mark is on the quarter that contains the month', () => {
  const plan = Object.assign(samplePlan(), { view: 'quarter' });
  assert.deepEqual(charts.buildCostModel(plan, 'stretch', 640).passes, [{ index: 1, kind: 'max' }]);
  assert.equal(charts.buildHeadroomModel(plan, 'stretch', 290).passedMax, 'Q2');
});

test('AC10 the headroom bar stacks the periods, with a solid max tick and a dashed stretch tick, both labelled', () => {
  const plan = samplePlan(), m = charts.buildHeadroomModel(plan, 'stretch', 290), svg = charts.headroomChart(m);
  assert.equal(m.total, 119300);
  const slices = attr(svg, /data-slice="(\d)" data-type="(\w+)" x="\d+" y="([\d.]+)" width="44" height="([\d.]+)"/g).map(x => ({ i: +x[1], h: +x[4] }));
  const sum = slices.reduce((s, x) => s + x.h, 0), yMax = 125000 * 1.1;
  assert.ok(Math.abs(sum - 119300 / yMax * (312 - 18)) < 3, 'stack height ' + sum);
  assert.equal(new Set(slices.map(x => x.i)).size, 6);
  assert.match(svg, /data-tick="max"[^>]*stroke-width="2"\/>/); assert.ok(!/data-tick="max"[^>]*dasharray/.test(svg));
  assert.match(svg, /data-tick="stretch"[^>]*stroke-dasharray="5 4"/);
  assert.ok(svg.includes('>Max €95,000<') && svg.includes('>Stretch €125,000<') && svg.includes('>Total €119,300<'));
});

test('AC10 labels next to the bar stay at least 17px apart even when the values are close', () => {
  const plan = samplePlan(); plan.budgets = { max: 119000, stretch: 119500 };
  const svg = charts.headroomChart(charts.buildHeadroomModel(plan, 'stretch', 290));
  const ys = ['max', 'total', 'stretch'].map(k => +attr(svg, new RegExp('data-label="' + k + '" x="\\d+" y="([\\d.]+)"', 'g'))[0][1]).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 17 - 0.01 && ys[2] - ys[1] >= 17 - 0.01, ys.join(','));
});

test('AC11 the label of the crossing period is bold in the headroom bar, thin slices get no label', () => {
  const svg = charts.headroomChart(charts.buildHeadroomModel(samplePlan(), 'stretch', 290));
  assert.match(svg, /data-slicelabel="4"[^>]*font-weight="700"/);
  assert.ok(!/data-slicelabel="3"[^>]*font-weight="700"/.test(svg));
  const thin = samplePlan(); thin.resources.push({ id: 7, name: 'Tiny', type: 'subscription', mode: 'oneTime', amount: 5, due: 1, from: 1, to: null, on: { max: true, stretch: true } });
  thin.budgets = { max: 500000, stretch: 600000 };
  const labels = attr(charts.headroomChart(charts.buildHeadroomModel(thin, 'max', 290)), /data-slicelabel="(\d)"/g).length;
  assert.ok(labels <= 6);
});

test('AC25 the headroom text alternative names the totals, the budgets and the periods where they are passed', () => {
  assert.equal(charts.headroomAlt(charts.buildHeadroomModel(samplePlan(), 'stretch', 290)),
    'The stretch scenario totals €119,300, against a max budget of €95,000 and a stretch budget of €125,000. The running total passes the max budget in M5.');
  assert.equal(charts.headroomAlt(charts.buildHeadroomModel(samplePlan(), 'max', 290)),
    'The max scenario totals €92,100, against a max budget of €95,000 and a stretch budget of €125,000.');
});

test('a total far above both budgets still fits inside the drawing', () => {
  const plan = samplePlan(); plan.budgets = { max: 1000, stretch: 2000 };
  const svg = charts.headroomChart(charts.buildHeadroomModel(plan, 'stretch', 290));
  for (const m of attr(svg, /y="(-?[\d.]+)"/g)) assert.ok(+m[1] >= 0 && +m[1] <= 350, 'y ' + m[1]);
});

test('AC29 milestone markers sit at their due period, with a different shape when not reached', () => {
  const m = charts.buildCostModel(samplePlan(), 'max', 640);
  assert.deepEqual(m.markers.map(x => [x.index, x.reached]), [[1, true], [4, false], [5, false]]);
  const svg = charts.costChart(m);
  assert.equal((svg.match(/class="mk"/g) || []).length, 3);
  assert.equal((svg.match(/<circle cx="[\d.]+" cy="16" r="10"/g) || []).length, 1, 'one circle with a check');
  assert.equal((svg.match(/rotate\(45/g) || []).length, 2, 'two diamonds with a cross');
  assert.match(svg, /aria-label="Milestone Public beta, not reached, due M6\. Edit"/);
  const all = charts.costChart(charts.buildCostModel(samplePlan(), 'stretch', 640));
  assert.equal((all.match(/data-reached="1"/g) || []).length, 3);
});

test('AC29 two milestones in one period do not sit on top of each other', () => {
  const plan = samplePlan(); plan.milestones.push({ id: 4, name: 'Another', value: '', due: 6, linked: [], importance: 'must' });
  const svg = charts.costChart(charts.buildCostModel(plan, 'stretch', 640));
  const xs = [...svg.matchAll(/data-ms="[34]"[\s\S]*?<(?:circle cx|rect x)="([\d.-]+)"/g)].map(x => +x[1]);
  assert.equal(xs.length, 2); assert.ok(Math.abs(xs[0] - xs[1]) >= 16, xs.join(','));
});

test('AC29 in the quarter view the markers move to the quarter that contains the month, the label keeps the month', () => {
  const m = charts.buildCostModel(Object.assign(samplePlan(), { view: 'quarter' }), 'stretch', 640);
  assert.deepEqual(m.markers.map(x => [x.index, x.due]), [[0, 'Q1 (M2)'], [1, 'Q2 (M5)'], [1, 'Q2']]);
});

test('AC25 the chart text alternative lists the milestones and whether they are reached', () => {
  const alt = charts.costAlt(charts.buildCostModel(samplePlan(), 'max', 640));
  assert.match(alt, /Milestones: Prototype ready due M2, reached; Security audit passed due M5, not reached; Public beta due M6, not reached\./);
});
