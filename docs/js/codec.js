/* Budgeteer codec: turns a plan into a link fragment and back, and validates what comes in.
   Link format: "v1." followed by base64url of the UTF-8 bytes of a compact JSON array, or "v1z." with the bytes deflated first
   (the shorter of the two is used). The format version is part of every link, so later releases keep reading older links. */
(function (root, factory) {
  var api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./core.js') : root.Budgeteer.core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.codec = api; }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  var FORMAT_VERSION = 1;
  var L = core.LIMITS;
  var TYPES = core.TYPE_ORDER, MODES = ['rateDays', 'fixed', 'oneTime'], IMPORTANCE = ['must', 'nice'];

  /* a plan in one shape, so that a round trip compares equal */
  function normalizePlan(plan) {
    return {
      version: 1, view: plan.view === 'quarter' ? 'quarter' : 'month', length: plan.length, scenario: plan.scenario === 'stretch' ? 'stretch' : 'max',
      budgets: { max: plan.budgets.max, stretch: plan.budgets.stretch },
      resources: plan.resources.map(function (r) {
        var o = { id: r.id, name: r.name, type: r.type, mode: r.mode };
        if (r.mode === 'rateDays') { o.rate = r.rate; o.days = r.days; } else o.amount = r.amount;
        if (r.mode === 'oneTime') o.due = r.due;
        o.from = r.from || 1; o.to = r.to || null; o.on = { max: !!r.on.max, stretch: !!r.on.stretch };
        return o;
      }),
      milestones: plan.milestones.map(function (m) { return { id: m.id, name: m.name, value: m.value, due: m.due, linked: m.linked.slice(), importance: m.importance }; })
    };
  }

  function toCompact(plan) {
    var p = normalizePlan(plan);
    return [FORMAT_VERSION, p.view === 'quarter' ? 1 : 0, p.length, p.budgets.max, p.budgets.stretch, p.scenario === 'stretch' ? 1 : 0,
      p.resources.map(function (r) {
        var mode = MODES.indexOf(r.mode), a, b;
        if (mode === 0) { a = r.rate; b = r.days; } else if (mode === 1) { a = r.amount; b = 0; } else { a = r.amount; b = r.due; }
        return [r.id, r.name, TYPES.indexOf(r.type), mode, a, b, r.from, r.to === null ? 0 : r.to, (r.on.max ? 1 : 0) + (r.on.stretch ? 2 : 0)];
      }),
      p.milestones.map(function (m) { return [m.id, m.name, m.value, m.due, m.linked, IMPORTANCE.indexOf(m.importance)]; })];
  }

  /* bytes and base64url */
  var LINK_WARN_LENGTH = 2000;      /* total link length above which some apps may cut a link off */
  var MAX_JSON_BYTES = 65536;       /* a plan is far smaller; this stops a malicious link from inflating into memory */
  function bytesToB64u(bytes) {
    var bin = '', i;
    for (i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64uToBytes(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
    var b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    var bin = atob(b), bytes = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function fromUtf8(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  function hasCompression() { return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'; }

  function pipeBytes(bytes, stream, limit) {
    var writer = stream.writable.getWriter(), reader = stream.readable.getReader(), chunks = [], total = 0;
    writer.write(bytes).catch(function () {}); writer.close().catch(function () {});
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) { var out = new Uint8Array(total), o = 0; chunks.forEach(function (c) { out.set(c, o); o += c.length; }); return out; }
        total += r.value.length;
        if (limit && total > limit) { reader.cancel().catch(function () {}); throw new Error('too large'); }
        chunks.push(r.value); return pump();
      });
    }
    return pump();
  }
  function deflate(bytes) { return pipeBytes(bytes, new CompressionStream('deflate-raw')); }
  function inflate(bytes) { return pipeBytes(bytes, new DecompressionStream('deflate-raw'), MAX_JSON_BYTES); }

  function encodePlan(plan) { return 'v' + FORMAT_VERSION + '.' + bytesToB64u(utf8(JSON.stringify(toCompact(plan)))); }
  /* the shorter of the plain and the deflated form; plain when this browser cannot deflate */
  function encodePlanShort(plan) {
    var plain = encodePlan(plan);
    if (!hasCompression()) return Promise.resolve(plain);
    return deflate(utf8(JSON.stringify(toCompact(plan)))).then(function (z) {
      var zipped = 'v' + FORMAT_VERSION + 'z.' + bytesToB64u(z);
      return zipped.length < plain.length ? zipped : plain;
    }, function () { return plain; });
  }
  /* the address of this page without a fragment, for example https://nlsplgrnd.github.io/Budgeteer/ */
  function pageBase(href) { return String(href).replace(/#.*$/, '').replace(/\?.*$/, ''); }
  function buildLink(base, fragment) { return pageBase(base) + '#' + fragment; }
  function fragmentOf(link) { var i = link.indexOf('#'); return i < 0 ? '' : link.slice(i + 1); }
  /* what to tell the person about a link: a file: link only works on this computer, a long link may be cut off by some apps */
  function shareAdvice(link) {
    var local = /^file:/i.test(link), n = link.length;
    return { length: n, local: local, tooLong: n > LINK_WARN_LENGTH };
  }

  /* validation helpers */
  function isInt(x, lo, hi) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= lo && x <= hi; }
  function isNum(x, lo, hi) { return typeof x === 'number' && isFinite(x) && x >= lo && x <= hi; }
  function isStr(x, max) { return typeof x === 'string' && x.length <= max; }
  function bad(code, message) { return { ok: false, code: code, message: message }; }
  var INVALID = 'This link is not valid or was cut off, so the plan could not be restored. You are seeing an empty plan.';

  var NEWER = 'This link comes from a newer release of Budgeteer than this page. Nothing was changed.';
  var NO_ZIP = 'This link needs a newer browser to be opened. Nothing was changed.';
  function parseFragment(fragment) {
    var frag = String(fragment || '').replace(/^#/, '');
    if (!frag) return bad('empty', '');
    var m = /^v(\d+)(z?)\.(.*)$/.exec(frag);
    if (!m) return bad('invalid', INVALID);
    var version = parseInt(m[1], 10);
    if (version > FORMAT_VERSION) return bad('newer', NEWER);
    if (version < 1) return bad('invalid', INVALID);
    return { ok: true, zipped: m[2] === 'z', payload: m[3] };
  }
  function planFromJson(text) {
    var a; try { a = JSON.parse(text); } catch (e) { return bad('invalid', INVALID); }
    return fromCompactV1(a);
  }
  /* decodePlan(fragment): { ok: true, plan } or { ok: false, code: 'empty' | 'invalid' | 'newer' | 'compressed', message }. Plain links only. */
  function decodePlan(fragment) {
    var f = parseFragment(fragment); if (!f.ok) return f;
    if (f.zipped) return bad('compressed', NO_ZIP);
    var text; try { text = fromUtf8(b64uToBytes(f.payload)); } catch (e) { return bad('invalid', INVALID); }
    return planFromJson(text);
  }
  /* decodePlanShort(fragment): the same, as a promise, and also reads deflated links */
  function decodePlanShort(fragment) {
    var f = parseFragment(fragment); if (!f.ok) return Promise.resolve(f);
    if (!f.zipped) return Promise.resolve(decodePlan(fragment));
    if (!hasCompression()) return Promise.resolve(bad('compressed', NO_ZIP));
    var bytes; try { bytes = b64uToBytes(f.payload); } catch (e) { return Promise.resolve(bad('invalid', INVALID)); }
    return inflate(bytes).then(function (out) {
      try { return planFromJson(fromUtf8(out)); } catch (e) { return bad('invalid', INVALID); }
    }, function () { return bad('invalid', INVALID); });
  }

  function fromCompactV1(a) {
    if (!Array.isArray(a) || a.length !== 8 || a[0] !== 1) return bad('invalid', INVALID);
    var view = a[1] === 1 ? 'quarter' : a[1] === 0 ? 'month' : null, length = a[2];
    if (!view || !isInt(length, 1, L.months) || !isNum(a[3], 0, 1e12) || !isNum(a[4], 0, 1e12) || (a[5] !== 0 && a[5] !== 1)) return bad('invalid', INVALID);
    if (view === 'quarter' && length % 3 !== 0) return bad('invalid', INVALID);
    if (!Array.isArray(a[6]) || a[6].length > L.resources || !Array.isArray(a[7]) || a[7].length > L.milestones) return bad('invalid', INVALID);
    var resources = [], milestones = [], i, r, x, ids = {};
    for (i = 0; i < a[6].length; i++) {
      r = a[6][i];
      if (!Array.isArray(r) || r.length !== 9 || !isInt(r[0], 1, 1e9) || ids[r[0]] || !isStr(r[1], 200) || !isInt(r[2], 0, TYPES.length - 1) || !isInt(r[3], 0, 2)) return bad('invalid', INVALID);
      if (!isNum(r[4], 0, 1e12) || !isNum(r[5], 0, 1e12) || !isInt(r[6], 1, L.months) || !isInt(r[7], 0, L.months) || !isInt(r[8], 0, 3)) return bad('invalid', INVALID);
      ids[r[0]] = true;
      x = { id: r[0], name: r[1], type: TYPES[r[2]], mode: MODES[r[3]] };
      if (r[3] === 0) { x.rate = r[4]; x.days = r[5]; } else x.amount = r[4];
      if (r[3] === 2) { if (!isInt(r[5], 1, L.months)) return bad('invalid', INVALID); x.due = r[5]; }
      x.from = r[6]; x.to = r[7] === 0 ? null : r[7]; x.on = { max: (r[8] & 1) === 1, stretch: (r[8] & 2) === 2 };
      resources.push(x);
    }
    var mids = {};
    for (i = 0; i < a[7].length; i++) {
      x = a[7][i];
      if (!Array.isArray(x) || x.length !== 6 || !isInt(x[0], 1, 1e9) || mids[x[0]] || !isStr(x[1], L.milestoneName) || !isStr(x[2], L.milestoneValue) || !isInt(x[3], 1, L.months) || !Array.isArray(x[4]) || !isInt(x[5], 0, 1)) return bad('invalid', INVALID);
      for (var k = 0; k < x[4].length; k++) if (!ids[x[4][k]]) return bad('invalid', INVALID);
      mids[x[0]] = true;
      milestones.push({ id: x[0], name: x[1], value: x[2], due: x[3], linked: x[4].slice(), importance: IMPORTANCE[x[5]] });
    }
    return { ok: true, plan: { version: 1, view: view, length: length, scenario: a[5] === 1 ? 'stretch' : 'max', budgets: { max: a[3], stretch: a[4] }, resources: resources, milestones: milestones } };
  }

  /* JSON file: { "app": "Budgeteer", "format": 1, "plan": { ... } }, checked with the same rules as a link */
  var MAX_FILE_BYTES = 262144;
  var NOT_A_PLAN = 'This file is not a valid Budgeteer plan, so nothing was changed.';
  function exportJson(plan) { return JSON.stringify({ app: 'Budgeteer', format: FORMAT_VERSION, plan: normalizePlan(plan) }, null, 2) + '\n'; }
  function importJson(text) {
    if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) return bad('invalid', NOT_A_PLAN);
    var doc; try { doc = JSON.parse(text); } catch (e) { return bad('invalid', NOT_A_PLAN); }
    if (!doc || typeof doc !== 'object' || doc.app !== 'Budgeteer' || typeof doc.format !== 'number' || !doc.plan || typeof doc.plan !== 'object') return bad('invalid', NOT_A_PLAN);
    if (doc.format > FORMAT_VERSION) return bad('newer', 'This file comes from a newer release of Budgeteer than this page. Nothing was changed.');
    if (doc.format < 1) return bad('invalid', NOT_A_PLAN);
    var compact; try { compact = toCompact(doc.plan); } catch (e) { return bad('invalid', NOT_A_PLAN); }
    var r = fromCompactV1(JSON.parse(JSON.stringify(compact)));
    return r.ok ? r : bad('invalid', NOT_A_PLAN);
  }

  return { exportJson: exportJson, importJson: importJson, NOT_A_PLAN: NOT_A_PLAN, FORMAT_VERSION: FORMAT_VERSION, LINK_WARN_LENGTH: LINK_WARN_LENGTH, normalizePlan: normalizePlan, encodePlan: encodePlan, encodePlanShort: encodePlanShort, buildLink: buildLink, pageBase: pageBase, fragmentOf: fragmentOf, shareAdvice: shareAdvice, decodePlan: decodePlan, decodePlanShort: decodePlanShort };
});
