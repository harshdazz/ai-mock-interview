import { test } from "node:test";
import assert from "node:assert/strict";
import { findQuote, normalise } from "../src/lib/ai/quotes.ts";

// Shaped like real Web Speech output: lower case, no punctuation, fillers,
// and a doubled word from a false start.
const TRANSCRIPT =
  "so um basically i would i would keep the filters in the url so you know the view survives a refresh and then for the widgets i'd use react query because it handles caching and the the loading states";

test("normalising ignores case, punctuation, fillers and repeated words", () => {
  assert.equal(normalise("So, UM -- I would I would keep... the filters!"), "so i would keep the filters");
  assert.equal(normalise("Don’t re-render"), "dont re render");
  assert.equal(normalise("café crème"), "cafe creme");
});

test("an exact quote is found and returned as the transcript says it", () => {
  assert.equal(
    findQuote("keep the filters in the url", TRANSCRIPT),
    "keep the filters in the url"
  );
});

test("a cleaned-up quote still matches the messy transcript", () => {
  // The model tidied case, punctuation, the filler and the false start.
  const found = findQuote("I would keep the filters in the URL, so the view survives a refresh.", TRANSCRIPT);
  // What is shown to the candidate is their own words, false start included,
  // not the model's tidied version.
  assert.equal(
    found,
    "i would i would keep the filters in the url so you know the view survives a refresh"
  );
});

test("a quote that starts before a repeated phrase still matches", () => {
  assert.equal(findQuote("so I would keep the filters", TRANSCRIPT), "so um basically i would i would keep the filters");
});

test("apostrophes and hyphens do not matter", () => {
  assert.ok(findQuote("I'd use React Query because it handles caching", TRANSCRIPT));
  assert.ok(findQuote("Id use React-Query", TRANSCRIPT));
});

test("a paraphrase is not found", () => {
  assert.equal(findQuote("I would store filter state in query parameters", TRANSCRIPT), null);
});

test("an invented claim is not found", () => {
  assert.equal(findQuote("I would profile with the React DevTools first", TRANSCRIPT), null);
});

test("words from different places cannot be stitched into one quote", () => {
  // Every word is in the transcript, but not consecutively.
  assert.equal(findQuote("the filters handle caching", TRANSCRIPT), null);
});

test("an ellipsis may skip material, but the parts must be in order", () => {
  assert.equal(
    findQuote("keep the filters in the url ... react query because it handles caching", TRANSCRIPT),
    "keep the filters in the url … react query because it handles caching"
  );
  assert.equal(findQuote("react query because it handles caching ... keep the filters in the url", TRANSCRIPT), null);
});

test("quotes too short to prove anything are rejected", () => {
  assert.equal(findQuote("the url", TRANSCRIPT), null);
  assert.equal(findQuote("", TRANSCRIPT), null);
  assert.equal(findQuote("um, you know", TRANSCRIPT), null);
});
