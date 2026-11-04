'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const core = require('../docs/js/core.js');
const codec = require('../docs/js/codec.js');
const { samplePlan } = require('../docs/js/sample.js');

const PAGES = 'https://nlsplgrnd.github.io/Budgeteer/';
const norm = codec.normalizePlan;

let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const WORDS = 'plan budget team design review launch customer data security audit beta users sign onboard feedback prototype release support quality access report training pilot partner contract license cloud hosting analytics tool service sprint roadmap scope risk change owner approve finance legal market sales invoice vendor retail mobile web portal search checkout payment account profile settings export import backup'.split(' ');
function words(len) { let s = ''; while (s.length < len) s += (s ? ' ' : '') + WORDS[Math.floor(rnd() * WORDS.length)]; return s.slice(0, len).trim().padEnd(len, 'x'); }
function noise(len) { const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?-()'; let s = ''; for (let i = 0; i < len; i++) s += c[Math.floor(rnd() * c.length)]; return s; }
function biggest(text) {
  const resources = [];
  for (let i = 1; i <= 20; i++) {
    const mode = ['rateDays', 'fixed', 'oneTime'][i % 3], r = { id: i, name: text(40), type: core.TYPE_ORDER[i % 5], mode, from: 1 + (i % 4), to: 6 + (i % 7), on: { max: i % 2 === 0, stretch: true } };
    if (mode === 'rateDays') { r.rate = 400 + i * 37; r.days = 3.5 + (i % 9); } else r.amount = 1000 + i * 730;
    if (mode === 'oneTime') r.due = 1 + (i % 12);
    resources.push(r);
  }
  const milestones = [];
  for (let i = 1; i <= 8; i++) milestones.push({ id: i, name: text(40), value: text(140), due: 1 + i, linked: [i, i + 8, i + 12], importance: i % 2 ? 'must' : 'nice' });
  return { version: 1, view: 'month', length: 12, scenario: 'stretch', budgets: { max: 295000, stretch: 355000 }, resources, milestones };
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');

test('AC17 a plan survives the plain link format exactly', () => {
  const p = samplePlan(), frag = codec.encodePlan(p);
  assert.match(frag, /^v1\.[A-Za-z0-9_-]+$/);
  const r = codec.decodePlan(frag);
  assert.equal(r.ok, true);
  assert.deepEqual(r.plan, norm(p));
  assert.equal(core.scenarioTotals(r.plan, 'stretch').total, 119300);
});

test('AC17 view, scenario, budgets, switches and fractions are restored', () => {
  const p = samplePlan(); p.view = 'quarter'; p.scenario = 'max'; p.resources[0].days = 8.5; p.resources[5].on.stretch = false; p.resources[1].to = 4;
  const r = codec.decodePlan(codec.encodePlan(p));
  assert.deepEqual(r.plan, norm(p));
  assert.equal(r.plan.view, 'quarter'); assert.equal(r.plan.scenario, 'max'); assert.equal(r.plan.resources[0].days, 8.5);
  assert.deepEqual(r.plan.resources[5].on, { max: false, stretch: false });
});

test('names with umlauts and euro signs survive', () => {
  const p = samplePlan(); p.resources[0].name = 'Entwicklungsteam Größe €'; p.milestones[0].value = 'Fertig für Kunden: schön, süß, äöü.';
  assert.deepEqual(codec.decodePlan(codec.encodePlan(p)).plan, norm(p));
});

test('AC26 the largest plan round-trips, plain and deflated', async () => {
  for (const text of [words, noise]) {
    const p = biggest(text);
    assert.deepEqual(codec.decodePlan(codec.encodePlan(p)).plan, norm(p));
    const frag = await codec.encodePlanShort(p);
    const r = await codec.decodePlanShort(frag);
    assert.equal(r.ok, true);
    assert.deepEqual(r.plan, norm(p));
  }
});

test('the shorter form is chosen, and a small plan stays plain or shrinks', async () => {
  const p = samplePlan(), plain = codec.encodePlan(p), short = await codec.encodePlanShort(p);
  assert.ok(short.length <= plain.length);
  assert.match(short, /^v1z?\./);
  assert.deepEqual((await codec.decodePlanShort(short)).plan, norm(p));
  const tiny = core.newPlan('month', 3);
  const t = await codec.encodePlanShort(tiny);
  assert.deepEqual((await codec.decodePlanShort(t)).plan, norm(tiny));
});

test('link size: a typical plan is short, the largest realistic plan stays under 2,000 characters with the Pages address', async () => {
  const typical = codec.buildLink(PAGES, await codec.encodePlanShort(samplePlan()));
  assert.ok(typical.length < 600, 'typical link ' + typical.length);
  const big = codec.buildLink(PAGES, await codec.encodePlanShort(biggest(words)));
  assert.ok(big.length < codec.LINK_WARN_LENGTH, 'largest English-like link ' + big.length);
  assert.equal(codec.shareAdvice(big).tooLong, false);
});

test('link size: the worst case, a full plan of random text, is flagged as too long and the JSON export is the way out', async () => {
  const link = codec.buildLink(PAGES, await codec.encodePlanShort(biggest(noise)));
  assert.ok(link.length > codec.LINK_WARN_LENGTH, 'random worst case ' + link.length);
  assert.equal(codec.shareAdvice(link).tooLong, true);
  assert.ok(link.length < 8000, 'still far below browser limits');
});

test('Pages links: the base is the address without fragment and query, the format does not depend on it', () => {
  const frag = codec.encodePlan(samplePlan());
  assert.equal(codec.pageBase(PAGES + '#v1.abc'), PAGES);
  assert.equal(codec.pageBase(PAGES + 'index.html?x=1#v1.abc'), PAGES + 'index.html');
  assert.equal(codec.pageBase('https://example.org/'), 'https://example.org/');
  const a = codec.buildLink(PAGES, frag), b = codec.buildLink('https://budgeteer.example/', frag);
  assert.equal(codec.fragmentOf(a), frag); assert.equal(codec.fragmentOf(b), frag);
  assert.equal(codec.fragmentOf(PAGES), '');
  assert.equal(codec.decodePlan(codec.fragmentOf(a)).ok, true);
  assert.equal(codec.decodePlan('#' + frag).ok, true, 'a leading # is accepted');
  assert.equal(PAGES.length + 1, 39);
});

test('a link opened from disk only works on this computer, and is not flagged as the hosted tool', () => {
  const s = codec.shareAdvice('file:///home/user/budgeteer/docs/index.html#v1.abc');
  assert.equal(s.local, true);
  assert.equal(codec.shareAdvice(PAGES + '#v1.abc').local, false);
});

test('AC18 empty, garbage and cut-off links give a clear result and never throw', async () => {
  assert.equal(codec.decodePlan('').code, 'empty');
  assert.equal(codec.decodePlan('#').code, 'empty');
  for (const bad of ['hello', 'v1.', 'v1.!!!', 'v1.AAAA', 'v1.eyJhIjoxfQ', 'v0.abc', 'vx.abc', 'plan=1', 'v1z.', 'v1z.AAAA']) {
    const r = await codec.decodePlanShort(bad);
    assert.equal(r.ok, false, bad); assert.equal(r.code === 'invalid' || r.code === 'compressed', true, bad);
    if (r.code === 'invalid') assert.match(r.message, /not valid or was cut off/);
  }
  const frag = codec.encodePlan(samplePlan());
  for (const cut of [10, 50, 100, 300, frag.length - 1]) assert.equal(codec.decodePlan(frag.slice(0, cut)).ok, false, 'cut at ' + cut);
  const z = await codec.encodePlanShort(biggest(words));
  for (const cut of [10, 100, z.length - 3]) assert.equal((await codec.decodePlanShort(z.slice(0, cut))).ok, false, 'zipped cut at ' + cut);
});

test('AC42 a newer format version is refused with a message, an unknown one never throws', async () => {
  const frag = codec.encodePlan(samplePlan());
  const newer = 'v2.' + frag.slice(3);
  const r = codec.decodePlan(newer);
  assert.equal(r.ok, false); assert.equal(r.code, 'newer'); assert.match(r.message, /newer release/);
  assert.equal((await codec.decodePlanShort('v9z.' + frag.slice(3))).code, 'newer');
  assert.equal(codec.FORMAT_VERSION, 1);
  assert.equal(codec.decodePlan('v1.' + frag.slice(3)).ok, true, 'version 1 is read by every later release');
});

function craft(arr, zipped) {
  const json = Buffer.from(JSON.stringify(arr));
  return zipped ? 'v1z.' + b64u(zlib.deflateRawSync(json)) : 'v1.' + b64u(json);
}
test('well-formed JSON with wrong content is refused', async () => {
  const good = JSON.parse(JSON.stringify([1, 0, 6, 95000, 125000, 1, [[1, 'A', 0, 0, 100, 5, 1, 0, 3]], [[1, 'M', 'v', 2, [1], 0]]]));
  assert.equal(codec.decodePlan(craft(good)).ok, true);
  const mutate = (fn) => { const c = JSON.parse(JSON.stringify(good)); fn(c); return craft(c); };
  const cases = {
    'length 13': (c) => { c[2] = 13; }, 'length 0': (c) => { c[2] = 0; }, 'length fractional': (c) => { c[2] = 2.5; },
    'quarter view with 4 months': (c) => { c[1] = 1; c[2] = 4; },
    'negative budget': (c) => { c[3] = -1; }, 'NaN budget': (c) => { c[3] = null; }, 'string budget': (c) => { c[3] = '95000'; },
    'wrong top-level size': (c) => { c.pop(); }, 'not an array': (c) => { c.length = 0; },
    'bad type index': (c) => { c[6][0][2] = 9; }, 'bad mode index': (c) => { c[6][0][3] = 3; },
    'bad on bits': (c) => { c[6][0][8] = 4; }, 'from 0': (c) => { c[6][0][6] = 0; }, 'name not a string': (c) => { c[6][0][1] = 5; },
    'duplicate resource id': (c) => { c[6].push(c[6][0].slice()); },
    'one-time without due': (c) => { c[6][0][3] = 2; c[6][0][5] = 0; },
    'milestone name too long': (c) => { c[7][0][1] = 'x'.repeat(41); }, 'milestone value too long': (c) => { c[7][0][2] = 'x'.repeat(141); },
    'milestone links a missing resource': (c) => { c[7][0][4] = [99]; }, 'milestone due 13': (c) => { c[7][0][3] = 13; },
    'bad importance': (c) => { c[7][0][5] = 2; },
    '21 resources': (c) => { c[6] = Array.from({ length: 21 }, (_, i) => [i + 1, 'r', 0, 1, 1, 0, 1, 0, 1]); c[7] = []; },
    '9 milestones': (c) => { c[7] = Array.from({ length: 9 }, (_, i) => [i + 1, 'm', '', 1, [], 0]); }
  };
  for (const [name, fn] of Object.entries(cases)) {
    const r = codec.decodePlan(mutate(fn));
    assert.equal(r.ok, false, name); assert.equal(r.code, 'invalid', name);
  }
});

test('a deflated link that inflates to a huge size is refused without exhausting memory', async () => {
  const bomb = 'v1z.' + b64u(zlib.deflateRawSync(Buffer.alloc(20 * 1024 * 1024, 0x20)));
  assert.ok(bomb.length < 30000, 'a 20 MB payload deflates to a small link: ' + bomb.length);
  const r = await codec.decodePlanShort(bomb);
  assert.equal(r.ok, false); assert.equal(r.code, 'invalid');
});

test('a valid plan padded beyond the size limit is refused, so the limit really stops the inflation', async () => {
  const json = JSON.stringify([1, 0, 6, 95000, 125000, 1, [[1, 'A', 0, 0, 100, 5, 1, 0, 3]], []]);
  const small = 'v1z.' + b64u(zlib.deflateRawSync(Buffer.from(json)));
  assert.equal((await codec.decodePlanShort(small)).ok, true);
  const padded = 'v1z.' + b64u(zlib.deflateRawSync(Buffer.from(json + ' '.repeat(100000))));
  const r = await codec.decodePlanShort(padded);
  assert.equal(r.ok, false); assert.equal(r.code, 'invalid');
});

test('a plain decode refuses a deflated link with a clear code', () => {
  const r = codec.decodePlan('v1z.AAAA');
  assert.equal(r.ok, false); assert.equal(r.code, 'compressed'); assert.match(r.message, /newer browser/);
});

test('AC28 the same validation applies to a plan that is decoded again after another round trip', () => {
  let p = samplePlan();
  for (let i = 0; i < 3; i++) p = codec.decodePlan(codec.encodePlan(p)).plan;
  assert.deepEqual(p, norm(samplePlan()));
});
