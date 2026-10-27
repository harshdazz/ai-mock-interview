import { test } from "node:test";
import assert from "node:assert/strict";
import type { Generate, GenerateRequest } from "../src/lib/ai/gemini.ts";
import { gradeAnswer } from "../src/lib/ai/grading.ts";
import {
  alignVerdicts,
  describeGrade,
  scoreFromPoints,
  type KeyPointResult,
} from "../src/lib/ai/scoring.ts";

const POINTS = [
  "Keeps filter state in the URL",
  "Reads filters from the URL on first load",
  "Uses a discriminated union for widget state",
  "Profiles before optimising",
];

/** A stand-in for Gemini that replays canned responses and records requests. */
function fakeGenerate(...responses: unknown[]) {
  const requests: GenerateRequest[] = [];
  const generate = (async (request: GenerateRequest) => {
    requests.push(request);
    if (responses.length === 0) throw new Error("unexpected extra call");
    return responses.shift();
  }) as Generate;
  return { generate, requests };
}

const point = (covered: boolean): KeyPointResult => ({
  point: "p",
  covered,
  quote: covered ? "q" : "",
});

test("score is coverage out of ten, rounded", () => {
  assert.deepEqual(scoreFromPoints([point(true), point(true), point(true), point(false), point(false)]), {
    score: 6,
    covered: 3,
    total: 5,
  });
  assert.equal(scoreFromPoints([point(true), point(false), point(false), point(false)]).score, 3);
  assert.equal(scoreFromPoints([point(false), point(false), point(false), point(false)]).score, 0);
  assert.equal(scoreFromPoints([point(true), point(true), point(true), point(true)]).score, 10);
});

test("the same verdicts always produce the same score", () => {
  const verdicts = [
    { id: 1, quote: "we kept the filters in the query string", verdict: "covered" as const },
    { id: 2, quote: "", verdict: "missed" as const },
    { id: 3, quote: "a union of loading, error and success", verdict: "covered" as const },
    { id: 4, quote: "", verdict: "missed" as const },
  ];
  const scores = Array.from({ length: 5 }, () => scoreFromPoints(alignVerdicts(POINTS, verdicts)).score);
  assert.deepEqual(scores, [5, 5, 5, 5, 5]);
});

test("verdicts are matched by id, not by position", () => {
  const points = alignVerdicts(POINTS.slice(0, 2), [
    { id: 2, quote: "read them on load", verdict: "covered" },
    { id: 1, quote: "", verdict: "missed" },
  ]);
  assert.deepEqual(points, [
    { point: POINTS[0], covered: false, quote: "" },
    { point: POINTS[1], covered: true, quote: "read them on load" },
  ]);
});

test("a point the model skipped counts as missed", () => {
  const points = alignVerdicts(POINTS.slice(0, 2), [{ id: 1, quote: "in the url", verdict: "covered" }]);
  assert.equal(points[1].covered, false);
});

test("covered without a quote counts as missed: no evidence, no credit", () => {
  const [result] = alignVerdicts(POINTS.slice(0, 1), [{ id: 1, quote: "  ", verdict: "covered" }]);
  assert.deepEqual(result, { point: POINTS[0], covered: false, quote: "" });
});

test("a missed point never carries a quote into the feedback", () => {
  const [result] = alignVerdicts(POINTS.slice(0, 1), [{ id: 1, quote: "something", verdict: "missed" }]);
  assert.equal(result.quote, "");
});

test("the description names every missed point", () => {
  const text = describeGrade({
    score: 5,
    covered: 2,
    total: 4,
    points: POINTS.map((p, i) => ({ point: p, covered: i % 2 === 0, quote: i % 2 === 0 ? "x" : "" })),
    advice: "I put the filters in the URL so the view survives a reload.",
  });
  assert.equal(
    text,
    `Missed: ${POINTS[1]}; ${POINTS[3]}. What to say instead: I put the filters in the URL so the view survives a reload.`
  );
});

test("gradeAnswer sends the numbered key points and fixes the verdict count", async () => {
  const { generate, requests } = fakeGenerate({
    points: [
      { id: 1, quote: "filters live in the query string", verdict: "covered" },
      { id: 2, quote: "", verdict: "missed" },
      { id: 3, quote: "", verdict: "missed" },
      { id: 4, quote: "I profile first", verdict: "covered" },
    ],
    advice: "Explain what happens on a hard refresh.",
  });

  const grade = await gradeAnswer(generate, {
    question: "How do you share a filtered dashboard view?",
    modelAnswer: "Put the filters in the URL...",
    keyPoints: POINTS,
    answer: "so um the filters live in the query string and I profile first",
  });

  assert.equal(requests.length, 1);
  const prompt = (requests[0].parts[0] as { text: string }).text;
  POINTS.forEach((p, i) => assert.ok(prompt.includes(`${i + 1}. ${p}`)));
  const verdicts = (requests[0].schema.properties as Record<string, { minItems?: string; maxItems?: string }>).points;
  assert.equal(verdicts.minItems, "4");
  assert.equal(verdicts.maxItems, "4");

  assert.equal(grade.score, 5);
  assert.equal(grade.covered, 2);
  assert.deepEqual(
    grade.points.filter((p) => !p.covered).map((p) => p.point),
    [POINTS[1], POINTS[2]]
  );
});

test("a question without key points gets them derived first, then graded", async () => {
  const { generate, requests } = fakeGenerate(
    { keyPoints: ["A", "B", "C", "D"] },
    {
      points: [1, 2, 3, 4].map((id) => ({ id, quote: id === 1 ? "a" : "", verdict: id === 1 ? "covered" : "missed" })),
      advice: "Cover B.",
    }
  );

  const grade = await gradeAnswer(generate, {
    question: "Q",
    modelAnswer: "M",
    answer: "a",
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(grade.points.map((p) => p.point), ["A", "B", "C", "D"]);
  assert.equal(grade.score, 3);
});
