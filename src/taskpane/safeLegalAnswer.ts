/* global Document, DocumentFragment, HTMLElement, URL */

export interface LegalAnswerParts {
  readonly answer: string;
  readonly sources: string;
}

export interface LegalAnswerLabels {
  readonly answerAriaLabel: string;
  readonly sourcesHeading: string;
}

const SOURCES_HEADING = /^(?:#{1,6}\s+)?(?:Sources|Viri)\s*$/iu;
const REFERENCE_DEFINITION_ID = /^\s*\[([ZS]\d+)\]:/iu;
const REFERENCE_DEFINITION = /^\s*\[([ZS]\d+)\]:\s*<([^<>\s]+)>\s*$/iu;
const INLINE_TOKEN =
  /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\[([ZS]\d+)\]|\[([^\]\n]+)\]\(([^)\s]+)\)|\[([ZS]\d+)\]/giu;
const LEGAL_SOURCE_HOSTS = new Set([
  "pisrs.si",
  "www.pisrs.si",
  "sodnapraksa.si",
  "www.sodnapraksa.si",
]);

export function splitLegalAnswer(text: string): LegalAnswerParts {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const sourceIndex = lines.findIndex((line) => SOURCES_HEADING.test(line.trim()));
  if (sourceIndex < 0) {
    return { answer: text.trim(), sources: "" };
  }
  return {
    answer: lines.slice(0, sourceIndex).join("\n").trim(),
    sources: lines
      .slice(sourceIndex + 1)
      .join("\n")
      .trim(),
  };
}

function safeLegalSourceUrl(value: string): string | undefined {
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  const rawAuthority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/iu.exec(value)?.[1];
  if (
    value.trim() !== value ||
    hasControlCharacter ||
    rawAuthority === undefined ||
    rawAuthority.includes(":")
  ) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      !LEGAL_SOURCE_HOSTS.has(parsed.hostname)
    ) {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

interface LegalReferenceDefinitions {
  readonly urls: ReadonlyMap<string, string>;
  readonly sources: string;
}

interface ReferenceCandidate {
  href?: string;
  readonly lineIndexes: number[];
  rejected: boolean;
}

function extractReferenceDefinitions(value: string): LegalReferenceDefinitions {
  const lines = value.replace(/\r\n?/gu, "\n").split("\n");
  const candidates = new Map<string, ReferenceCandidate>();

  lines.forEach((line, lineIndex) => {
    const idMatch = REFERENCE_DEFINITION_ID.exec(line);
    if (!idMatch) {
      return;
    }

    const id = idMatch[1].toUpperCase();
    const definitionMatch = REFERENCE_DEFINITION.exec(line);
    const href = definitionMatch ? safeLegalSourceUrl(definitionMatch[2]) : undefined;
    const existing = candidates.get(id);
    if (!existing) {
      candidates.set(id, {
        href,
        lineIndexes: [lineIndex],
        rejected: href === undefined,
      });
      return;
    }

    existing.lineIndexes.push(lineIndex);
    if (href === undefined || existing.href === undefined || href !== existing.href) {
      existing.rejected = true;
    }
  });

  const urls = new Map<string, string>();
  const hiddenLineIndexes = new Set<number>();
  for (const [id, candidate] of candidates) {
    if (candidate.rejected || candidate.href === undefined) {
      continue;
    }
    urls.set(id, candidate.href);
    candidate.lineIndexes.forEach((lineIndex) => hiddenLineIndexes.add(lineIndex));
  }

  return {
    urls,
    sources: lines
      .filter((_line, lineIndex) => !hiddenLineIndexes.has(lineIndex))
      .join("\n")
      .trim(),
  };
}

function appendLink(
  document: Document,
  parent: HTMLElement,
  label: string,
  href: string,
  className?: string
): void {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (className) {
    link.className = className;
  }
  parent.append(link);
}

function appendInline(
  document: Document,
  parent: HTMLElement,
  value: string,
  definitions: ReadonlyMap<string, string>
): void {
  let cursor = 0;
  INLINE_TOKEN.lastIndex = 0;
  for (const match of value.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    parent.append(document.createTextNode(value.slice(cursor, index)));
    if (match[1] !== undefined) {
      const strong = document.createElement("strong");
      strong.textContent = match[1];
      parent.append(strong);
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = definitions.get(match[3].toUpperCase());
      if (href) {
        appendLink(document, parent, match[2], href, "olc-source-reference");
      } else {
        parent.append(document.createTextNode(match[0]));
      }
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const href = safeLegalSourceUrl(match[5]);
      if (href) {
        appendLink(document, parent, match[4], href);
      } else {
        parent.append(document.createTextNode(match[0]));
      }
    } else if (match[6] !== undefined) {
      const referenceId = match[6].toUpperCase();
      const href = definitions.get(referenceId);
      if (href) {
        appendLink(document, parent, `[${referenceId}]`, href, "olc-source-reference");
      } else {
        const reference = document.createElement("span");
        reference.className = "olc-source-reference";
        reference.textContent = `[${referenceId}]`;
        parent.append(reference);
      }
    }
    cursor = index + match[0].length;
  }
  parent.append(document.createTextNode(value.slice(cursor)));
}

function renderBlocks(
  document: Document,
  value: string,
  definitions: ReadonlyMap<string, string>
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = value.replace(/\r\n?/gu, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      const node = document.createElement("h3");
      appendInline(document, node, heading[2], definitions);
      fragment.append(node);
      index++;
      continue;
    }

    const listItem = /^(?:[-*]\s+|(\d+)\.\s+)(.+)$/u.exec(line);
    if (listItem) {
      const ordered = listItem[1] !== undefined;
      const list = document.createElement(ordered ? "ol" : "ul");
      while (index < lines.length) {
        const candidate = /^(?:[-*]\s+|(\d+)\.\s+)(.+)$/u.exec(lines[index].trim());
        if (!candidate || (candidate[1] !== undefined) !== ordered) {
          break;
        }
        const item = document.createElement("li");
        appendInline(document, item, candidate[2], definitions);
        list.append(item);
        index++;
      }
      fragment.append(list);
      continue;
    }

    const paragraphLines = [line];
    index++;
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || /^#{1,6}\s+/u.test(candidate) || /^(?:[-*]\s+|\d+\.\s+)/u.test(candidate)) {
        break;
      }
      paragraphLines.push(candidate);
      index++;
    }
    const paragraph = document.createElement("p");
    appendInline(document, paragraph, paragraphLines.join(" "), definitions);
    fragment.append(paragraph);
  }
  return fragment;
}

export function createSafeLegalAnswer(
  document: Document,
  text: string,
  labels: LegalAnswerLabels
): HTMLElement {
  const parts = splitLegalAnswer(text);
  const references = extractReferenceDefinitions(parts.sources);
  const result = document.createElement("section");
  result.className = "olc-legal-result";

  const answer = document.createElement("article");
  answer.className = "olc-legal-answer";
  answer.setAttribute("aria-label", labels.answerAriaLabel);
  answer.append(renderBlocks(document, parts.answer, references.urls));

  const sources = document.createElement("section");
  sources.className = "olc-legal-sources";
  const heading = document.createElement("h2");
  heading.textContent = labels.sourcesHeading;
  sources.append(heading, renderBlocks(document, references.sources, references.urls));
  result.append(answer, sources);
  return result;
}
