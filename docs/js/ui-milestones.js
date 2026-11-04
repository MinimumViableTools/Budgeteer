/* Budgeteer page: the milestone list, the milestone dialog, and the markers' click. */
(function () {
  'use strict';
  var core = Budgeteer.core, ui = Budgeteer.ui, $ = ui.$, esc = ui.esc, L = core.LIMITS;
  var store, dlg, editingId = null, draftLinks = [], draftImp = 'must', opener = null, lastList = '';

  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="var(--surface-raised)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="var(--surface-raised)" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function stateCell(plan, m, scn) {
    var st = core.milestoneStatus(plan, m, scn);
    return '<div><div class="ms-state"><span class="ms-glyph ' + (st.reached ? 'ok' : 'no') + '" aria-hidden="true"><span>' + (st.reached ? CHECK : CROSS) + '</span></span>' + (st.reached ? 'Reached' : 'Not reached') + '</div>' +
      (st.reached ? '' : '<div class="ms-reason">' + esc(st.reasonText) + '</div>') + '</div>';
  }
  var part = {
    structure: function () {},
    value: function (plan) {
      var el = $('msList');
      if (!plan.milestones.length) { var e = '<p class="empty">No milestones yet. Add one to describe a goal and see whether the plan reaches it.</p>'; if (e !== lastList) { el.innerHTML = e; lastList = e; } return; }
      var h = '<div class="ms-row ms-head" aria-hidden="true"><span>Importance</span><span>Goal</span><span>Due</span><span>Max</span><span>Stretch</span><span></span></div>';
      plan.milestones.forEach(function (m) {
        h += '<div class="ms-row"><div><span class="imp ' + m.importance + '">' + (m.importance === 'must' ? 'Must-have' : 'Nice-to-have') + '</span></div>' +
          '<div class="ms-cell-name"><div class="ms-name">' + esc(m.name) + '</div>' + (m.value ? '<div class="ms-value">' + esc(m.value) + '</div>' : '') + '</div>' +
          '<div class="ms-name"><span class="sr-only">Due </span>' + core.monthLabel(m.due, plan.view, 'end') + '</div>' +
          '<div><span class="sr-only">Max scenario: </span>' + stateCell(plan, m, 'max') + '</div><div><span class="sr-only">Stretch scenario: </span>' + stateCell(plan, m, 'stretch') + '</div>' +
          '<div><button class="pk-btn pk-btn--ghost" type="button" data-edit="' + m.id + '" aria-label="Edit milestone ' + esc(m.name) + '">Edit</button></div></div>';
      });
      if (h !== lastList) { el.innerHTML = h; lastList = h; }
    }
  };

  /* dialog */
  function chips(plan) {
    var el = $('msLinks');
    el.innerHTML = plan.resources.map(function (r) {
      var on = draftLinks.indexOf(r.id) >= 0;
      return '<button type="button" class="chip" role="checkbox" aria-checked="' + on + '" data-link="' + r.id + '" style="--c:' + ui.COLORS[r.type] + '"><span class="pk-dot" aria-hidden="true"></span>' + esc(r.name) + '</button>';
    }).join('') || '<span class="hint">No resources yet.</span>';
  }
  function warn(plan) {
    var ms = { due: parseInt($('msDue').value, 10), linked: draftLinks };
    var current = $('msDue').value; var due = current === 'keep' ? (editingMilestone(plan) || {}).due : (core.monthFromChoice('milestone', current));
    var late = core.lateLinks(plan, { due: due, linked: draftLinks });
    $('msWarn').innerHTML = late.length ? '<div class="warn" role="status">' + esc(late.join(', ')) + (late.length > 1 ? ' start' : ' starts') + ' after this milestone is due, so ' + (late.length > 1 ? 'they add' : 'it adds') + ' nothing to it.</div>' : '';
    return ms;
  }
  function editingMilestone(plan) { return editingId === null ? null : plan.milestones.filter(function (m) { return m.id === editingId; })[0] || null; }
  function count() { $('valCount').textContent = (L.milestoneValue - $('msValue').value.length) + ' characters left'; }
  function setImp(v) { draftImp = v; $('impMust').setAttribute('aria-pressed', String(v === 'must')); $('impNice').setAttribute('aria-pressed', String(v === 'nice')); }
  function dueSelect(plan, current) {
    $('msDue').innerHTML = core.periodChoices(plan, 'milestone', current).map(function (c) { return '<option value="' + c.value + '"' + (c.selected ? ' selected' : '') + '>' + c.label + '</option>'; }).join('');
    $('lblDue').textContent = 'Due (' + core.unitName(plan.view) + ')';
  }

  function open(id, from) {
    var plan = store.getPlan();
    if (id === undefined && plan.milestones.length >= L.milestones) { store.say('A plan can have at most ' + L.milestones + ' milestones. Remove one first.'); return; }
    opener = from || document.activeElement; editingId = id === undefined ? null : id;
    var m = editingMilestone(plan);
    $('dlgTitle').textContent = m ? 'Edit milestone' : 'Add milestone';
    $('msName').value = m ? m.name : ''; $('msValue').value = m ? m.value : '';
    draftLinks = m ? m.linked.filter(function (x) { return core.findResource(plan, x); }) : []; setImp(m ? m.importance : 'must');
    dueSelect(plan, m ? m.due : plan.length);
    $('nameErr').textContent = ''; $('msName').removeAttribute('aria-invalid');
    $('msDelete').hidden = !m; $('msSave').textContent = m ? 'Save changes' : 'Save milestone';
    count(); chips(plan); warn(plan);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('msName').focus();
  }
  function restoreFocus() {
    var el = opener;
    if (el && !document.body.contains(el) && el.getAttribute) { var id = el.getAttribute('data-edit'); el = id ? document.querySelector('[data-edit="' + id + '"]') : null; }
    if (!el || !document.body.contains(el)) el = $('addMs');
    if (el) el.focus();
  }
  function closeDlg() { if (dlg.open) dlg.close(); }

  function bind() {
    dlg = $('msDlg');
    $('addMs').addEventListener('click', function () { open(undefined, $('addMs')); });
    $('msList').addEventListener('click', function (e) { var b = e.target.closest('[data-edit]'); if (b) open(+b.getAttribute('data-edit'), b); });
    $('costChart').addEventListener('click', function (e) { var g = e.target.closest('.mk'); if (g) open(+g.getAttribute('data-ms'), g); });
    $('costChart').addEventListener('keydown', function (e) { var g = e.target.closest && e.target.closest('.mk'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(+g.getAttribute('data-ms'), g); } });
    $('msValue').addEventListener('input', count);
    $('msDue').addEventListener('change', function () { warn(store.getPlan()); });
    $('msLinks').addEventListener('click', function (e) {
      var b = e.target.closest('[data-link]'); if (!b) return;
      var id = +b.getAttribute('data-link'), i = draftLinks.indexOf(id); if (i >= 0) draftLinks.splice(i, 1); else draftLinks.push(id);
      chips(store.getPlan()); warn(store.getPlan());
      var again = $('msLinks').querySelector('[data-link="' + id + '"]'); if (again) again.focus();
    });
    $('impMust').addEventListener('click', function () { setImp('must'); });
    $('impNice').addEventListener('click', function () { setImp('nice'); });
    $('msCancel').addEventListener('click', closeDlg);
    $('msDelete').addEventListener('click', function () { var id = editingId; closeDlg(); store.deleteMilestone(id); });
    dlg.addEventListener('close', restoreFocus);
    $('msForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var plan = store.getPlan(), m = editingMilestone(plan), sel = $('msDue').value;
      var due = sel === 'keep' ? m.due : core.monthFromChoice('milestone', sel);
      var res = store.saveMilestone({ name: $('msName').value, value: $('msValue').value, due: due, linked: draftLinks, importance: draftImp }, editingId);
      if (!res.ok) {
        $('nameErr').textContent = res.errors.name || res.errors.value || res.errors.general || '';
        $('msName').setAttribute('aria-invalid', 'true'); $('msName').focus(); return;
      }
      closeDlg();
    });
  }

  ui.onReady(function (s) { store = s; ui.addPart(part); bind(); });
})();
