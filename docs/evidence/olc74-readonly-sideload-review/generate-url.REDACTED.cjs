// REVIEW-ONLY REDACTED COPY: private document URL removed; see README.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const moduleRoot = '/home/rajko/olc-word-connector/node_modules/';
const { generateSideloadUrl } = require(moduleRoot + 'office-addin-dev-settings');
const { OfficeAddinManifest } = require(moduleRoot + 'office-addin-manifest');
const file = '/tmp/olc74-sideload-dom-candidate/manifest.xml';
const expected = 'c2ec4f5123d3b531142e9b87dbfe15a1a7d5637d9a3f180a131ccc75aea4ece3';
const doc = process.env.OLC74_PRIVATE_DOCUMENT_URL;
if (!doc) throw Error("Set OLC74_PRIVATE_DOCUMENT_URL in the approved local session");
(async () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (hash !== expected) throw Error('manifest hash mismatch');
  const manifest = await OfficeAddinManifest.readManifestFile(file);
  if (manifest.id !== '7eb3a8cf-4fa9-47f2-a408-afe5f6c59515' || manifest.defaultSettings.sourceLocation !== 'https://localhost:3002/taskpane.html') throw Error('unexpected manifest identity or source');
  const generated = await generateSideloadUrl(path.basename(file), manifest, doc);
  const u = new URL(generated);
  if (u.searchParams.get('wdaddinmanifestfile') !== 'manifest.xml' || u.searchParams.get('wdaddindevserverport') !== '3002' || u.searchParams.get('wdaddinmanifestguid') !== manifest.id || u.searchParams.has('wdaddintest')) throw Error('unexpected URL parameters');
  const out = '/tmp/olc74-sideload-review/document19-sideload.url';
  fs.writeFileSync(out, generated + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ saved: out, sha256: crypto.createHash('sha256').update(generated+'\n').digest('hex'), manifest: 'manifest.xml', port: 3002, guid: manifest.id, suppressDialogs: false }));
})().catch(() => { console.error('STOP: could not safely generate the sideload URL'); process.exitCode = 1; });
