/* Budgeteer export: a plan as CSV for a spreadsheet and as Markdown for people and AI assistants. Pure functions, no access to the page.
   Both formats use plain numbers in euro, no currency signs and no thousands separators. They are for hand-over only, the tool does not read them back. */
(function (root, factory) {
  var api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./core.js') : root.Budgeteer.core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.exporter = api; }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  var MODE_LABELS = { fte: 'FTE', rateDays: 'Rate x days', fixed: 'Fixed per month', oneTime: 'One time' };
  var HEADER = ['resource', 'type', 'cost_mode', 'in_max', 'in_stretch', 'first_month', 'last_month', 'monthly_cost_eur', 'total_eur'];

  /* money as a plain number with at most two decimals */
  function num(n) { return String(Math.round(n * 100) / 100); }
  function yesNo(b) { return b ? 'yes' : 'no'; }

  /* the months a resource is active and what it costs in a month it is active */
  function span(r, length) {
    if (r.mode === 'oneTime') return { first: r.due, last: r.due, monthly: r.amount };
    var first = r.from || 1;
    return { first: first, last: r.to || length, monthly: core.costAt(r, first, length) };
  }

  /* a spreadsheet runs a cell that starts with one of these as a formula, so such text gets a leading apostrophe */
  function neutral(text) { return /^[=+\-@\t\r]/.test(text) ? "'" + text : text; }
  function csvCell(value) {
    var text = neutral(String(value));
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }
  function csvLine(cells) { return cells.map(csvCell).join(','); }

  function exportCsv(plan) {
    var lines = [HEADER.join(',')];
    plan.resources.forEach(function (r) {
      var s = span(r, plan.length);
      lines.push(csvLine([r.name, core.TYPE_LABELS[r.type], MODE_LABELS[r.mode], yesNo(r.on.max), yesNo(r.on.stretch), s.first, s.last, num(s.monthly), num(core.lineTotal(r, plan.length))]));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /* text inside a Markdown table cell: line breaks become spaces and a pipe is escaped */
  function cell(value) { return String(value).replace(/\s*[\r\n]+\s*/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|'); }
  function row(cells) { return '| ' + cells.map(cell).join(' | ') + ' |'; }
  function table(head, rows) { return [row(head), row(head.map(function () { return '---'; }))].concat(rows.map(row)).join('\n'); }
  function heading(text) { return String(text).replace(/\s*[\r\n]+\s*/g, ' '); }

  function against(total, budget) { return num(Math.abs(total - budget)) + (total > budget ? ' over' : ' under'); }

  function exportMarkdown(plan) {
    var max = core.scenarioTotals(plan, 'max'), str = core.scenarioTotals(plan, 'stretch'), n = plan.length, m;
    var out = [];
    out.push('# ' + heading(plan.name));
    out.push('');
    out.push('Budgeteer plan over ' + n + ' month' + (n === 1 ? '' : 's') + '. All amounts are in euro. Max budget ' + num(plan.budgets.max) + ', stretch budget ' + num(plan.budgets.stretch) + '.');
    out.push('');
    out.push('## Totals');
    out.push('');
    out.push(table(['Scenario', 'Total', 'Against max budget', 'Against stretch budget', 'Status'], [
      ['Max', num(max.total), against(max.total, plan.budgets.max), against(max.total, plan.budgets.stretch), core.STATUS_TEXT[core.status(max.total, plan.budgets)]],
      ['Stretch', num(str.total), against(str.total, plan.budgets.max), against(str.total, plan.budgets.stretch), core.STATUS_TEXT[core.status(str.total, plan.budgets)]]
    ]));
    out.push('');
    out.push('## Resources');
    out.push('');
    out.push(plan.resources.length ? table(['Resource', 'Type', 'Cost mode', 'In max', 'In stretch', 'First month', 'Last month', 'Monthly cost', 'Total'],
      plan.resources.map(function (r) {
        var s = span(r, n);
        return [r.name, core.TYPE_LABELS[r.type], MODE_LABELS[r.mode], yesNo(r.on.max), yesNo(r.on.stretch), s.first, s.last, num(s.monthly), num(core.lineTotal(r, n))];
      })) : 'No resources yet.');
    out.push('');
    out.push('## Cost per month');
    out.push('');
    var months = [];
    for (m = 0; m < n; m++) months.push(['M' + (m + 1), num(core.sumByType(max.monthly[m])), num(core.sumByType(str.monthly[m]))]);
    out.push(table(['Month', 'Max', 'Stretch'], months));
    out.push('');
    out.push('## Milestones');
    out.push('');
    out.push(plan.milestones.length ? table(['Milestone', 'Importance', 'Due', 'Goal', 'Max', 'Stretch'],
      plan.milestones.map(function (ms) {
        function st(scn, t) { var s = core.milestoneStatus(plan, ms, scn, t); return s.reached ? 'reached' : 'not reached: ' + s.reasonText; }
        return [ms.name, ms.importance === 'must' ? 'Must-have' : 'Nice-to-have', 'M' + ms.due, ms.value, st('max', max), st('stretch', str)];
      })) : 'No milestones yet.');
    return out.join('\n') + '\n';
  }

  return { exportCsv: exportCsv, exportMarkdown: exportMarkdown, CSV_HEADER: HEADER.join(','), MODE_LABELS: MODE_LABELS };
});
