// Supported CUA operator. Bind olc74TestTab to synthetic Document19 and
// ORIGINAL_WORD_TAB_ID to the preserved Document17 tab. Never print raw evidence.
if (typeof ORIGINAL_WORD_TAB_ID !== 'string' || olc74TestTab.id === ORIGINAL_WORD_TAB_ID) {
  throw new Error('STOP: original Word tab excluded');
}
var olc74Frame = olc74TestTab.playwright.frameLocator('#WacFrame_Word_0');
var olc74Frames = await olc74Frame.locator('iframe').evaluateAll(elements => elements.map(e => ({id:e.id,src:e.getAttribute('src')||''})).filter(e=>{
  try {const u=new URL(e.src);return u.origin==='https://word-staging.openlegalcore.org' && ['/taskpane.html','/taskpane'].includes(u.pathname);} catch {return false;}
}));
if (olc74Frames.length !== 1 || !olc74Frames[0].id) throw new Error('STOP: one identifiable staging pane required');
var olc74Pane = olc74Frame.frameLocator('iframe[id=' + JSON.stringify(olc74Frames[0].id) + ']');
if ((await olc74Pane.locator('#olc74-staging-identity').textContent()) !== 'olc74-staging-readonly-v1') throw new Error('STOP: diagnostic identity missing');
var olc74Status = olc74Pane.locator('#readonly-export-status');
if ((await olc74Status.textContent()) !== 'ready') throw new Error('STOP: not ready; do not recapture');
// Operator must already have verified Document19 name and synthetic selection
// via Word UI and saved a screenshot before this one-shot capture action.
await olc74Pane.getByRole('button',{name:'Capture read-only OOXML once',exact:true}).click();
await olc74Pane.getByRole('link',{name:'Download private OOXML evidence JSON',exact:true}).waitFor({state:'visible',timeoutMs:15000});
if ((await olc74Status.textContent()) !== 'ready-download') throw new Error('STOP: diagnostic not complete');
var olc74Text = await olc74Pane.locator('#readonly-export-evidence-json').textContent();
var olc74Data = JSON.parse(olc74Text);
if (olc74Data.observation?.scope !== 'NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY' || olc74Data.observation?.stoppedBeforeInsertText !== true || !['originalOoxml','currentOoxml','targetOoxml'].every(k=>typeof olc74Data[k] === 'string')) throw new Error('STOP: invalid evidence');
var olc74Fs = await import('node:fs/promises');
var olc74Crypto = await import('node:crypto');
var olc74Output = '/tmp/olc74-staging-ooxml-' + Date.now() + '.json';
await olc74Fs.writeFile(olc74Output,olc74Text,{mode:0o600,flag:'wx'});
nodeRepl.write({saved:olc74Output,sha256:olc74Crypto.createHash('sha256').update(olc74Text).digest('hex'),scope:olc74Data.observation.scope,firstFailure:olc74Data.observation.firstFailure,equality:{originalCurrent:olc74Data.originalOoxml===olc74Data.currentOoxml,originalTarget:olc74Data.originalOoxml===olc74Data.targetOoxml,currentTarget:olc74Data.currentOoxml===olc74Data.targetOoxml}});
