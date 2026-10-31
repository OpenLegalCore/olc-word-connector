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
const server = https.createServer({cert:fs.readFileSync('/home/rajko/.office-addin-dev-certs/localhost.crt'),key:fs.readFileSync('/home/rajko/.office-addin-dev-certs/localhost.key')},(req,res)=>{
  let file;
  try {file=decodeURIComponent(new URL(req.url,'https://localhost:3002').pathname).slice(1);} catch {res.writeHead(400).end();return;}
  if (req.method !== 'GET' || !Object.hasOwn(metadata.files,file)) {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'});
  fs.createReadStream(path.join(root,file)).pipe(res);
});
server.on('error',err=>{console.error(err.code);process.exitCode=1;});
server.listen(3002,'127.0.0.1',()=>console.log('OLC74 SID ELOAD SERVER READY 127.0.0.1:3002'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
