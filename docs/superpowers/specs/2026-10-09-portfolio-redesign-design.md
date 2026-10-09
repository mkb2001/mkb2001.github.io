# Portfolio redesign: Shared Hours

Date: 2026-10-09
Status: draft, awaiting Kevin's review

## Purpose

The site exists to get Kevin hired for a remote engineering role, full-time or as a contractor.
Its readers are hiring managers and engineers in Europe, the Gulf and the US, who will spend under
a minute on it. In that time the page has to show two things: that Kevin ships real systems, and
that working with him across time zones is easy.

The redesign makes the second point the opening of the page. The working-hours overlap, now a
sidebar widget, becomes a full-width hero. Everything below it stays calm and readable.

## Constraints

- Static Astro site on GitHub Pages. No new runtime dependencies beyond two font packages.
- All copy stays in `src/data/profile.ts` and follows `../VOICE.md`. Existing copy is not rewritten.
  New strings (the hero sentences below) are drafts that Kevin approves before shipping.
- Review happens on `localhost:4321`. Nothing is pushed until Kevin says so.
- The page must work without JavaScript, at 360px wide, in light and dark mode, with keyboard
  only, and with reduced motion.

## Out of scope

- Content changes to projects, experience or skills.
- Additional pages, a blog, or a CMS.
- Analytics, contact forms, or a theme toggle (the site follows the system setting).

## Visual system

### Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--haze` | `#E8EDF1` | `#15233A` | Page background |
| `--surface` | `#F3F6F8` | `#1C2C45` | Credentials panel, diagram background |
| `--dusk` | `#15233A` | `#E4E9EE` | Body text and headings; night hours on the strip |
| `--slate` | `#5B6878` | `#9EAABA` | Secondary text, meta lines, rules |
| `--sun` | `#F0B941` | `#F4C760` | Working hours on the strip. Used nowhere else. |
| `--lake` | `#246B5A` | `#6CC3A0` | Shared hours on the strip, links, focus ring |
| `--night` | `#15233A` | `#2A3B57` | The strip's track (night hours) |

`--sun` is never used for text. Every text/background pair must meet WCAG AA (4.5:1 for body,
3:1 for text at 24px and above); the implementation checks each pair and adjusts the hex values,
not the roles, if one fails.

### Type

- **Schibsted Grotesk** (`@fontsource-variable/schibsted-grotesk`): name, headings, navigation,
  and every time figure, with `font-variant-numeric: tabular-nums` on figures.
- **Source Serif 4** (`@fontsource-variable/source-serif-4`): body text. Line height 1.6.
- Scale: ratio 1.25 from an 18px body, reusing the existing `--step-*` tokens.
- No monospace face, no all-caps labels, no eyebrow labels above headings.

Newsreader, Public Sans, Bodoni Moda, IBM Plex Sans and IBM Plex Mono are removed from
`package.json`.

### Layout

- Left-aligned throughout. Page width stays `70rem`; body text stays under `38rem` (about 70
  characters).
- The hour strip spans the full page width inside the gutter.
- Sections below the hero keep the current pattern: section heading in a narrow left column,
  content on the right from `52rem` up, stacked below that.

## Page structure

```
Masthead      Kevin Mugarura                         Work  Experience  Contact
Hero          Time sentence + overlap sentence
              Hour strip (you / me, shared band, now marker)
              First intro paragraph, then links: Email, GitHub, LinkedIn, CV
Selected work Featured AIBOS project with call-path diagram
              Other projects in two columns
Experience    Roles, as now
Skills        Skills list and credentials panel, as now
Contact       As now
Footer        As now
```

