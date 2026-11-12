/* Spike for plan step 3: how long is a shared link? Run with: node spikes/link-size.js
   Measures the fragment and the full GitHub Pages link for a typical plan and for the largest plan the limits allow. */
'use strict';
const zlib = require('node:zlib');
const core = require('../app/js/core.js');
const codec = require('../app/js/codec.js');
const { samplePlan } = require('../app/js/sample.js');

const BASE = 'https://minimumviabletools.github.io/Budgeteer/'; /* the Pages address of the repo */
const WORDS = ('plan budget team design review launch customer data security audit beta users sign onboard feedback prototype release support '
  + 'quality access report training pilot partner contract license cloud hosting analytics tool service sprint roadmap scope risk change owner approve '
  + 'finance legal market sales invoice vendor retail mobile web portal search checkout payment account profile settings export import backup').split(' ');
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function sentence(len) { let s = ''; while (s.length < len) s += (s ? ' ' : '') + WORDS[Math.floor(rnd() * WORDS.length)]; s = s.slice(0, len).trim(); return s.length < len ? s + 'x'.repeat(len - s.length) : s; }
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

async function measure(label, plan) {
  const json = JSON.stringify(codec.normalizePlan(plan));
  const compact = JSON.stringify(JSON.parse(Buffer.from(codec.encodePlan(plan).slice(3).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')));
  const frag = codec.encodePlan(plan);
  const b64 = (buf) => buf.toString('base64url').length + 3;
  const z = b64(zlib.deflateRawSync(Buffer.from(compact), { level: 9 }));
  const br = b64(zlib.brotliCompressSync(Buffer.from(compact)));
  const real = await codec.encodePlanShort(plan);
  const rows = { 'verbose JSON, base64url': Buffer.from(json).toString('base64url').length + 3, 'compact, base64url (the codec)': frag.length, 'compact + deflate': z, 'compact + brotli (not used)': br, 'the codec: shorter of both': real.length };
  console.log('\n' + label + '  (compact JSON ' + compact.length + ' bytes)');
  Object.keys(rows).forEach(k => console.log('  ' + k.padEnd(34) + String(rows[k]).padStart(5) + ' fragment, ' + String(rows[k] + BASE.length + 1).padStart(5) + ' in total'));
}

console.log('Base link: ' + BASE + '#  (' + (BASE.length + 1) + ' characters)');
(async () => {
  await measure('Sample plan (6 resources, 3 milestones)', samplePlan());
  await measure('Largest plan, English-like text', biggest(sentence));
  await measure('Largest plan, random text (worst case for compression)', biggest(noise));
})();
