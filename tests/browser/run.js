/* Starts a small static server for app/ and runs every browser check in order. Needs Playwright, see README.md. */
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const APP = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const file = path.join(APP, decodeURIComponent(req.url.split('?')[0].replace(/^\/$/, '/index.html')));
  if (!file.startsWith(APP) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
function run(file, base) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], { env: Object.assign({}, process.env, { BASE_URL: base }) });
    let out = '', err = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ status: code, stdout: out, stderr: err }));
  });
}
server.listen(0, async () => {
  const base = 'http://localhost:' + server.address().port + '/index.html';
  const only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter((f) => /^\d\d-.*\.js$/.test(f) && (!only || f.startsWith(only))).sort();
  let failed = 0;
  for (const f of files) {
    const r = await run(f, base);
    const bad = r.stdout.split('\n').filter((l) => l.startsWith('FAIL'));
    console.log((r.status === 0 ? 'ok   ' : 'FAIL ') + f + (bad.length ? '\n  ' + bad.join('\n  ') : '') + (r.status !== 0 && !bad.length ? '\n' + r.stderr.slice(0, 400) : ''));
    if (r.status !== 0) failed++;
  }
  server.close(); process.exitCode = failed ? 1 : 0;
});
