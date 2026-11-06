const { OUT, open, check, done } = require('./lib.js');
const fs = require('fs');
const HTTP = process.env.BASE_URL || 'http://localhost:8765/index.html';
const clip = (p) => p.evaluate(() => navigator.clipboard.readText());
(async () => {
  const s = await open({ url: HTTP }); const p = s.p;
  /* AC55 the Export button on the open card, no share button at the top */
  check('AC55 no "Share plan" button at the top', (await p.locator('#shareBtn').count()) === 0 && !/Share plan/.test(await p.textContent('header')));
  check('AC55 the open card has Copy, Export and Close, and the other cards have no Export', (await p.locator('.plan-card.active [data-export]').count()) === 1 && (await p.locator('[data-export]').count()) === 1);
  check('the export menu is hidden at first', await p.locator('#exportPanel').isHidden());
  await p.click('[data-export]'); await p.waitForTimeout(300);
  check('AC55 the menu opens under the tray with the name of the plan and four formats', (await p.locator('#exportPanel').isVisible()) && (await p.textContent('#exName')) === '“Sample plan”'
    && (await p.locator('#fmtSeg button').allTextContents()).join() === 'Link,JSON,Markdown,CSV' && (await p.getAttribute('[data-export]', 'aria-expanded')) === 'true');
  check('the menu comes right after the tray, before the plan settings', await p.evaluate(() => document.getElementById('tray').nextElementSibling.id === 'exportPanel'));
  check('focus goes to the chosen format', (await p.evaluate(() => document.activeElement.getAttribute('data-f'))) === 'link');
  /* AC56 the paper slip per format */
  const slip = async (f) => { await p.click('#fmtSeg [data-f=' + f + ']'); await p.waitForTimeout(250); return { file: await p.textContent('#exFile'), stamp: (await p.textContent('#exStamp')).trim(), pre: await p.textContent('#exPre'), why: await p.textContent('#exWhy'), dl: await p.locator('#exDownload').isVisible(), pressed: await p.getAttribute('#fmtSeg [data-f=' + f + ']', 'aria-pressed') }; };
  const link = await slip('link');
  check('AC56 link: no file name, "Opens again", the real link, no download', link.file === 'Link' && link.stamp === 'Opens again' && link.pre.startsWith(HTTP + '#v2') && !link.dl && link.pressed === 'true');
  const json = await slip('json');
  check('AC56 JSON: file name, "Opens again", the JSON, download', json.file === 'budgeteer-plan.json' && json.stamp === 'Opens again' && JSON.parse(json.pre).app === 'Budgeteer' && json.dl);
  const md = await slip('md');
  check('AC56 Markdown: file name, "Export only", the Markdown, download', md.file === 'budgeteer-plan.md' && md.stamp === 'Export only' && md.pre.startsWith('# Sample plan\n') && /Budgeteer does not open it again/.test(md.why) && md.dl);
  const csv = await slip('csv');
  check('AC57 CSV: file name, "Export only", header and six rows', csv.file === 'budgeteer-plan.csv' && csv.stamp === 'Export only' && csv.pre.startsWith('resource,type,cost_mode,in_max,in_stretch,first_month,last_month,monthly_cost_eur,total_eur') && csv.pre.trim().split(/\r?\n/).length === 7 && csv.dl);
  /* copy gives exactly the text of the preview */
  for (const [f, word] of [['link', 'link'], ['json', 'JSON'], ['md', 'Markdown'], ['csv', 'CSV']]) {
    await p.click('#fmtSeg [data-f=' + f + ']'); await p.waitForTimeout(250);
    const shown = await p.textContent('#exPre'); await p.click('#exCopy'); await p.waitForTimeout(250);
    check('AC56 copy ' + f + ': the clipboard holds the text and the status says so', (await clip(p)) === shown && new RegExp('Copied the ' + word + '\\.').test(await p.textContent('#exSay')));
  }
  /* downloads */
  const names = [];
  for (const [f, ext] of [['json', 'json'], ['md', 'md'], ['csv', 'csv']]) {
    await p.click('#fmtSeg [data-f=' + f + ']'); await p.waitForTimeout(200);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exDownload')]);
    const file = OUT + '/export-test.' + ext; await dl.saveAs(file); names.push(dl.suggestedFilename());
    check('AC56 download ' + f + ': the file holds the previewed text and the status names it', fs.readFileSync(file, 'utf8') === (await p.textContent('#exPre')) && /Downloaded budgeteer-plan\./.test(await p.textContent('#exSay')));
  }
  check('AC56 the downloads are named budgeteer-plan.json, .md and .csv', names.join() === 'budgeteer-plan.json,budgeteer-plan.md,budgeteer-plan.csv');
  /* AC57 the CSV adds up to the totals of the tool */
  await p.click('#fmtSeg [data-f=csv]'); await p.waitForTimeout(200);
  const rows = (await p.textContent('#exPre')).trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  const sum = (c) => rows.filter((r) => r[c] === 'yes').reduce((a, r) => a + Number(r[8]), 0);
  check('AC57 the CSV totals per scenario are 92100 and 119300', sum(3) === 92100 && sum(4) === 119300);
  /* the menu follows edits and renames while it is open */
  await p.click('#fmtSeg [data-f=md]'); await p.waitForTimeout(150);
  await p.fill('[data-rename]', 'Q4 budget'); await p.waitForTimeout(250);
  check('the title and the Markdown follow a rename', (await p.textContent('#exName')) === '“Q4 budget”' && (await p.textContent('#exPre')).startsWith('# Q4 budget\n'));
  await p.click('#sMax'); await p.fill('#bMax', '70000'); await p.waitForTimeout(250);
  check('the Markdown follows a budget change', /Max budget 70000/.test(await p.textContent('#exPre')));
  /* closing */
  await p.click('#closeExport');
  check('AC55 Close shuts the menu and the focus goes back to Export', (await p.locator('#exportPanel').isHidden()) && (await p.evaluate(() => document.activeElement.hasAttribute('data-export'))) && (await p.getAttribute('[data-export]', 'aria-expanded')) === 'false');
  await p.click('[data-export]'); await p.keyboard.press('Escape');
  check('AC55 Escape shuts the menu', await p.locator('#exportPanel').isHidden());
  await p.click('[data-export]'); await p.click('[data-export]');
  check('AC55 the Export button toggles the menu', await p.locator('#exportPanel').isHidden());
  /* the menu shuts when another plan opens or the tray is shut */
  await p.click('[data-export]'); await p.click('[data-new]'); await p.waitForTimeout(200);
  check('AC55 opening another plan shuts the menu', await p.locator('#exportPanel').isHidden());
  await p.click('[data-export]'); await p.click('#trayToggle'); await p.waitForTimeout(500);
  check('AC55 shutting the tray shuts the menu', await p.locator('#exportPanel').isHidden());
  await p.click('#trayToggle'); await p.waitForTimeout(500);
  /* AC59 the import tile */
  check('AC59 "Import JSON" sits next to "New plan" in the tray, and the file chooser is not in the menu', (await p.locator('#tray [data-import]').count()) === 1 && (await p.locator('#tray [data-new]').count()) === 1 && (await p.locator('#exportPanel #importFile').count()) === 0);
  /* AC60 an empty plan offers the sample */
  check('AC60 a new plan is blank and shows the hint', await p.locator('#blankHint').isVisible());
  await p.click('#openSample'); await p.waitForTimeout(250);
  check('AC60 the hint adds the sample plan as a new card and goes away', (await p.locator('#cards .rcard').count()) === 6 && await p.locator('#blankHint').isHidden() && await p.locator('#demoBanner').isVisible());
  await p.click('[data-new]');
  await p.click('[data-tpl="freelancer"]');
  check('AC60 the hint goes away once the plan has a resource', await p.locator('#blankHint').isHidden());

  /* phone: two lines in the open card, the row scrolls, the menu fits */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  const box = await p.evaluate(() => { const b = document.querySelector('#tray .box').getBoundingClientRect(), a = document.querySelector('.plan-card.active'), n = a.querySelector('[data-rename]').getBoundingClientRect(), c = a.querySelector('[data-copy]').getBoundingClientRect(); return { h: b.height, sameLine: Math.abs(n.top - c.top) < 4, w: document.documentElement.scrollWidth }; });
  check('AC53 phone: the open card has the name on its own line and the row is at most 120 px high', !box.sameLine && box.h <= 120, JSON.stringify(box));
  check('phone: Copy, Export and Close are all visible inside the card', await p.evaluate(() => { const a = document.querySelector('.plan-card.active').getBoundingClientRect(); return ['[data-copy]', '[data-export]', '[data-close]'].every((q) => { const r = document.querySelector('.plan-card.active ' + q).getBoundingClientRect(); return r.left >= a.left - 1 && r.right <= a.right + 1 && r.width > 0; }); }));
  await p.click('#trayToggle'); await p.waitForTimeout(500);
  check('AC53 phone: shut, the row is at most 60 px high', (await p.evaluate(() => document.querySelector('#tray .box').getBoundingClientRect().height)) <= 60);
  await p.click('#trayToggle'); await p.waitForTimeout(500);
  await p.click('[data-export]'); await p.waitForTimeout(300);
  check('phone: the menu fits, the page does not scroll sideways', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await p.locator('#exportPanel').isVisible()));
  await p.click('#fmtSeg [data-f=csv]'); await p.waitForTimeout(250);
  check('phone: the long preview scrolls inside the slip, not the page', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/step22-phone.png', fullPage: true });
  /* keyboard: the segments, copy and download can be reached and operated */
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);
  await p.focus('#fmtSeg [data-f=json]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  check('keyboard: Enter on a segment chooses the format', (await p.getAttribute('#fmtSeg [data-f=json]', 'aria-pressed')) === 'true');
  await p.focus('#fmtSeg [data-f=csv]'); const order = [];
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => document.activeElement.id)); }
  check('keyboard: Tab goes from the formats to the preview, Copy and Download in order', order.join() === 'exPre,exCopy,exDownload', order.join());
  const small = await p.evaluate(() => [...document.querySelectorAll('#exportPanel button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 43.5; }).map((e) => e.id || e.textContent));
  check('every control of the menu is at least 44px tall', small.length === 0, small.join(' | '));
  await p.locator('#exportPanel').screenshot({ path: OUT + '/step22.png' });
  check('no errors', s.errs.length === 0, s.errs.join(' | '));
  await s.b.close(); done();
})();
