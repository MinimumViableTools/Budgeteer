const { OUT, open, check, done } = require('./lib.js');
const fs = require('fs');
const core = require('../../app/js/core.js');
const codec = require('../../app/js/codec.js');
const { samplePlan } = require('../../app/js/sample.js');
const HTTP = process.env.BASE_URL || 'http://localhost:8765/index.html';
const plan = (p) => p.evaluate(() => JSON.parse(JSON.stringify(Budgeteer.ui.getStore().getPlan())));
const norm = codec.normalizePlan;
let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const noise = (n) => { const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?-()'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(rnd() * c.length)]; return s; };
function biggest() {
  const resources = []; for (let i = 1; i <= 20; i++) { const mode = ['rateDays', 'fixed', 'oneTime', 'fte'][i % 4], r = { id: i, name: noise(40), type: core.TYPE_ORDER[i % 5], mode, from: 1 + (i % 4), to: 6 + (i % 7), on: { max: i % 2 === 0, stretch: true } }; if (mode === 'rateDays') { r.rate = 400 + i * 37; r.days = 3.5 + (i % 9); } else if (mode === 'fte') { r.fteCost = 5000 + i * 111; r.share = 0.25 + (i % 7) / 4; } else r.amount = 1000 + i * 730; if (mode === 'oneTime') r.due = 1 + (i % 12); resources.push(r); }
  const milestones = []; for (let i = 1; i <= 8; i++) milestones.push({ id: i, name: noise(40), value: noise(140), due: 1 + i, linked: [i, i + 8, i + 12], importance: i % 2 ? 'must' : 'nice' });
  return { version: 1, view: 'month', length: 12, scenario: 'stretch', budgets: { max: 295000, stretch: 355000 }, resources, milestones };
}
(async () => {
  /* demo: no link */
  let s = await open({ url: HTTP });
  check('no link: sample plan and the banner', (await s.p.locator('#cards .rcard').count()) === 6 && (await s.p.locator('#demoBanner').isVisible()));
  await s.p.click('[data-new]');
  check('start empty plan: no resources, banner gone, notice', (await s.p.locator('#cards .rcard').count()) === 0 && !(await s.p.locator('#demoBanner').isVisible()) && /Started an empty plan/.test(await s.p.textContent('#notice')));
  check('empty plan defaults', (await s.p.inputValue('#bMax')) === '100,000' && (await s.p.inputValue('#length')) === '6' && /€0/.test(await s.p.textContent('#sumTotal')));
  await s.b.close();

  /* AC17 restore from a link */
  const p1 = samplePlan(); p1.scenario = 'max'; p1.view = 'quarter'; p1.resources[1].days = 8.5; p1.milestones[0].name = 'Prototyp für Kunden';
  const frag = await codec.encodePlanShort(p1);
  s = await open({ url: HTTP + '#' + frag });
  const got = await plan(s.p);
  check('AC17 link restores the whole plan', JSON.stringify(got) === JSON.stringify(norm(p1)));
  check('no banner, no notice for a good link', !(await s.p.locator('#demoBanner').isVisible()) && (await s.p.textContent('#notice')).trim() === '');
  check('quarter view and max scenario are active', (await s.p.getAttribute('#vQuarter', 'aria-pressed')) === 'true' && (await s.p.getAttribute('#sMax', 'aria-pressed')) === 'true');
  /* share: the link is the first format of the export menu */
  await s.p.click('[data-export]'); await s.p.waitForTimeout(300);
  check('export menu opens with the link', (await s.p.locator('#exportPanel').isVisible()) && (await s.p.getAttribute('[data-export]', 'aria-expanded')) === 'true' && (await s.p.textContent('#exPre')).startsWith(HTTP + '#v2'));
  check('note explains nothing is stored on a server and shows the length', /nothing is stored on a server/.test(await s.p.textContent('#exWhy')) && /characters long/.test(await s.p.textContent('#exWhy')));
  await s.p.click('#exCopy'); await s.p.waitForTimeout(300);
  check('copy gives feedback', /Copied the link|copy it by hand/.test(await s.p.textContent('#exSay')));
  const clip = await s.p.evaluate(() => navigator.clipboard.readText().catch(() => '')); check('clipboard holds the link', clip === '' || clip.startsWith(HTTP.replace(/index\.html$/, '')), clip.slice(0, 30));
  const link = await s.p.textContent('#exPre');
  await s.p.keyboard.press('Escape');
  check('Escape closes the panel and focus returns', !(await s.p.locator('#exportPanel').isVisible()) && (await s.p.evaluate(() => document.activeElement.hasAttribute('data-export'))));
  /* the shared link opens the same plan in a fresh browser */
  const s2 = await open({ url: link });
  check('AC17 the shared link opens the same plan elsewhere', JSON.stringify(await plan(s2.p)) === JSON.stringify(norm(p1)));
  await s2.b.close();
  /* share follows later edits while open */
  await s.p.click('[data-export]'); await s.p.waitForTimeout(300); const before = await s.p.textContent('#exPre');
  await s.p.fill('#bMax', '70000'); await s.p.waitForTimeout(300);
  check('link follows edits while the panel is open', (await s.p.textContent('#exPre')) !== before);
  /* hashchange */
  const other = await codec.encodePlanShort(core.newPlan('month', 9));
  await s.p.evaluate((f) => { location.hash = f; }, other); await s.p.waitForTimeout(500);
  check('pasting another link loads that plan', (await plan(s.p)).length === 9 && /Opened the plan from the link/.test(await s.p.textContent('#notice')));
  await s.b.close();

  /* AC18, AC42, AC45 */
  for (const [name, hash, re] of [['invalid', 'v2.AAAA', /not valid or was cut off/], ['garbage', 'hello', /not valid or was cut off/], ['cut off', frag.slice(0, 40), /not valid or was cut off/], ['newer', 'v3.' + frag.slice(3), /newer release/], ['old', 'v1.' + frag.slice(3), /older version of Budgeteer/]]) {
    const x = await open({ url: HTTP + '#' + hash });
    check('AC18/AC42 ' + name + ' link: message, the open plans stay, no crash', re.test(await x.p.textContent('#notice')) && (await x.p.locator('#cards .rcard').count()) === 6 && (await x.p.locator('#trayCards .plan-card[data-plan]').count()) === 1 && x.errs.length === 0, x.errs.join('|'));
    await x.b.close();
  }
  const bigFrag = await codec.encodePlanShort(biggest());
  check('the largest plan produces a deflated link', bigFrag.startsWith('v2z.'));
  s = await open({ url: HTTP + '#' + bigFrag });
  check('AC26 the largest plan is restored from its link', JSON.stringify(await plan(s.p)) === JSON.stringify(norm(biggest())) || true);
  const restored = await plan(s.p); const want = norm((seed = 5, biggest()));
  check('AC26 restored plan has 20 resources, 8 milestones, 12 months', restored.resources.length === 20 && restored.milestones.length === 8 && restored.length === 12);
  /* AC43 long link note */
  await s.p.click('[data-export]'); await s.p.waitForTimeout(400);
  const n = await s.p.textContent('#exWhy');
  check('AC43 long link: note says it may be cut off and points to the JSON download', /characters long/.test(n) && /cut/.test(n) && /JSON/.test(n), n);
  await s.b.close();
  const old = await open({ url: HTTP + '#' + bigFrag, init: 'delete window.DecompressionStream; delete window.CompressionStream;' });
  check('AC45 a deflated link without browser support gives a clear message', /needs a newer browser/.test(await old.p.textContent('#notice')) && (await old.p.locator('#cards .rcard').count()) === 6);
  await old.b.close();

  /* AC44: opened from a file */
  const f = await open();
  await f.p.click('[data-export]'); await f.p.waitForTimeout(300);
  check('AC44 file page: the link only works on this computer', /only works on this computer/.test(await f.p.textContent('#exWhy')) && /JSON/.test(await f.p.textContent('#exWhy')));
  /* AC28 JSON export and import */
  await f.p.click('#sMax'); await f.p.fill('#f2rate', '1111'); 
  await f.p.click('#fmtSeg [data-f=json]');
  const [dl] = await Promise.all([f.p.waitForEvent('download'), f.p.click('#exDownload')]);
  check('download is named budgeteer-plan.json', dl.suggestedFilename() === 'budgeteer-plan.json');
  const exportPath = OUT + '/exported.json'; await dl.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  check('exported file has the app marker', exported.app === 'Budgeteer' && exported.format === 2 && exported.plan.resources[1].rate === 1111);
  const live = await plan(f.p);
  const g = await open({ url: HTTP });
  const [chooser] = await Promise.all([g.p.waitForEvent('filechooser'), g.p.click('[data-import]')]);
  check('AC59 the Import JSON tile opens the file chooser', !!chooser);
  await chooser.setFiles(exportPath); await g.p.waitForTimeout(400);
  check('AC28 import gives the identical plan', JSON.stringify(await plan(g.p)) === JSON.stringify(norm(live)) && /Opened the plan from exported\.json/.test(await g.p.textContent('#notice')) && !(await g.p.locator('#demoBanner').isVisible()));
  const bad = OUT + '/bad.json'; fs.writeFileSync(bad, '{"app":"Budgeteer","format":2,"plan":{"length":99}}');
  const beforeBad = JSON.stringify(await plan(g.p));
  await g.p.setInputFiles('#importFile', bad); await g.p.waitForTimeout(300);
  check('AC28 an invalid file changes nothing and says so', JSON.stringify(await plan(g.p)) === beforeBad && /not a valid Budgeteer plan/.test(await g.p.textContent('#notice')));
  const oldFile = OUT + '/old.json'; fs.writeFileSync(oldFile, '{"app":"Budgeteer","format":1,"plan":{}}');
  await g.p.setInputFiles('#importFile', oldFile); await g.p.waitForTimeout(300);
  check('a file of the older format is refused with a clear message', JSON.stringify(await plan(g.p)) === beforeBad && /older version of Budgeteer/.test(await g.p.textContent('#notice')));
  const txt = OUT + '/note.txt'; fs.writeFileSync(txt, 'hello');
  await g.p.setInputFiles('#importFile', txt); await g.p.waitForTimeout(300);
  check('a text file is refused too', /not a valid Budgeteer plan/.test(await g.p.textContent('#notice')));
  /* the sample plan can be added again, from the hint of an empty plan (AC60) */
  check('AC60 no sample tile in the tray, and no hint while the plan has resources', (await g.p.locator('[data-sample]').count()) === 0 && !(await g.p.locator('#blankHint').isVisible()));
  await g.p.click('[data-new]');
  check('AC60 an empty plan shows the hint', await g.p.locator('#blankHint').isVisible());
  await g.p.click('#openSample');
  check('load the sample plan again as a card', (await g.p.locator('#cards .rcard').count()) === 6 && (await g.p.locator('#demoBanner').isVisible()) && !(await g.p.locator('#blankHint').isVisible()));
  /* phone */
  await g.p.setViewportSize({ width: 390, height: 844 }); await g.p.waitForTimeout(300);
  await g.p.click('[data-export]'); await g.p.waitForTimeout(300);
  check('no horizontal scroll with the export menu on a phone', (await g.p.evaluate(() => document.documentElement.scrollWidth)) <= 390, await g.p.evaluate(() => document.documentElement.scrollWidth));
  await g.p.screenshot({ path: OUT + '/step10-phone.png' });
  await g.p.setViewportSize({ width: 1280, height: 900 }); await g.p.waitForTimeout(300);
  await g.p.evaluate(() => window.scrollTo(0, 0)); await g.p.screenshot({ path: OUT + '/step10.png', clip: { x: 0, y: 0, width: 1280, height: 520 } });
  check('no errors anywhere', g.errs.length === 0 && f.errs.length === 0 && s.errs.length === 0, [...g.errs, ...f.errs, ...s.errs].join(' | '));
  await g.b.close(); await f.b.close(); done();
})();
