// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReceiver, ORIGIN } from "../../scripts/owner-signin/receiver.js";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((close) => close());
});
async function setup(
  verify = vi.fn(async () => ({
    principal: "synthetic:owner",
    audience: "test-api",
    clientId: "test-spa",
    identityExpiresAt: Date.now() + 60_000,
  }))
) {
  const dir = mkdtempSync(join(tmpdir(), "olc-owner-test-"));
  const output = join(dir, "identity.json");
  // Allocate a port, then bind a fresh receiver with its exact Host policy.
  const net = await import("node:net");
  const allocator = net.createServer();
  await new Promise<void>((resolve, reject) => {
    allocator.on("error", reject);
    allocator.listen(0, "127.0.0.1", resolve);
  });
  const port = (allocator.address() as import("node:net").AddressInfo).port;
  await new Promise<void>((resolve) => allocator.close(() => resolve()));
  const receiver = createReceiver({
    clientId: "test-spa",
    audience: "test-api",
    output,
    verify,
    port,
  });
  await new Promise<void>((resolve) => receiver.server.listen(port, "127.0.0.1", resolve));
  cleanups.push(() => {
    receiver.clear();
    receiver.server.closeAllConnections();
    receiver.server.close();
    rmSync(dir, { recursive: true });
  });
  const base = `http://127.0.0.1:${port}`;
  const page = await (await fetch(base + "/start")).text();
  const nonce = /#([a-f0-9]{64})/.exec(page)![1];
  const post = (overrides: RequestInit = {}) =>
    fetch(base + "/identity", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-OLC-Enrollment": nonce },
      body: JSON.stringify({ accessToken: "synthetic-bearer" }),
      ...overrides,
    });
  return { base, post, nonce, output, receiver, verify };
}
describe("operator-only owner enrollment (synthetic transport, not Microsoft/Word acceptance)", () => {
  it("accepts once after verification and saves only identity with private permissions", async () => {
    const s = await setup();
    expect((await s.post()).status).toBe(200);
    expect(s.verify).toHaveBeenCalledWith("synthetic-bearer", "test-spa", "test-api");
    const saved = readFileSync(s.output, "utf8");
    expect(JSON.parse(saved)).toEqual({
      principal: "synthetic:owner",
      clientId: "test-spa",
      audience: "test-api",
    });
    expect(saved).not.toContain("synthetic-bearer");
    expect(statSync(s.output).mode & 0o777).toBe(0o600);
    expect((await s.post()).status).toBe(409);
    expect(s.receiver.getVerifiedToken()).toBe("synthetic-bearer");
    s.receiver.clear();
    expect(() => s.receiver.getVerifiedToken()).toThrow();
  });
  it("rejects cross-origin, missing nonce, DNS rebinding Host, and cross-site start requests", async () => {
    const s = await setup();
    for (const headers of [
      {
        Origin: "https://attacker.invalid",
        "Content-Type": "application/json",
        "X-OLC-Enrollment": s.nonce,
      },
      { Origin: ORIGIN, "Content-Type": "application/json" },
      { Origin: ORIGIN, "Content-Type": "application/json", "X-OLC-Enrollment": "0".repeat(64) },
    ])
      expect((await s.post({ headers: headers as Record<string, string> })).status).toBe(403);
    expect(
      (await fetch(s.base + "/start", { headers: { "Sec-Fetch-Site": "cross-site" } })).status
    ).toBe(403);
    const http = await import("node:http");
    const rebound = await new Promise<number>((resolve, reject) => {
      const request = http.request(
        s.base + "/start",
        { headers: { Host: "attacker.invalid" } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        }
      );
      request.on("error", reject);
      request.end();
    });
    expect(rebound).toBe(403);
    expect(s.verify).not.toHaveBeenCalled();
    expect(existsSync(s.output)).toBe(false);
  });
  it("allows only exact-origin preflight and bounded JSON POST, never a token in a URL", async () => {
    const s = await setup();
    const preflight = await s.post({ method: "OPTIONS", body: undefined });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect((await fetch(s.base + "/identity?token=synthetic")).status).toBe(403);
    expect(
      (await s.post({ body: JSON.stringify({ accessToken: "x".repeat(22_000) }) })).status
    ).toBe(413);
    expect((await s.post({ body: JSON.stringify({ idToken: "synthetic" }) })).status).toBe(400);
    expect(s.verify).not.toHaveBeenCalled();
  });
  it("fails closed on verification failure and never overwrites an existing private result", async () => {
    const verify = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic invalid signature"))
      .mockResolvedValue({
        principal: "synthetic:owner",
        audience: "test-api",
        clientId: "test-spa",
        identityExpiresAt: Date.now() + 60_000,
      });
    const s = await setup(verify);
    expect((await s.post()).status).toBe(401);
    expect(existsSync(s.output)).toBe(false);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(s.output, "retained owner file");
    expect((await s.post()).status).toBe(401);
    expect(readFileSync(s.output, "utf8")).toBe("retained owner file");
    expect(() => s.receiver.getVerifiedToken()).toThrow();
  });
  it("does not accept a second request while verification is pending", async () => {
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const verify = vi.fn(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        principal: "synthetic:owner",
        audience: "test-api",
        clientId: "test-spa",
        identityExpiresAt: Date.now() + 60_000,
      };
    });
    const s = await setup(verify);
    const first = s.post();
    await ready;
    expect((await s.post()).status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect(verify).toHaveBeenCalledTimes(1);
  });
});

describe("operator API probe", () => {
  it("uses only fixed safe routes and revokes its capability without exposing credentials", async () => {
    const { probeApi } = await import("../../scripts/owner-signin/probe.js");
    const paths: string[] = [];
    const statuses = [401, 401, 200, 200, 200, 200, 401];
    const send = vi.fn(async (url: string | URL | Request) => {
      paths.push(String(url));
      return Response.json(
        paths.length === 3
          ? {
              token: "c".repeat(43),
              scope: "word:models word:complete",
              expiresAt: Date.now() + 600_000,
            }
          : {},
        { status: statuses[paths.length - 1], headers: { "X-OLC-Word-Gateway": "1" } }
      );
    });
    const result = await probeApi("synthetic-api-token", send);
    expect(result.result).toBe("PASS");
    expect(result.checks).toHaveLength(7);
    expect(paths.some((path) => path.includes("completions"))).toBe(false);
    expect(JSON.stringify(result)).not.toContain("synthetic-api-token");
    expect(JSON.stringify(result)).not.toContain("c".repeat(43));
  });
});
