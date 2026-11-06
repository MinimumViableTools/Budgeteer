/* Budgeteer page: the export menu (link, JSON, Markdown, CSV: copy or download) and opening a JSON file. */
(function () {
  'use strict';
  var core = Budgeteer.core, codec = Budgeteer.codec, exporter = Budgeteer.exporter, ui = Budgeteer.ui, $ = ui.$;
  var store, seq = 0, isOpen = false, fmt = 'link', current = '';

  var FORMATS = {
    link: { word: 'link', file: '', again: true, why: '' },
    json: { word: 'JSON', file: 'budgeteer-plan.json', again: true, type: 'application/json', why: 'An exact copy of the plan. Open it again in Budgeteer to keep working on it.' },
    md: { word: 'Markdown', file: 'budgeteer-plan.md', again: false, type: 'text/markdown;charset=utf-8', why: 'Readable by people and by an AI. Paste it into a chat to have the plan reshaped. Budgeteer does not open it again.' },
    csv: { word: 'CSV', file: 'budgeteer-plan.csv', again: false, type: 'text/csv;charset=utf-8', why: 'Plain numbers, one row per resource, for a spreadsheet such as Google Sheets. Budgeteer does not open it again.' }
  };

  function emptyPlan() { return core.startPlan('New plan'); }

  function linkNote(link) {
    var a = codec.shareAdvice(link);
    if (a.local) return 'This link only works on this computer, because this page is opened from a file. Use the hosted page, or export the plan as JSON to share it.';
    if (a.tooLong) return 'This link is ' + a.length + ' characters long, and some apps may cut a link that long off. Export the plan as JSON to be safe.';
    return 'Anyone with this link sees this plan. The plan is in the link itself and nothing is stored on a server. The link is ' + a.length + ' characters long.';
  }

  function say(text) { $('exSay').textContent = text; }

  /* the text of the chosen format. The link is made asynchronously, the others at once. */
  function render() {
    if (!isOpen) return;
    var plan = store.getPlan(), f = FORMATS[fmt], mine = ++seq;
    $('exName').textContent = '“' + plan.name + '”';
    [].forEach.call($('fmtSeg').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === fmt)); });
    var stamp = $('exStamp'); stamp.textContent = f.again ? 'Opens again' : 'Export only'; stamp.className = 'pk-stamp slip-stamp ' + (f.again ? 'pk-stamp--ok' : 'pk-stamp--note');
    $('exFile').textContent = f.file || 'Link';
    $('exDownload').hidden = fmt === 'link';
    $('exCopy').textContent = fmt === 'link' ? 'Copy link' : 'Copy';
    var pre = $('exPre'); pre.classList.toggle('wrap', fmt === 'link');
    if (fmt === 'link') {
      current = ''; pre.textContent = '';
      codec.encodePlanShort(plan).then(function (frag) {
        if (mine !== seq || fmt !== 'link') return;
        current = codec.buildLink(location.href, frag); pre.textContent = current; $('exWhy').textContent = linkNote(current);
      });
      return;
    }
    current = fmt === 'json' ? codec.exportJson(plan) : fmt === 'md' ? exporter.exportMarkdown(plan) : exporter.exportCsv(plan);
    $('exWhy').textContent = f.why; pre.textContent = current;
  }

  function exportButton() { return document.querySelector('[data-export]'); }
  function syncButton() { var b = exportButton(); if (b) b.setAttribute('aria-expanded', String(isOpen)); }

  function toggle(show, quiet) {
    if (show === isOpen) return;
    isOpen = show; $('exportPanel').hidden = !show; syncButton();
    if (show) { say(''); render(); var on = $('fmtSeg').querySelector('[aria-pressed=true]'); if (on) on.focus(); }
    else if (!quiet) { var b = exportButton(); if (b) b.focus(); }
  }
  function close(quiet) { toggle(false, quiet); }

  function copy() {
    if (!current) return;
    var f = FORMATS[fmt], done = function () { say('Copied the ' + f.word + '.'); };
    function fallback() {
      var ok = false, area = document.createElement('textarea');
      area.value = current; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      if (ok) done(); else say('Your browser did not allow copying. Select the text above and copy it by hand.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(current).then(done, fallback); else fallback();
  }
  function download() {
    var f = FORMATS[fmt]; if (!f.file || !current) return;
    var blob = new Blob([current], { type: f.type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = f.file; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    say('Downloaded ' + f.file + '.');
  }

  function readFile(file) {
    var reader = file.text ? file.text() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file); });
    reader.then(function (text) {
      var r = codec.importJson(text);
      if (r.ok) Budgeteer.tray.addPlan(r.plan, 'Opened the plan from ' + file.name + ' as a new card in the tray.'); else store.say(r.message);
    }, function () { store.say(codec.NOT_A_PLAN); });
  }

  ui.onReady(function (s) {
    store = s;
    $('closeExport').addEventListener('click', function () { close(); });
    $('exportPanel').addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    $('fmtSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; fmt = b.getAttribute('data-f'); say(''); render(); });
    $('exCopy').addEventListener('click', copy);
    $('exDownload').addEventListener('click', download);
    $('importFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (f) readFile(f); this.value = ''; });
    store.subscribe(render);
  });
  Budgeteer.share = { emptyPlan: emptyPlan, toggle: function () { toggle(!isOpen); }, close: close, isOpen: function () { return isOpen; }, syncButton: syncButton };
})();
