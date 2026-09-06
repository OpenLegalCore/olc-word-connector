import { describe, expect, it } from "vitest";

import {
  createSafeLegalAnswer as renderSafeLegalAnswer,
  splitLegalAnswer,
} from "../../src/taskpane/safeLegalAnswer";

function createSafeLegalAnswer(document: Document, text: string): HTMLElement {
  return renderSafeLegalAnswer(document, text, {
    answerAriaLabel: "Answer",
    sourcesHeading: "Sources",
  });
}

describe("safe legal answer rendering", () => {
  it("localizes only renderer chrome and leaves provider text and links unchanged", () => {
    const text = "Exact provider answer [Z1]\n\nSources\n- [Z1] [Act](https://pisrs.si/source)";
    const rendered = renderSafeLegalAnswer(document, text, {
      answerAriaLabel: "Odgovor",
      sourcesHeading: "Viri",
    });

    expect(rendered.querySelector(".olc-legal-answer")?.getAttribute("aria-label")).toBe("Odgovor");
    expect(rendered.querySelector(".olc-legal-sources h2")?.textContent).toBe("Viri");
    expect(rendered.textContent).toContain("Exact provider answer");
    expect(rendered.querySelector<HTMLAnchorElement>("a")?.href).toBe("https://pisrs.si/source");
  });

  it("separates Sources and renders headings, lists, emphasis and Z/S references", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "## Rule\n**Important** answer [Z1] and [S2].\n\n- First\n- Second\n\n## Sources\n- [Z1] Act\n- [S2] Judgment"
    );

    expect(rendered.querySelector(".olc-legal-answer h3")?.textContent).toBe("Rule");
    expect(rendered.querySelector("strong")?.textContent).toBe("Important");
    expect(
      Array.from(rendered.querySelectorAll(".olc-source-reference"), (node) => node.textContent)
    ).toEqual(["[Z1]", "[S2]", "[Z1]", "[S2]"]);
    expect(rendered.querySelector(".olc-legal-sources h2")?.textContent).toBe("Sources");
  });

  it("makes only allowlisted HTTPS legal-source links clickable and treats HTML as text", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "[PISRS](https://pisrs.si/pregledPredpisa?id=ZAKO2008) " +
        "[PISRS www](https://www.pisrs.si/pregledPredpisa?id=ZAKO2008) " +
        "[Case law](https://sodnapraksa.si/?q=id:example) " +
        "[Case law www](https://www.sodnapraksa.si/?q=id:example) <img src=x>"
    );
    const links = Array.from(rendered.querySelectorAll("a"));

    expect(links.map((link) => link.href)).toEqual([
      "https://pisrs.si/pregledPredpisa?id=ZAKO2008",
      "https://www.pisrs.si/pregledPredpisa?id=ZAKO2008",
      "https://sodnapraksa.si/?q=id:example",
      "https://www.sodnapraksa.si/?q=id:example",
    ]);
    expect(
      links.every((link) => link.target === "_blank" && link.rel === "noopener noreferrer")
    ).toBe(true);
    expect(rendered.querySelector("img")).toBeNull();
    expect(rendered.textContent).toContain("<img src=x>");
  });

  it("rejects HTTP, arbitrary, lookalike, credential-bearing and active-content links", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "[HTTP](http://pisrs.si/source) [Arbitrary](https://example.invalid/source) " +
        "[Lookalike](https://pisrs.si.example.invalid/source) " +
        "[Port](https://pisrs.si:8443/source) " +
        "[Credential](https://user:pass@pisrs.si/source) [Script](javascript:alert(1))"
    );

    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.textContent).toContain("[HTTP]");
    expect(rendered.textContent).toContain("[Arbitrary]");
    expect(rendered.textContent).toContain("[Lookalike]");
    expect(rendered.textContent).toContain("[Port]");
    expect(rendered.textContent).toContain("[Credential]");
    expect(rendered.textContent).toContain("[Script]");
  });

  it("rejects an explicitly declared default HTTPS port", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "[Default port](https://pisrs.si:443/pregledPredpisa?id=ZAKO2008)"
    );

    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.textContent).toContain("[Default port]");
  });

  it("rejects malformed and control-bearing URLs and supports ordered lists", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "1. First source\n2. Second source\n\n[Broken](https://%) " +
        "[Control](https://pisrs.si/\u007f)"
    );

    expect(rendered.querySelectorAll("ol > li")).toHaveLength(2);
    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.textContent).toContain("[Broken](https://%)");
    expect(rendered.textContent).toContain("[Control]");
  });

  it("does not promote unsupported source classes", () => {
    const rendered = createSafeLegalAnswer(document, "Allowed [Z1] [S1], unsupported [L1].");
    expect(rendered.querySelectorAll(".olc-source-reference")).toHaveLength(2);
    expect(rendered.textContent).toContain("[L1]");
  });

  it("does not promote non-Z/S or non-numeric reference definitions", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "Unsupported [A1] and [S].\n\nSources\n" +
        "[A1]: <https://www.sodnapraksa.si/?q=id:letter>\n" +
        "[S]: <https://www.sodnapraksa.si/?q=id:missing-number>"
    );

    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.textContent).toContain("[A1]:");
    expect(rendered.textContent).toContain("[S]:");
  });

  it("keeps a stable empty Sources section when the backend omits its heading", () => {
    expect(splitLegalAnswer("Answer only")).toEqual({ answer: "Answer only", sources: "" });
    const rendered = createSafeLegalAnswer(document, "Answer only");
    expect(rendered.querySelector(".olc-legal-sources h2")?.textContent).toBe("Sources");
  });

  it("separates a plain Sources heading without requiring Markdown syntax", () => {
    expect(splitLegalAnswer("Answer\n\nSources\n- [Z1] Act")).toEqual({
      answer: "Answer",
      sources: "- [Z1] Act",
    });
  });

  it("separates a realistic Slovenian Viri section and keeps model HTML inert", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "## Odgovor\nZa vprašanje sta pomembna zakon [Z1] in sodba [S1]. <strong>Ni HTML.</strong>\n\n" +
        "## Viri\n- [Z1] [Zakon](https://pisrs.si/pregledPredpisa?id=ZAKO2008)\n" +
        "- [S1] [Sodba](https://www.sodnapraksa.si/?q=id:example)"
    );
    const answer = rendered.querySelector(".olc-legal-answer")!;
    const sources = rendered.querySelector(".olc-legal-sources")!;

    expect(answer.textContent).toContain("Za vprašanje sta pomembna zakon [Z1] in sodba [S1].");
    expect(answer.querySelector("a")).toBeNull();
    expect(sources.textContent).toContain("Zakon");
    expect(sources.textContent).toContain("Sodba");
    expect(sources.querySelectorAll("a")).toHaveLength(2);
    expect(rendered.querySelector("strong")).toBeNull();
    expect(answer.textContent).toContain("<strong>Ni HTML.</strong>");
  });

  it("resolves forward S references and full-reference labels from exact Viri definitions", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "## Odgovor\nGlej [S1] in [S1 · VSL sodba III Cp 975/2016][S1].\n\n" +
        "## Viri\n- [VSL sodba III Cp 975/2016][S1] · ECLI:SI:VSLJ:2016:III.CP.975.2016\n" +
        "[S1]: <https://www.sodnapraksa.si/?q=id:example>"
    );
    const links = Array.from(rendered.querySelectorAll<HTMLAnchorElement>("a"));

    expect(links.map((link) => link.textContent)).toEqual([
      "[S1]",
      "S1 · VSL sodba III Cp 975/2016",
      "VSL sodba III Cp 975/2016",
    ]);
    expect(links.every((link) => link.href === "https://www.sodnapraksa.si/?q=id:example")).toBe(
      true
    );
    expect(
      links.every((link) => link.target === "_blank" && link.rel === "noopener noreferrer")
    ).toBe(true);
    expect(rendered.textContent).not.toContain("[S1]:");
  });

  it("resolves an allowlisted PISRS definition but never invents an undefined Z URL", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "Veljata [Z1] in še nedoločen [Z2].\n\nSources\n" +
        "- [Zakon o primeru][Z1]\n- [Z2] Manjkajoči vir\n" +
        "[Z1]: <https://www.pisrs.si/pregledPredpisa?id=ZAKO2008>"
    );
    const links = Array.from(rendered.querySelectorAll<HTMLAnchorElement>("a"));

    expect(links.map((link) => link.href)).toEqual([
      "https://www.pisrs.si/pregledPredpisa?id=ZAKO2008",
      "https://www.pisrs.si/pregledPredpisa?id=ZAKO2008",
    ]);
    expect(rendered.querySelector("a")?.textContent).toBe("[Z1]");
    expect(rendered.querySelectorAll("a")).toHaveLength(2);
    expect(rendered.textContent).toContain("[Z2]");
    expect(rendered.textContent).not.toContain("[Z1]:");
  });

  it("does not use a reference definition outside the exact Sources or Viri section", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "Answer [S1]\n[S1]: <https://www.sodnapraksa.si/?q=id:outside>\n\n" +
        "Sources and links\n- [Decision][S1]"
    );

    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.textContent).toContain("[S1]: <https://www.sodnapraksa.si/?q=id:outside>");
    expect(rendered.textContent).toContain("[Decision][S1]");
  });

  it("rejects unsafe, malformed and explicit-port reference definitions", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "[S1] [S2] [S3] [S4] [S5] [S6] [S7] [S8]\n\nSources\n" +
        "[S1]: <http://www.sodnapraksa.si/source>\n" +
        "[S2]: <https://sodnapraksa.si.example.invalid/source>\n" +
        "[S3]: <https://evilsodnapraksa.si/source>\n" +
        "[S4]: <https://user@www.sodnapraksa.si/source>\n" +
        "[S5]: <https://www.sodnapraksa.si:443/source>\n" +
        "[S6]: <https://pisrs.si:8443/source>\n" +
        "[S7]: <https://%>\n" +
        "[S8]: <https://www.sodnapraksa.si/source"
    );

    expect(rendered.querySelector("a")).toBeNull();
    expect(rendered.querySelectorAll(".olc-source-reference")).toHaveLength(16);
    expect(rendered.textContent).toContain("[S5]: <https://www.sodnapraksa.si:443/source>");
    expect(rendered.textContent).toContain("[S8]: <https://www.sodnapraksa.si/source");
  });

  it("accepts identical duplicate definitions and rejects a conflicting ID entirely", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "Accepted [S1], conflicting [S2].\n\nSources\n" +
        "[S1]: <https://www.sodnapraksa.si/?q=id:same>\n" +
        "[S1]: <https://www.sodnapraksa.si/?q=id:same>\n" +
        "[S2]: <https://www.sodnapraksa.si/?q=id:first>\n" +
        "[S2]: <https://www.sodnapraksa.si/?q=id:second>"
    );

    expect(rendered.querySelectorAll("a")).toHaveLength(1);
    expect(rendered.querySelector("a")?.textContent).toBe("[S1]");
    expect(rendered.textContent).not.toContain("[S1]:");
    expect(rendered.textContent).toContain("[S2]: <https://www.sodnapraksa.si/?q=id:first>");
    expect(rendered.textContent).toContain("[S2]: <https://www.sodnapraksa.si/?q=id:second>");
  });

  it("keeps HTML labels inert and refuses active-content reference URLs", () => {
    const rendered = createSafeLegalAnswer(
      document,
      "[<img src=x onerror=alert(1)>][S1] [Run script][S2]\n\nSources\n" +
        "[S1]: <https://www.sodnapraksa.si/?q=id:safe>\n" +
        "[S2]: <javascript:alert(1)>"
    );

    expect(rendered.querySelectorAll("a")).toHaveLength(1);
    expect(rendered.querySelector("a")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(rendered.querySelector("img")).toBeNull();
    expect(rendered.querySelector("script")).toBeNull();
    expect(rendered.textContent).toContain("[Run script][S2]");
    expect(rendered.textContent).toContain("[S2]: <javascript:alert(1)>");
  });

  it("accepts only exact Sources or Viri separator headings", () => {
    expect(splitLegalAnswer("Answer\n\n###### vIrI\n- [Z1] Vir")).toEqual({
      answer: "Answer",
      sources: "- [Z1] Vir",
    });
    expect(splitLegalAnswer("Answer\n\nViri in povezave\n- [Z1] Vir")).toEqual({
      answer: "Answer\n\nViri in povezave\n- [Z1] Vir",
      sources: "",
    });
  });
});
