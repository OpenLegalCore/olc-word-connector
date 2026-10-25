/* global document, location, history, fetch, AbortSignal */
import { BrowserCacheLocation, PublicClientApplication } from "@azure/msal-browser";

const origin = "https://word-staging.openlegalcore.org";
const clientId = "4d4318a5-0c42-4785-a5bb-179538d393de";
const scope = "api://db0e1d38-ce26-443e-b17b-0edb7881a4cc/Word.Access";
const nonce = location.hash.slice(1);
history.replaceState(null, "", location.pathname);
const button = document.querySelector<HTMLButtonElement>("button");
const status = document.querySelector<HTMLParagraphElement>("#status");
if (button && status && location.origin === origin && /^[a-f0-9]{64}$/.test(nonce)) {
  const app = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: origin + "/microsoft-redirect.html",
    },
    cache: { cacheLocation: BrowserCacheLocation.MemoryStorage },
    system: {
      loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => undefined },
      popupBridgeTimeout: 120_000,
    },
  });
  void app
    .initialize()
    .then(() => {
      button.disabled = false;
      status.textContent = "Izberi isti Microsoftov račun, ki ga uporabljaš v Wordu.";
      button.addEventListener("click", () => {
        if (button.disabled) return;
        button.disabled = true;
        // Popup is started synchronously from the explicit owner action.
        void app
          .acquireTokenPopup({ scopes: [scope], prompt: "select_account" })
          .then(async (result) => {
            const response = await fetch("http://127.0.0.1:8766/identity", {
              method: "POST",
              credentials: "omit",
              redirect: "error",
              cache: "no-store",
              headers: { "Content-Type": "application/json", "X-OLC-Enrollment": nonce },
              body: JSON.stringify({ accessToken: result.accessToken }),
              signal: AbortSignal.timeout(20_000),
            });
            if (!response.ok) throw new Error("Verification failed");
            status.textContent =
              "Identiteta je kriptografsko preverjena in zasebno shranjena na tem računalniku. Vrni se v Codex. Žetona ne kopiraj. Staging še ni aktiviran.";
            await app.clearCache().catch(() => undefined);
          })
          .catch((error: unknown) => {
            const code = (error as { errorCode?: string }).errorCode;
            status.textContent =
              code === "user_cancelled"
                ? "Prijava je preklicana. Dostop ni bil spremenjen."
                : "Prijava ali lokalno preverjanje ni uspelo. Preveri, da lokalni sprejemnik teče, in dovoli dostop do localhost, če ga Chrome zahteva. Sporoči morebitno Microsoftovo kodo napake, brez žetona.";
            button.disabled = false;
          });
      });
    })
    .catch(() => {
      status.textContent = "Microsoftove prijave ni bilo mogoče pripraviti.";
    });
}
