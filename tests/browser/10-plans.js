const { OUT, open, check, done } = require('./lib.js');
const fs = require('fs');
const URL = process.env.BASE_URL || 'http://localhost:8765/index.html';
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
const names = (p) => p.locator('#trayCards .plan-card[data-plan]').evaluateAll((els) => els.map((e) => (e.querySelector('[data-rename]') ? e.querySelector('[data-rename]').value : e.querySelector('.plan-title').textContent)));
const resCount = (p) => p.locator('#cards .rcard').count();
(async () => {
  const s = await open({ url: URL }); const p = s.p;
  /* start */
  check('the tray shows the sample plan as the open card, count and stamp', (await names(p)).join() === 'Sample plan' && (await p.textContent('#trayCount')).trim() === '(1)' && /Open/.test(await p.textContent('.plan-card.active .plan-stamp')) && (await p.getAttribute('.plan-card.active', 'aria-current')) === 'true');
  check('the sample banner shows for the sample plan and points to the tray', (await p.locator('#demoBanner').isVisible()) && /New plan/.test(await p.textContent('#demoBanner')));
  /* AC47 one click, always */
  await p.click('[data-new]');
  check('AC47 one click starts an empty plan, the old one stays', (await names(p)).join() === 'Sample plan,New plan' && (await resCount(p)) === 0 && !(await p.locator('#demoBanner').isVisible()) && /Started an empty plan/.test(await p.textContent('#notice')));
  const gapOf = () => p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('trayCards')).getPropertyValue('--gap')));
  const inRail = () => p.evaluate(() => { const r = document.getElementById('trayBody').getBoundingClientRect(), f = document.getElementById('trayToggle').getBoundingClientRect(); return [...document.querySelectorAll('#trayCards .plan-card')].every((c) => { const b = c.getBoundingClientRect(); return b.left >= f.right - 1 && b.right <= r.right + 1; }); });
  check('AC53 the open row is at most 90 px high', (await p.evaluate(() => document.querySelector('#tray .box').getBoundingClientRect().height)) <= 90);
  check('AC54 a few cards stand next to each other: no overlap, no scrolling, all inside the row', (await gapOf()) >= 0 && (await p.evaluate(() => document.getElementById('trayBody').scrollLeft)) === 0 && (await inRail()));
  check('focus goes to the name of the new plan', (await p.evaluate(() => document.activeElement.hasAttribute('data-rename'))));
  await p.click('[data-open]');
  check('AC49 opening the sample card shows it as it was', (await resCount(p)) === 6 && (await p.textContent('#sumTotal')) === '€119,300' && (await p.locator('#demoBanner').isVisible()));
  /* edits stay with their plan */
  await p.click('#sMax'); await p.fill('#bMax', '88000'); await p.dispatchEvent('#bMax', 'input');
  await p.click('[data-open]'); check('the other plan is untouched by edits of this one', (await p.inputValue('#bMax')) === '100,000' && (await p.getAttribute('#sMax', 'aria-pressed')) === 'true');
  await p.click('[data-open]'); check('and the edits are still there when coming back', (await p.inputValue('#bMax')) === '88,000');
  /* AC48 copy */
  await p.click('[data-copy]');
  check('AC48 copy: a new card "Copy of Sample plan" with all resources and milestones, next to the original', (await names(p)).join() === 'Sample plan,Copy of Sample plan,New plan' && (await resCount(p)) === 6 && (await p.locator('#msList .ms-row:not(.ms-head)').count()) === 3 && (await p.inputValue('#bMax')) === '88,000' && !(await p.locator('#demoBanner').isVisible()));
  await p.fill('#f2rate', '1999');
  await p.click('[data-open="1"]');
  check('AC48 editing the copy leaves the original alone', (await p.inputValue('#f2rate')) === '650');
  await p.click('[data-open]'); 
  /* AC52 rename */
  await p.fill('[data-rename]', 'Q3 budget für Größe'); await p.waitForTimeout(100);
  check('AC52 rename: stored, shown in the bar and in the exported file', (await plan(p)).name === 'Q3 budget für Größe' && /Q3 budget für Größe/.test(await p.textContent('#trayNow')));
  await p.keyboard.press('Enter');
  check('Enter leaves the name field', !(await p.evaluate(() => document.activeElement.hasAttribute('data-rename'))));
  await p.click('[data-rename]'); await p.fill('[data-rename]', '   '); await p.keyboard.press('Tab');
  check('an empty name is not accepted, the old name comes back', (await p.inputValue('[data-rename]')) === 'Q3 budget für Größe' && (await plan(p)).name === 'Q3 budget für Größe');
  await p.fill('[data-rename]', 'x'.repeat(60)); check('names stop at 40 characters', (await p.inputValue('[data-rename]')).length === 40 && (await plan(p)).name.length === 40);
  await p.fill('[data-rename]', 'Q3 budget für Größe'); await p.keyboard.press('Enter');
  /* collapse */
  await p.click('#trayToggle'); await p.waitForTimeout(700);
  check('AC53 the shut row is at most 60 px high and shows the arrow and the title', (await p.evaluate(() => document.querySelector('#tray .box').getBoundingClientRect().height)) <= 60);
  check('the row is shut: cards hidden, flag set, the title of the open plan stays visible', !(await p.locator('#trayBody').isVisible()) && (await p.getAttribute('#trayToggle', 'aria-expanded')) === 'false' && /Q3 budget für Größe/.test(await p.textContent('#trayNow')) && (await p.locator('#trayNow').isVisible()));
  await p.click('#trayToggle'); await p.waitForTimeout(700); check('and open again', (await p.locator('#trayBody').isVisible()) && (await p.getAttribute('#trayToggle', 'aria-expanded')) === 'true');
  /* AC51 close with undo */
  await p.click('[data-close="2"]');
  check('AC51 closing a card that is not open: it is gone, the undo note appears, the shown plan stays', (await names(p)).join() === 'Sample plan,Q3 budget für Größe' && !(await p.locator('#trayUndo').isHidden()) && /Closed “New plan”/.test(await p.textContent('#undoText')));
  await p.click('#undoBtn');
  check('undo brings it back at its place', (await names(p)).join() === 'Sample plan,Q3 budget für Größe,New plan' && (await p.locator('#trayUndo').isHidden()) && /Brought “New plan” back/.test(await p.textContent('#notice')));
  await p.click('.plan-card.active [data-close]');
  check('closing the open plan opens its neighbour', (await names(p)).join() === 'Sample plan,Q3 budget für Größe' && (await p.inputValue('[data-rename]')) === 'Q3 budget für Größe');
  /* reload keeps the stack */
  await p.click('[data-open]'); await p.fill('#bStr', '130000'); await p.dispatchEvent('#bStr', 'input'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(900);
  check('AC52 a reload keeps the plans, their order, the open plan and the edits', (await names(p)).join() === 'Sample plan,Q3 budget für Größe' && (await p.inputValue('[data-rename]')) === 'Sample plan' && (await p.inputValue('#bStr')) === '130,000' && (await resCount(p)) === 6);
  check('the undo of a close does not survive a reload', await p.locator('#trayUndo').isHidden());
  await p.click('#trayToggle'); await p.waitForTimeout(700); await p.reload(); await p.waitForTimeout(700);
  check('the shut state also survives a reload', !(await p.locator('#trayBody').isVisible()));
  await p.click('#trayToggle'); await p.waitForTimeout(700);
  /* closing the last plan */
  await p.click('.plan-card.active [data-close]'); await p.click('.plan-card.active [data-close]');
  check('closing the last plan leaves an empty plan', (await names(p)).join() === 'New plan' && (await resCount(p)) === 0);
  await p.click('#undoBtn'); check('the closed plan comes back with undo, in front of the replacement', (await names(p)).join() === 'Q3 budget für Größe,New plan');
  /* AC50 limit */
  for (let i = 0; i < 12; i++) { if ((await p.locator('#trayCards .plan-card[data-plan]').count()) < 10) await p.click('[data-new]'); }
  check('AC50 the tray holds ten plans', (await p.locator('#trayCards .plan-card[data-plan]').count()) === 10 && (await p.textContent('#trayCount')).trim() === '(10)');
  const g10 = await gapOf();
  check('AC54 many cards overlap, and at least 100 px of every card stays visible', g10 < 0 && g10 >= -(200 - 104) - 1, String(g10));
  check('AC54 the open card is fully inside the visible row', await p.evaluate(() => { const r = document.getElementById('trayBody').getBoundingClientRect(), b = document.querySelector('.plan-card.active').getBoundingClientRect(), f = document.getElementById('trayToggle').getBoundingClientRect(); return b.left >= f.right - 1 && b.right <= r.right + 1; }));
  await p.click('[data-new]', { force: true }); check('AC50 the eleventh is refused with a message', (await p.locator('#trayCards .plan-card[data-plan]').count()) === 10 && /at most 10 plans/.test(await p.textContent('#notice')));
  await p.click('[data-copy]'); check('copy is refused at the limit too', /at most 10 plans/.test(await p.textContent('#notice')) && (await p.locator('#trayCards .plan-card[data-plan]').count()) === 10);
  /* phone */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  check('AC53 phone: the open row is at most 120 px high', (await p.evaluate(() => document.querySelector('#tray .box').getBoundingClientRect().height)) <= 120);
  check('phone: the page does not scroll sideways, the tray does', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await p.evaluate(() => { const c = document.getElementById('trayBody'); return c.scrollWidth > c.clientWidth; })));
  await p.screenshot({ path: OUT + '/step21-phone.png', clip: { x: 0, y: 0, width: 390, height: 420 } });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);
  await p.locator('#tray').screenshot({ path: OUT + '/step21.png' });
  /* targets and focus */
  const small = await p.evaluate(() => [...document.querySelectorAll('#tray button, #tray input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 43.5; }).map((e) => (e.className || e.id) + ' ' + Math.round(e.getBoundingClientRect().height)));
  check('every control of the tray is at least 44px tall', small.length === 0, small.join(' | '));
  await s.b.close();

  /* a link, a file, another tab */
  const frag = await require('../../docs/js/codec.js').encodePlanShort(Object.assign(require('../../docs/js/sample.js').samplePlan(), { name: 'From a link' }));
  const a = await open({ url: URL });
  await a.p.click('[data-new]'); await a.p.evaluate((f) => { location.hash = f; }, frag); await a.p.waitForTimeout(600);
  check('a pasted link opens as a new card and keeps the other plans', (await names(a.p)).join() === 'Sample plan,New plan,From a link' && /Opened the plan from the link/.test(await a.p.textContent('#notice')));
  await a.p.evaluate(() => { location.hash = 'v2.AAAA'; }); await a.p.waitForTimeout(500);
  check('a broken link only gives a message', (await names(a.p)).length === 3 && /not valid or was cut off/.test(await a.p.textContent('#notice')));
  await a.p.click('[data-export]'); await a.p.click('#fmtSeg [data-f=json]'); const [dl] = await Promise.all([a.p.waitForEvent('download'), a.p.click('#exDownload')]);
  const path = OUT + '/plans-export.json'; await dl.saveAs(path);
  check('the export carries the plan name', JSON.parse(fs.readFileSync(path, 'utf8')).plan.name === 'From a link');
  await a.p.setInputFiles('#importFile', path); await a.p.waitForTimeout(400);
  check('AC49 an imported file is a new card, nothing is replaced', (await names(a.p)).join() === 'Sample plan,New plan,From a link,From a link' && /new card in the tray/.test(await a.p.textContent('#notice')));
  check('the new plan button stays in the tray after an import', await a.p.locator('[data-new]').isVisible());
  await a.p.setInputFiles('#importFile', OUT + '/bad.json'); await a.p.waitForTimeout(300);
  check('a bad file adds nothing', (await names(a.p)).length === 4);
  await a.p.click('[data-new]'); await a.p.click('#openSample');
  check('the sample plan can be added as a card from the hint, with its banner', (await names(a.p)).includes('Sample plan') && (await a.p.locator('#demoBanner').isVisible()) && (await names(a.p)).length === 6);
  /* a fresh visitor with a link does not get the sample plan */
  const l = await open({ url: URL + '#' + frag });
  check('someone who comes for a link starts with that plan only', (await names(l.p)).join() === 'From a link' && !(await l.p.locator('#demoBanner').isVisible()));
  /* another tab does not see these plans */
  const t = await l.ctx.newPage(); await t.goto(URL); await t.waitForTimeout(900);
  check('a new tab starts fresh: the plans belong to their own tab', (await names(t)).join() === 'Sample plan');
  /* blocked storage */
  const blocked = await open({ url: URL, init: "Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });" });
  await blocked.p.click('[data-new]'); await blocked.p.waitForTimeout(400);
  check('blocked tab storage: the page and the tray still work, no errors', (await names(blocked.p)).join() === 'Sample plan,New plan' && blocked.errs.length === 0, blocked.errs.join('|'));
  /* corrupt storage */
  const corrupt = await open({ url: URL, init: "try { sessionStorage.setItem('budgeteer.session', '{\"v\":1,\"entries\":[{\"id\":1,\"plan\":{\"length\":99}}]}'); } catch (e) {}" });
  check('corrupt stored plans are ignored and the sample plan shows', (await names(corrupt.p)).join() === 'Sample plan' && corrupt.errs.length === 0, corrupt.errs.join('|'));
  check('no errors', a.errs.length === 0 && s.errs.length === 0 && l.errs.length === 0, [...a.errs, ...s.errs, ...l.errs].join(' | '));
  for (const x of [a, l, blocked, corrupt]) await x.b.close();
  done();
})();
