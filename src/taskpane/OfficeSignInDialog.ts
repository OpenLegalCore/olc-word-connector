/* global Office, URL, AbortController, AbortSignal, clearInterval, clearTimeout, crypto, setInterval, setTimeout, btoa, TextEncoder */
import { ChatGatewayError } from "../chat/ChatGatewayError";
export type SignInOutcome = "completed" | "closed" | "denied" | "expired" | "failed";
export type CodeExchange = (
  code: string,
  verifier: string,
  state: string,
  signal: AbortSignal
) => Promise<void>;
export interface SecureSignIn {
  open(exchange?: CodeExchange): Promise<SignInOutcome>;
  close(): void;
}
export function secureSignInOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error("Unsafe sign-in origin");
  return parsed.origin;
}
const encode = (bytes: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const random = (): string => encode(crypto.getRandomValues(new Uint8Array(32)));
const opaque = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** Native Office channel; verifier never leaves this pane except the HTTPS code exchange. */
export class OfficeSignInDialog implements SecureSignIn {
  private active?: { finish: (outcome: SignInOutcome) => void };
  constructor(
    private readonly origin: string,
    private readonly ui: Pick<Office.UI, "displayDialogAsync">
  ) {}
  open(exchange?: CodeExchange): Promise<SignInOutcome> {
    if (this.active || !exchange) return Promise.resolve("failed");
    let origin: string, verifier: string, state: string;
    try {
      if (
        !Office.context?.requirements?.isSetSupported("DialogApi", "1.2") ||
        !Office.context.requirements.isSetSupported("DialogOrigin", "1.1")
      )
        return Promise.resolve("failed");
      origin = secureSignInOrigin(this.origin);
      verifier = random();
      state = random();
    } catch {
      return Promise.resolve("failed");
    }
    // Open synchronously from the gesture. S256 calculation happens while the fixed bootstrap loads.
    const challenge = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(verifier))
      .then(encode);
    return new Promise((resolve) => {
      let dialog: Office.Dialog | undefined,
        challengeTimer: ReturnType<typeof setInterval> | undefined;
      let finished = false,
        exchanging = false;
      const abort = new AbortController();
      const timer = setTimeout(() => finish("failed"), 5 * 60_000);
      const finish = (outcome: SignInOutcome): void => {
        if (finished) return;
        finished = true;
        abort.abort();
        clearTimeout(timer);
        clearInterval(challengeTimer);
        this.active = undefined;
        verifier = "";
        try {
          dialog?.close();
        } catch {
          /* best effort */
        }
        resolve(outcome);
      };
      this.active = { finish };
      void challenge.catch(() => finish("failed"));
      try {
        this.ui.displayDialogAsync(
          `${origin}/signin.html`,
          { height: 60, width: 45, displayInIframe: false, promptBeforeOpen: true },
          (result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              finish(result.error?.code === 12009 ? "closed" : "failed");
              return;
            }
            dialog = result.value;
            if (finished) {
              try {
                dialog.close();
              } catch {
                /* late window */
              }
              return;
            }
            try {
              if (typeof dialog.messageChild !== "function") {
                finish("failed");
                return;
              }
              dialog.addEventHandler(Office.EventType.DialogMessageReceived, (event) => {
                if (
                  finished ||
                  exchanging ||
                  !("message" in event) ||
                  event.origin !== origin ||
                  typeof event.message !== "string" ||
                  event.message.length > 512
                )
                  return;
                try {
                  const message = JSON.parse(event.message) as Record<string, unknown>;
                  if (
                    Object.keys(message).sort().join(",") === "state,type" &&
                    message.type === "olc-word-authorization-denied" &&
                    message.state === state
                  ) {
                    finish("denied");
                    return;
                  }
                  if (
                    Object.keys(message).sort().join(",") !== "code,state,type" ||
                    message.type !== "olc-word-authorized" ||
                    message.state !== state ||
                    !opaque(message.code)
                  )
                    return;
                  exchanging = true;
                  void exchange(message.code, verifier, state, abort.signal).then(
                    () => finish("completed"),
                    (error: unknown) =>
                      finish(
                        error instanceof ChatGatewayError && error.code === "ACCESS_DENIED"
                          ? "denied"
                          : error instanceof ChatGatewayError && error.code === "SESSION_EXPIRED"
                            ? "expired"
                            : "failed"
                      )
                  );
                } catch {
                  /* untrusted message */
                }
              });
              dialog.addEventHandler(Office.EventType.DialogEventReceived, (event) =>
                finish("error" in event && event.error === 12006 ? "closed" : "failed")
              );
              const sendChallenge = (): void => {
                void challenge
                  .then((value) => {
                    if (finished || exchanging) return;
                    try {
                      dialog?.messageChild(
                        JSON.stringify({ type: "olc-word-authorize", challenge: value, state }),
                        { targetOrigin: origin }
                      );
                    } catch {
                      /* Access/identity pages are a different origin */
                    }
                  })
                  .catch(() => undefined);
              };
              challengeTimer = setInterval(sendChallenge, 500);
              sendChallenge();
            } catch {
              finish("failed");
            }
          }
        );
      } catch {
        finish("failed");
      }
    });
  }
  close(): void {
    this.active?.finish("closed");
  }
}
