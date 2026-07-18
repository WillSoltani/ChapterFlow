/**
 * s16-rubric-audit-v1 — python-compatible canonical JSON hashing.
 *
 * The owner's audit chain hashes records with python
 * `json.dumps(ensure_ascii=False, sort_keys=True, separators=(",", ":"))` over
 * PARSED values, where float identity survives parsing: `3.0` stays a float and
 * re-serializes as `3.0`, while JS `JSON.parse` collapses it to `3`. Hashing a
 * plain-parsed record therefore diverges on every whole-number float (proven
 * against the sealed 2026-07-15 run: dispatch receipts matched, result records
 * with `x.0` floats did not). This module re-serializes from the RAW record
 * text with number-lexeme fidelity: a number token containing `.`/`e` is a
 * python float (integral values render `X.0`), a bare-integer token renders as
 * an integer. Number formats outside the range this port is proven for
 * (|x| >= 1e16, or non-integral |x| < 1e-4) throw rather than mis-hash.
 */

import { sha256Hex } from "../../contracts/contractUtil.js";

export class RubricAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricAuditError";
  }
}

class PyNum {
  constructor(
    readonly value: number,
    readonly isFloat: boolean,
  ) {}
}

export type PyTree = null | boolean | string | PyNum | PyTree[] | { [key: string]: PyTree };

class Parser {
  private pos = 0;
  constructor(private readonly text: string) {}

  parse(): PyTree {
    const value = this.parseValue();
    this.skipWs();
    if (this.pos !== this.text.length) throw new RubricAuditError("canonical parse: trailing content");
    return value;
  }

  private skipWs(): void {
    while (this.pos < this.text.length && " \t\n\r".includes(this.text[this.pos])) this.pos += 1;
  }

  private parseValue(): PyTree {
    this.skipWs();
    const ch = this.text[this.pos];
    if (ch === "{") return this.parseObject();
    if (ch === "[") return this.parseArray();
    if (ch === '"') return this.parseString();
    if (ch === "t" || ch === "f" || ch === "n") return this.parseLiteral();
    return this.parseNumber();
  }

  private expect(ch: string): void {
    if (this.text[this.pos] !== ch) {
      throw new RubricAuditError(`canonical parse: expected '${ch}' at ${this.pos}`);
    }
    this.pos += 1;
  }

  private parseObject(): { [key: string]: PyTree } {
    this.expect("{");
    const out: { [key: string]: PyTree } = {};
    this.skipWs();
    if (this.text[this.pos] === "}") { this.pos += 1; return out; }
    for (;;) {
      this.skipWs();
      const key = this.parseString();
      this.skipWs();
      this.expect(":");
      out[key] = this.parseValue();
      this.skipWs();
      if (this.text[this.pos] === ",") { this.pos += 1; continue; }
      this.expect("}");
      return out;
    }
  }

  private parseArray(): PyTree[] {
    this.expect("[");
    const out: PyTree[] = [];
    this.skipWs();
    if (this.text[this.pos] === "]") { this.pos += 1; return out; }
    for (;;) {
      out.push(this.parseValue());
      this.skipWs();
      if (this.text[this.pos] === ",") { this.pos += 1; continue; }
      this.expect("]");
      return out;
    }
  }

  private parseString(): string {
    const start = this.pos;
    this.expect('"');
    while (this.pos < this.text.length) {
      const ch = this.text[this.pos];
      if (ch === "\\") { this.pos += 2; continue; }
      if (ch === '"') {
        this.pos += 1;
        return JSON.parse(this.text.slice(start, this.pos)) as string;
      }
      this.pos += 1;
    }
    throw new RubricAuditError("canonical parse: unterminated string");
  }

  private parseLiteral(): PyTree {
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (this.text.startsWith(literal, this.pos)) {
        this.pos += literal.length;
        return value;
      }
    }
    throw new RubricAuditError(`canonical parse: bad literal at ${this.pos}`);
  }

  private parseNumber(): PyNum {
    const match = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.text.slice(this.pos));
    if (!match || match[0].length === 0) {
      throw new RubricAuditError(`canonical parse: bad number at ${this.pos}`);
    }
    this.pos += match[0].length;
    const isFloat = match[1] !== undefined || match[2] !== undefined;
    return new PyNum(Number(match[0]), isFloat);
  }
}

export function parsePyTree(text: string): PyTree {
  return new Parser(text).parse();
}

function pyNumberRepr(num: PyNum): string {
  const { value, isFloat } = num;
  if (!Number.isFinite(value)) throw new RubricAuditError("canonical serialize: non-finite number");
  if (!isFloat) {
    if (!Number.isSafeInteger(value)) throw new RubricAuditError("canonical serialize: unsafe integer");
    return String(value);
  }
  if (Object.is(value, -0)) return "-0.0";
  if (Number.isInteger(value)) {
    if (Math.abs(value) >= 1e16) throw new RubricAuditError("canonical serialize: float magnitude beyond proven range");
    return `${value}.0`;
  }
  // Non-integral floats: JS shortest repr equals python repr inside the proven
  // range; python switches to exponent notation below 1e-4 where JS does not.
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e16) {
    throw new RubricAuditError("canonical serialize: float outside proven repr range");
  }
  const repr = String(value);
  if (repr.includes("e") || repr.includes("E")) {
    throw new RubricAuditError("canonical serialize: exponent repr outside proven range");
  }
  return repr;
}

function serialize(tree: PyTree, out: string[]): void {
  if (tree === null) { out.push("null"); return; }
  if (typeof tree === "boolean") { out.push(tree ? "true" : "false"); return; }
  if (typeof tree === "string") { out.push(JSON.stringify(tree)); return; }
  if (tree instanceof PyNum) { out.push(pyNumberRepr(tree)); return; }
  if (Array.isArray(tree)) {
    out.push("[");
    tree.forEach((item, index) => {
      if (index > 0) out.push(",");
      serialize(item, out);
    });
    out.push("]");
    return;
  }
  out.push("{");
  Object.keys(tree).sort().forEach((key, index) => {
    if (index > 0) out.push(",");
    out.push(JSON.stringify(key), ":");
    serialize(tree[key], out);
  });
  out.push("}");
}

export function canonicalPyJson(tree: PyTree): string {
  const out: string[] = [];
  serialize(tree, out);
  return out.join("");
}

/** Canonical sha256 of a JSON document's RAW TEXT with python float fidelity —
 *  equals python `artifact_sha256(json.loads(text))`. */
export function artifactSha256FromText(text: string): string {
  return sha256Hex(Buffer.from(canonicalPyJson(parsePyTree(text)), "utf8"));
}

/** Judgment hash: the result minus its dispatch-binding keys (python
 *  `judgment_sha256`), computed with the same float fidelity. */
export function judgmentSha256FromText(text: string): string {
  const tree = parsePyTree(text);
  if (tree === null || typeof tree !== "object" || Array.isArray(tree) || tree instanceof PyNum) {
    throw new RubricAuditError("judgment hash requires a top-level object record");
  }
  const judgment: { [key: string]: PyTree } = {};
  for (const key of Object.keys(tree)) {
    if (key === "run_id" || key === "job_id" || key === "rater_role" || key === "worker_dispatch_receipt_sha256") continue;
    judgment[key] = tree[key];
  }
  return sha256Hex(Buffer.from(canonicalPyJson(judgment), "utf8"));
}
