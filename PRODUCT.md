# Product

## Register

product

## Users

Job seekers preparing for technical interviews, mostly early-career developers
applying for frontend and full-stack roles.

Their context when using this: alone, usually evening, camera pointed at
themselves, a week or less before a real interview. They are nervous and
slightly embarrassed to be watching themselves speak. They are not browsing;
they came here to do one specific uncomfortable thing and get feedback on it.

The job to be done: rehearse answering out loud, and find out where the
answers are weak before an interviewer does.

## Product Purpose

Generate role-specific interview questions, capture spoken answers through the
webcam and speech-to-text, and return scored feedback per answer.

Success is a user who completes a full session out loud rather than reading
questions and skipping the speaking part. The speaking is the product. Anything
that makes the recording step feel high-stakes or clinical works against it.

## Brand Personality

Steady, specific, unsentimental. The voice of a good interviewer who tells you
the truth without making you feel small.

Three words: composed, candid, exacting.

Feedback names what was missing and what to say instead. It never congratulates
a weak answer and never delivers criticism as a verdict on the person.

## Anti-references

- Gamified learning apps. No streaks, badges, confetti, mascots, or celebration
  states. The user is preparing for something that matters to their income.
- Generic AI-SaaS chrome: indigo/violet gradients, glassmorphic cards, a hero
  metric row, an uppercase tracked eyebrow above every section.
- Clinical assessment tools that present a score as a judgment. Scores here are
  diagnostic, always attached to what to do about them.
- The default shadcn zinc look this project started from.

## Design Principles

1. **The camera is the interface.** During a session, the video feed and the
   question are the only things competing for attention. Controls recede until
   they are needed.
2. **Red means live, nothing else.** The brand color is a tally light. It marks
   recording state and the single primary action on a screen. It is never
   decorative and never signals failure.
3. **Scores are diagnostic, never verdicts.** Every rating ships with the
   specific gap and a concrete revision. No number appears alone.
4. **Lower the cost of starting.** The distance between opening the app and
   speaking the first answer should be as short as it can be. Setup, config,
   and explanation get out of the way.
5. **Never fake a result.** A failed AI call is shown as a failure with a retry,
   never as a zero score or an empty state pretending to be data.

## Accessibility & Inclusion

- Target WCAG 2.2 AA. All body text verified at 4.5:1, UI borders and controls
  at 3:1, verified numerically against the OKLCH tokens rather than eyeballed.
- Speech-to-text is the primary input, so a typed-answer fallback is required,
  not optional. Browser speech recognition has patchy support and fails on
  accents it was not trained for. A user who cannot dictate must still be able
  to complete a full session.
- Recording state must never be indicated by color alone. The tally light pairs
  with a text label and an elapsed timer.
- Full keyboard operation of the session controls. Users mid-answer should not
  have to find a mouse.
- `prefers-reduced-motion` honored throughout; the pulsing record indicator
  becomes static.
