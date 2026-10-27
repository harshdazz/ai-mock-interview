import { test } from "node:test";
import assert from "node:assert/strict";
import { countRequest, type RateWindow } from "../worker/rate-window.ts";

const HOUR = 3600;

/** Replays a run of requests against one stored window. */
function replay(times: number[], limit: number) {
  let stored: RateWindow | undefined;
  return times.map((now) => {
    const { next, result } = countRequest(stored, now, limit, HOUR);
    if (next) stored = next;
    return result;
  });
}

test("allows up to the limit, then refuses with time until the window ends", () => {
  const results = replay([0, 1_000, 2_000, 3_000], 3);
  assert.deepEqual(
    results.map((r) => r.allowed),
    [true, true, true, false]
  );
  assert.deepEqual(
    results.map((r) => r.remaining),
    [2, 1, 0, 0]
  );
  // The window opened at t=0, so at t=3s there are 3597s left.
  assert.equal(results[3].retryAfterSeconds, 3597);
});

test("a refused request does not extend the window", () => {
  const results = replay([0, 10_000, 20_000, HOUR * 1000], 1);
  assert.deepEqual(
    results.map((r) => r.allowed),
    [true, false, false, true]
  );
});

test("a new window starts once the old one has fully elapsed", () => {
  const results = replay([0, 1, HOUR * 1000 - 1, HOUR * 1000], 2);
  assert.deepEqual(
    results.map((r) => r.allowed),
    [true, true, false, true]
  );
  assert.equal(results[3].remaining, 1);
});
