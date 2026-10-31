'use strict';
// Offline acceptance check of the actual packaged bytes; fake Word only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const [packageRoot, dependencyPackage] = process.argv.slice(2);
assert(packageRoot && dependencyPackage, 'usage: node verify-package.cjs PACKAGE_ROOT DEPENDENCY_PACKAGE_JSON');
const dependency = createRequire(path.resolve(dependencyPackage));
const {JSDOM} = dependency('jsdom');
const {transformSync} = dependency('esbuild');
const candidate = path.join(packageRoot, 'candidate/frontend');
const packet = JSON.parse(fs.readFileSync(path.join(packageRoot, 'PACKAGE.json')));
const digest = data => createHash('sha256').update(data).digest('hex');
for (const [name, hash] of Object.entries(packet.candidate_files_sha256)) assert.equal(digest(fs.readFileSync(path.join(candidate,name))),hash);
for (const [name, hash] of Object.entries(packet.rollback_files_sha256)) {
  assert.equal(digest(fs.readFileSync(path.join(packageRoot,'rollback/frontend',name))),hash);
  if (name !== 'taskpane.html') assert.equal(packet.candidate_files_sha256[name],hash);
}
for (const kind of ['candidate','rollback']) assert.equal(digest(fs.readFileSync(path.join(packageRoot,kind+'.tar'))),packet[kind+'_tar_sha256']);
const fakePath = path.resolve(__dirname,'../../../test/office/FakeOfficeWordRuntime.ts');
const compiled = transformSync(fs.readFileSync(fakePath,'utf8'),{loader:'ts',format:'cjs'}).code;
const fakeModule = {exports:{}};
new Function('module','exports',compiled)(fakeModule,fakeModule.exports);
const {FakeOfficeWordRuntime} = fakeModule.exports;
const html = fs.readFileSync(path.join(candidate,'taskpane.html'),'utf8');
async function scenario(hostName, fail) {
  const dom = new JSDOM(html,{url:'https://word-staging.openlegalcore.org/taskpane?proposal=explicit',runScripts:'outside-only'});
  const w=dom.window;
  let ready;
  let network=0;
  w.fetch = () => {network++;throw Error('unexpected network');};
  w.XMLHttpRequest = class {constructor(){network++;throw Error('unexpected network');}};
  w.URL.createObjectURL = () => 'blob:offline-private-evidence';
  const fake = new FakeOfficeWordRuntime({text:'Synthetic Document19 selection'});
  w.Office={HostType:{Word:'Word'},onReady:callback=>{ready=callback;}};
  w.Word={run:(range,batch)=> batch ? fake.runWithRange(range,batch) : fake.run(range)};
  for (const script of w.document.querySelectorAll('script[src]')) {
    const src=script.getAttribute('src');
    if (src.startsWith('https://')) {assert.equal(src,'https://appsforoffice.microsoft.com/lib/1/hosted/office.js');continue;}
    assert(packet.added.includes(src));
    w.eval(fs.readFileSync(path.join(candidate,src),'utf8'));
  }
  for (const element of w.document.querySelectorAll('link[href]')) assert(packet.candidate_files_sha256[element.getAttribute('href')]);
  assert.equal(fake.runCalls,0);assert.equal(fake.runWithRangeCalls,0);assert.equal(network,0);
  ready({host:hostName});
  if(hostName!=='Word') {
    assert.equal(w.document.querySelector('#readonly-export-status'),null);
    assert.equal(w.document.querySelector('#bootstrap-error').textContent,'WORD_HOST_REQUIRED');
    w.close();return;
  }
  assert.equal(w.document.querySelector('#readonly-export-status').textContent,'ready');
  assert.equal(fake.runCalls,0);assert.equal(fake.runWithRangeCalls,0);
  assert.equal(w.document.querySelectorAll('button').length,1);
  assert.equal(w.document.querySelector('button').textContent,'Capture read-only OOXML once');
  if(fail)fake.failNextSync(new Error('PRIVATE_FAILURE_MESSAGE'));
  const button=w.document.querySelector('button');button.click();button.dispatchEvent(new w.Event('click'));
  for(let i=0;i<100 && w.document.querySelector('#readonly-export-status').textContent==='capturing';i++) await new Promise(r=>setImmediate(r));
  assert.equal(button.disabled,true);assert.equal(fake.runCalls,1);
  assert.equal(w.document.querySelector('#readonly-export-status').textContent,fail?'error-capture-or-export':'ready-download');
  if(!fail) {
    assert.equal(fake.runWithRangeCalls,1);
    const node=w.document.querySelector('#readonly-export-evidence-json');const data=JSON.parse(node.textContent);
    assert.equal(node.childElementCount,0);
    assert.equal(data.observation.scope,'NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY');
    assert.equal(data.observation.stoppedBeforeInsertText,true);
    assert.equal(data.originalOoxml,data.currentOoxml);assert.equal(data.currentOoxml,data.targetOoxml);
  } else assert(!w.document.body.textContent.includes('PRIVATE_FAILURE_MESSAGE'));
  assert.equal(network,0);assert.equal(fake.mutationCount,0);assert.equal(fake.untrackCalls,0);assert.equal(fake.selectCalls,0);assert.equal(fake.searchCalls,0);
  w.close();
}
(async()=>{await scenario('Word',false);await scenario('Word',true);await scenario('Excel',false);console.log('PASS: package/rollback hashes, old-file preservation, exact-bundle priority, no automatic capture, one-shot DOM export, no writes/network, failure and non-Word guards (fake runtime).');})().catch(error=>{console.error(error);process.exitCode=1;});
