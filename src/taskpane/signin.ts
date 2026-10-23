/* global Office, location */
import { secureSignInOrigin } from "./OfficeSignInDialog";

// Public same-origin bootstrap; only a non-credential correlation nonce travels.
try {
  const origin = secureSignInOrigin(location.origin);
  if (/^#[a-f0-9]{32}$/.test(location.hash)) {
    void Office.onReady()
      .then(() => {
        location.replace(`${origin}/api/session${location.hash}`);
      })
      .catch(() => undefined);
  }
} catch {
  /* no arbitrary redirect or authentication fallback */
}
