const { OUT, open, check, done } = require('./lib.js');
const URL = process.env.BASE_URL || 'http://localhost:8765/index.html';
const contrastScan = () => {
  function parse(c) { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function over(top, bot) { const a = top.a + bot.a * (1 - top.a); return a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; }
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function background(el) {
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let bg = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = chain.length - 1; i >= 0; i--) { const cs = getComputedStyle(chain[i]); const c = parse(cs.backgroundColor); if (c && c.a > 0) bg = over(c, bg.a ? bg : { r: 0, g: 0, b: 0, a: 1 }); }
    return bg.a ? bg : { r: 26, g: 24, b: 20, a: 1 };
  }
  function opacityOf(el) { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; }
  const out = [];
  const els = document.querySelectorAll('body *');
  els.forEach((el) => {
    if (el.closest('.sr-only') || el.closest('[hidden]') || el.closest('dialog:not([open])')) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isInput = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'file';
    if (!own && !isInput) return;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el); let color;
    if (el instanceof SVGElement) color = parse(cs.fill); else color = parse(cs.color);
    if (!color) return;
    const bg = background(el), op = opacityOf(el);
    const fg = over({ r: color.r, g: color.g, b: color.b, a: color.a * op }, bg);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700, large = size >= 24 || (size >= 18.66 && bold);
    out.push({ text: (el.value || el.textContent).trim().slice(0, 30), tag: el.tagName, cls: el.getAttribute('class') || '', ratio: Math.round(ratio(fg, bg) * 100) / 100, need: large ? 3 : 4.5 });
  });
  return out;
};
(async () => {
  const { b, p, errs } = await open({ url: URL });
  await p.waitForTimeout(1500);
  for (const scn of ['stretch', 'max']) {
    await p.click(scn === 'max' ? '#sMax' : '#sStr');
    const res = await p.evaluate(contrastScan);
    const bad = res.filter((x) => x.ratio < x.need);
    check('contrast of ' + res.length + ' text items in ' + scn, bad.length === 0, bad.slice(0, 6).map((x) => x.tag + '.' + x.cls + ' "' + x.text + '" ' + x.ratio + '<' + x.need).join(' | '));
  }
  /* labels */
  const unlabeled = await p.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')].filter((e) => { if (e.type === 'hidden' || e.closest('[hidden]')) return false; const id = e.id; const hasFor = id && document.querySelector('label[for="' + id + '"]'); const wrapped = e.closest('label'); const aria = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'); const text = (e.tagName === 'BUTTON') && e.textContent.trim(); return !(hasFor || wrapped || aria || text); }).map((e) => e.outerHTML.slice(0, 80)));
  check('every form control has a name', unlabeled.length === 0, unlabeled.join(' | '));
  /* landmarks and headings */
  const lm = await p.evaluate(() => ({ main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, regions: [...document.querySelectorAll('section[aria-labelledby]')].every((s) => document.getElementById(s.getAttribute('aria-labelledby'))) }));
  check('one main, one h1, lang set, sections labelled', lm.main === 1 && lm.h1 === 1 && lm.lang === 'en' && lm.regions, JSON.stringify(lm));
  /* targets */
  const small = await p.evaluate(() => [...document.querySelectorAll('button,input:not([type=hidden]):not([type=file]):not([type=checkbox]),select,textarea,summary,[role=button]')].filter((e) => { if (e.closest('[hidden]') || e.closest('dialog:not([open])') || e instanceof SVGElement) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5); }).map((e) => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)));
  check('interactive controls are at least 44px tall', small.length === 0, small.join(' | '));
  const sw = await p.evaluate(() => [...document.querySelectorAll('.sw')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.height); }));
  check('switch targets are at least 44px tall', sw.every((h) => h >= 44), sw.join());
  /* keyboard and focus */
  await p.reload(); await p.waitForTimeout(800);
  const seq = []; let prev = '';
  for (let i = 0; i < 400; i++) {
    await p.keyboard.press('Tab');
    const info = await p.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      const style = { outline: cs.outlineStyle, w: parseFloat(cs.outlineWidth), color: cs.outlineColor, shadow: cs.boxShadow };
      return { id: e.id || e.getAttribute('data-sw') || e.getAttribute('data-name') || e.className || e.tagName, key: Array.prototype.indexOf.call(document.querySelectorAll('*'), e), checkbox: e.type === 'checkbox', tag: e.tagName, style, vis: r.width > 0 && r.height > 0, svg: e instanceof SVGElement, ring: e.querySelector && !!e.querySelector('.mkring') };
    });
    if (!info) break; seq.push(info);
    if (seq.length > 5 && seq[seq.length - 1].key === seq[0].key) break;
  }
  check('tab reaches many controls and wraps around', seq.length > 60 && seq.length < 399, seq.length);
  const noFocus = seq.filter((x) => !x.svg && !x.ring && (x.style.outline === 'none' || x.style.w < 2) && x.style.shadow === 'none' && !x.checkbox);
  const hiddenFocus = seq.filter((x) => !x.vis);
  check('every focused element shows a visible focus ring', noFocus.length === 0, noFocus.slice(0, 5).map((x) => x.tag + '.' + x.id).join(' | '));
  check('no focus lands on an invisible element', hiddenFocus.length === 0, hiddenFocus.slice(0, 5).map((x) => x.tag + '.' + x.id).join(' | '));
  const first = seq[0].id, order = seq.slice(0, 8).map((x) => x.id).join(',');
  check('tab starts at the skip link and goes through the page in order', seq[0].id === 'skip' || /skip/.test(String(seq[0].id)), order);
  /* widths */
  for (const w of [320, 390, 768, 1280]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(300);
    const sw2 = await p.evaluate(() => document.documentElement.scrollWidth);
    check('no horizontal scroll at ' + w, sw2 <= w, sw2);
  }
  /* reduced motion */
  const ctx2 = await open({ url: URL });
  await ctx2.p.emulateMedia({ reducedMotion: 'reduce' }); await ctx2.p.reload(); await ctx2.p.waitForTimeout(500);
  const typedText = await ctx2.p.textContent('#typed'); const anim = await ctx2.p.evaluate(() => getComputedStyle(document.querySelector('.caret')).animationName);
  check('reduced motion: headline is complete at once and the caret does not blink', typedText === 'Plan what fits, then see what does not.' && anim === 'none', typedText.slice(0, 20) + ' / ' + anim);
  await ctx2.b.close();
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