The second and third intro paragraphs move out of the hero. The AIBOS paragraph is already covered
by the featured project. The availability paragraph ("I am looking for a remote engineering
role...") moves to the top of Contact.

## Components

### `src/lib/overlap.ts` (new, pure)

All time math, with no DOM access, so it can be unit-tested.

```ts
type Interval = { start: number; end: number }; // hours in visitor-local time, 0 ≤ start < end ≤ 24

computeOverlap(input: {
  kevinOffset: number;      // hours, e.g. 3
  kevinHours: { start: number; end: number }; // Kampala clock, e.g. 9–18
  visitorOffset: number;    // hours, may be fractional (India +5.5, Nepal +5.75)
  visitorHours: { start: number; end: number }; // assumed 9–17
}): {
  kevin: Interval[];        // Kevin's day on the visitor's clock, split at midnight if it wraps
  visitor: Interval[];
  shared: Interval[];
  sharedHours: number;      // total, unrounded
  sameZone: boolean;        // visitorOffset === kevinOffset
}

describeOverlap(sharedHours: number, sameZone: boolean): string
```

`describeOverlap` rounds to the nearest half hour and returns one of the draft sentences below.

### `src/components/HourStrip.astro` (replaces `Overlap.astro`)

Renders the hero sentences and the strip.

- **Server-rendered fallback** (no JavaScript): the sentence "Kampala is on UTC+3. That covers a
  full working day with Europe and the Gulf, and mornings with the US East Coast." The strip is
  rendered `hidden`. This is the current fallback copy, unchanged.
- **With JavaScript**: a script reads the visitor's offset from
  `new Date().getTimezoneOffset()`, calls `computeOverlap`, shows the strip, and replaces the
  fallback with two sentences:
  1. `It is {time} in Kampala.` where `{time}` comes from
     `Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Kampala" })`.
  2. The output of `describeOverlap`.
- The time sentence updates once a minute. The overlap sentence does not change after load.
- The strip has two rows, "Your day" and "My day", each a 24-hour bar on the visitor's clock with
  ticks at 00, 06, 12, 18 and 24. Working hours are `--sun`, other hours `--night`,
  and the shared hours are outlined in `--lake` across both rows. A vertical line marks
  the visitor's current time.
- The strip is `aria-hidden="true"`. The two sentences carry the information for screen readers,
  in an element with `aria-live="off"` so the per-minute update is not announced.

**Draft sentences for `describeOverlap`. Kevin approves or rewrites these.**

| Case | Draft |
|---|---|
| `sameZone` | "You are in the same time zone as me, so we share the whole working day." |
| 1 hour or more | "Our working days overlap by {n} hours." ("one hour" when n is 1; half hours as "five and a half hours") |
| Under 1 hour, above 0 | "Our working days overlap by less than an hour, so I would plan most of the work in writing." |
| 0 | "Our working days do not overlap, so I would plan the work in writing and reply at the start of my day." |

### Load motion

On load, the "Your day" and "My day" bars draw from 00 to 24 over about 900ms, then the shared
outline fades in. This is the only animation that runs without user action on the page. Under
`prefers-reduced-motion: reduce` the strip appears in its final state.

### `src/components/CallPath.astro` (new)

An inline SVG inside the featured AIBOS project showing the call path as four labelled boxes in a
row: Caller → Twilio → Realtime audio stream ↔ OpenAI voice model, with PostgreSQL below the stream
service. The labels come from the existing `featured.body` text. It is drawn in `--dusk` and
`--slate` with one `--lake` line for the live audio path, has a `<title>` and `<desc>`, and stacks
vertically below `40rem`. It has no motion.

### Unchanged components

Experience, skills, credentials, contact and footer keep their current markup. They only pick up
the new tokens and fonts.

## Files

| File | Change |
|---|---|
| `package.json` | Add the two new font packages, remove the five unused ones |
| `src/styles/global.css` | Replace color tokens and font stacks |
| `src/layouts/Base.astro` | Import new fonts; update `theme-color` values to `--haze` light and dark |
| `src/pages/index.astro` | New hero; move the two intro paragraphs; add `CallPath` |
| `src/data/profile.ts` | Add `availability` (the moved paragraph) and the hero sentence strings |
| `src/lib/overlap.ts` | New |
| `src/lib/overlap.test.ts` | New |
| `src/components/HourStrip.astro` | New, replaces `Overlap.astro` |
| `src/components/CallPath.astro` | New |
| `src/components/Overlap.astro` | Deleted (tracked in git) |
| `src/components/BoardingPass.astro`, `src/pages/lab/boarding-pass.astro` | Moved to `../lab-night-flight/` outside the repo. Neither file has ever been committed, so they are moved rather than deleted. This also keeps `/lab/boarding-pass` from being published. |

## Testing

- **Unit tests** for `src/lib/overlap.ts`, run with `node --test src/lib/overlap.test.ts` (Node 24
  strips the types itself; no new dependency). Kevin's day is 09–18 Kampala (06–15 UTC) and the
  visitor's is 09–17 local. Cases, with Kevin's day on the visitor's clock and the expected overlap:
  - Kampala (UTC+3): 09–18, `sameZone` true, 8 hours shared.
  - London in summer (UTC+1): 07–16, shared 09–16, 7 hours.
  - New York in summer (UTC−4): 02–11, shared 09–11, 2 hours.
  - US Pacific in summer (UTC−7): 23–24 and 00–08 (split), no overlap.
  - India (UTC+5.5): 11:30–20:30, shared 11:30–17, 5.5 hours.
  - Tokyo (UTC+9): 15–24, ending exactly at midnight and not split, shared 15–17, 2 hours.
  - Kiribati (UTC+14): 20–24 and 00–05 (split), no overlap.
  - `describeOverlap` returns the right draft for each case, including "one hour" and half hours.
- **Build checks:** `npm run check` and `npm run build` both pass with no warnings.
- **Visual review** with screenshots at 360px and 1280px, light and dark, with JavaScript on
  and off, and with reduced motion. Keyboard tab order reaches every link with a visible focus
  ring.
- **Contrast:** each text/background pair is computed and recorded in the implementation notes.

## Open decisions for Kevin

1. The four hero sentences in the table above.
2. Whether to set `cvPath` so the CV download link appears. `../Kevin_Mugarura_CV_Remote.pdf`
   looks like the right file.

## Addendum, 2026-10-09: plain HTML, CSS and JavaScript

Kevin dropped Astro after Task 2. The visual design above is unchanged. What changed:

- **No build step.** The site is `index.html`, `styles.css`, `js/*.js` and self-hosted fonts in
  `fonts/`. Content is written directly in `index.html`; `profile.ts` no longer exists. The hero
  sentences live in `js/copy.js`.
- **No dependencies.** `package.json` only declares `"type": "module"` and two scripts:
  `npm test` (`node --test`) and `npm run dev` (`python3 -m http.server 4321`).
- **Deploy.** The workflow runs the tests, copies only the served files into `_site/`, and
  publishes that with GitHub Pages. `docs/` and test files are not published.
- **The Astro version** (source, config, lockfile, build output and `node_modules`) was moved to
  `../astro-version/`, outside the repo. None of it had been committed.
- **Running Kampala clock (added at Kevin's request).** A ticker showing Kampala time to the
  microsecond rides the now line on the hour strip, moving along the visitor's day and clamped to
  the strip's edges. Milliseconds and microseconds are drawn quieter than the whole seconds. With
  reduced motion it updates once a second and hides the sub-second digits. Browsers coarsen
  `performance.now()` (Chrome to 100 µs on pages that are not cross-origin isolated, which GitHub
  Pages cannot enable), so the last microsecond digits often read as zeros. That is the real value.
- **The call-path diagram** is HTML and CSS, as the plan decided, not SVG.
