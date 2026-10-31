// REVIEW-ONLY REDACTED COPY: private original tab ID replaced by required guard input.
// Supported cua_repl operator; requires a separate Word tab and explicit synthetic selection.
// Set olc74TestTab to the isolated Document19 tab, never the original Document17.
if (typeof olc74OriginalTabId !== 'string' || !olc74OriginalTabId || olc74TestTab.id === olc74OriginalTabId) throw new Error('STOP: original Word tab excluded');
var olc74Frame = olc74TestTab.playwright.frameLocator('#WacFrame_Word_0');
var olc74Frames = await olc74Frame.locator('iframe').evaluateAll(elements => elements.map(e => ({id:e.id,src:e.getAttribute('src')||''})).filter(e=>e.src.startsWith('https://localhost:3002/taskpane.html')));
if (olc74Frames.length !== 1 || !olc74Frames[0].id) throw new Error('STOP: one identifiable local harness iframe required');
var olc74Pane = olc74Frame.frameLocator('iframe[id=' + JSON.stringify(olc74Frames[0].id) + ']');
var olc74Status = olc74Pane.locator('#readonly-export-status');
if ((await olc74Status.textContent()) !== 'ready') throw new Error('STOP: page is not ready; do not recapture');
await olc74Pane.getByRole('button',{name:'Capture read-only OOXML once',exact:true}).click();
await olc74Pane.getByRole('link',{name:'Download private OOXML evidence JSON',exact:true}).waitFor({state:'visible',timeoutMs:15000});
if ((await olc74Status.textContent()) !== 'ready-download') throw new Error('STOP: diagnostic not complete');
var olc74Text = await olc74Pane.locator('#readonly-export-evidence-json').textContent();
var olc74Data = JSON.parse(olc74Text);
if (olc74Data.observation?.scope !== 'NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY' || olc74Data.observation?.stoppedBeforeInsertText !== true || !['originalOoxml','currentOoxml','targetOoxml'].every(k=>typeof olc74Data[k] === 'string')) throw new Error('STOP: invalid diagnostic evidence');
var olc74Fs = await import('node:fs/promises');
var olc74Crypto = await import('node:crypto');
var olc74Output = '/tmp/olc74-native-dom-ooxml-' + Date.now() + '.json';
await olc74Fs.writeFile(olc74Output,olc74Text,{mode:0o600,flag:'wx'});
nodeRepl.write({saved:olc74Output,bytes:new TextEncoder().encode(olc74Text).length,sha256:olc74Crypto.createHash('sha256').update(olc74Text).digest('hex'),observation:olc74Data.observation,equality:{originalCurrent:olc74Data.originalOoxml===olc74Data.currentOoxml,originalTarget:olc74Data.originalOoxml===olc74Data.targetOoxml,currentTarget:olc74Data.currentOoxml===olc74Data.targetOoxml}});
