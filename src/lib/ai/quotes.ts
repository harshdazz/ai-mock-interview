/**
 * Checks that a quote the model attributes to the candidate is actually in
 * their transcript.
 *
 * The model is asked to copy words verbatim, but the transcript comes from
 * speech-to-text: no reliable casing or punctuation, filler words, repeated
 * words from false starts. A model quoting "I'd use a cache" for "i'd um use
 * use a cache" has quoted faithfully, so both sides are normalised the same
 * way before comparing. What survives normalisation must then appear as one
 * run of consecutive words. Paraphrase does not survive, which is the point:
 * a claim the candidate never made cannot be backed by a quote they never said.
 *
 * No imports, so the browser, the worker and tests can all use it.
 */

/** Words that carry no meaning in speech and that a quote may leave out. */
const FILLER_WORDS = new Set([
  "um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "mm", "mhm",
  "like", "basically", "actually", "literally",
]);

const FILLER_PHRASES = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
];

/** Below this a quote proves little: "the cache" appears in most answers. */
export const MIN_QUOTE_WORDS = 3;

interface Token {
  word: string;
  /** Offsets into the original text, so a match can be shown as spoken. */
  start: number;
  end: number;
}

/** Lower-case, accents stripped, apostrophes dropped ("don't" == "dont"). */
const fold = (word: string) =>
  word.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/['’]/g, "");

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  // Letters and digits, with internal apostrophes kept as part of the word.
  // Everything else (punctuation, hyphens, dots in "React.memo") splits.
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) {
    tokens.push({ word: fold(match[0]), start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/** False starts repeat a word or a short phrase: "I I think", "I would I would". */
const MAX_REPEAT_WORDS = 3;

/** Length of a run starting at `i` that repeats the last words kept, or 0. */
function repeatAt(tokens: Token[], i: number, kept: Token[]): number {
  for (let n = MAX_REPEAT_WORDS; n >= 1; n--) {
    if (kept.length < n || i + n > tokens.length) continue;
    const tail = kept.slice(-n);
    if (tail.every((t, j) => t.word === tokens[i + j].word)) return n;
  }
  return 0;
}

/** Drops fillers and the repeats left by false starts. */
function clean(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const phrase = FILLER_PHRASES.find((p) => p.every((w, j) => tokens[i + j]?.word === w));
    if (phrase) {
      i += phrase.length - 1;
      continue;
    }
    if (FILLER_WORDS.has(tokens[i].word)) continue;
    const repeat = repeatAt(tokens, i, out);
    if (repeat > 0) {
      i += repeat - 1;
      continue;
    }
    out.push(tokens[i]);
  }
  return out;
}

/** The comparable form of a text, exposed for tests and debugging. */
export const normalise = (text: string) =>
  clean(tokenise(text))
    .map((t) => t.word)
    .join(" ");

function indexOfRun(haystack: Token[], needle: Token[], from: number): number {
  outer: for (let i = from; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j].word !== needle[j].word) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Finds `quote` in `transcript` and returns the transcript's own text for it,
 * fillers and all, or null if it is not there.
 *
 * A quote may skip material with an ellipsis ("I'd cache it ... in Redis");
 * each part must then appear in order. The parts are returned joined by " … ".
 */
export function findQuote(quote: string, transcript: string): string | null {
  const parts = quote
    .split(/\.{3}|…/)
    .map((part) => clean(tokenise(part)))
    .filter((part) => part.length > 0);
  const wordCount = parts.reduce((sum, part) => sum + part.length, 0);
  if (wordCount < MIN_QUOTE_WORDS) return null;

  const spoken = clean(tokenise(transcript));
  const found: string[] = [];
  let from = 0;
  for (const part of parts) {
    const at = indexOfRun(spoken, part, from);
    if (at === -1) return null;
    const last = spoken[at + part.length - 1];
    found.push(transcript.slice(spoken[at].start, last.end));
    from = at + part.length;
  }
  return found.join(" … ");
}
