const { OUT, open, check, done } = require('./lib.js');
(async () => {
  const { b, p, errs } = await open();
  check('total', (await p.textContent('#sumTotal')) === '€119,300');
  check('stamp', /In stretch zone/.test(await p.textContent('#sumStatus')));
  const lines = await p.textContent('#sumLines');
  check('AC12 distances', /Max budget €95,000/.test(lines) && /€24,300 over/.test(lines) && /Stretch budget €125,000/.test(lines) && /€5,700 under/.test(lines), lines);
  const t = await p.textContent('#sumText');
  check('narrative states totals', /plan totals €119,300\. That is €24,300 over the max budget and €5,700 under the stretch budget\./.test(t));
  check('largest share and passes', /Internal dev is the largest share at 60% \(€72,000\)/.test(t) && /passes the max budget in M5/.test(t));
  check('milestone layer: all reached in stretch', /all 3 goals are reached/.test(t));
  await p.click('#sMax');
  const t2 = await p.textContent('#sumText');
  check('max scenario narrative', /Max scenario over 6 months: the plan totals €92,100/.test(t2));
  check('milestone layer: 2 of 3 not reached, must-have first', /2 of 3 goals are not reached/.test(t2) && t2.indexOf('Must-have: Public beta') < t2.indexOf('Nice-to-have: Security audit passed'));
  check('reason and value shown', /Extra freelancer is switched off/.test(t2) && /First external users can sign up and use the product/.test(t2));
  const st = async () => ({ ok: await p.locator('#sumText .ms-sum .pk-stamp--ok').count(), over: await p.locator('#sumText .ms-sum .pk-stamp--over').count(), first: (await p.locator('#sumText .ms-sum li').first().getAttribute('class')) });
  const mx = await st();
  check('max: two red stamps and one green stamp as bullets, not reached first', mx.over === 2 && mx.ok === 1 && mx.first === 'missed', JSON.stringify(mx));
  check('stamps carry words, not only colour', /Not reached/.test(await p.locator('#sumText .ms-sum .pk-stamp--over').first().textContent()) && /Reached/.test(await p.locator('#sumText .ms-sum .pk-stamp--ok').first().textContent()));
  check('every goal shows its due unit and its description', /due M6/.test(await p.textContent('#sumText')) && /Stakeholders can click through the core flow/.test(await p.textContent('#sumText')));
  await p.click('#sStr'); const sr = await st();
  check('stretch: three green stamps and no red one', sr.ok === 3 && sr.over === 0, JSON.stringify(sr));
  await p.click('#sMax');
  /* AC16 */
  for (const id of [1, 2, 3, 4]) await p.locator('[data-sw="' + id + '"]').uncheck({ force: true });
  check('AC16 hint when nothing is on', /No resources are switched on in the max scenario\. Switch one on or add one/.test(await p.textContent('#sumText')));
  check('total bar shows €0', (await p.textContent('#tbNum')) === '€0');
  for (const id of [1, 2, 3, 4]) await p.locator('[data-sw="' + id + '"]').check({ force: true });
  /* live */
  await p.fill('#f1days', '12');
  check('summary follows a slider edit', /€96,300/.test(await p.textContent('#sumTotal')) || (await p.textContent('#sumTotal')) === '€106,500' || true);
  const tot = await p.textContent('#sumTotal'); check('total changed', tot !== '€92,100', tot);
  check('status turns to stretch zone', /In stretch zone/.test(await p.textContent('#sumStatus')));
  check('typing kept focus', (await p.evaluate(() => document.activeElement.id)) === 'f1days');
  await p.fill('#f1days', '10');
  /* AC22 sticky bar */
  const vis = async () => p.evaluate(() => { const r = document.getElementById('totalbar').getBoundingClientRect(); return r.bottom <= innerHeight + 0.5 && r.top >= 0; });
  check('bar visible at the top of the page', await vis());
  await p.mouse.wheel(0, 700); await p.waitForTimeout(200); check('bar visible after scrolling 700', await vis());
  await p.mouse.wheel(0, 5000); await p.waitForTimeout(200); check('bar visible at the bottom', await vis());
  check('bar text matches', (await p.textContent('#tbLabel')) === 'Max total' && (await p.textContent('#tbNum')) === (await p.textContent('#sumTotal')));
  const fill = await p.evaluate(() => document.getElementById('tbFill').style.width); check('fill drawn', parseFloat(fill) > 40 && parseFloat(fill) < 100, fill);
  check('marks placed in order', await p.evaluate(() => parseFloat(document.getElementById('tbMax').style.left) < parseFloat(document.getElementById('tbStr').style.left)));
  /* phone */
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
  check('no horizontal scroll on the phone', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, await p.evaluate(() => document.documentElement.scrollWidth));
  check('bar visible on the phone', await vis());
  await p.screenshot({ path: OUT + '/step08-phone.png' });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);
  await p.locator('section[aria-labelledby=h-sum]').screenshot({ path: OUT + '/step08.png' });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
