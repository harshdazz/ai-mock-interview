import { test } from "node:test";
import assert from "node:assert/strict";
import { assessAnswer, type CvCheck, type FollowUp } from "../src/lib/ai/followup.ts";
import type { Generate, GenerateRequest } from "../src/lib/ai/gemini.ts";
import type { ResumeProfile } from "../src/lib/ai/resume.ts";

const textOf = (request: GenerateRequest) =>
  request.parts.map((p) => ("text" in p ? p.text : "")).join("");

const has = (request: GenerateRequest, field: string) => field in (request.schema.properties ?? {});

const KEY_POINTS = [
  "Replaced polling with a WebSocket feed",
  "Explains how reconnects are handled",
  "Explains how the request saving was measured",
  "Mentions backpressure when updates arrive faster than rendering",
];

const ANSWER =
  "so we were polling every two seconds for vehicle positions and I replaced that with a websocket feed so the server pushes updates instead";

const RESUME: ResumeProfile = {
  currentRole: "Frontend Engineer",
  yearsExperience: 2,
  techStack: ["React", "TypeScript"],
  projects: [],
  talkingPoints: ["Replaced a polling loop with a WebSocket feed, saving around 40k requests a day"],
};

const INPUT = {
  question: "You replaced polling with a WebSocket feed. How did that work?",
  modelAnswer: "M",
  keyPoints: KEY_POINTS,
  answer: ANSWER,
};

const GRADE_TWO_OF_FOUR = {
  points: [
    { id: 1, quote: "I replaced that with a websocket feed", verdict: "covered" },
    { id: 2, quote: "", verdict: "missed" },
    { id: 3, quote: "", verdict: "missed" },
    { id: 4, quote: "", verdict: "missed" },
  ],
  advice: "",
};

const GRADE_ALL = {
  points: KEY_POINTS.map((_, i) => ({ id: i + 1, quote: "I replaced that with a websocket feed", verdict: "covered" })),
  advice: "",
};

const CV_PARTLY: CvCheck = {
  claim: "Replaced a polling loop with a WebSocket feed, saving around 40k requests a day",
  quote: "I replaced that with a websocket feed",
  verdict: "partly",
  gap: "how the 40k requests a day was measured",
};

const FOLLOW_UP: FollowUp = {
  target: "CV claim not yet backed up",
  reason: "cv_claim",
  question: "You mentioned saving about 40k requests a day. How did you measure that?",
};

/**
 * A fake model that answers each kind of call by its schema, and records the
 * order calls start in so parallelism can be checked.
 */
function fakeModel({
  grade = GRADE_TWO_OF_FOUR as unknown,
  cv = CV_PARTLY as CvCheck | Error,
  followUp = FOLLOW_UP as FollowUp | Error,
} = {}) {
  const calls: { kind: string; request: GenerateRequest }[] = [];
  let cvStartedDuringGrade = false;

  const generate = (async (request: GenerateRequest) => {
    if (has(request, "claim")) {
      calls.push({ kind: "cv", request });
      if (cv instanceof Error) throw cv;
      return cv;
    }
    if (has(request, "target")) {
      calls.push({ kind: "followUp", request });
      if (followUp instanceof Error) throw followUp;
      return followUp;
    }
    if (has(request, "checks")) {
      calls.push({ kind: "support", request });
      const ids = [...textOf(request).matchAll(/^(\d+)\. Point:/gm)].map((m) => Number(m[1]));
      return { checks: ids.map((id) => ({ id, reason: "", supports: true })) };
    }
    calls.push({ kind: "grade", request });
    // Give a parallel CV check the chance to start before the grade returns.
    await new Promise((resolve) => setTimeout(resolve, 20));
    cvStartedDuringGrade = calls.some((c) => c.kind === "cv");
    return grade;
  }) as Generate;

  return { generate, calls, cvStartedDuringGrade: () => cvStartedDuringGrade };
}

test("the grade and the CV claim check run in parallel", async () => {
  const model = fakeModel();
  await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.ok(model.cvStartedDuringGrade(), "the CV check started before the grade came back");
});

test("both results feed one follow-up prompt, CV gap first", async () => {
  const model = fakeModel();
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });

  const followUpCalls = model.calls.filter((c) => c.kind === "followUp");
  assert.equal(followUpCalls.length, 1);
  const gaps = textOf(followUpCalls[0].request);
  const cvAt = gaps.indexOf("CV claim not yet backed up");
  const missedAt = gaps.indexOf(`Key point not made: ${KEY_POINTS[1]}`);
  assert.ok(cvAt !== -1 && missedAt !== -1 && cvAt < missedAt);
  KEY_POINTS.slice(1).forEach((p) => assert.ok(gaps.includes(p)));

  assert.equal(result.grade.score, 3);
  assert.equal(result.cv?.verdict, "partly");
  assert.equal(result.followUp?.question, FOLLOW_UP.question);
});

test("the CV check runs on the light tier; the follow-up on the main one", async () => {
  const model = fakeModel();
  await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(model.calls.find((c) => c.kind === "cv")?.request.tier, "light");
  assert.equal(model.calls.find((c) => c.kind === "followUp")?.request.tier, undefined);
});

test("nothing missed and the CV claim backed: no follow-up, no extra call", async () => {
  const model = fakeModel({ grade: GRADE_ALL, cv: { ...CV_PARTLY, verdict: "backed", gap: "" } });
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(result.followUp, null);
  assert.ok(!model.calls.some((c) => c.kind === "followUp"));
});

test("without a CV there is no CV check, and missed points still get a follow-up", async () => {
  const model = fakeModel();
  const result = await assessAnswer(model.generate, INPUT);
  assert.ok(!model.calls.some((c) => c.kind === "cv"));
  assert.equal(result.cv, null);
  assert.ok(!textOf(model.calls.find((c) => c.kind === "followUp")!.request).includes("CV claim"));
});

test("a CV verdict in the candidate's favour needs a quote that is really there", async () => {
  const model = fakeModel({
    grade: GRADE_ALL,
    cv: { ...CV_PARTLY, verdict: "backed", quote: "we measured it in grafana", gap: "" }, // never said
  });
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(result.cv?.verdict, "not_backed");
  assert.ok(result.followUp, "an unbacked claim earns a follow-up even with every key point made");
});

test("a CV quote that is there is shown in the transcript's own words", async () => {
  const model = fakeModel({ cv: { ...CV_PARTLY, quote: "I replaced that with a WebSocket feed." } });
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(result.cv?.quote, "I replaced that with a websocket feed");
});

test("if the CV check fails, the grade and a follow-up still come back", async () => {
  const model = fakeModel({ cv: new Error("every model busy") });
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(result.cv, null);
  assert.equal(result.grade.score, 3);
  assert.ok(result.followUp);
});

test("if the follow-up writer fails, the grade still comes back", async () => {
  const model = fakeModel({ followUp: new Error("every model busy") });
  const result = await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  assert.equal(result.followUp, null);
  assert.equal(result.grade.score, 3);
});

test("the CV and the answer are fenced data in both new prompts", async () => {
  const model = fakeModel();
  await assessAnswer(model.generate, { ...INPUT, resume: RESUME });
  for (const kind of ["cv", "followUp"]) {
    const { request } = model.calls.find((c) => c.kind === kind)!;
    assert.ok(!request.system.includes("vehicle positions"), `${kind}: answer kept out of the system prompt`);
    assert.ok(!request.system.includes("40k"), `${kind}: CV kept out of the system prompt`);
    assert.match(request.system, /ends in _[0-9a-f]{12}/);
  }
});
