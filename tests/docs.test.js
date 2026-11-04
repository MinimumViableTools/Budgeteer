'use strict';
/* Checks the rules of the stack: the page works from disk, on Pages and in a container with no build, no server and no network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'docs');
const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
const refs = (re) => [...html.matchAll(re)].map((m) => m[1]);

test('every local file the page loads exists', () => {
  const files = [...refs(/<script src="([^"]+)"/g), ...refs(/<link rel="stylesheet" href="([^"]+)"/g)];
  assert.ok(files.length >= 10);
  for (const f of files) assert.ok(!/^[a-z]+:\/\//.test(f), 'external file ' + f), assert.ok(fs.existsSync(path.join(DOCS, f)), 'missing ' + f);
});

test('the page loads nothing from the network, only a link to the source is external', () => {
  const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, ['https://github.com/MinimumViableTools/Budgeteer']);
  const css = ['style.css', 'design/tokens.css', 'design/fonts.css', 'design/components.css'].map((f) => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n');
  assert.ok(!/url\(\s*["']?https?:/i.test(css) && !/@import/.test(css), 'no remote CSS resources');
});

test('scripts are classic scripts in a working order, with no modules and no runtime fetching', () => {
  const scripts = refs(/<script src="([^"]+)"/g);
  assert.ok(!/type="module"/.test(html));
  const order = ['js/core.js', 'js/codec.js', 'js/sample.js', 'js/state.js', 'js/stack.js', 'js/charts.js', 'js/ui.js', 'js/ui-plans.js', 'js/main.js'];
  const idx = order.map((f) => scripts.indexOf(f)); assert.ok(idx.every((i) => i >= 0), 'all core scripts are loaded');
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'dependencies come first');
  assert.equal(scripts[scripts.length - 1], 'js/main.js');
  for (const f of scripts) {
    const code = fs.readFileSync(path.join(DOCS, f), 'utf8');
    assert.ok(!/^\s*(import|export)\s/m.test(code), f + ' uses module syntax');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|importScripts/.test(code), f + ' fetches at run time');
    assert.ok(!/localStorage|document\.cookie|indexedDB/.test(code), f + ' stores data beyond the tab');
    if (f !== 'js/ui-plans.js') assert.ok(!/sessionStorage/.test(code), f + ' uses the tab storage, only the tray may');
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(code), f + ' uses eval');
  }
});

test('the pure files never touch the page', () => {
  for (const f of ['core.js', 'codec.js', 'sample.js', 'state.js', 'stack.js', 'charts.js']) {
    const code = fs.readFileSync(path.join(DOCS, 'js', f), 'utf8');
    assert.ok(!/\bdocument\b|\bwindow\b|\blocation\b|\bnavigator\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, '')), f + ' reaches into the page');
  }
});

test('fonts, their licence texts and the Pages marker are shipped', () => {
  const fonts = fs.readdirSync(path.join(DOCS, 'design', 'fonts'));
  assert.ok(fonts.filter((f) => f.endsWith('.woff2')).length === 3);
  assert.ok(fonts.includes('OFL-CourierPrime.txt') && fonts.includes('OFL-SourceSerif4.txt'));
  for (const f of fonts.filter((x) => x.startsWith('OFL'))) assert.match(fs.readFileSync(path.join(DOCS, 'design', 'fonts', f), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/i);
  assert.ok(fs.existsSync(path.join(DOCS, '.nojekyll')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'LICENSE')));
  const fontCss = fs.readFileSync(path.join(DOCS, 'design', 'fonts.css'), 'utf8');
  for (const m of fontCss.matchAll(/url\("([^"]+)"\)/g)) assert.ok(fs.existsSync(path.join(DOCS, 'design', m[1])), 'font file ' + m[1]);
});

test('the design copy carries its version line and the page is dark with a language', () => {
  assert.match(fs.readFileSync(path.join(DOCS, 'design', 'tokens.css'), 'utf8'), /^\/\* Pocketknife design version \d+/);
  assert.match(html, /<html lang="en" data-theme="ink">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test('the Pages site and the demo: no link needed, the sample plan is the default', () => {
  const main = fs.readFileSync(path.join(DOCS, 'js', 'main.js'), 'utf8');
  assert.match(main, /samplePlan\(\)/);
  assert.match(html, /id="demoBanner"/);
});

test('the slogan and the description of the page', () => {
  assert.match(html, /<span id="typed">Budget\? Nudge it\. Judge it\.<\/span>/);
  assert.match(html, /<meta name="description" content="Rehearse your budget before you commit\.">/);
});

test('the logo: files, token colours, and its place before the name', () => {
  const dir = path.join(DOCS, 'logo'), svg = fs.readFileSync(path.join(dir, 'budgeteer-logo.svg'), 'utf8');
  const tokens = fs.readFileSync(path.join(DOCS, 'design', 'tokens.css'), 'utf8');
  const ink = tokens.slice(tokens.indexOf('[data-theme="ink"]'), tokens.indexOf(':root {', tokens.indexOf('[data-theme="ink"]')));
  const allowed = ['--surface', '--data-internal-staff', '--data-freelancer', '--ribbon'].map((n) => new RegExp(n + ': (#[0-9a-f]{6});').exec(ink)[1]);
  const fills = [...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase());
  assert.equal(fills.length, 4);
  assert.deepEqual([...new Set(fills)].sort(), [...allowed].sort(), 'only Ink theme tokens');
  assert.ok(!/gradient|filter|shadow|<text|<image/i.test(svg.replace(/<!--[\s\S]*?-->/g, '')), 'flat, no text');
  assert.match(svg, /viewBox="0 0 32 32"/); assert.match(svg, /rx="6"/);
  for (const [f, size] of [['budgeteer-logo-1024.png', 1024], ['budgeteer-logo-512.png', 512], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
    const b = fs.readFileSync(path.join(dir, f));
    assert.equal(b.subarray(1, 4).toString(), 'PNG'); assert.equal(b.readUInt32BE(16), size); assert.equal(b.readUInt32BE(20), size);
  }
  assert.ok(html.indexOf('class="logo"') > 0 && html.indexOf('class="logo"') < html.indexOf('<h1>'), 'the logo comes before the headline');
  assert.match(html, /<img class="logo" src="logo\/budgeteer-logo\.svg" alt="" width="56" height="56">/);
  assert.match(html, /<link rel="icon" href="logo\/budgeteer-logo\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<link rel="apple-touch-icon" href="logo\/apple-touch-icon\.png">/);
  for (const f of refs(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(DOCS, f)), 'missing ' + f);
});

test('only the tray stores plans, and only in the tab', () => {
  const plans = fs.readFileSync(path.join(DOCS, 'js', 'ui-plans.js'), 'utf8');
  assert.match(plans, /sessionStorage/); assert.ok(!/localStorage/.test(plans));
  assert.match(plans, /try \{ return window\.sessionStorage; \} catch/, 'blocked storage must not break the page');
});

test('the changelog is structured: dated versions, only the allowed headings, newest version equals the footer', () => {
  const log = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8').split('\n');
  const versions = log.filter((l) => l.startsWith('## ') && l !== '## Unreleased');
  assert.ok(versions.length >= 4);
  for (const h of versions) assert.match(h, /^## \d+\.\d+\.\d+ - \d{4}-\d{2}-\d{2}$/, h);
  const allowed = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
  for (const l of log.filter((x) => x.startsWith('### '))) assert.ok(allowed.includes(l.slice(4)), l);
  let current = null; const seen = {};
  for (const l of log) {
    if (l.startsWith('## ')) { current = l; seen[current] = 0; } else if (l.startsWith('### ') && current) seen[current]++;
  }
  for (const h of versions) assert.ok(seen[h] > 0, 'no ### heading in ' + h);
  const newest = versions[0].split(' ')[1];
  assert.match(fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8'), new RegExp('Budgeteer ' + newest.replace(/\./g, '\\.') + '</span>'));
});

test('the release script accepts the newest version and writes notes with a compare link', () => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const root = path.join(__dirname, '..');
  const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const newest = log.split('\n').filter((l) => /^## \d/.test(l))[0].split(' ')[1];
  /* a copy with an empty Unreleased section, so pending entries do not matter here */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-'));
  const emptied = path.join(dir, 'CHANGELOG.md');
  fs.writeFileSync(emptied, log.replace(/## Unreleased\n[\s\S]*?(?=\n## \d)/, '## Unreleased\n'));
  const withPending = path.join(dir, 'PENDING.md');
  fs.writeFileSync(withPending, fs.readFileSync(emptied, 'utf8').replace('## Unreleased\n', '## Unreleased\n\n- Something not released yet.\n'));
  const run = (version, prev, file) => spawnSync('bash', ['.github/scripts/release-notes.sh', version].concat(prev ? [prev] : []), { cwd: root, encoding: 'utf8', env: Object.assign({}, process.env, { CHANGELOG: file || emptied }) });
  const ok = run(newest, 'v0.0.1');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^### /);
  assert.match(ok.stdout, /\*\*Full changelog\*\*: https:\/\/github\.com\/.+\/compare\/v0\.0\.1\.\.\.v/);
  assert.notEqual(run(newest, 'v' + newest).status, 0, 'a version that is not newer is refused');
  assert.notEqual(run('9.9.9').status, 0, 'a version the page does not show is refused');
  const pending = run(newest, 'v0.0.1', withPending);
  assert.notEqual(pending.status, 0, 'entries left under Unreleased are refused');
  assert.match(pending.stderr, /Unreleased/);
});
