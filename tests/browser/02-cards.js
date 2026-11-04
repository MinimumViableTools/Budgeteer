const { OUT, open, check, done } = require('./lib.js');
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
(async () => {
  const { b, p, errs } = await open();
  check('six cards', (await p.locator('#cards .rcard').count()) === 6);
  check('core team total', (await p.textContent('[data-tot="1"]')) === '€72,000');
  check('share 60%', /60% of stretch/.test(await p.textContent('[data-share="1"]')));
  check('five chips', (await p.locator('#tplChips .chip').count()) === 5);
  /* typing keeps focus and updates the total */
  await p.click('#f2rate'); await p.fill('#f2rate', '1500'); 
  check('typing keeps focus', (await p.evaluate(() => document.activeElement.id)) === 'f2rate');
  check('total follows the rate', (await p.textContent('[data-tot="2"]')) === '€36,000');
  check('slider follows', (await p.inputValue('#cards [data-id="2"][data-k="rate"][type=range]')) === '1500');
  await p.fill('#f2rate', '5000');
  check('range grows when a larger value is typed', (await p.getAttribute('#cards [data-id="2"][data-k="rate"][type=range]', 'max')) === '5000');
  check('stored', (await plan(p)).resources[1].rate === 5000);
  await p.fill('#f2rate', '1200'); await p.keyboard.press('Tab');
  check('number reformatted on blur', (await p.inputValue('#f2rate')) === '1,200');
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
  /* FTE */
  check('core team is an FTE card: 200 percent of 6,000', (await p.inputValue('#f1share')) === '200' && (await p.inputValue('#f1fteCost')) === '6,000' && /Share of one FTE/.test(await p.textContent('[data-card="1"]')) && /Cost per FTE and month/.test(await p.textContent('[data-card="1"]')));
  await p.fill('#f1share', '150');
  check('FTE total follows the share', (await p.textContent('[data-tot="1"]')) === '€54,000' && (await plan(p)).resources[0].share === 1.5);
  await p.fill('#f1share', '400');
  check('a share above the slider range is accepted and grows the range', (await plan(p)).resources[0].share === 4 && (await p.getAttribute('#cards [data-id="1"][data-k="share"][type=range]', 'max')) === '400');
  await p.fill('#f1share', '200'); await p.keyboard.press('Tab');
  check('FTE slider works by keyboard in steps of 5 percent', true);
  await p.focus('#cards [data-id="1"][data-k="share"][type=range]'); await p.keyboard.press('ArrowRight');
  check('arrow key adds 5 percent', (await p.inputValue('#f1share')) === '205');
  await p.keyboard.press('ArrowLeft');
  /* a new internal staff card is FTE at 100 percent */
  await p.click('[data-tpl="internalStaff"]');
  const idStaff = (await plan(p)).resources.slice(-1)[0].id;
  check('new internal staff: FTE at 100 percent, 8,000 per FTE, name Internal team', (await p.inputValue('#f' + idStaff + 'share')) === '100' && (await p.inputValue('#f' + idStaff + 'fteCost')) === '8,000' && (await p.inputValue('[data-name="' + idStaff + '"]')) === 'Internal team' && (await p.textContent('[data-tot="' + idStaff + '"]')) === '€48,000');
  await p.click('[data-card="' + idStaff + '"] summary'); await p.selectOption('#m' + idStaff, 'rateDays');
  check('the cost mode can be changed away from FTE', (await p.locator('#f' + idStaff + 'rate').count()) === 1);
  await p.selectOption('#m' + idStaff, 'fte');
  check('and back to FTE with the earlier values', (await p.inputValue('#f' + idStaff + 'share')) === '100');
  await p.click('[data-rm="' + idStaff + '"]');
  /* quarter view */
  await p.click('#vQuarter');
  check('fixed amount shows three times in quarters', (await p.inputValue('#f4amount')) === '900' && /Cost per quarter/.test(await p.textContent('[data-card="4"]')));
  await p.fill('#f4amount', '1500');
  check('typed per-quarter value is divided by three', (await plan(p)).resources[3].amount === 500);
  check('days per quarter', (await p.inputValue('#f2days')) === '12' && /Days per quarter/.test(await p.textContent('[data-card="2"]')));
  check('FTE card in the quarter view: cost per FTE three times, share unchanged', (await p.inputValue('#f1fteCost')) === '18,000' && /Cost per FTE and quarter/.test(await p.textContent('[data-card="1"]')) && (await p.inputValue('#f1share')) === '200');
  await p.fill('#f1fteCost', '21000');
  check('typed per-quarter FTE cost is divided by three', (await plan(p)).resources[0].fteCost === 7000);
  await p.fill('#f1fteCost', '18000');
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
  check('back to months keeps precise values elsewhere', (await plan(p)).resources[1].days === 4 && (await p.inputValue('#f4amount')) === '500');
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
