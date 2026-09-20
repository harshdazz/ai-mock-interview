# Design

## Theme

Dark. Not by default and not for the aesthetic.

The scene: one person, evening, a laptop, a camera pointed at their own face.
A bright white interface in a dim room turns the screen into a mirror and makes
the user watch themselves under a floodlight. A dark ground lets the video feed
be the brightest object on screen, which is where attention belongs, and takes
the edge off the self-consciousness that stops people speaking out loud.

The reference is a recording booth, not a dashboard.

## Color

**Strategy: restrained.** Tinted dark neutrals carry the surface; one saturated
color appears on under 10% of any screen.

The brand color is a **tally light**. In a studio, red means you are live. So
red marks exactly two things: recording state, and the single primary action on
a screen. It is never used for decoration, never for section accents, and never
for errors (errors are amber or plain ink, because a user mid-answer must not
confuse "you are recording" with "something broke").

All values OKLCH. Verified numerically, not by eye.

| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--bg` | `0.145 0.008 0` | `#0d090a` | Page ground |
| `--surface` | `0.196 0.009 0` | `#191315` | Panels, cards |
| `--surface-2` | `0.243 0.010 0` | `#241e20` | Hover, elevated |
| `--border` | `0.300 0.010 0` | `#322c2e` | Dividers, quiet edges |
| `--border-strong` | `0.480 0.012 0` | `#645b5d` | Input and control borders |
| `--ink` | `0.967 0.003 0` | `#f6f3f4` | Primary text |
| `--ink-muted` | `0.740 0.010 0` | `#b1a8aa` | Secondary text |
| `--ink-faint` | `0.620 0.010 0` | `#8c8486` | Placeholders, metadata |
| `--primary` | `0.550 0.200 8` | `#c9235b` | Primary action, button fill |
| `--live` | `0.660 0.200 8` | `#f14e7b` | Recording indicator |
| `--success` | `0.700 0.150 150` | `#4cb86a` | Strong scores |
| `--warning` | `0.780 0.150 75` | `#efa831` | Weak scores, errors |

Neutrals are tinted 0.008-0.012 chroma toward the brand hue (0 deg), so the
greys belong to this palette rather than reading as stock zinc.

`--primary` and `--live` are two steps of one hue with different jobs: the
deeper step carries white label text at 5.41:1, the brighter step stays legible
as an indicator on the dark ground at 5.76:1. One would not do both.

### Verified contrast

Against `--bg`: ink 17.99, ink-muted 8.55, ink-faint 5.41, live 5.76,
success 7.88, warning 9.69, border-strong 3.01.
Against `--surface`: ink 16.61, ink-muted 7.89, ink-faint 5.00, live 5.32.
White on `--primary`: 5.41. Every token is in sRGB gamut.

Note that `--ink-faint` clears 4.5:1, so placeholder text meets body contrast
rather than the usual unreadable grey.

## Typography

Two families on a contrast axis, plus mono for measurements.

- **Display / headings:** a humanist sans with real weight range, set tight
  (-0.02em at display sizes, floor -0.04em).
- **Body:** the same family at regular weight. Hierarchy comes from scale and
  weight contrast, not from a second typeface competing for attention.
- **Mono:** timers, elapsed time, word-per-minute readouts, scores. Anything
  that is a measurement is set in mono so numbers stop shifting width as they
  tick.

Scale ratio 1.25 minimum between steps. Body measure capped at 68ch. Question
text is the largest thing on the session screen, above the user's own name and
above any nav.

`text-wrap: balance` on h1-h3, `text-wrap: pretty` on feedback prose.

## Layout

- Session screen is a single column on mobile, camera-left / question-right at
  >=1024px. The camera never drops below 280px wide; below that the feed stops
  being useful as self-review.
- Controls sit in a fixed cluster near the video, not in a page header. The user
  is looking at the camera, so the controls belong in the same eye path.
- Cards only where something is genuinely a discrete repeated object (a past
  session in a list). The session screen itself uses no cards. No nested cards.
- Responsive grids use `repeat(auto-fit, minmax(280px, 1fr))` rather than
  breakpoint-stepped column counts.

### z-index scale

`--z-dropdown: 10`, `--z-sticky: 20`, `--z-backdrop: 30`, `--z-modal: 40`,
`--z-toast: 50`, `--z-tooltip: 60`. No arbitrary values.

## Motion

Ease-out exponential curves only. No bounce, no elastic, nothing that reads as
playful during a task this tense.

- The tally light pulses on a 2s ease-in-out loop while recording. It is the
  only looping animation in the product.
- Feedback reveals with a short staggered fade as each item resolves, because
  the results genuinely arrive in sequence. Content is visible by default and
  the animation enhances it; visibility is never gated on a transition firing.
- Question transitions crossfade over 200ms. No slide, no page-turn.
- Under `prefers-reduced-motion: reduce` the tally light becomes a static dot
  with its text label, and every transition becomes an instant state change.

## Components

Built on the existing shadcn/Radix primitives. The tokens change; the
primitives stay. Buttons, dialogs, forms, and tooltips keep their current API so
the rewrite stays scoped to appearance and the new session-specific pieces:

- `TallyLight` — recording state, pulse, elapsed timer, text label.
- `LiveTranscript` — interim and final speech results, distinguished by weight
  rather than color alone.
- `ScoreDial` — a rating with its diagnostic text attached; never renders a
  bare number.
- `SessionRail` — question progress, per-question state at a glance.
