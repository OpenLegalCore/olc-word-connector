import { describe, expect, it, vi } from "vitest";
import type { IPublicClientApplication, Configuration } from "@azure/msal-browser";
import { MicrosoftAccess, msalConfiguration } from "../../src/taskpane/MicrosoftAccess";
const clientId = "33333333-3333-4333-8333-333333333333",
  apiScope = "api://44444444-4444-4444-8444-444444444444/Word.Access";
const config = { clientId, apiScope },
  origin = "https://word.example.invalid";
const success = () => ({
  accessToken: "synthetic-microsoft-api-token",
  expiresOn: new Date(Date.now() + 3600_000),
});
function setup(nested = true) {
  const app = {
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn<(request: unknown) => Promise<ReturnType<typeof success>>>(async () =>
      success()
    ),
    ssoSilent: vi.fn<(request: unknown) => Promise<ReturnType<typeof success>>>(async () =>
      success()
    ),
    acquireTokenPopup: vi.fn<(request: unknown) => Promise<ReturnType<typeof success>>>(async () =>
      success()
    ),
  };
  const fallback = {
    open: vi.fn(async () => ({
      accessToken: "synthetic-fallback-token",
      expiresAt: Date.now() + 3600_000,
    })),
    close: vi.fn(),
  };
  const create = vi.fn<
    (config: Configuration, nested: boolean) => Promise<IPublicClientApplication>
  >(async () => app as unknown as IPublicClientApplication);
  const source = new MicrosoftAccess(
    vi.fn(async () => Response.json(config, { headers: { "X-OLC-Word-Gateway": "1" } })),
    origin,
    {
      supported: () => nested,
      loginHint: async () => "synthetic@example.invalid",
      fallback,
      create,
    }
  );
  return { source, app, fallback, create };
}
describe("MSAL/NAA token acquisition (synthetic host)", () => {
  it("uses memory cache, common authority and only our API scope; silent on startup/access", async () => {
    const { source, app, create } = setup();
    await source.acquire();
    await source.acquire(false, true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      auth: { clientId, authority: "https://login.microsoftonline.com/common" },
      cache: { cacheLocation: "memoryStorage" },
    });
    expect(create.mock.calls[0][1]).toBe(true);
    expect(msalConfiguration(config, origin).cache?.cacheLocation).toBe("memoryStorage");
    expect(app.acquireTokenSilent.mock.calls[1][0]).toMatchObject({
      scopes: [apiScope],
      forceRefresh: true,
      loginHint: "synthetic@example.invalid",
    });
    expect(app.acquireTokenPopup).not.toHaveBeenCalled();
  });
  it("bootstraps without cached account using Office login hint and ssoSilent", async () => {
    const { source, app } = setup();
    app.acquireTokenSilent.mockRejectedValueOnce({ errorCode: "no_account_error" });
    await source.acquire();
    expect(app.ssoSilent).toHaveBeenCalledOnce();
    expect(app.acquireTokenPopup).not.toHaveBeenCalled();
  });
  it("requires explicit action for consent/login and maps cancellation without another popup", async () => {
    const { source, app } = setup();
    app.acquireTokenSilent.mockRejectedValueOnce({ errorCode: "consent_required" });
    await expect(source.acquire()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(app.acquireTokenPopup).not.toHaveBeenCalled();
    app.acquireTokenPopup.mockRejectedValueOnce({ errorCode: "user_cancelled" });
    await expect(source.acquire(true)).rejects.toMatchObject({ code: "CANCELLED" });
    expect(app.acquireTokenPopup).toHaveBeenCalledOnce();
  });
  it("uses Microsoft Office-dialog fallback only on explicit action in unsupported hosts", async () => {
    const { source, app, fallback, create } = setup(false);
    app.acquireTokenSilent.mockRejectedValueOnce({ errorCode: "login_required" });
    await expect(source.acquire()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(fallback.open).not.toHaveBeenCalled();
    await source.acquire(true);
    await source.acquire();
    expect(fallback.open).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][1]).toBe(false);
    source.close();
    expect(fallback.close).toHaveBeenCalledOnce();
  });
});
