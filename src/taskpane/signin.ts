/* global Office, location */
import { secureSignInOrigin } from "./OfficeSignInDialog";

// Public same-origin bootstrap. No nonce, credential or return URL is in the URL.
try {
  const origin = secureSignInOrigin(location.origin);
  void Office.onReady()
    .then(() => {
      location.replace(`${origin}/api/session`);
    })
    .catch(() => undefined);
} catch {
  /* no arbitrary redirect or authentication fallback */
}
