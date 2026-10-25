/* global process, console, setTimeout */
const { createReceiver, PORT } = require("./receiver");
const output = process.argv[2];
if (!output || process.argv.length !== 3) throw new Error("A new private output file is required");
const receiver = createReceiver({
  clientId: "4d4318a5-0c42-4785-a5bb-179538d393de",
  audience: "db0e1d38-ce26-443e-b17b-0edb7881a4cc",
  output,
});
receiver.server.on("error", () => {
  console.error("Loopback receiver unavailable; no changes made.");
  process.exitCode = 1;
});
receiver.server.listen(PORT, "127.0.0.1", () => {
  console.log(`Owner verification ready: http://127.0.0.1:${PORT}/start`);
});
setTimeout(() => {
  receiver.clear();
  receiver.server.close();
  readline.close();
}, 30 * 60_000).unref();

const readline = require("node:readline").createInterface({ input: process.stdin });
let probing = false;
readline.on("line", async (line) => {
  if (line !== "probe" || probing) return;
  probing = true;
  try {
    const result = await require("./probe").probeApi(receiver.getVerifiedToken());
    require("node:fs").writeFileSync(
      output + ".checks.json",
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx", mode: 0o600 }
    );
    console.log("Staging safe-route checks: " + result.result);
  } catch {
    console.log("Staging checks unavailable; no identity/token printed.");
  } finally {
    probing = false;
  }
});
