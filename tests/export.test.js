'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app/js/core.js');
const exporter = require('../app/js/export.js');
const { samplePlan } = require('../app/js/sample.js');

/* a small CSV reader for the tests: quoted fields, doubled quotes, line breaks inside quotes */
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* part of the line break */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

test('CSV: header and one row per resource with plain numbers', () => {
  const csv = exporter.exportCsv(samplePlan());
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'resource,type,cost_mode,in_max,in_stretch,first_month,last_month,monthly_cost_eur,total_eur');
  assert.equal(lines[0], exporter.CSV_HEADER);
  assert.equal(lines[1], 'Core team,Internal staff,FTE,yes,yes,1,6,12000,72000');
  assert.equal(lines[5], 'Security audit,One time,One time,no,yes,5,5,8000,8000');
  assert.equal(lines.length, 8, 'six rows, a header and the closing line break');
  assert.ok(csv.endsWith('\r\n'));
  parseCsv(csv).slice(1).forEach((r) => r.slice(5).forEach((v) => assert.match(v, /^\d+(\.\d+)?$/, 'plain number: ' + v)));
  assert.ok(!/[€$]/.test(csv), 'no currency sign');
});

test('CSV: the sum of total_eur per scenario matches the totals of the tool (AC57)', () => {
  const plan = samplePlan(), rows = parseCsv(exporter.exportCsv(plan)).slice(1);
  const sum = (col) => rows.filter((r) => r[col] === 'yes').reduce((s, r) => s + Number(r[8]), 0);
  assert.equal(sum(3), core.scenarioTotals(plan, 'max').total);
  assert.equal(sum(3), 92100);
  assert.equal(sum(4), core.scenarioTotals(plan, 'stretch').total);
  assert.equal(sum(4), 119300);
});

test('CSV: names with a comma, a quote or a line break survive a round trip', () => {
  const plan = samplePlan();
  plan.resources[0].name = 'Team, "core"';
  plan.resources[1].name = 'Line\nbreak';
  const rows = parseCsv(exporter.exportCsv(plan));
  assert.equal(rows[1][0], 'Team, "core"');
  assert.equal(rows[2][0], 'Line\nbreak');
  assert.equal(rows[1].length, 9);
  assert.equal(rows.length, 7);
});

test('CSV: a name that a spreadsheet would run as a formula gets a leading apostrophe', () => {
  const plan = samplePlan();
  ['=SUM(A1)', '+1', '-2', '@x'].forEach((name, i) => { plan.resources[i].name = name; });
  const rows = parseCsv(exporter.exportCsv(plan));
  assert.deepEqual([1, 2, 3, 4].map((i) => rows[i][0]), ["'=SUM(A1)", "'+1", "'-2", "'@x"]);
  assert.equal(rows[5][0], 'Security audit', 'other names stay as they are');
});

test('CSV: amounts have at most two decimals, a plan without resources has only the header', () => {
  const plan = samplePlan();
  plan.resources = [{ id: 1, name: 'Odd', type: 'subscription', mode: 'fixed', amount: 10.005, from: 1, to: null, on: { max: true, stretch: true } }];
  const row = parseCsv(exporter.exportCsv(plan))[1];
  assert.match(row[7], /^\d+(\.\d{1,2})?$/);
  assert.match(row[8], /^\d+(\.\d{1,2})?$/);
  plan.resources = [];
  assert.equal(exporter.exportCsv(plan), exporter.CSV_HEADER + '\r\n');
});

test('CSV: a resource with an end month and a one-time cost show their months', () => {
  const rows = parseCsv(exporter.exportCsv(samplePlan()));
  assert.deepEqual(rows[6].slice(5, 9), ['3', '6', '4800', '19200']);
});

test('Markdown: name, budgets, totals, resources, months and milestones (AC58)', () => {
  const md = exporter.exportMarkdown(samplePlan());
  assert.ok(md.startsWith('# Sample plan\n'));
  ['## Totals', '## Resources', '## Cost per month', '## Milestones'].forEach((h) => assert.ok(md.includes(h + '\n'), h));
  assert.match(md, /Max budget 95000, stretch budget 125000/);
  assert.match(md, /\| Max \| 92100 \| 2900 under \| 32900 under \| Within max budget \|/);
  assert.match(md, /\| Stretch \| 119300 \| 24300 over \| 5700 under \| In stretch zone \|/);
  assert.match(md, /\| Core team \| Internal staff \| FTE \| yes \| yes \| 1 \| 6 \| 12000 \| 72000 \|/);
  assert.match(md, /\| M5 \| 15350 \| 28150 \|/);
  assert.match(md, /\| Security audit passed \| Nice-to-have \| M5 \| .* \| not reached: Security audit is switched off \| reached \|/);
  assert.ok(!/[€$]/.test(md), 'plain numbers, no currency sign');
});

test('Markdown: every table row has the same number of cells as its header', () => {
  const lines = exporter.exportMarkdown(samplePlan()).split('\n');
  let cols = 0;
  lines.forEach((l) => {
    if (!l.startsWith('|')) { cols = 0; return; }
    const n = l.split(/(?<!\\)\|/).length - 2;
    if (!cols) cols = n; else assert.equal(n, cols, l);
  });
});

test('Markdown: a pipe or a line break in a name or text keeps the tables intact', () => {
  const plan = samplePlan();
  plan.name = 'Plan\nname';
  plan.resources[0].name = 'A | B';
  plan.milestones[0].value = 'Two\nlines | here';
  const md = exporter.exportMarkdown(plan);
  assert.ok(md.startsWith('# Plan name\n'));
  assert.ok(md.includes('| A \\| B |'));
  assert.ok(md.includes('| Two lines \\| here |'));
});

test('Markdown: an empty plan says so instead of showing empty tables', () => {
  const md = exporter.exportMarkdown(core.startPlan('Blank'));
  assert.match(md, /## Resources\n\nNo resources yet\.\n/);
  assert.match(md, /## Milestones\n\nNo milestones yet\.\n/);
  assert.match(md, /\| Max \| 0 \|/);
});

test('exports do not change the plan', () => {
  const plan = samplePlan(), before = JSON.stringify(plan);
  exporter.exportCsv(plan); exporter.exportMarkdown(plan);
  assert.equal(JSON.stringify(plan), before);
});
