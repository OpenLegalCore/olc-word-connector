/* global require, process, console, window, document, Office */
// Offline acceptance driver: real Firefox, actual production bundles, synthetic Office/Access/Engine.
// Needs an already installed Playwright + Firefox. Never connect this fixture to live infrastructure.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { build } = require("esbuild");
const { Miniflare } = require("miniflare");
const { firefox } = require(process.env.OLC72_PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const output = process.env.OLC72_BROWSER_OUTPUT;
if (!output) throw new Error("Set OLC72_BROWSER_OUTPUT to a private local output directory");
const app = "https://word.test.invalid",
  host = "https://office.test.invalid";
const officeScript = `window.Office={HostType:{Word:'Word'},PlatformType:{OfficeOnline:'OfficeOnline'},AsyncResultStatus:{Succeeded:'succeeded'},EventType:{DocumentSelectionChanged:'selection',DialogParentMessageReceived:'parent',DialogMessageReceived:'message',DialogEventReceived:'event'},context:{displayLanguage:'sl-SI',document:{addHandlerAsync(t,h,c){c({status:'succeeded'})},removeHandlerAsync(){}},requirements:{isSetSupported(){return true}},ui:{addHandlerAsync(t,h,c){window.addEventListener('message',e=>h({origin:e.origin,message:e.data}));c({status:'succeeded'})},messageParent(m,o){window.opener.postMessage(m,o.targetOrigin)},displayDialogAsync(url,options,callback){const popup=window.open(url,'_blank'),handlers={};window.addEventListener('message',e=>{if(e.source===popup&&handlers.message)handlers.message({origin:e.origin,message:e.data})});callback({status:'succeeded',value:{close(){popup.close()},messageChild(m,o){popup.postMessage(m,o.targetOrigin)},addEventHandler(t,h){handlers[t]=h}}})}}},onReady(cb){const v={host:'Word',platform:'OfficeOnline'};if(cb)cb(v);return Promise.resolve(v)}};
const range={text:'Synthetic selection',isEmpty:false,load(){},getRange(){return this},parentBody:{type:'MainDoc',load(){}},parentTableOrNullObject:{isNullObject:true,load(){}},parentTableCellOrNullObject:{isNullObject:true,load(){}},tables:{items:[],load(){}},inlinePictures:{items:[],load(){}},getOoxml(){return{value:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Synthetic selection</w:t></w:r></w:p></w:document>'}},insertText(){throw Error('No Word write allowed')}};const context={document:{getSelection(){return range}},trackedObjects:{add(){},remove(){}},sync:async()=>{}};window.Word={run:async(...args)=>args.at(-1)(context)};`;
let stage = "build";
async function main() {
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const jose = await import("jose");
  for (const name of ["auth", "api"])
    await build({
      entryPoints: [path.join(root, `infrastructure/cloudflare/word-session/${name}-worker.js`)],
      outfile: path.join(output, `${name}.mjs`),
      bundle: true,
      format: "esm",
      platform: "browser",
    });
  const { authorize } = await import(pathToFileURL(path.join(output, "auth.mjs")).href);
  const { wordApi } = await import(pathToFileURL(path.join(output, "api.mjs")).href);
  const mf = new Miniflare({
    modules: true,
    script: fs.readFileSync(path.join(output, "auth.mjs"), "utf8"),
    compatibilityDate: "2026-07-30",
    durableObjects: { WORD_SESSIONS: { className: "WordSessionStore", useSQLite: true } },
  });
  let browser;
  try {
    const pair = await jose.generateKeyPair("RS256");
    const key = jose.createLocalJWKSet({
      keys: [{ ...(await jose.exportJWK(pair.publicKey)), alg: "RS256", kid: "test" }],
    });
    const env = {
      PUBLIC_ORIGIN: app,
      ACCESS_ISSUER: "https://synthetic.cloudflareaccess.com",
      ACCESS_AUDIENCE: "a".repeat(64),
      WORD_SESSIONS: await mf.getDurableObjectNamespace("WORD_SESSIONS"),
      ENGINE_ORIGIN: "https://engine.test.invalid",
      ENGINE_API_KEY: "synthetic-engine-only",
      CF_ACCESS_CLIENT_ID: "synthetic-id",
      CF_ACCESS_CLIENT_SECRET: "synthetic-service-only",
    };
    const assertion = await new jose.SignJWT({ type: "app" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("synthetic-human")
      .setIssuer(env.ACCESS_ISSUER)
      .setAudience(env.ACCESS_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(pair.privateKey);
    stage = "launch";
    browser = await firefox.launch({
      headless: true,
      ...(process.env.OLC72_BROWSER_EXECUTABLE
        ? { executablePath: process.env.OLC72_BROWSER_EXECUTABLE }
        : {}),
      firefoxUserPrefs: { "network.cookie.cookieBehavior": 2 },
    });
    const context = await browser.newContext({ viewport: { width: 360, height: 820 } });
    let expired = false,
      completions = 0,
      models = 0;
    const calls = [];
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.hostname === "appsforoffice.microsoft.com")
        return route.fulfill({ contentType: "application/javascript", body: officeScript });
      if (url.origin === host)
        return route.fulfill({
          contentType: "text/html",
          body: `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style="width:100vw;height:100vh;border:0" src="${app}/taskpane.html"></iframe>`,
        });
      if (url.origin !== app) return route.abort();
      if (url.pathname.startsWith("/word-auth/") || url.pathname.startsWith("/word-api/")) {
        const headers = await request.allHeaders();
        if (url.pathname.startsWith("/word-auth/")) headers["Cf-Access-Jwt-Assertion"] = assertion;
        const init = {
          method: request.method(),
          headers,
          ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}),
        };
        let result;
        if (url.pathname.startsWith("/word-auth/")) {
          result = await authorize(new Request(url, init), env, key);
          result.headers.set(
            "Set-Cookie",
            "synthetic_cookie=1; Secure; HttpOnly; SameSite=None; Path=/"
          );
        } else if (expired)
          result = new Response('{"error":{"code":"SESSION_EXPIRED"}}', {
            status: 401,
            headers: { "Content-Type": "application/json", "X-OLC-Word-Gateway": "1" },
          });
        else
          result = await wordApi(new Request(url, init), env, async (upstream) => {
            if (new URL(upstream.url).pathname !== "/v1/models") {
              completions++;
              throw new Error("Completion forbidden");
            }
            models++;
            return new Response('{"object":"list","data":[{"id":"lexai-engine-local"}]}', {
              headers: { "Content-Type": "application/json" },
            });
          });
        calls.push({
          path: url.pathname,
          method: request.method(),
          status: result.status,
          cookiePresent: Boolean(headers.cookie),
        });
        const responseHeaders = {};
        result.headers.forEach((value, name) => {
          responseHeaders[name] = value;
        });
        return route.fulfill({
          status: result.status,
          headers: responseHeaders,
          body: Buffer.from(await result.arrayBuffer()),
        });
      }
      if (request.method() !== "GET") throw new Error("Unexpected method");
      const file = path.resolve(root, "dist/stage", "." + url.pathname);
      if (!file.startsWith(path.join(root, "dist/stage") + path.sep) || !fs.existsSync(file))
        return route.fulfill({ status: 404, body: "Not found" });
      return route.fulfill({
        contentType: file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".js")
            ? "application/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "image/png",
        body: fs.readFileSync(file),
      });
    });
    stage = "load production pane";
    const parent = await context.newPage();
    await parent.goto(host);
    let frame = parent.frames().find((frame) => frame.url().startsWith(app));
    const state = (name) =>
      frame.locator(`.olc-app[data-view-state="${name}"]`).waitFor({ timeout: 15_000 });
    await state("session-expired");
    assert.equal(calls.length, 0);
    const login = async () => {
      const settings = frame.locator('[data-action-id="toggle-settings"]');
      if ((await settings.getAttribute("aria-expanded")) === "true") await settings.click();
      await frame.locator('[data-action-id="open-secure-sign-in"]').click();
      await state("ready");
    };
    stage = "initial login";
    await login();
    assert.equal(await frame.locator('[data-action-id="allow-pane-cookies"]').count(), 0);
    await frame.locator("#runtime-legal-question").fill("Synthetic retained draft\nSecond line");
    await frame.locator('[data-action-id="remove-selection"]').click();
    await frame.locator('[data-action-id="toggle-settings"]').click();
    await frame.locator('input[name="olc-ui-language"][value="en-US"]').check();
    expired = true;
    await frame.locator('[data-action-id="check-connection"]').click();
    await state("session-expired");
    stage = "expiry recovery";
    expired = false;
    await login();
    assert.equal(
      await frame.locator("#runtime-legal-question").inputValue(),
      "Synthetic retained draft\nSecond line"
    );
    assert.equal(await frame.locator(".olc-selection-attachment").count(), 0);
    assert.equal(await frame.locator("html").getAttribute("lang"), "en-US");
    await parent.setViewportSize({ width: 280, height: 820 });
    await parent.screenshot({ path: path.join(output, "runtime-280px.png") });
    const before = calls.length;
    stage = "reopen";
    await parent.reload();
    frame = parent.frames().find((frame) => frame.url().startsWith(app));
    await state("session-expired");
    assert.equal(calls.length, before);
    await login();
    assert.equal(completions, 0);
    assert.equal(models, 3);
    assert(calls.every((call) => !call.cookiePresent));
    assert.deepEqual(await context.cookies(), []);
    const result = {
      observedAt: new Date().toISOString(),
      browser: `Firefox ${browser.version()}`,
      mode: "headless, intercepted synthetic HTTPS origins, actual production bundles; Office/Access/Engine are synthetic",
      actualWord: "NOT_RUN",
      cookies: "all blocked by Firefox preference",
      freshPaneRequiresGesture: true,
      pkceExchangeAndSafeChecks: true,
      simulatedExpiryRecovery: true,
      multilineDraftRetained: true,
      localeRetained: true,
      removedAttachmentRetained: true,
      reopenedPaneNewSession: true,
      completionCalls: completions,
      calls,
    };
    fs.writeFileSync(
      path.join(output, "browser-results.json"),
      JSON.stringify(result, null, 2) + "\n"
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser?.close();
    await mf.dispose();
  }
}
main().catch((error) => {
  fs.writeFileSync(path.join(output, "failure.txt"), String(error.stack));
  console.error(
    stage,
    error.name,
    "Offline Word session browser verification failed; no live request was authorized"
  );
  process.exitCode = 1;
});
