/* Budgeteer page: the resource cards. */
(function () {
  'use strict';
  var core = Budgeteer.core, ui = Budgeteer.ui, $ = ui.$, esc = ui.esc;
  var COLORS = { internalDev: 'var(--data-internal-dev)', freelancer: 'var(--data-freelancer)', subscription: 'var(--data-subscription)', infrastructure: 'var(--data-infrastructure)', oneTime: 'var(--data-one-time)' };
  var RANGES = { rate: [0, 2000, 50], days: [0, 22, 0.5], amount: [0, 2000, 10], amount1: [0, 30000, 250] };
  var store, openMore = {};

  function fmt(n) { return ui.fmtInput(n); }
  function mult(plan) { return plan.view === 'quarter' ? 3 : 1; }

  function field(id, label, unit, shown, range, key) {
    var max = Math.max(range[1], shown);
    return '<div class="pk-field"><div class="pk-field__row"><label class="pk-label" for="f' + id + key + '">' + label + '</label>' +
      '<span class="grp"><input class="pk-input" id="f' + id + key + '" data-k="' + key + '" data-id="' + id + '" inputmode="decimal" autocomplete="off" value="' + fmt(shown) + '"><span class="unit">' + unit + '</span></span></div>' +
      '<input class="pk-range" type="range" data-k="' + key + '" data-id="' + id + '" aria-label="' + label + '" min="' + range[0] + '" max="' + max + '" step="' + range[2] + '" value="' + shown + '"></div>';
  }

  /* period options: months in the month view; quarters in the quarter view, with a "keep" entry for a precise month */
  function periodOptions(plan, kind, current) {
    var h = '', n = core.periodCount(plan), i, q = plan.view === 'quarter';
    var lk = kind === 'from' ? 'start' : kind === 'to' ? 'end' : 'start';
    if (!q) {
      if (kind === 'to') h += '<option value=""' + (current === null ? ' selected' : '') + '>End of plan</option>';
      for (i = 1; i <= plan.length; i++) h += '<option value="' + i + '"' + (current === i ? ' selected' : '') + '>M' + i + '</option>';
      return h;
    }
    var aligned = current === null || core.isAligned(lk, current);
    if (kind === 'to') h += '<option value=""' + (current === null ? ' selected' : '') + '>End of plan</option>';
    if (current !== null && !aligned) h += '<option value="keep" selected>' + core.monthLabel(current, 'quarter', kind === 'to' ? 'end' : 'start') + '</option>';
    for (i = 1; i <= n; i++) h += '<option value="q' + i + '"' + (aligned && current !== null && core.quarterOf(current) === i ? ' selected' : '') + '>Q' + i + '</option>';
    return h;
  }

  function cardHtml(plan, r) {
    var m = mult(plan), unit = core.unitName(plan.view), h = '', scn = plan.scenario;
    h += '<article class="pk-card rcard" data-card="' + r.id + '" style="--dot:' + COLORS[r.type] + '">';
    h += '<div class="pk-card__head"><span class="pk-dot" aria-hidden="true"></span><input class="name-in" data-name="' + r.id + '" value="' + esc(r.name) + '" aria-label="Resource name" maxlength="40" autocomplete="off">';
    h += '<label class="sw"><input type="checkbox" data-sw="' + r.id + '"' + (r.on[scn] ? ' checked' : '') + '><span class="track" aria-hidden="true"></span><span class="swl">In ' + scn + '</span></label>';
    h += '<button class="xbtn" type="button" data-rm="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">×</button></div>';
    h += '<div class="pk-num" data-tot="' + r.id + '"></div><div class="pk-bar"><i data-bar="' + r.id + '"></i></div><div class="pk-muted" data-share="' + r.id + '"></div>';
    h += '<div class="warn" data-outside="' + r.id + '" hidden>This resource starts after the plan ends, so it adds nothing.</div>';
    if (r.mode === 'rateDays') {
      h += field(r.id, 'Day rate', '€', r.rate, RANGES.rate, 'rate');
      h += field(r.id, 'Days per ' + unit, 'days', core.shownValue(r.days, plan.view), [RANGES.days[0], RANGES.days[1] * m, RANGES.days[2] * m], 'days');
    } else if (r.mode === 'fixed') {
      h += field(r.id, 'Cost per ' + unit, '€', core.shownValue(r.amount, plan.view), [RANGES.amount[0], RANGES.amount[1] * m, RANGES.amount[2]], 'amount');
    } else {
      h += field(r.id, 'One-time amount', '€', r.amount, RANGES.amount1, 'amount1');
      h += '<div class="pk-field"><label class="pk-label" for="d' + r.id + '">Due in</label><select class="sel" id="d' + r.id + '" data-pk="due" data-id="' + r.id + '">' + periodOptions(plan, 'due', r.due) + '</select></div>';
    }
    h += '<details class="more" data-more="' + r.id + '"' + (openMore[r.id] ? ' open' : '') + '><summary>More settings</summary><div class="more-grid">';
    h += '<div><label class="pk-label" for="t' + r.id + '">Type</label><select class="sel" id="t' + r.id + '" data-pk="type" data-id="' + r.id + '">' + core.TYPE_ORDER.map(function (t) { return '<option value="' + t + '"' + (r.type === t ? ' selected' : '') + '>' + core.TYPE_LABELS[t] + '</option>'; }).join('') + '</select></div>';
    h += '<div><label class="pk-label" for="m' + r.id + '">Cost mode</label><select class="sel" id="m' + r.id + '" data-pk="mode" data-id="' + r.id + '"><option value="rateDays"' + (r.mode === 'rateDays' ? ' selected' : '') + '>Rate × days</option><option value="fixed"' + (r.mode === 'fixed' ? ' selected' : '') + '>Fixed per ' + unit + '</option><option value="oneTime"' + (r.mode === 'oneTime' ? ' selected' : '') + '>One time</option></select></div>';
    if (r.mode !== 'oneTime') {
      h += '<div><label class="pk-label" for="s' + r.id + '">Starts in</label><select class="sel" id="s' + r.id + '" data-pk="from" data-id="' + r.id + '">' + periodOptions(plan, 'from', r.from || 1) + '</select></div>';
      h += '<div><label class="pk-label" for="e' + r.id + '">Ends in</label><select class="sel" id="e' + r.id + '" data-pk="to" data-id="' + r.id + '">' + periodOptions(plan, 'to', r.to) + '</select></div>';
    }
    return h + '</div></details></article>';
  }

  function setFill(rng) { var mn = +rng.min, mx = +rng.max; rng.style.setProperty('--p', (mx > mn ? (rng.value - mn) / (mx - mn) * 100 : 0) + '%'); }

  var part = {
    structure: function (plan) {
      $('cards').innerHTML = plan.resources.map(function (r) { return cardHtml(plan, r); }).join('') || '<p class="empty">No resources yet. Add one from a template above.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('#cards .pk-range'), setFill);
      $('resHint').innerHTML = 'Viewing the <b>' + plan.scenario + '</b> scenario. Use the switches to include or exclude resources in this scenario only.';
      $('tplChips').innerHTML = '<span class="pk-label">Add a resource</span>' + core.TYPE_ORDER.map(function (k) {
        return '<button type="button" class="chip" data-tpl="' + k + '" style="--c:' + COLORS[k] + '"><span class="pk-dot" aria-hidden="true"></span>' + core.TYPE_LABELS[k] + ' <span aria-hidden="true">+</span></button>';
      }).join('');
    },
    value: function (plan) {
      var scn = plan.scenario, total = core.scenarioTotals(plan, scn).total;
      plan.resources.forEach(function (r) {
        var card = document.querySelector('[data-card="' + r.id + '"]'); if (!card) return;
        var lt = core.lineTotal(r, plan.length), on = r.on[scn];
        card.querySelector('[data-tot="' + r.id + '"]').textContent = core.formatEuro(lt);
        card.querySelector('[data-bar="' + r.id + '"]').style.width = on && total ? Math.min(100, lt / total * 100) + '%' : '0%';
        card.querySelector('[data-share="' + r.id + '"]').textContent = on ? (total ? Math.round(lt / total * 100) + '% of ' + scn : '') : 'Not in ' + scn;
        card.classList.toggle('off', !on);
        card.querySelector('.swl').textContent = 'In ' + scn;
        var sw = card.querySelector('[data-sw]'); if (sw.checked !== on) sw.checked = on;
        card.querySelector('[data-outside="' + r.id + '"]').hidden = !core.outsidePlan(r, plan.length);
      });
    }
  };

  function apply(id, key, shown) {
    var plan = store.getPlan(), patch = {};
    if (key === 'rate') patch.rate = shown;
    else if (key === 'days') patch.days = core.storedValue(shown, plan.view);
    else if (key === 'amount') patch.amount = core.storedValue(shown, plan.view);
    else if (key === 'amount1') patch.amount = shown;
    store.updateResource(id, patch, 'value');
  }

  function bind() {
    var cards = $('cards');
    cards.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-name')) { store.renameResource(+t.getAttribute('data-name'), t.value); return; }
      var key = t.getAttribute('data-k'); if (!key) return;
      var wrap = t.closest('.pk-field'), rng = wrap.querySelector('.pk-range'), inp = wrap.querySelector('.pk-input'), v;
      if (t.type === 'range') { v = parseFloat(t.value); inp.value = fmt(v); }
      else { v = core.parseAmount(t.value); if (v > +rng.max) rng.max = v; rng.value = v; }
      setFill(rng); apply(+t.getAttribute('data-id'), key, v);
    });
    cards.addEventListener('focusout', function (e) {
      var t = e.target, key = t.getAttribute && t.getAttribute('data-k');
      if (key && t.classList.contains('pk-input')) { var rng = t.closest('.pk-field').querySelector('.pk-range'); t.value = fmt(parseFloat(rng.value)); }
    });
    cards.addEventListener('change', function (e) {
      var t = e.target, id = +t.getAttribute('data-id');
      if (t.hasAttribute('data-sw')) { store.setResourceOn(+t.getAttribute('data-sw'), store.getPlan().scenario, t.checked); return; }
      var pk = t.getAttribute('data-pk'); if (!pk) return;
      var v = t.value, q = /^q(\d+)$/.exec(v);
      if (pk === 'type') { store.updateResource(id, { type: v }, 'structure'); return; }
      if (pk === 'mode') { store.changeResourceMode(id, v); return; }
      if (v === 'keep') return;
      if (pk === 'due') store.updateResource(id, { due: q ? core.snapOneTimeDue(+q[1]) : +v }, 'structure');
      if (pk === 'from') store.updateResource(id, { from: q ? core.snapStart(+q[1]) : +v }, 'structure');
      if (pk === 'to') store.updateResource(id, { to: v === '' ? null : (q ? core.snapEnd(+q[1]) : +v) }, 'structure');
    });
    cards.addEventListener('toggle', function (e) { var d = e.target; if (d.hasAttribute && d.hasAttribute('data-more')) openMore[d.getAttribute('data-more')] = d.open; }, true);
    cards.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (b) store.removeResource(+b.getAttribute('data-rm'));
    });
    $('tplChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tpl]'); if (b) store.addResource(b.getAttribute('data-tpl'));
    });
  }

  ui.onReady(function (s) { store = s; ui.addPart(part); bind(); });
  ui.COLORS = COLORS;
})();
