declare const __OLC_FRONTEND_VERSION__: string;
/** Deterministic fingerprint of production inputs, embedded in the loaded bundle. */
export const frontendVersion =
  typeof __OLC_FRONTEND_VERSION__ === "string" ? __OLC_FRONTEND_VERSION__ : "unbundled-test";
