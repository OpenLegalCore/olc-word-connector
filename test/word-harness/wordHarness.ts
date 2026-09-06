/* global Office */

import { bootstrapWordHarness } from "./bootstrapWordHarness";

void Office.onReady((info) => {
  bootstrapWordHarness(document, {
    wordHost: Office.HostType.Word,
    onReady: (callback) => callback({ host: info.host }),
  });
});
