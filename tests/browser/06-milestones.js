const { OUT, open, check, done } = require('./lib.js');
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
(async () => {
  const { b, p, errs } = await open();
  check('three rows', (await p.locator('#msList .ms-row:not(.ms-head)').count()) === 3);
  let t = await p.textContent('#msList');
  check('AC34 both scenarios side by side with reasons', /Public beta/.test(t) && /Extra freelancer is switched off/.test(t) && /Security audit is switched off/.test(t) && (t.match(/Reached/g) || []).length >= 4, t.length);
  check('importance and due shown', /Must-have/.test(t) && /Nice-to-have/.test(t) && /M2/.test(t) && /M5/.test(t) && /M6/.test(t));
  check('three markers on the chart (stretch: all reached)', (await p.locator('#costChart .mk').count()) === 3 && (await p.locator('#costChart .mk[data-reached="1"]').count()) === 3);
  await p.click('#sMax');
  check('max: one reached marker, two not', (await p.locator('#costChart .mk[data-reached="1"]').count()) === 1);
  /* dialog: open, Escape, focus return */
  await p.click('#addMs');
  check('dialog open with title', (await p.locator('#msDlg').evaluate(d => d.open)) && (await p.textContent('#dlgTitle')) === 'Add milestone');
  check('focus on the name', (await p.evaluate(() => document.activeElement.id)) === 'msName');
  check('Delete is hidden when adding', !(await p.locator('#msDelete').isVisible()));
  await p.keyboard.press('Escape');
  check('Escape closes and focus returns to the button', !(await p.locator('#msDlg').evaluate(d => d.open)) && (await p.evaluate(() => document.activeElement.id)) === 'addMs');
  /* validation */
  await p.click('#addMs'); await p.click('#msSave');
  check('empty name: error, stays open, focus on name, invalid flag', /Give the milestone a name/.test(await p.textContent('#nameErr')) && (await p.locator('#msDlg').evaluate(d => d.open)) && (await p.evaluate(() => document.activeElement.id)) === 'msName' && (await p.getAttribute('#msName', 'aria-invalid')) === 'true');
  check('error is announced (role alert)', (await p.getAttribute('#nameErr', 'role')) === 'alert');
  /* limits */
  await p.fill('#msName', 'x'.repeat(60)); check('name stops at 40', (await p.inputValue('#msName')).length === 40);
  await p.fill('#msValue', 'y'.repeat(200)); check('AC30 value stops at 140', (await p.inputValue('#msValue')).length === 140);
  check('count shows 0 left', /0 characters left/.test(await p.textContent('#valCount')));
  await p.fill('#msValue', 'We are live.'); check('count updates', /128 characters left/.test(await p.textContent('#valCount')));
  /* due select, links, warning */
  const opts = await p.locator('#msDue option').allTextContents(); check('due options are months', opts.join() === 'M1,M2,M3,M4,M5,M6', opts.join());
  check('default due is the last month', (await p.inputValue('#msDue')) === '6');
  await p.fill('#msName', 'Early check'); await p.selectOption('#msDue', '1');
  await p.click('#msLinks [data-link="6"]');
  check('chip toggles', (await p.getAttribute('#msLinks [data-link="6"]', 'aria-checked')) === 'true');
  check('warning for a resource that starts after the due month', /Extra freelancer starts after this milestone is due/.test(await p.textContent('#msWarn')));
  await p.click('#msLinks [data-link="6"]'); check('warning gone when unlinked', (await p.textContent('#msWarn')).trim() === '');
  await p.click('#msLinks [data-link="1"]'); await p.click('#impNice');
  check('importance toggles', (await p.getAttribute('#impNice', 'aria-pressed')) === 'true' && (await p.getAttribute('#impMust', 'aria-pressed')) === 'false');
  await p.click('#msSave');
  check('saved: dialog closed, list has 4 rows, notice', !(await p.locator('#msDlg').evaluate(d => d.open)) && (await p.locator('#msList .ms-row:not(.ms-head)').count()) === 4 && /Milestone saved/.test(await p.textContent('#notice')));
  const pl = await plan(p); const m4 = pl.milestones[3];
  check('stored', m4.name === 'Early check' && m4.value === 'We are live.' && m4.due === 1 && JSON.stringify(m4.linked) === '[1]' && m4.importance === 'nice');
  check('AC29 marker appears', (await p.locator('#costChart .mk').count()) === 4);
  /* AC36 live update: switching Core team off in max changes the new milestone */
  const reachedBefore = await p.locator('#costChart .mk[data-reached="1"]').count();
  await p.locator('[data-sw="1"]').uncheck({ force: true });
  check('AC36 markers and list follow a switch', (await p.locator('#costChart .mk[data-reached="1"]').count()) < reachedBefore && /Core team is switched off/.test(await p.textContent('#msList')) && /Core team is switched off/.test(await p.textContent('#sumText')));
  await p.locator('[data-sw="1"]').check({ force: true });
  /* edit via the list and via the marker */
  await p.click('[data-edit="4"]');
  check('edit dialog title and values', (await p.textContent('#dlgTitle')) === 'Edit milestone' && (await p.inputValue('#msName')) === 'Early check' && (await p.locator('#msDelete').isVisible()));
  await p.selectOption('#msDue', '3'); await p.click('#msSave');
  check('edit saved', (await plan(p)).milestones[3].due === 3 && (await p.evaluate(() => document.activeElement.getAttribute('data-edit'))) === '4');
  await p.focus('#costChart .mk[data-ms="2"]'); await p.keyboard.press('Enter');
  check('marker opens the dialog with keyboard', (await p.locator('#msDlg').evaluate(d => d.open)) && (await p.inputValue('#msName')) === 'Security audit passed');
  await p.keyboard.press('Escape');
  /* keyboard order in the dialog */
  await p.click('#addMs'); const order = [];
  for (let i = 0; i < 12; i++) { order.push(await p.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('data-link') && 'chip' || document.activeElement.tagName)); await p.keyboard.press('Tab'); }
  check('tab order follows the form', order.slice(0, 5).join() === 'msName,msValue,msDue,chip,chip', order.join());
  await p.keyboard.press('Escape');
  /* delete */
  await p.click('[data-edit="4"]'); await p.click('#msDelete');
  check('deleted', (await p.locator('#msList .ms-row:not(.ms-head)').count()) === 3 && /Milestone deleted/.test(await p.textContent('#notice')));
  /* limit of 8 */
  for (let i = 0; i < 5; i++) { await p.click('#addMs'); await p.fill('#msName', 'M' + i); await p.click('#msSave'); }
  check('8 milestones', (await p.locator('#msList .ms-row:not(.ms-head)').count()) === 8);
  await p.click('#addMs');
  check('9th refused with a message, no dialog', !(await p.locator('#msDlg').evaluate(d => d.open)) && /at most 8 milestones/.test(await p.textContent('#notice')));
  for (let i = 0; i < 5; i++) { await p.click('[data-edit="' + (4 + i + 1) + '"]').catch(() => {}); if (await p.locator('#msDlg').evaluate(d => d.open)) { await p.click('#msDelete'); } }
  /* quarter view */
  await p.click('#vQuarter');
  t = await p.textContent('#msList'); check('quarter view: due labels', /Q1 \(M2\)/.test(t) && /Q2 \(M5\)/.test(t) && /Q2/.test(t));
  check('quarter markers on two quarters', (await p.locator('#costChart .mk').count()) >= 3);
  await p.click('[data-edit="1"]');
  check('keep option is selected for a precise month', (await p.locator('#msDue option:checked').textContent()) === 'Q1 (M2)');
  await p.selectOption('#msDue', 'q1'); await p.click('#msSave');
  check('picking Q1 puts the milestone on month 3', (await plan(p)).milestones[0].due === 3);
  await p.click('#vMonth');
  check('back to months: M3 shown', /M3/.test(await p.textContent('#msList')));
  /* phone */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  check('no horizontal scroll on the phone', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, await p.evaluate(() => document.documentElement.scrollWidth));
  await p.locator('section[aria-labelledby=h-ms]').screenshot({ path: OUT + '/step09-phone.png' });
  await p.click('#addMs'); await p.screenshot({ path: OUT + '/step09-dialog-phone.png' });
  const dw = await p.evaluate(() => document.getElementById('msDlg').getBoundingClientRect().width); check('dialog fits the phone', dw <= 390, dw);
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);
  await p.locator('section[aria-labelledby=h-ms]').screenshot({ path: OUT + '/step09.png' });
  check('no errors', errs.length === 0, errs.join(' | '));
  await b.close(); done();
})();
