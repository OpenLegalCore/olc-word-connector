/* global Office, URL, clearInterval, clearTimeout, crypto, setInterval, setTimeout */

export type SignInOutcome = "completed" | "closed" | "failed";
export interface SecureSignIn {
  open(): Promise<SignInOutcome>;
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

/** Opens identity outside the Word iframe. Completion is NOT proof of pane access. */
export class OfficeSignInDialog implements SecureSignIn {
  private active?: { finish: (outcome: SignInOutcome) => void };

  constructor(
    private readonly origin: string,
    private readonly ui: Pick<Office.UI, "displayDialogAsync">,
    private readonly makeNonce = (): string =>
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
        x.toString(16).padStart(2, "0")
      ).join("")
  ) {}

  open(): Promise<SignInOutcome> {
    if (this.active) return Promise.resolve("failed");
    let origin: string;
    let nonce: string;
    try {
      if (
        !Office.context?.requirements?.isSetSupported("DialogApi", "1.2") ||
        !Office.context.requirements.isSetSupported("DialogOrigin", "1.1")
      )
        return Promise.resolve("failed");
      origin = secureSignInOrigin(this.origin);
      nonce = this.makeNonce();
      if (!/^[a-f0-9]{32}$/.test(nonce)) throw new Error("Invalid nonce");
    } catch {
      return Promise.resolve("failed");
    }
    return new Promise((resolve) => {
      let dialog: Office.Dialog | undefined;
      let challengeTimer: ReturnType<typeof setInterval> | undefined;
      let finished = false;
      const timer = setTimeout(() => finish("failed"), 5 * 60_000);
      const finish = (outcome: SignInOutcome): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clearInterval(challengeTimer);
        this.active = undefined;
        try {
          dialog?.close();
        } catch {
          /* close is best effort */
        }
        resolve(outcome);
      };
      this.active = { finish };
      try {
        this.ui.displayDialogAsync(
          `${origin}/signin.html`,
          { height: 60, width: 45, displayInIframe: false, promptBeforeOpen: true },
          (result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              // Office's Ignore choice (12009) is not an Access policy denial.
              finish(result.error?.code === 12009 ? "closed" : "failed");
              return;
            }
            dialog = result.value;
            if (finished) {
              try {
                dialog.close();
              } catch {
                /* late window must not survive */
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
                  !("message" in event) ||
                  event.origin !== origin ||
                  typeof event.message !== "string" ||
                  event.message.length > 256
                )
                  return;
                try {
                  const message = JSON.parse(event.message) as Record<string, unknown>;
                  if (
                    Object.keys(message).sort().join(",") === "nonce,type" &&
                    message.type === "olc-word-session-landing" &&
                    message.nonce === nonce
                  ) {
                    finish("completed");
                  }
                } catch {
                  /* untrusted message does not authenticate or trigger a request */
                }
              });
              dialog.addEventHandler(Office.EventType.DialogEventReceived, (event) =>
                finish("error" in event && event.error === 12006 ? "closed" : "failed")
              );
              // Access may redirect before either side is ready. Retry only the
              // native challenge, never login navigation, HTTP or a user request.
              const challenge = (): void => {
                if (finished) return;
                try {
                  dialog?.messageChild(
                    JSON.stringify({ type: "olc-word-session-challenge", nonce }),
                    { targetOrigin: origin }
                  );
                } catch {
                  /* identity pages must not receive a cross-origin challenge */
                }
              };
              challengeTimer = setInterval(challenge, 500);
              challenge();
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
