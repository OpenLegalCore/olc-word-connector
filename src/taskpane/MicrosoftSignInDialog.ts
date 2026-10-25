/* global Office, crypto, setTimeout, clearTimeout */
import { ChatGatewayError } from "../chat/ChatGatewayError";
import type { MicrosoftToken } from "./MicrosoftAccess";
/** Older hosts: standard MSAL in a first-party Office dialog, never Cloudflare. */
export class MicrosoftSignInDialog {
  private cancel?: () => void;
  constructor(
    private readonly origin: string,
    private readonly ui: Pick<Office.UI, "displayDialogAsync">
  ) {}
  open(): Promise<MicrosoftToken> {
    if (this.cancel) return Promise.reject(new ChatGatewayError("NETWORK_ERROR"));
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, "0")
    ).join("");
    return new Promise((resolve, reject) => {
      let dialog: Office.Dialog | undefined,
        done = false;
      const finish = (token?: MicrosoftToken, error = new ChatGatewayError("CANCELLED")): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.cancel = undefined;
        try {
          dialog?.close();
        } catch {
          /* best effort */
        }
        if (token) resolve(token);
        else reject(error);
      };
      const timer = setTimeout(
        () => finish(undefined, new ChatGatewayError("TIMEOUT")),
        5 * 60_000
      );
      this.cancel = () => finish();
      try {
        if (!Office.context.requirements.isSetSupported("DialogOrigin", "1.1")) {
          finish(undefined, new ChatGatewayError("NETWORK_ERROR"));
          return;
        }
        this.ui.displayDialogAsync(
          this.origin + "/microsoft-signin.html",
          { displayInIframe: false, promptBeforeOpen: true, height: 65, width: 45 },
          (result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              finish();
              return;
            }
            dialog = result.value;
            if (done) {
              dialog.close();
              return;
            }
            dialog.addEventHandler(Office.EventType.DialogEventReceived, () => finish());
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, (event) => {
              if (
                done ||
                !("message" in event) ||
                event.origin !== this.origin ||
                event.message.length > 24 * 1024
              )
                return;
              try {
                const message = JSON.parse(event.message) as Record<string, unknown>;
                if (message.type === "olc-microsoft-ready" && Object.keys(message).length === 1) {
                  dialog?.messageChild(JSON.stringify({ type: "olc-microsoft-start", state }), {
                    targetOrigin: this.origin,
                  });
                  return;
                }
                if (
                  Object.keys(message).sort().join(",") !== "accessToken,expiresAt,state,type" ||
                  message.type !== "olc-microsoft-token" ||
                  message.state !== state ||
                  typeof message.accessToken !== "string" ||
                  !message.accessToken ||
                  message.accessToken.length > 16 * 1024 ||
                  typeof message.expiresAt !== "number" ||
                  message.expiresAt <= Date.now()
                )
                  return;
                finish({ accessToken: message.accessToken, expiresAt: message.expiresAt });
              } catch {
                /* closed untrusted message schema */
              }
            });
          }
        );
      } catch {
        finish(undefined, new ChatGatewayError("NETWORK_ERROR"));
      }
    });
  }
  close(): void {
    this.cancel?.();
  }
}
