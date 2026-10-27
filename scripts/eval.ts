/**
 * `pnpm eval`: the golden-set eval.
 *
 * Runs the real grading code (gradeAnswer in src/lib/ai/grading.ts, the same
 * function the worker calls) against the answers in evals/golden.json, whose
 * right score is known, and fails if any lands outside its expected range.
 *
 * It calls Gemini for real, so a run costs quota: two requests per case that
 * earns any credit (the grade, then the support check), one for a case that
 * earns none, and one more whenever a quote needs its retry. The free tier
 * allows about 20 requests per model per day; the grade and the support check
 * start on different models, so one full run fits in a day.
 *
 *   pnpm eval               run every case
 *   pnpm eval --only q3     run cases whose id starts with q3 (comma-separate several)
 *   pnpm eval --list        print the cases and the cost, call nothing
 *
 * Exit code 0 when every case passes, 1 when any fails or errors, 2 when it
 * cannot start (no key, bad fixture file).
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { AiError } from "../src/lib/ai/errors.ts";
import { createGemini } from "../src/lib/ai/gemini.ts";
import { gradeAnswer } from "../src/lib/ai/grading.ts";
import type { AnswerGrade } from "../src/lib/ai/scoring.ts";

const score = z.number().int().min(0).max(10);

const Golden = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        modelAnswer: z.string(),
        keyPoints: z.array(z.string()).min(4).max(6),
        cases: z
          .array(
            z.object({
              kind: z.enum(["strong", "average", "weak", "injection"]),
              expected: z.tuple([score, score]),
              answer: z.string().min(1),
            })
          )
          .min(1),
      })
    )
    .min(1),
});

const { values: args } = parseArgs({
  options: { only: { type: "string" }, list: { type: "boolean" } },
});

let golden: z.infer<typeof Golden>;
try {
  golden = Golden.parse(
    JSON.parse(readFileSync(new URL("../evals/golden.json", import.meta.url), "utf8"))
  );
} catch (error) {
  console.error("evals/golden.json is not valid:", error instanceof Error ? error.message : error);
  process.exit(2);
}

const all = golden.questions.flatMap((question) =>
  question.cases.map((c) => ({ id: `${question.id}/${c.kind}`, question, ...c }))
);
const prefixes = args.only?.split(",").map((p) => p.trim()).filter(Boolean);
const cases = prefixes ? all.filter((c) => prefixes.some((p) => c.id.startsWith(p))) : all;

if (cases.length === 0) {
  console.error(`No case id starts with ${args.only}. Ids: ${all.map((c) => c.id).join(", ")}`);
  process.exit(2);
}

const range = ([low, high]: [number, number]) => (low === high ? `${low}` : `${low}–${high}`);

if (args.list) {
  for (const c of cases) console.log(`${c.id.padEnd(22)} expects ${range(c.expected)}`);
  console.log(
    `\n${cases.length} cases. A run makes about ${cases.length * 2} Gemini requests: up to 2 per case, plus 1 for any quote retry.`
  );
  process.exit(0);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Put it in .env (see .env.example); pnpm eval reads it from there.");
  process.exit(2);
}

// Count what the run actually spent. Failed attempts (a 503 that fell through
// to the next model, a timeout) are counted apart from the requests that
// returned an answer.
const served = new Map<string, number>();
let failedAttempts = 0;
const generate = createGemini(apiKey, {
  onAttempt: ({ model, error }) => {
    if (error) failedAttempts++;
    else served.set(model, (served.get(model) ?? 0) + 1);
  },
});

/** What the quote and support checks did, only where they did something. */
function checks(v: AnswerGrade["verification"]): string {
  const parts = [
    v.retried && `${v.retried} retried`,
    v.dropped && `${v.dropped} dropped`,
    v.unsupported && `${v.unsupported} unsupported`,
    !v.supportChecked && "support not checked",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
}

const columns = [24, 8, 7, 11, 26];
const row = (cells: string[]) => cells.map((cell, i) => cell.padEnd(columns[i] ?? 0)).join("").trimEnd();

console.log(`Golden-set eval: ${cases.length} cases against gradeAnswer (src/lib/ai/grading.ts)\n`);
console.log(row(["case", "expect", "score", "points", "checks", "result"]));

const started = Date.now();
let failures = 0;

for (const c of cases) {
  try {
    const grade = await gradeAnswer(generate, {
      question: c.question.question,
      modelAnswer: c.question.modelAnswer,
      keyPoints: c.question.keyPoints,
      answer: c.answer,
    });
    const [low, high] = c.expected;
    const pass = grade.score >= low && grade.score <= high;
    if (!pass) failures++;
    const marks = grade.points.map((p) => (p.covered ? "✓" : "·")).join("");
    console.log(
      row([c.id, range(c.expected), String(grade.score), marks, checks(grade.verification), pass ? "pass" : "FAIL"])
    );
  } catch (error) {
    failures++;
    const reason =
      error instanceof AiError ? `${error.kind}: ${error.message}` : error instanceof Error ? error.message : String(error);
    console.log(row([c.id, range(c.expected), "-", "", "", `ERROR ${reason.slice(0, 120)}`]));
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
const requests = [...served.values()].reduce((sum, n) => sum + n, 0);
const byModel = [...served].map(([model, n]) => `${n} ${model}`).join(", ");

console.log(
  `\n${cases.length - failures} passed, ${failures} failed in ${Math.floor(seconds / 60)}m ${seconds % 60}s.`
);
console.log(
  `Gemini: ${requests} requests answered${byModel ? ` (${byModel})` : ""}, ${failedAttempts} failed attempts that fell through to another model.`
);

process.exitCode = failures > 0 ? 1 : 0;
