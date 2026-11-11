#!/usr/bin/env node
// Is every rule taught? Reads the rule ids from RULES.md (the first cell of each table row) and the coverage table
// in TUTORIAL.md (a "## Coverage" section: | rule ids | shown / explained / skip | step id or reason |), and fails
// on any rule the table doesn't mention, any row whose how isn't one of the three, and any shown/explained row that
// names no step. Ids in a row may be a list ("P3.1, P3.2") or a range within one prefix ("C1–C10", "P6P.1-P6P.4").
// Rulings (Q-…) are answers about rules, not rules, and are not counted.
//   node scripts/tutorial/coverage.mjs [RULES.md] [TUTORIAL.md]
import { readFileSync } from "node:fs";

const [rulesPath = "RULES.md", tutorialPath = "TUTORIAL.md"] = process.argv.slice(2);
const ID = /^[A-Z][A-Z0-9]*(?:\.[0-9]+)?$/; // C1, P3S.1, P6P.10: capitals and digits, at least one digit
const firstCell = (line) => line.split("|")[1]?.trim() ?? "";

const rules = [];
for (const line of readFileSync(rulesPath, "utf8").split("\n")) {
  if (!line.startsWith("|")) continue;
  const id = firstCell(line);
  if (ID.test(id) && /\d/.test(id)) rules.push(id);
}

/** "C1–C10" → C1…C10; "P6P.1-P6P.4" or "P6P.1–4" → P6P.1…P6P.4; anything else as written */
function expand(token) {
  const m = /^(.*?)(\d+)\s*[–-]\s*(.*?)(\d+)$/.exec(token);
  if (!m) return [token];
  const [, prefix, a, prefix2, b] = m;
  if (prefix2 && prefix2 !== prefix) return [token];
  const out = [];
  for (let n = Number(a); n <= Number(b); n++) out.push(`${prefix}${n}`);
  return out;
}

const text = readFileSync(tutorialPath, "utf8");
const at = text.search(/^## Coverage\b/m);
if (at < 0) {
  console.error(`${tutorialPath} has no "## Coverage" section: list how the lesson covers every rule in ${rulesPath}.`);
  process.exit(1);
}
const section = text.slice(at).split(/\n## /)[0];
const covered = new Map();
const problems = [];
for (const line of section.split("\n")) {
  if (!line.startsWith("|") || /^\|\s*-/.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  const [ids, how, where] = cells;
  if (!ids || ids.toLowerCase() === "rule" || ids.toLowerCase() === "rules") continue;
  const kind = (how ?? "").toLowerCase().split(/[\s,(]/)[0];
  if (!["shown", "explained", "skip"].includes(kind)) problems.push(`${ids}: "${how}" is not shown, explained or skip`);
  if (kind !== "skip" && !where) problems.push(`${ids}: ${kind}, but in which step?`);
  if (kind === "skip" && !where) problems.push(`${ids}: skipped without a reason`);
  for (const token of ids.split(/,\s*/)) for (const id of expand(token)) covered.set(id, kind);
}
const missing = rules.filter((id) => !covered.has(id));
const unknown = [...covered.keys()].filter((id) => !rules.includes(id));
for (const id of unknown) problems.push(`${id} is in the coverage table but not in ${rulesPath}`);
const count = (k) => rules.filter((id) => covered.get(id) === k).length;
console.log(`${rules.length} rules: ${count("shown")} shown, ${count("explained")} explained, ${count("skip")} skipped, ${missing.length} not covered.`);
if (missing.length) console.log(`Not covered: ${missing.join(", ")}`);
for (const p of problems) console.log(p);
process.exit(missing.length || problems.length ? 1 : 0);
