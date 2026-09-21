# Mock Interview

Practise technical interviews out loud. You describe the role you're going for,
upload your CV, and get five questions written for that specific job. You answer
them into your webcam, your speech is transcribed live, and each answer is scored
against a model answer with the specific gap named.

The point is the speaking. Reading interview questions and nodding along tells
you nothing about whether you can actually say the answer under pressure.

> **Live demo:** _not deployed yet_
> **Note:** the Gemini free tier allows 20 requests per model per day, so a
> public demo exhausts quickly. Run it locally with your own key.

---

## What makes it more than a question generator

**Questions are grounded in your actual CV.** Upload a PDF and the questions
stop being about React in the abstract and start being about what you claim you
did:

| Without a CV | With a CV |
| --- | --- |
| "In a logistics dashboard, real-time data visualization is often critical. How would you handle..." | "You replaced a polling loop with a WebSocket feed for live vehicle positions, saving around 40k requests a day. How did..." |

You can't answer the second one from memorised theory. Measured across a test
run, four of five questions cite specific claims from the CV.

**The CV is read natively by Gemini.** The PDF goes to the API as inline base64,
so there's no `pdf.js` in the bundle and no text-extraction step to get wrong.

**Scores always come with a diagnosis.** There's deliberately no way to render a
bare number: a rating without the gap it refers to reads as a verdict on the
person rather than something to act on.

---

## Stack

React 19 · TypeScript 5.8 · Vite 7 · Tailwind 3.4 with shadcn/Radix primitives
· Firebase Auth and Firestore · Google Gemini via
`@google/genai` · Web Speech API · `react-webcam`

---

## Running it locally

```bash
git clone https://github.com/harshdazz/ai-mock-interview.git
cd ai-mock-interview
pnpm install
cp .env.example .env    # then fill it in, see below
pnpm dev
```

### Environment

Every key is free-tier. `.env.example` lists all seven with links.

| Variable | Where it comes from |
| --- | --- |
| `VITE_GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `VITE_FIREBASE_*` (6 keys) | [Firebase console](https://console.firebase.google.com) → web app config |

In the Firebase console: enable **Email/Password** and **Google** under
Authentication → Sign-in method, and create a **Firestore** database. Grant
camera and microphone permission when the browser asks.

The security rules live in this repo rather than only in the console, so they
are reviewable and deploy with the app:

```bash
firebase deploy --only firestore:rules
```

### Deploying

```bash
pnpm deploy          # builds, then deploys hosting and Firestore rules
```

Hosting config is in [`firebase.json`](./firebase.json). Every path rewrites to
`index.html`, because the router is client-side and a hard refresh on
`/generate/interview/abc` would otherwise 404. Hashed assets are cached for a
year and `index.html` is not, so a deploy takes effect immediately.

Auth is Firebase's rather than a third-party provider's on purpose: it makes
`request.auth.uid` real inside Firestore rules, so per-user access control needs
no token exchange, no backend and no service-account key.

### Scripts

| | |
| --- | --- |
| `pnpm dev` | Dev server on :5173 |
| `pnpm build` | Typecheck and production build |
| `pnpm lint` | ESLint |
| `pnpm preview` | Serve the built output |

---

## How it's put together

```
src/
  lib/ai/          Gemini layer: client, schemas, prompts, CV extraction
  components/
    session/       TallyLight, LiveTranscript, ScoreDial
  hooks/           useResume
  providers/       auth (Firebase), theme
  Routes/          Pages
  config/          Firebase
```

**`src/lib/ai/client.ts`** is where the interesting decisions live. Three things
it handles that were not obvious up front:

- **Structured output.** The API is given a response schema, so there's no
  markdown fence to strip and no JSON array to find with a regex.
- **A measured model chain.** Gemini's free tier is 20 requests *per model per
  day*, so the chain exists to buy quota, not just redundancy. Availability was
  measured rather than assumed: at time of writing `gemini-3.5-flash` was the
  most reliable, while newer flash models load-shed heavily.
- **429 and 503 are handled differently.** A 429 means that model's daily
  allowance is spent and will not recover inside a request, so it moves straight
  to the next model. A 503 is transient and worth one retry. Treating them the
  same burned six requests on a guaranteed failure.

**Thinking is disabled for question generation.** Measured 18.7s at the default
automatic budget against 10.8s with it off, for output of the same length and
quality. Grading keeps a small budget, since that one is a judgement call.

---

## Known limitations

- **The Gemini key ships in the client bundle.** Anything prefixed `VITE_` is
  compiled into the JS and readable in devtools. A serverless proxy is the
  correct fix; restricting the key by HTTP referrer is the stopgap.
- **Speech recognition is Chrome-only** in practice. Other browsers fall back to
  a typed answer, which is fully supported but not the point of the exercise.
- **One JS chunk, ~320 kB gzipped.** Firebase dominates it. Route-level
  code splitting is the obvious next step.
- **Free-tier quota** works out to roughly 14 full interviews per day.

---

## Credit

The project began as a rebuild of a
[React interview-prep tutorial](https://github.com/Mahalakshmi-Design-Studioz/ai-mock-interview-react-vite-typescript-january-2025)
by Mahalakshmi Design Studioz, and has since been substantially rewritten:
migrated to React 19 and the current `@google/genai` SDK with structured output,
rebuilt on a verified OKLCH design system, and extended with CV-driven question
generation, a typed-answer mode, and the retry and quota handling described
above.
