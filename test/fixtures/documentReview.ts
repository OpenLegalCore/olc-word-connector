/** Independently authored synthetic data; no saved user/Engine incident content. */
export function documentReviewFixture(language: "sl" | "en" = "sl", withProposal = true) {
  return {
    status: "ANSWER",
    claims: [
      {
        text: language === "sl" ? "Sintetična razlaga žetona 🟤." : "Synthetic explanation 🟤.",
        source_labels: ["Z1"],
      },
    ],
    notice: "",
    sources: [
      {
        label: "Z1",
        source_id: "synthetic:word:1",
        source_class: "LEGISLATION",
        title: "Synthetic source",
        locator: "synthetic fixture",
        url: "",
        currentness_status: "CURRENT",
        as_of_date: "",
      },
    ],
    proposal: withProposal
      ? {
          markdown:
            language === "sl"
              ? "Stranki se dogovorita o roku plačila."
              : "The parties agree on the payment deadline.",
          language,
          change_summary:
            language === "sl"
              ? "Izrecen sintetični predlog za lokalni pregled."
              : "Explicit synthetic proposal for local review.",
          source_labels: ["Z1"],
        }
      : null,
  };
}

/** Engine-validated document-only shapes, independent of request wording. */
export function documentOnlyFixture(language: "sl" | "en" = "sl", legal = true) {
  const value = documentReviewFixture(language);
  value.claims = [];
  if (!legal) {
    value.sources = [];
    value.proposal!.source_labels = [];
  }
  return value;
}

export function contentEvent(content: string): string {
  return `data: ${JSON.stringify({ model: "lexai-engine-local", choices: [{ delta: { content }, finish_reason: null }] })}\n\n`;
}
export const successTerminal = `data: ${JSON.stringify({ model: "lexai-engine-local", choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 84, completion_tokens: 47, total_tokens: 131 } })}\n\ndata: [DONE]\n\n`;
