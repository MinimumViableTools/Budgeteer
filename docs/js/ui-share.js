/* Budgeteer page: sharing as a link, JSON export and import, and starting a new plan. */
(function () {
  'use strict';
  var core = Budgeteer.core, codec = Budgeteer.codec, ui = Budgeteer.ui, $ = ui.$;
  var store, seq = 0, openPanel = false;

  function emptyPlan() { var p = core.newPlan('month', 6); p.budgets = { max: 100000, stretch: 125000 }; return p; }

  function note(link) {
    var a = codec.shareAdvice(link);
    if (a.local) return 'This link only works on this computer, because this page is opened from a file. Use the hosted page, or download the plan as JSON to share it.';
    if (a.tooLong) return 'This link is ' + a.length + ' characters long, and some apps may cut a link that long off. Download the plan as JSON to be safe.';
    return 'Anyone with this link sees this plan. The plan is in the link itself and nothing is stored on a server. The link is ' + a.length + ' characters long.';
  }
  function refreshLink() {
    if (!openPanel) return;
    var mine = ++seq, plan = store.getPlan();
    codec.encodePlanShort(plan).then(function (frag) {
      if (mine !== seq) return;
      var link = codec.buildLink(location.href, frag);
      $('shareLink').value = link; $('shareNote').textContent = note(link);
    });
  }
  function toggle(show) {
    openPanel = show; $('sharePanel').hidden = !show; $('shareBtn').setAttribute('aria-expanded', String(show));
    if (show) { refreshLink(); $('shareLink').focus(); $('shareLink').select(); } else $('shareBtn').focus();
  }
  function copy() {
    var el = $('shareLink'); el.focus(); el.select();
    function fallback() { var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } $('shareNote').textContent = ok ? 'Link copied.' : 'Press Ctrl+C (or Cmd+C) to copy the selected link.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(function () { $('shareNote').textContent = 'Link copied.'; }, fallback); else fallback();
  }
  function download() {
    var blob = new Blob([codec.exportJson(store.getPlan())], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'budgeteer-plan.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    store.say('Downloaded the plan as budgeteer-plan.json.');
  }
  function readFile(file) {
    var reader = file.text ? file.text() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file); });
    reader.then(function (text) {
      var r = codec.importJson(text);
      if (r.ok) { Budgeteer.main.hideBanner(); store.loadPlan(r.plan, 'Opened the plan from ' + file.name + '.'); } else store.say(r.message);
    }, function () { store.say(codec.NOT_A_PLAN); });
  }

  ui.onReady(function (s) {
    store = s;
    $('shareBtn').addEventListener('click', function () { toggle(!openPanel); });
    $('closeShare').addEventListener('click', function () { toggle(false); });
    $('sharePanel').addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
    $('copyLink').addEventListener('click', copy);
    $('exportBtn').addEventListener('click', download);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (f) readFile(f); this.value = ''; });
    $('newPlan').addEventListener('click', function () { Budgeteer.main.hideBanner(); store.loadPlan(emptyPlan(), 'Started an empty plan.'); });
    $('bannerNew').addEventListener('click', function () { Budgeteer.main.hideBanner(); store.loadPlan(emptyPlan(), 'Started an empty plan.'); $('shareBtn').focus(); });
    $('samplePlan').addEventListener('click', function () { Budgeteer.main.showBanner(); store.loadPlan(Budgeteer.sample.samplePlan(), 'Loaded the sample plan.'); });
    store.subscribe(refreshLink);
  });
  Budgeteer.share = { emptyPlan: emptyPlan };
})();
