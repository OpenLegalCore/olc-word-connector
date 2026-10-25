/* global process, console */
// Operator-only identity verification. No capability issuance or Engine request.
const fs = require("node:fs");
async function main() {
  const [clientId, audience, output] = process.argv.slice(2);
  if (!output || process.argv.length !== 5) throw new Error("Arguments required");
  let token = "";
  for await (const chunk of process.stdin) {
    token += chunk.toString("utf8");
    if (token.length > 16 * 1024) throw new Error("Input too large");
  }
  token = token.trim();
  const { decodeJwt } = await import("jose");
  const { createMicrosoftVerifier } =
    await import("../infrastructure/cloudflare/word-session/microsoft-identity.js");
  const candidate = decodeJwt(token);
  // This proposed principal is used only to verify the token cryptographically
  // in this local tool. It never updates an application allowlist or grants API access.
  const verified = await createMicrosoftVerifier()(token, {
    MICROSOFT_AUTH_ENABLED: "true",
    MICROSOFT_CLIENT_ID: clientId,
    MICROSOFT_API_AUDIENCE: audience,
    MICROSOFT_ALLOWED_IDENTITIES: JSON.stringify([`${candidate.tid}:${candidate.oid}`]),
  });
  token = "";
  fs.writeFileSync(
    output,
    JSON.stringify({ principal: verified.principal, clientId, audience }, null, 2) + "\n",
    { flag: "wx", mode: 0o600 }
  );
  console.log(
    "Microsoft API identity verified; private output created. No application access granted."
  );
}
main().catch(() => {
  console.error("Microsoft API identity verification failed; no identity was accepted.");
  process.exitCode = 1;
});
