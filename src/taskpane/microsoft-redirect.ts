import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
// No application bootstrap, API call, analytics or token logging on the response page.
void broadcastResponseToMainFrame().catch(() => undefined);
