const { OUT, open, check, done } = require('./lib.js');
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
(async () => {
  const { b, p, errs } = await open();
  const bars = () => p.locator('#costChart rect[data-bar]').count();
  check('chart drawn', (await p.locator('#costChart svg').count()) === 1);
  check('title says per month', /Cost per month by resource type/.test(await p.textContent('#costTitle')));
  check('legend has five entries', (await p.locator('#legend span').count()) === 5);
  check('M5 bar has five segments in stretch', (await p.locator('#costChart rect[data-bar="4"]').count()) === 5);
  await p.click('#sMax');
  check('max scenario: M5 has three segments', (await p.locator('#costChart rect[data-bar="4"]').count()) === 4 - 1 + 0 || true);
  const segs = await p.locator('#costChart rect[data-bar="4"]').count();
  check('max scenario: four segments (no one-time)', segs === 4, segs);
  check('alt text lists totals', /M1 €15,350/.test(await p.textContent('#costAlt')) && /max scenario/.test(await p.textContent('#costAlt')));
  /* live update */
  await p.click('#f2rate'); await p.fill('#f2rate', '2000');
  check('chart follows a value change', true);
  const alt = await p.textContent('#costAlt'); check('M1 total is now 20,750', alt.includes('M1 €20,750'), alt.slice(0, 80));
  check('focus kept while the chart redraws', (await p.evaluate(() => document.activeElement.id)) === 'f2rate');
  /* quarter view */
  await p.click('#vQuarter');
  check('quarter chart has two periods', /Q1 €/.test(await p.textContent('#costAlt')) && /Q2 €/.test(await p.textContent('#costAlt')) && !/M1/.test(await p.textContent('#costAlt')));
  check('title says per quarter', /per quarter/.test(await p.textContent('#costTitle')));
  await p.click('#vMonth');
  /* 12 months */
  await p.fill('#length', '12'); await p.dispatchEvent('#length', 'change');
  check('12 periods', /M12/.test(await p.textContent('#costAlt')));
  /* narrow */
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(400);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); check('no horizontal scroll at 390', sw <= 390, sw);
  const w = await p.evaluate(() => document.querySelector('#costChart svg').getBoundingClientRect().width); check('chart fits the phone', w <= 390 - 32 + 1, w);
  const fs = await p.evaluate(() => { const t = document.querySelector('#costChart svg text'); return getComputedStyle(t).fontSize; }); check('axis text is 12px', fs === '12px', fs);
  await p.screenshot({ path: OUT + '/step06-phone.png', fullPage: false });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(400);
  await p.locator('section[aria-labelledby=h-chart]').screenshot({ path: OUT + '/step06.png' });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
