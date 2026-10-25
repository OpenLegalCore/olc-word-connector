/* global AbortSignal, RequestInit, Response, Office, TextDecoder, globalThis */
import {
  BrowserCacheLocation,
  createNestablePublicClientApplication,
  PublicClientApplication,
  InteractionRequiredAuthError,
  type Configuration,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { ChatGatewayError } from "../chat/ChatGatewayError";
import { MicrosoftSignInDialog } from "./MicrosoftSignInDialog";

export interface MicrosoftToken {
  accessToken: string;
  expiresAt: number;
}
export interface MicrosoftTokenSource {
  acquire(interactive?: boolean, forceRefresh?: boolean): Promise<MicrosoftToken>;
  close(): void;
}
export interface MicrosoftConfiguration {
  clientId: string;
  apiScope: string;
}
export type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;
const guid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export async function loadMicrosoftConfiguration(send: AuthFetch): Promise<MicrosoftConfiguration> {
  const response = await send("/word-api/auth/config", {
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (
    !response.ok ||
    response.redirected ||
    response.headers.get("X-OLC-Word-Gateway") !== "1" ||
    response.headers.get("Content-Type")?.split(";", 1)[0] !== "application/json"
  )
    throw new ChatGatewayError(
      response.status >= 500 ? "INVALID_CONFIGURATION" : "INVALID_RESPONSE"
    );
  const reader = response.body?.getReader();
  if (!reader) throw new ChatGatewayError("INVALID_RESPONSE");
  let text = "",
    size = 0;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024) throw new ChatGatewayError("INVALID_RESPONSE");
      text += decoder.decode(part.value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode()) as MicrosoftConfiguration;
    if (
      !value ||
      Object.keys(value).sort().join(",") !== "apiScope,clientId" ||
      !new RegExp(`^${guid}$`).test(value.clientId) ||
      !new RegExp(`^api://${guid}/Word\\.Access$`).test(value.apiScope) ||
      value.apiScope === `api://${value.clientId}/Word.Access`
    )
      throw new ChatGatewayError("INVALID_CONFIGURATION");
    return value;
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export function msalConfiguration(
  config: MicrosoftConfiguration,
  origin: string,
  nested = false
): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: origin + (nested ? "/taskpane.html" : "/microsoft-redirect.html"),
    },
    cache: { cacheLocation: BrowserCacheLocation.MemoryStorage },
    system: {
      loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => undefined },
      iframeBridgeTimeout: 15_000,
      popupBridgeTimeout: 120_000,
    },
  };
}
export function mapMicrosoftError(error: unknown): ChatGatewayError {
  if (error instanceof ChatGatewayError) return error;
  const code = (error as { errorCode?: string })?.errorCode;
  if (code === "user_cancelled") return new ChatGatewayError("CANCELLED");
  if (code === "monitor_window_timeout" || code === "timed_out")
    return new ChatGatewayError("TIMEOUT");
  if (
    error instanceof InteractionRequiredAuthError ||
    [
      "interaction_required",
      "consent_required",
      "login_required",
      "no_account_error",
      "silent_sso_error",
    ].includes(code ?? "")
  )
    return new ChatGatewayError("SESSION_EXPIRED");
  return new ChatGatewayError("NETWORK_ERROR");
}
export interface MicrosoftAccessDependencies {
  supported: () => boolean;
  loginHint: () => Promise<string | undefined>;
  fallback: { open(): Promise<MicrosoftToken>; close(): void };
  create?: (config: Configuration, nested: boolean) => Promise<IPublicClientApplication>;
}
/** Silent broker access first. Interactive login is reachable only from the explicit UI action. */
export class MicrosoftAccess implements MicrosoftTokenSource {
  private initialized?: Promise<{
    app: IPublicClientApplication;
    scopes: string[];
    nested: boolean;
  }>;
  private fallbackToken?: MicrosoftToken;
  constructor(
    private readonly send: AuthFetch,
    private readonly origin: string,
    private readonly dependencies: MicrosoftAccessDependencies
  ) {}
  private initialize() {
    return (this.initialized ??= (async () => {
      const config = await loadMicrosoftConfiguration(this.send),
        nested = this.dependencies.supported();
      const create =
        this.dependencies.create ??
        (async (settings, useNested) => {
          if (useNested) return createNestablePublicClientApplication(settings);
          const app = new PublicClientApplication(settings);
          await app.initialize();
          return app;
        });
      return {
        app: await create(msalConfiguration(config, this.origin, nested), nested),
        scopes: [config.apiScope],
        nested,
      };
    })().catch((error: unknown) => {
      this.initialized = undefined;
      throw mapMicrosoftError(error);
    }));
  }
  async acquire(interactive = false, forceRefresh = false): Promise<MicrosoftToken> {
    try {
      const { app, scopes, nested } = await this.initialize();
      if (
        !nested &&
        !forceRefresh &&
        this.fallbackToken &&
        this.fallbackToken.expiresAt > Date.now() + 60_000
      )
        return this.fallbackToken;
      if (interactive && !nested)
        return (this.fallbackToken = await this.dependencies.fallback.open());
      const accounts = app.getAllAccounts();
      // Do not arbitrarily select one of several accounts. Office's hint is only a hint, never authorization.
      const request = {
        scopes,
        loginHint: await this.dependencies.loginHint(),
        ...(accounts.length === 1 ? { account: accounts[0] } : {}),
        forceRefresh,
      };
      let result;
      if (interactive) result = await app.acquireTokenPopup(request);
      else {
        try {
          result = await app.acquireTokenSilent(request);
        } catch (error) {
          if ((error as { errorCode?: string }).errorCode !== "no_account_error") throw error;
          result = await app.ssoSilent(request);
        }
      }
      const token = {
        accessToken: result.accessToken,
        expiresAt: result.expiresOn?.getTime() ?? 0,
      };
      if (!token.accessToken || token.expiresAt <= Date.now())
        throw new ChatGatewayError("SESSION_EXPIRED");
      return token;
    } catch (error) {
      throw mapMicrosoftError(error);
    }
  }
  close(): void {
    this.fallbackToken = undefined;
    this.dependencies.fallback.close();
  }
}
export async function officeLoginHint(): Promise<string | undefined> {
  try {
    return (await Office.auth.getAuthContext()).userPrincipalName || undefined;
  } catch {
    return undefined;
  }
}

export function createOfficeMicrosoftAccess(origin: string): MicrosoftTokenSource {
  return new MicrosoftAccess((url, init) => globalThis.fetch(url, init), origin, {
    supported: () => Office.context.requirements?.isSetSupported("NestedAppAuth", "1.1") ?? false,
    loginHint: officeLoginHint,
    fallback: new MicrosoftSignInDialog(origin, Office.context.ui),
  });
}
