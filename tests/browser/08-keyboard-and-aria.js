const { OUT, open, check, done } = require('./lib.js');
const URL = process.env.BASE_URL || 'http://localhost:8765/index.html';
(async () => {
  const { b, p, errs } = await open({ url: URL });
  /* sliders by keyboard */
  const before = await p.textContent('[data-tot="2"]');
  await p.focus('#cards [data-id="2"][data-k="rate"][type=range]'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  check('AC24 a slider moves with the arrow keys and the total follows', (await p.textContent('[data-tot="2"]')) !== before && (await p.inputValue('#f2rate')) === '750', await p.inputValue('#f2rate'));
  await p.keyboard.press('Home'); check('Home goes to the minimum', (await p.inputValue('#f2rate')) === '0');
  await p.keyboard.press('End'); check('End goes to the maximum', (await p.inputValue('#f2rate')) === '2,000');
  /* switch by keyboard */
  await p.focus('[data-sw="2"]'); await p.keyboard.press('Space');
  check('a switch toggles with Space', (await p.evaluate(() => Budgeteer.ui.getStore().getPlan().resources[1].on.stretch)) === false);
  /* segmented buttons by keyboard */
  await p.focus('#sMax'); await p.keyboard.press('Enter');
  check('scenario buttons work with Enter', (await p.getAttribute('#sMax', 'aria-pressed')) === 'true');
  /* names of the charts */
  const names = await p.evaluate(() => [...document.querySelectorAll('svg[role=img]')].map((s) => s.getAttribute('aria-labelledby').split(' ').every((id) => { const e = document.getElementById(id); return e && e.textContent.trim().length > 0; })));
  check('AC25 both charts have an accessible name and description', names.length === 2 && names.every(Boolean), names.join());
  const alts = await p.evaluate(() => [document.getElementById('costAlt').textContent, document.getElementById('headAlt').textContent]);
  check('AC25 the text alternatives carry the numbers', /M1 €/.test(alts[0]) && /Milestones:/.test(alts[0]) && /totals €/.test(alts[1]), alts[1].slice(0, 60));
  /* focus ring contrast */
  const ring = await p.evaluate(() => { const c = getComputedStyle(document.documentElement).getPropertyValue('--focus').trim(); return c; });
  check('focus colour is the shared focus token', ring === '#9db8ff', ring);
  /* the summary region is not a live region (it changes while sliding) */
  check('the summary is not announced on every change', (await p.evaluate(() => !document.getElementById('sumText').closest('[aria-live]'))));
  check('the notice is a polite live region', (await p.getAttribute('#notice', 'aria-live')) === 'polite');
  /* phone: full page at 390 and the long names */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => Budgeteer.ui.getStore().renameResource(1, 'A very long resource name that needs all'));
  await p.waitForTimeout(300);
  const clipped = await p.evaluate(() => { const i = document.querySelector('[data-name="1"]'); return i.scrollWidth > i.clientWidth + 1; });
  const w = await p.evaluate(() => document.querySelector('[data-name="1"]').getBoundingClientRect().width);
  check('AC21 a long name has the full card width on a phone', w > 250, w);
  const stacked = await p.evaluate(() => { const r = [...document.querySelectorAll('.pk-panel')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().left)); return new Set(r).size === 1; });
  check('AC21 everything stacks in one column', stacked);
  await p.screenshot({ path: OUT + '/step11-phone-full.png', fullPage: true });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
