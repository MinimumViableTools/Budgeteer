/* Browser checks: they drive the real page with Playwright. Not part of node --test, see README.md. */
const { chromium } = require('playwright');
const path = require('node:path'), os = require('node:os');
const URL = require('node:url').pathToFileURL(path.join(__dirname, '..', '..', 'app', 'index.html')).href;
const OUT = process.env.OUT || os.tmpdir();
async function open(opts = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  if (opts.offline !== false) await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.goto(opts.url || URL); await p.waitForTimeout(opts.wait || 600);
  return { b, ctx, p, errs };
}
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' [' + extra + ']' : '')); if (!ok) fails++; }
module.exports = { OUT, open, check, done: () => { console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0; } };
