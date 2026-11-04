const { OUT, open, check, done } = require('./lib.js');
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
(async () => {
  const { b, p, errs } = await open();
  check('headroom drawn', (await p.locator('#headChart svg').count()) === 1);
  check('six slices per type exist', (await p.locator('#headChart rect[data-slice]').count()) >= 6);
  check('labels', /Max €95,000/.test(await p.textContent('#headChart')) && /Stretch €125,000/.test(await p.textContent('#headChart')) && /Total €119,300/.test(await p.textContent('#headChart')));
  check('status stamp in stretch zone', /In stretch zone/.test(await p.textContent('#headStatus')) && (await p.locator('#headStatus .pk-stamp--warn').count()) === 1);
  check('passes max highlighted in M5', (await p.locator('#costChart [data-pass="4"]').count()) === 1 && /Passes max/.test(await p.textContent('#costChart')));
  check('crossing label bold', (await p.locator('#headChart [data-slicelabel="4"]').getAttribute('font-weight')) === '700');
  check('alt text', /passes the max budget in M5/.test(await p.textContent('#headAlt')));
  await p.click('#sMax');
  check('max scenario: within max stamp and no pass mark', /Within max/.test(await p.textContent('#headStatus')) && (await p.locator('#costChart [data-pass]').count()) === 0);
  /* live: raising the max budget removes the pass mark in stretch */
  await p.click('#sStr');
  await p.fill('#bMax', '120000'); await p.dispatchEvent('#bMax', 'input');
  check('raising max moves the status', /Within max/.test(await p.textContent('#headStatus')) && (await p.locator('#costChart [data-pass]').count()) === 0);
  check('focus stays in the budget field', (await p.evaluate(() => document.activeElement.id)) === 'bMax');
  await p.fill('#bMax', '60000'); await p.dispatchEvent('#bMax', 'input'); await p.fill('#bStr', '80000'); await p.dispatchEvent('#bStr', 'input');
  check('both passes in separate periods', (await p.locator('#costChart [data-pass]').count()) === 2);
  await p.fill('#bMax', '20000'); await p.dispatchEvent('#bMax', 'input'); await p.fill('#bStr', '21000'); await p.dispatchEvent('#bStr', 'input');
  check('same period reads max + stretch', /Passes max \+ stretch/.test(await p.textContent('#costChart')));
  await p.fill('#bMax', '1000'); await p.dispatchEvent('#bMax', 'input'); await p.fill('#bStr', '2000'); await p.dispatchEvent('#bStr', 'input');
  check('far over: over stretch stamp', /Over stretch/.test(await p.textContent('#headStatus')));
  /* quarter view */
  await p.fill('#bMax', '95000'); await p.dispatchEvent('#bMax', 'input'); await p.fill('#bStr', '125000'); await p.dispatchEvent('#bStr', 'input');
  await p.click('#vQuarter');
  check('quarter view: pass on Q2 and slice labels Q', /Passes max/.test(await p.textContent('#costChart')) && /Q2/.test(await p.textContent('#headChart')));
  await p.click('#vMonth');
  /* phone */
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(400);
  check('no horizontal scroll on the phone', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  const w = await p.evaluate(() => document.querySelector('#headChart svg').getBoundingClientRect().width); check('headroom fits', w <= 360, w);
  await p.screenshot({ path: OUT + '/step07-phone.png', clip: { x: 0, y: 330, width: 390, height: 900 }, fullPage: true });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(400);
  await p.locator('section[aria-labelledby=h-chart]').screenshot({ path: OUT + '/step07.png' });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
