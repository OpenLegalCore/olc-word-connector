import { ChatGatewayError } from "./ChatGatewayError";

type Path = Array<string | number>;
type Frame = {
  path: Path;
  kind: "object" | "array";
  phase: "key" | "colon" | "value" | "comma";
  key: string;
  index: number;
  keys: Set<string>;
};

function invalid(): never {
  throw new ChatGatewayError("INVALID_RESPONSE", "DOC_JSON_STRUCTURE");
}

/** Incremental JSON token reader. Only claims[].text and root notice reach the UI.
 * No provisional proposal/source is emitted. Final JSON/shape validation is separate.
 */
export class DocumentReviewExplanationStream {
  private readonly stack: Frame[] = [];
  private rootComplete = false;
  private primitive = false;
  private string?: { key: boolean; path: Path; raw: string; decoded: string; sent: number };
  private escaped = false;
  private unicode = "";
  private unicodeRemaining = 0;
  private hasExplanation = false;
  private stringStarted = false;

  feed(fragment: string): string {
    let output = "";
    const emit = (): void => {
      const token = this.string;
      if (!token || token.key || !this.isExplanation(token.path)) return;
      let end = token.decoded.length;
      const last = token.decoded.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end--;
      if (end <= token.sent) return;
      if (!this.stringStarted) {
        if (this.hasExplanation) output += "\n\n";
        this.hasExplanation = true;
        this.stringStarted = true;
      }
      output += token.decoded.slice(token.sent, end);
      token.sent = end;
    };
    for (const character of fragment) {
      if (this.string) {
        const token = this.string;
        if (this.unicodeRemaining) {
          if (!/^[0-9a-f]$/i.test(character)) invalid();
          token.raw += character;
          this.unicode += character;
          if (--this.unicodeRemaining === 0) {
            token.decoded += String.fromCharCode(parseInt(this.unicode, 16));
            this.unicode = "";
          }
        } else if (this.escaped) {
          token.raw += character;
          this.escaped = false;
          if (character === "u") this.unicodeRemaining = 4;
          else {
            const escapes: Record<string, string> = {
              '"': '"',
              "\\": "\\",
              "/": "/",
              b: "\b",
              f: "\f",
              n: "\n",
              r: "\r",
              t: "\t",
            };
            if (!(character in escapes)) invalid();
            token.decoded += escapes[character];
          }
        } else if (character === "\\") {
          token.raw += character;
          this.escaped = true;
        } else if (character === '"') {
          emit();
          // JSON.parse checks string control characters and exact escaping.
          const decoded = JSON.parse('"' + token.raw + '"') as string;
          if (token.key) {
            const frame = this.stack[this.stack.length - 1];
            if (frame.keys.has(decoded))
              throw new ChatGatewayError("INVALID_RESPONSE", "DOC_DUPLICATE_KEY");
            frame.keys.add(decoded);
            frame.key = decoded;
            frame.phase = "colon";
          } else this.completeValue();
          this.string = undefined;
        } else {
          if (character.charCodeAt(0) < 32) invalid();
          token.raw += character;
          token.decoded += character;
        }
        continue;
      }
      if (this.primitive) {
        if (!/[\s,}\]]/.test(character)) continue;
        this.primitive = false;
        this.completeValue();
      }
      if (/\s/.test(character)) continue;
      const frame = this.stack[this.stack.length - 1];
      if (character === '"') {
        const key = frame?.kind === "object" && frame.phase === "key";
        const path = key ? [] : this.valuePath();
        this.string = { key, path, raw: "", decoded: "", sent: 0 };
        this.stringStarted = false;
      } else if (character === "{" || character === "[") {
        const path = this.valuePath();
        if (this.stack.length >= 32) invalid();
        this.stack.push({
          path,
          kind: character === "{" ? "object" : "array",
          phase: character === "{" ? "key" : "value",
          key: "",
          index: 0,
          keys: new Set(),
        });
      } else if (character === "}" || character === "]") {
        if (!frame || (character === "}") !== (frame.kind === "object")) invalid();
        if (frame.phase !== "comma" && frame.phase !== (frame.kind === "object" ? "key" : "value"))
          invalid();
        this.stack.pop();
        this.completeValue();
      } else if (character === ":") {
        if (frame?.phase !== "colon") invalid();
        frame.phase = "value";
      } else if (character === ",") {
        if (frame?.phase !== "comma") invalid();
        frame.phase = frame.kind === "object" ? "key" : "value";
      } else {
        this.valuePath();
        if (!/[-0-9tfn]/.test(character)) invalid();
        this.primitive = true;
      }
    }
    emit();
    return output;
  }

  finish(): void {
    if (!this.rootComplete || this.stack.length || this.string || this.primitive) invalid();
  }

  private valuePath(): Path {
    const frame = this.stack[this.stack.length - 1];
    if (!frame) {
      if (this.rootComplete) invalid();
      return [];
    }
    if (frame.phase !== "value") invalid();
    return [...frame.path, frame.kind === "object" ? frame.key : frame.index];
  }

  private completeValue(): void {
    const frame = this.stack[this.stack.length - 1];
    if (!frame) this.rootComplete = true;
    else {
      frame.phase = "comma";
      if (frame.kind === "array") frame.index++;
    }
  }

  private isExplanation(path: Path): boolean {
    return (
      (path.length === 1 && path[0] === "notice") ||
      (path.length === 3 &&
        path[0] === "claims" &&
        typeof path[1] === "number" &&
        path[2] === "text")
    );
  }
}
