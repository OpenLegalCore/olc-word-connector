'use strict';
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const root = '/tmp/olc74-sideload-dom-candidate';
const metadata = JSON.parse(fs.readFileSync(path.join(root,'CANDIDATE.json'),'utf8'));
for (const [name, hash] of Object.entries(metadata.files)) {
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex') !== hash) throw Error('candidate hash mismatch');
}
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.xml':'application/xml','.png':'image/png','.css':'text/css'};
let phase = 'control';
let nextConnection = 0;
let nextRequest = 0;
const connections = new WeakMap();
const methods = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);
const tlsErrors = new Set(['ECONNRESET', 'ETIMEDOUT', 'ERR_SSL_HTTP_REQUEST', 'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA', 'ERR_SSL_SSLV3_ALERT_CERTIFICATE_UNKNOWN']);
function event(fields) { console.log(JSON.stringify({time: new Date().toISOString(), ...fields})); }
process.on('SIGUSR2', () => { phase = 'observation'; event({event:'phase', phase}); });
const server = https.createServer({cert:fs.readFileSync('/home/rajko/.office-addin-dev-certs/localhost.crt'),key:fs.readFileSync('/home/rajko/.office-addin-dev-certs/localhost.key')},(req,res)=>{
  const id = ++nextRequest;
  const requestPhase = phase;
  const method = methods.has(req.method) ? req.method : 'OTHER';
  let file;
  let allowed = false;
  let malformed = false;
  try {
    file=decodeURIComponent(new URL(req.url,'https://localhost:3002').pathname).slice(1);
    allowed=Object.hasOwn(metadata.files,file);
  } catch { malformed = true; }
  const requestPath = allowed ? '/' + file : 'other';
  const base = {phase:requestPhase, id, connection:connections.get(req.socket) || null, method, path:requestPath};
  event({event:'request', ...base});
  let finished = false;
  const manifestHash = file === 'manifest.xml' && req.method === 'GET' && allowed ? crypto.createHash('sha256') : null;
  res.once('finish',()=>{
    finished = true;
    const details = {event:'response', ...base, status:res.statusCode, completion:'finished'};
    if (manifestHash && res.statusCode === 200) details.manifestSha256 = manifestHash.digest('hex');
    event(details);
  });
  res.once('close',()=>{ if (!finished) event({event:'response', ...base, status:res.statusCode, completion:'closed-before-finish'}); });
  if (malformed) {res.writeHead(400).end();return;}
  if (req.method !== 'GET' || !allowed) {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'});
  const stream = fs.createReadStream(path.join(root,file));
  if (manifestHash) stream.on('data', chunk => manifestHash.update(chunk));
  stream.pipe(res);
});
server.on('secureConnection', socket => { const id = ++nextConnection; connections.set(socket,id); event({event:'tls', phase, connection:id, result:'connected'}); });
server.on('tlsClientError', err => event({event:'tls', phase, result:'error', code:tlsErrors.has(err.code) ? err.code : 'OTHER'}));
server.on('error',err=>{console.error(err.code);process.exitCode=1;});
server.listen(3002,'127.0.0.1',()=>console.log('OLC74 SID ELOAD SERVER READY 127.0.0.1:3002'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
