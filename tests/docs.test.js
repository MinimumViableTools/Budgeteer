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
  assert.deepEqual(external, ['https://github.com/NLSPLGRND/Budgeteer']);
  const css = ['style.css', 'design/tokens.css', 'design/fonts.css', 'design/components.css'].map((f) => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n');
  assert.ok(!/url\(\s*["']?https?:/i.test(css) && !/@import/.test(css), 'no remote CSS resources');
});

test('scripts are classic scripts in a working order, with no modules and no runtime fetching', () => {
  const scripts = refs(/<script src="([^"]+)"/g);
  assert.ok(!/type="module"/.test(html));
  const order = ['js/core.js', 'js/codec.js', 'js/sample.js', 'js/state.js', 'js/charts.js', 'js/ui.js', 'js/main.js'];
  const idx = order.map((f) => scripts.indexOf(f)); assert.ok(idx.every((i) => i >= 0), 'all core scripts are loaded');
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'dependencies come first');
  assert.equal(scripts[scripts.length - 1], 'js/main.js');
  for (const f of scripts) {
    const code = fs.readFileSync(path.join(DOCS, f), 'utf8');
    assert.ok(!/^\s*(import|export)\s/m.test(code), f + ' uses module syntax');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|importScripts/.test(code), f + ' fetches at run time');
    assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(code), f + ' stores data in the browser');
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(code), f + ' uses eval');
  }
});

test('the pure files never touch the page', () => {
  for (const f of ['core.js', 'codec.js', 'sample.js', 'state.js', 'charts.js']) {
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
  const allowed = ['--surface', '--data-internal-dev', '--data-freelancer', '--ribbon'].map((n) => new RegExp(n + ': (#[0-9a-f]{6});').exec(ink)[1]);
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
