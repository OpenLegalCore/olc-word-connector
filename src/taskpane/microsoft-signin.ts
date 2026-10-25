/* global Office, document, location, setInterval, clearInterval, HTMLButtonElement, fetch */
import { PublicClientApplication } from "@azure/msal-browser";
import { loadMicrosoftConfiguration, msalConfiguration } from "./MicrosoftAccess";

// In the Office dialog MSAL and its child popup share the first-party partition.
// MemoryStorage is intentional: no redirect flow, browser persistence or refresh-token transfer.
void Office.onReady(async () => {
  const button = document.querySelector<HTMLButtonElement>("button"),
    status = document.querySelector("p");
  if (!button || !status) return;
  try {
    const config = await loadMicrosoftConfiguration((url, init) => fetch(url, init));
    const app = new PublicClientApplication(msalConfiguration(config, location.origin));
    await app.initialize();
    let state: string | undefined;
    Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (event) => {
      if (!("message" in event) || event.origin !== location.origin) return;
      try {
        const value = JSON.parse(event.message) as Record<string, unknown>;
        if (
          !state &&
          Object.keys(value).sort().join(",") === "state,type" &&
          value.type === "olc-microsoft-start" &&
          typeof value.state === "string" &&
          /^[a-f0-9]{64}$/.test(value.state)
        ) {
          state = value.state;
          button.disabled = false;
          clearInterval(ready);
        }
      } catch {
        /* invalid parent message */
      }
    });
    const ready = setInterval(
      () =>
        Office.context.ui.messageParent(JSON.stringify({ type: "olc-microsoft-ready" }), {
          targetOrigin: location.origin,
        }),
      500
    );
    button.addEventListener("click", () => {
      if (!state || button.disabled) return;
      button.disabled = true;
      void app
        .acquireTokenPopup({ scopes: [config.apiScope] })
        .then((result) => {
          Office.context.ui.messageParent(
            JSON.stringify({
              type: "olc-microsoft-token",
              state,
              accessToken: result.accessToken,
              expiresAt: result.expiresOn?.getTime() ?? 0,
            }),
            { targetOrigin: location.origin }
          );
        })
        .catch(() => {
          status.textContent = "Sign-in did not complete. / Prijava ni bila zaključena.";
          button.disabled = false;
        });
    });
  } catch {
    status.textContent = "Microsoft sign-in is unavailable. / Microsoftova prijava ni na voljo.";
  }
});
