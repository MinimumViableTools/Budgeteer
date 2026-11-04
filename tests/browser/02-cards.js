const { OUT, open, check, done } = require('./lib.js');
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
(async () => {
  const { b, p, errs } = await open();
  check('six cards', (await p.locator('#cards .rcard').count()) === 6);
  check('core team total', (await p.textContent('[data-tot="1"]')) === '€72,000');
  check('share 60%', /60% of stretch/.test(await p.textContent('[data-share="1"]')));
  check('five chips', (await p.locator('#tplChips .chip').count()) === 5);
  /* typing keeps focus and updates the total */
  await p.click('#f1rate'); await p.fill('#f1rate', '1500'); 
  check('typing keeps focus', (await p.evaluate(() => document.activeElement.id)) === 'f1rate');
  check('total follows the rate', (await p.textContent('[data-tot="1"]')) === '€90,000');
  check('slider follows', (await p.inputValue('#cards [data-id="1"][data-k="rate"][type=range]')) === '1500');
  await p.fill('#f1rate', '5000');
  check('range grows when a larger value is typed', (await p.getAttribute('#cards [data-id="1"][data-k="rate"][type=range]', 'max')) === '5000');
  check('stored', (await plan(p)).resources[0].rate === 5000);
  await p.fill('#f1rate', '1200'); await p.keyboard.press('Tab');
  check('number reformatted on blur', (await p.inputValue('#f1rate')) === '1,200');
  /* switch */
  await p.locator('[data-sw="1"]').uncheck({ force: true });
  check('switch off dims the card', (await p.locator('[data-card="1"]').getAttribute('class')).includes('off') && /Not in stretch/.test(await p.textContent('[data-share="1"]')));
  check('stored per scenario', JSON.stringify((await plan(p)).resources[0].on) === '{"max":true,"stretch":false}');
  await p.locator('[data-sw="1"]').check({ force: true });
  await p.click('#sMax');
  check('security audit is not in max', (await p.locator('[data-card="5"]').getAttribute('class')).includes('off') && /Not in max/.test(await p.textContent('[data-share="5"]')));
  check('label reads In max', (await p.textContent('[data-card="1"] .swl')) === 'In max');
  /* add and remove */
  await p.click('[data-tpl="freelancer"]');
  check('seven cards', (await p.locator('#cards .rcard').count()) === 7);
  check('new resource added in max is on in both scenarios', JSON.stringify((await plan(p)).resources[6].on) === '{"max":true,"stretch":true}');
  check('notice', /Added Freelancer to both scenarios/.test(await p.textContent('#notice')));
  await p.click('#sStr'); await p.click('[data-tpl="subscription"]');
  check('added while viewing stretch: stretch only', JSON.stringify((await plan(p)).resources[7].on) === '{"max":false,"stretch":true}' && /to the stretch scenario only/.test(await p.textContent('#notice')));
  await p.click('[data-rm="8"]'); await p.click('#sMax');
  await p.click('[data-rm="7"]');
  check('removed', (await p.locator('#cards .rcard').count()) === 6 && /Resource removed/.test(await p.textContent('#notice')));
  /* name */
  await p.fill('[data-name="3"]', 'Analytics suite');
  check('rename stored and focus kept', (await plan(p)).resources[2].name === 'Analytics suite' && (await p.evaluate(() => document.activeElement.getAttribute('data-name'))) === '3');
  /* mode change */
  await p.click('[data-card="3"] summary'); await p.selectOption('#m3', 'oneTime');
  check('mode change rebuilds the card with a due select', (await p.locator('#d3').count()) === 1 && (await plan(p)).resources[2].mode === 'oneTime');
  check('More settings stays open after the rebuild', await p.locator('#m3').isVisible());
  await p.selectOption('#m3', 'fixed');
  /* quarter view */
  await p.click('#vQuarter');
  check('fixed amount shows three times in quarters', (await p.inputValue('#f4amount')) === '900' && /Cost per quarter/.test(await p.textContent('[data-card="4"]')));
  await p.fill('#f4amount', '1500');
  check('typed per-quarter value is divided by three', (await plan(p)).resources[3].amount === 500);
  check('days per quarter', (await p.inputValue('#f1days')) === '30' && /Days per quarter/.test(await p.textContent('[data-card="1"]')));
  check('extra freelancer start shows Q1 or Q2', (await p.locator('#s6').inputValue()) === 'q1' ? false : true);
  check('start M3 of extra freelancer is precise: shows "Q1 (M3)"', /Q1 \(M3\)/.test(await p.locator('#s6 option:checked').textContent()));
  check('one-time due M5 shows Q2 (M5)', /Q2 \(M5\)/.test(await p.locator('#d5 option:checked').textContent()));
  await p.selectOption('#d5', 'q2');
  check('snapped to first month of Q2', (await plan(p)).resources[4].due === 4);
  await p.click('[data-card="6"] summary');
  await p.selectOption('#s6', 'q2');
  check('start snapped to month 4', (await plan(p)).resources[5].from === 4);
  await p.selectOption('#e6', 'q2');
  check('end snapped to month 6', (await plan(p)).resources[5].to === 6);
  await p.click('#vMonth');
  check('back to months keeps precise values elsewhere', (await plan(p)).resources[0].days === 10 && (await p.inputValue('#f4amount')) === '500');
  /* outside plan */
  await p.fill('#length', '3'); await p.dispatchEvent('#length', 'change');
  check('outside-plan warning for a resource due after the end', await p.locator('[data-outside="5"]').isVisible());
  await p.fill('#length', '6'); await p.dispatchEvent('#length', 'change');
  check('warning gone again', !(await p.locator('[data-outside="5"]').isVisible()));
  /* limit */
  for (let i = 0; i < 16; i++) await p.click('[data-tpl="subscription"]');
  check('20 resources then refused', (await p.locator('#cards .rcard').count()) === 20 && /at most 20 resources/.test(await p.textContent('#notice')));
  /* keyboard: the switch is a real checkbox reachable by tab */
  await p.focus('[data-name="1"]'); await p.keyboard.press('Tab');
  check('tab reaches the switch', (await p.evaluate(() => document.activeElement.hasAttribute('data-sw'))));
  await p.keyboard.press('Space');
  check('space toggles it', (await plan(p)).resources[0].on.max === false);
  /* a new plan built in max is complete in stretch */
  await p.evaluate(() => { const st = Budgeteer.ui.getStore(); st.loadPlan(Budgeteer.share.emptyPlan(), ''); });
  await p.click('#sMax'); for (const k of ['internalStaff', 'freelancer', 'subscription']) await p.click('[data-tpl="' + k + '"]');
  const totalMax = await p.textContent('#sumTotal'); await p.click('#sStr');
  check('new plan built in max: stretch shows the same resources and total', (await p.textContent('#sumTotal')) === totalMax && (await p.locator('#cards .rcard:not(.off)').count()) === 3 && !/No resources are switched on/.test(await p.textContent('#sumText')), totalMax);
  await p.screenshot({ path: OUT + '/step05.png', fullPage: true });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
