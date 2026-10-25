/* global Office, location */
import { secureSignInOrigin } from "./OfficeSignInDialog";
// Fixed same-origin Office bootstrap. No verifier, code or token in navigation.
try {
  const origin = secureSignInOrigin(location.origin);
  void Office.onReady()
    .then(() => {
      let navigated = false;
      Office.context.ui.addHandlerAsync(
        Office.EventType.DialogParentMessageReceived,
        (event) => {
          if (
            navigated ||
            event.origin !== origin ||
            typeof event.message !== "string" ||
            event.message.length > 512
          )
            return;
          try {
            const value = JSON.parse(event.message) as Record<string, unknown>;
            if (
              Object.keys(value).sort().join(",") !== "challenge,state,type" ||
              value.type !== "olc-word-authorize" ||
              typeof value.challenge !== "string" ||
              !/^[A-Za-z0-9_-]{43}$/.test(value.challenge) ||
              typeof value.state !== "string" ||
              !/^[A-Za-z0-9_-]{43}$/.test(value.state)
            )
              return;
            navigated = true;
            location.replace(
              `${origin}/word-auth/authorize?challenge=${value.challenge}&state=${value.state}`
            );
          } catch {
            /* reject arbitrary redirects and malformed messages */
          }
        },
        () => undefined
      );
    })
    .catch(() => undefined);
} catch {
  /* unsafe origin */
}
