# Shared Hours Redesign Implementation Plan

> **Superseded after Task 2 (2026-10-09).** Kevin switched from Astro to plain HTML, CSS and JS. Tasks 1–2 were done in Astro, then the whole site was rebuilt as static files. See the addendum at the end of the spec.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage of mkb2001.github.io around a live working-hours overlap strip, with a new palette, new type, and a call-path diagram for the AIBOS project.

**Architecture:** All time math moves into a pure TypeScript module (`src/lib/overlap.ts`) tested with Node's built-in runner. A new `HourStrip.astro` component renders a no-JavaScript fallback and enhances it in the browser using that module. The rest of the page keeps its existing markup and picks up new design tokens from `global.css`.

**Tech Stack:** Astro 7, TypeScript (strict, `verbatimModuleSyntax`), Node 24 (`node --test` with native type stripping), Fontsource variable fonts.

**Spec:** `docs/superpowers/specs/2026-10-09-portfolio-redesign-design.md`

## Global Constraints

- All commands run from `/home/limitless/Documents/Dev/portifolio_workspace/mkb2001.github.io`.
- No new runtime dependencies except `@fontsource-variable/schibsted-grotesk` and `@fontsource-variable/source-serif-4`.
- All copy lives in `src/data/profile.ts`. Do not reword any existing string. New strings follow `../VOICE.md`: full plain sentences, no slogans, no em-dashes as beats.
- Never `git push`. Kevin reviews on `localhost:4321`. Commits are GPG-signed and the signing prompt cannot be answered from an agent shell, so **each task ends by staging its files with `git add`, not by committing**. Kevin commits.
- Type-only imports must use `import type` (the tsconfig sets `verbatimModuleSyntax`). Imports between `.ts` files use the `.ts` extension so `node --test` can resolve them (`allowImportingTsExtensions` is already on).
- Node type stripping does not support `enum`, `namespace` or constructor parameter properties. Do not use them in `src/lib` or `src/data`.
- No all-caps labels, no monospace face, no eyebrow labels, no numbered section markers.
- Every text/background pair meets WCAG AA (4.5:1 body, 3:1 at 24px and above).

## Review Focus

1. **A visitor with a half-hour or 45-minute offset (India, Nepal).** The strip and sentence must show fractional hours correctly ("five and a half hours"), not round to an integer offset. Pinned by the India and Nepal tests in Task 1.
2. **Overlap that rounds to exactly one hour (0.75–1.24 h).** The sentence must say "one hour", not "1 hours" or the under-an-hour sentence. Pinned in Task 1.
3. **JavaScript disabled or failing.** The hero must still show the UTC+3 sentence and no empty strip. `.chart` sets `display: grid`, which overrides the `hidden` attribute, so Task 3 adds an explicit `.chart[hidden] { display: none }` and checks it in Step 6 with JavaScript off.
4. **Kevin's day ending exactly at the visitor's midnight (Tokyo).** It must render as one band to 24, not a band plus an empty zero-width band. Pinned in Task 1.
5. **Narrow screens (360px).** The strip ticks and the call-path diagram must not overflow horizontally. Checked in Task 3 Step 6 and Task 4 Step 4.

## Deviation from the spec, decided while planning

Contrast checks found two problems, and the plan fixes them as follows. Task 2 also updates the spec's color table.
- Light `--lake` `#2C7A68` is 4.35:1 on `--haze`, which fails for link text. It becomes `#246B5A` (5.36:1).
- `--sun` bands on a pale track are 1.52:1. The strip's track becomes a solid new `--night` token (light `#15233A`, dark `#2A3B57`). Sun on night is 8.79:1 in light mode and 7.08:1 in dark mode. Visually the night hours read as night, which suits the concept.

---

### Task 1: Overlap math and hero copy

**Files:**
- Create: `src/lib/overlap.ts`
- Create: `src/lib/overlap.test.ts`
- Modify: `src/data/profile.ts` (append `overlapCopy` and `availability`)
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Interval = { start: number; end: number }`
  - `type Hours = { start: number; end: number }`
  - `type OverlapCopy = { sameZone: string; hours: (spoken: string) => string; underAnHour: string; none: string }`
  - `computeOverlap(input: { kevinOffset: number; kevinHours: Hours; visitorOffset: number; visitorHours: Hours }): { kevin: Interval[]; visitor: Interval[]; shared: Interval[]; sharedHours: number; sameZone: boolean }`
  - `hoursInWords(hours: number): string`, where `hours` is a multiple of 0.5 between 1 and 9
  - `describeOverlap(sharedHours: number, sameZone: boolean, copy: OverlapCopy): string`
  - In `profile.ts`: `export const overlapCopy: OverlapCopy` and `export const availability: string`

- [ ] **Step 1: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "node --test src/lib/"
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/overlap.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOverlap, describeOverlap, hoursInWords } from "./overlap.ts";
import { overlapCopy } from "../data/profile.ts";

const KEVIN = { kevinOffset: 3, kevinHours: { start: 9, end: 18 }, visitorHours: { start: 9, end: 17 } };
const at = (visitorOffset: number) => computeOverlap({ ...KEVIN, visitorOffset });

test("Kampala visitor is in the same zone and shares eight hours", () => {
  const r = at(3);
  assert.equal(r.sameZone, true);
  assert.deepEqual(r.kevin, [{ start: 9, end: 18 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 17 }]);
  assert.equal(r.sharedHours, 8);
});

test("London in summer shares seven hours", () => {
  const r = at(1);
  assert.equal(r.sameZone, false);
  assert.deepEqual(r.kevin, [{ start: 7, end: 16 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 16 }]);
  assert.equal(r.sharedHours, 7);
});

test("New York in summer shares two hours", () => {
  const r = at(-4);
  assert.deepEqual(r.kevin, [{ start: 2, end: 11 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 11 }]);
  assert.equal(r.sharedHours, 2);
});

test("US Pacific in summer splits Kevin's day at midnight and shares nothing", () => {
  const r = at(-7);
  assert.deepEqual(r.kevin, [
    { start: 23, end: 24 },
    { start: 0, end: 8 },
  ]);
  assert.deepEqual(r.shared, []);
  assert.equal(r.sharedHours, 0);
});

test("India handles a half-hour offset", () => {
  const r = at(5.5);
  assert.deepEqual(r.kevin, [{ start: 11.5, end: 20.5 }]);
  assert.deepEqual(r.shared, [{ start: 11.5, end: 17 }]);
  assert.equal(r.sharedHours, 5.5);
});

test("Nepal handles a 45-minute offset", () => {
  const r = at(5.75);
  assert.deepEqual(r.kevin, [{ start: 11.75, end: 20.75 }]);
  assert.equal(r.sharedHours, 5.25);
});

test("Tokyo ends exactly at midnight without an empty second band", () => {
  const r = at(9);
  assert.deepEqual(r.kevin, [{ start: 15, end: 24 }]);
  assert.deepEqual(r.shared, [{ start: 15, end: 17 }]);
  assert.equal(r.sharedHours, 2);
});

test("Kiribati splits Kevin's day past midnight and shares nothing", () => {
  const r = at(14);
  assert.deepEqual(r.kevin, [
    { start: 20, end: 24 },
    { start: 0, end: 5 },
  ]);
  assert.equal(r.sharedHours, 0);
});

test("hoursInWords speaks whole and half hours", () => {
  assert.equal(hoursInWords(1), "one hour");
  assert.equal(hoursInWords(1.5), "one and a half hours");
  assert.equal(hoursInWords(2), "two hours");
  assert.equal(hoursInWords(5.5), "five and a half hours");
  assert.equal(hoursInWords(8), "eight hours");
});

test("describeOverlap picks the right sentence", () => {
  assert.equal(describeOverlap(8, true, overlapCopy), overlapCopy.sameZone);
  assert.equal(describeOverlap(7, false, overlapCopy), "Our working days overlap by seven hours.");
  assert.equal(describeOverlap(5.25, false, overlapCopy), "Our working days overlap by five and a half hours.");
  assert.equal(describeOverlap(0.8, false, overlapCopy), "Our working days overlap by one hour.");
  assert.equal(describeOverlap(1.2, false, overlapCopy), "Our working days overlap by one hour.");
  assert.equal(describeOverlap(0.5, false, overlapCopy), overlapCopy.underAnHour);
  assert.equal(describeOverlap(0.2, false, overlapCopy), overlapCopy.underAnHour);
  assert.equal(describeOverlap(0, false, overlapCopy), overlapCopy.none);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./overlap.ts`.

- [ ] **Step 4: Add the copy to `profile.ts`**

Add this line at the top of `src/data/profile.ts`, above the existing doc comment:

```ts
import type { OverlapCopy } from "../lib/overlap.ts";
```

Append to the end of the file:

```ts
/**
 * Hero sentences about how our working days overlap. These are drafts for Kevin to approve.
 * `hours` receives the overlap already in words, for example "five and a half hours".
 */
export const overlapCopy: OverlapCopy = {
  sameZone: "You are in the same time zone as me, so we share the whole working day.",
  hours: (spoken) => `Our working days overlap by ${spoken}.`,
  underAnHour: "Our working days overlap by less than an hour, so I would plan most of the work in writing.",
  none: "Our working days do not overlap, so I would plan the work in writing and reply at the start of my day.",
};

// Moved out of the hero; shown at the top of the Contact section.
export const availability =
  "I am looking for a remote engineering role, either full-time or as a contractor. I work as an independent contractor, so there is no visa or sponsorship involved.";
```

Change the `intro` array to hold only its first paragraph. The other two paragraphs move: the AIBOS one is covered by the featured project, and the availability one is now `availability` above.

```ts
export const intro = [
  "I am a software engineer based in Kampala. Most of my work is on the backend: services, data pipelines, and the containers and clusters they run on.",
];
```

- [ ] **Step 5: Implement `src/lib/overlap.ts`**

```ts
/**
 * Time math for the working-hours strip. Pure functions with no DOM access, so they can be
 * unit-tested with `node --test`. All hours are on a 24-hour clock and may be fractional.
 */

export type Interval = { start: number; end: number };
export type Hours = { start: number; end: number };

export type OverlapCopy = {
  sameZone: string;
  hours: (spoken: string) => string;
  underAnHour: string;
  none: string;
};

const mod24 = (n: number) => ((n % 24) + 24) % 24;

// A span of `length` hours starting at `start`, split in two if it runs past midnight.
function span(start: number, length: number): Interval[] {
  const s = mod24(start);
  const e = s + length;
  return e <= 24
    ? [{ start: s, end: e }]
    : [
        { start: s, end: 24 },
        { start: 0, end: e - 24 },
      ];
}

export function computeOverlap(input: {
  kevinOffset: number;
  kevinHours: Hours;
  visitorOffset: number;
  visitorHours: Hours;
}) {
  const { kevinOffset, kevinHours, visitorOffset, visitorHours } = input;
  // Hours to add to a Kampala clock time to get the visitor's clock time.
  const shift = visitorOffset - kevinOffset;
  const kevin = span(kevinHours.start + shift, kevinHours.end - kevinHours.start);
  const visitor = span(visitorHours.start, visitorHours.end - visitorHours.start);

  const shared: Interval[] = [];
  for (const a of kevin) {
    for (const b of visitor) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) shared.push({ start, end });
    }
  }
  shared.sort((a, b) => a.start - b.start);

  const sharedHours = shared.reduce((sum, i) => sum + (i.end - i.start), 0);
  return { kevin, visitor, shared, sharedHours, sameZone: shift === 0 };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

export function hoursInWords(hours: number): string {
  const whole = Math.floor(hours);
  const half = hours - whole === 0.5;
  if (whole === 1 && !half) return "one hour";
  return `${WORDS[whole]}${half ? " and a half" : ""} hours`;
}

export function describeOverlap(sharedHours: number, sameZone: boolean, copy: OverlapCopy): string {
  if (sameZone) return copy.sameZone;
  if (sharedHours === 0) return copy.none;
  const rounded = Math.round(sharedHours * 2) / 2;
  if (rounded < 1) return copy.underAnHour;
  return copy.hours(hoursInWords(rounded));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: all 10 tests pass, 0 failures.

- [ ] **Step 7: Type-check**

Run: `npx astro check`
Expected: `0 errors`. `index.astro` still compiles at this point, but it now renders only one intro paragraph, which is expected until Task 3.

- [ ] **Step 8: Stage**

```bash
git add package.json src/lib/overlap.ts src/lib/overlap.test.ts src/data/profile.ts
```

---

### Task 2: Palette and type

**Files:**
- Modify: `package.json` (fonts)
- Modify: `src/styles/global.css:1-60` (tokens) and the `h1, h2, h3` and `body` rules
- Modify: `src/layouts/Base.astro` (font imports, `theme-color`)
- Modify: `src/pages/index.astro` `<style>` (token renames only)
- Modify: `docs/superpowers/specs/2026-10-09-portfolio-redesign-design.md` (color table)

**Interfaces:**
- Consumes: nothing.
- Produces these CSS custom properties, which Tasks 3 and 4 use: `--haze --surface --dusk --slate --rule --sun --lake --night --display --serif`, plus the existing `--step-*`, `--space-*`, `--measure`, `--page`, `--gutter`.

- [ ] **Step 1: Swap the font packages**

```bash
npm uninstall @fontsource-variable/bodoni-moda @fontsource-variable/ibm-plex-sans @fontsource-variable/newsreader @fontsource-variable/public-sans @fontsource/ibm-plex-mono
npm install @fontsource-variable/schibsted-grotesk@^5.3.0 @fontsource-variable/source-serif-4@^5.3.0
```

The lab page imports Bodoni and Plex, so the build breaks until Step 6 moves it out. Do Step 6 before any build.

- [ ] **Step 2: Replace the tokens in `global.css`**

Replace everything from the top of the file through the closing brace of the `@media (prefers-color-scheme: dark)` block with:

```css
/*
 * Design tokens: an equatorial day.
 * Light: pale morning-sky page, dusk-navy ink, lake-green links.
 * Dark: dusk page, pale ink, lighter lake so contrast holds.
 * --sun marks working hours on the strip and is used nowhere else.
 */
:root {
  --haze: #e8edf1;
  --surface: #f3f6f8;
  --dusk: #15233a;
  --slate: #5b6878;
  --rule: #c9d2da;
  --sun: #f0b941;
  --lake: #246b5a;
  --night: #15233a;

  --display: "Schibsted Grotesk Variable", "Helvetica Neue", Arial, sans-serif;
  --serif: "Source Serif 4 Variable", "Iowan Old Style", Georgia, serif;

  /* Type scale, ratio 1.25 from an 18px body. */
  --step--2: 0.72rem;
  --step--1: 0.875rem;
  --step-0: 1.125rem;
  --step-1: 1.40625rem;
  --step-2: 1.758rem;
  --step-3: clamp(1.9rem, 1.4rem + 2vw, 2.75rem);
  --step-4: clamp(3rem, 1.6rem + 6vw, 6.25rem);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2.25rem;
  --space-6: 3.5rem;
  --space-7: 6rem;

  --measure: 38rem;
  --page: 70rem;
  --gutter: clamp(1rem, 4vw, 3rem);

  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --haze: #15233a;
    --surface: #1c2c45;
    --dusk: #e4e9ee;
    --slate: #9eaaba;
    --rule: #2f4060;
    --sun: #f4c760;
    --lake: #6cc3a0;
    --night: #2a3b57;
  }
}
```

- [ ] **Step 3: Update the base rules in `global.css`**

Make these replacements in the rest of the file:
- `body`: `background: var(--haze); color: var(--dusk); font-family: var(--serif);`
- `h1, h2, h3`: `font-family: var(--display); font-weight: 600; letter-spacing: -0.015em;`
- `a`: `color: var(--lake);`
- `:focus-visible`: `outline: 2px solid var(--lake);`
- `.skip`: `background: var(--dusk); color: var(--haze);`

Add after the `p` rule:

```css
time,
.figures {
  font-family: var(--display);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Rename tokens in `index.astro` styles**

In the `<style>` block of `src/pages/index.astro`, replace each old token with its new one: `--muted` → `--slate`, `--ink` → `--dusk`, `--accent-ink` → `--lake`, `--accent` → `--lake`. Remove every `font-variation-settings: "opsz" 72;` line, because Schibsted has no optical-size axis. Nav and meta lines should use the display face, so add `font-family: var(--display);` to `nav`, `.featured-meta, .project-meta, .role-org`, `.role-dates`, `.stack` and `.skills dt`.

Check: `grep -nE "var\(--(muted|ink|accent|paper|rule-soft|muted-band|sans)" src/pages/index.astro src/styles/global.css` prints nothing.

- [ ] **Step 5: Update `Base.astro`**

Replace the two font imports with:

```astro
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/source-serif-4";
```

Replace the two `theme-color` tags with:

```html
<meta name="theme-color" content="#e8edf1" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#15233a" media="(prefers-color-scheme: dark)" />
```

- [ ] **Step 6: Move the Night Flight lab out of the repo**

Neither file has ever been committed, so move them instead of deleting them:

```bash
mkdir -p ../lab-night-flight
mv src/components/BoardingPass.astro src/pages/lab/boarding-pass.astro ../lab-night-flight/
rmdir src/pages/lab
```

Check: `ls ../lab-night-flight` lists both files.

- [ ] **Step 7: Verify contrast**

Run from the repo:

```bash
node -e '
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const r=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const pairs=[["light dusk/haze","#15233a","#e8edf1",4.5],["light slate/haze","#5b6878","#e8edf1",4.5],["light lake/haze","#246b5a","#e8edf1",4.5],["light slate/surface","#5b6878","#f3f6f8",4.5],["light sun/night","#f0b941","#15233a",3],["dark dusk/haze","#e4e9ee","#15233a",4.5],["dark slate/haze","#9eaaba","#15233a",4.5],["dark lake/haze","#6cc3a0","#15233a",4.5],["dark slate/surface","#9eaaba","#1c2c45",4.5],["dark sun/night","#f4c760","#2a3b57",3]];
let bad=0;for(const[n,a,b,min]of pairs){const v=r(a,b);if(v<min)bad++;console.log((v<min?"FAIL ":"ok   ")+n.padEnd(22)+v.toFixed(2))}
process.exit(bad)'
```

Expected: every line starts with `ok`, and the exit code is 0.

- [ ] **Step 8: Update the spec's color table**

In the spec, change `--lake` light to `#246B5A`, add a row `| --night | #15233A | #2A3B57 | The strip's track (night hours) |`, and change the strip bullet "other hours `--dusk` at low opacity" to "other hours `--night`".

- [ ] **Step 9: Build and look**

Run: `npm run check && npm run build`
Expected: both succeed with 0 errors. Then run `npm run dev` and open `http://localhost:4321`. The page should show the new colors and fonts with the old layout, and the old Overlap widget should still be in the hero (it now uses removed tokens, so its bars may look flat; Task 3 replaces it).

- [ ] **Step 10: Stage**

```bash
git add package.json package-lock.json src/styles/global.css src/layouts/Base.astro src/pages/index.astro docs/superpowers/specs/2026-10-09-portfolio-redesign-design.md
```

---

### Task 3: Hour strip hero

**Files:**
- Create: `src/components/HourStrip.astro`
- Delete: `src/components/Overlap.astro`
- Modify: `src/pages/index.astro` (hero markup, hero styles, contact section)

**Interfaces:**
- Consumes: `computeOverlap`, `describeOverlap`, `type Interval` from `src/lib/overlap.ts`; `profile`, `overlapCopy`, `intro`, `availability` from `src/data/profile.ts`; the CSS tokens from Task 2.
- Produces: `<HourStrip />`, which takes no props.

- [ ] **Step 1: Create `src/components/HourStrip.astro`**

```astro
---
/**
 * The hero: the time in Kampala, how much of a working day the visitor shares with Kevin, and a
 * 24-hour strip on the visitor's clock showing both days. Without JavaScript it shows a single
 * sentence about the time zone and keeps the strip hidden.
 */
import { profile } from "../data/profile";

const { utcOffset, workHours } = profile;
const sign = utcOffset >= 0 ? "+" : "−";
---

<section class="strip" aria-labelledby="strip-title" data-offset={utcOffset} data-start={workHours.start} data-end={workHours.end}>
  <h2 id="strip-title" class="visually-hidden">Working hours</h2>
  <p class="strip-lead" aria-live="off">
    <span data-fallback>
      Kampala is on UTC{sign}{Math.abs(utcOffset)}. That covers a full working day with Europe and the Gulf, and
      mornings with the US East Coast.
    </span>
    <span data-time hidden></span>
    <span data-overlap hidden></span>
  </p>

  <div class="chart" data-chart hidden aria-hidden="true">
    <span class="row-label">Your day</span>
    <div class="track" data-row-you></div>
    <span class="row-label">My day</span>
    <div class="track" data-row-me></div>
    <div class="shared-layer" data-shared></div>
    <div class="ticks figures">
      <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
    </div>
    <span class="now" data-now></span>
  </div>
</section>

<script>
  import { computeOverlap, describeOverlap, type Interval } from "../lib/overlap";
  import { overlapCopy } from "../data/profile";

  // Visitor's assumed working day, in their local time.
  const VISITOR_HOURS = { start: 9, end: 17 };

  const root = document.querySelector<HTMLElement>(".strip");
  if (root) {
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
    const result = computeOverlap({
      kevinOffset: Number(root.dataset.offset),
      kevinHours: { start: Number(root.dataset.start), end: Number(root.dataset.end) },
      // getTimezoneOffset is minutes behind UTC, so negate it.
      visitorOffset: -new Date().getTimezoneOffset() / 60,
      visitorHours: VISITOR_HOURS,
    });

    const pct = (h: number) => `${(h / 24) * 100}%`;
    const draw = (parent: HTMLElement, intervals: Interval[], className: string) => {
      for (const i of intervals) {
        const el = document.createElement("span");
        el.className = className;
        el.style.left = pct(i.start);
        el.style.width = pct(i.end - i.start);
        parent.append(el);
      }
    };
    draw(q("[data-row-you]"), result.visitor, "band");
    draw(q("[data-row-me]"), result.kevin, "band");
    draw(q("[data-shared]"), result.shared, "shared");

    const timeEl = q("[data-time]");
    const nowMark = q("[data-now]");
    const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Kampala" });
    const tick = () => {
      const now = new Date();
      timeEl.textContent = `It is ${fmt.format(now)} in Kampala. `;
      nowMark.style.left = pct(now.getHours() + now.getMinutes() / 60);
    };

    q("[data-overlap]").textContent = describeOverlap(result.sharedHours, result.sameZone, overlapCopy);
    tick();
    q("[data-fallback]").hidden = true;
    timeEl.hidden = false;
    q("[data-overlap]").hidden = false;
    q("[data-chart]").hidden = false;
    setInterval(tick, 60_000);
  }
</script>

<style>
  .strip-lead {
    font-family: var(--display);
    font-size: var(--step-3);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.015em;
    max-width: 22em;
    margin-bottom: var(--space-5);
  }

  .strip-lead [data-time] {
    font-variant-numeric: tabular-nums;
  }

  .strip-lead [data-overlap] {
    color: var(--slate);
  }

  .chart {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: 1.75rem 1.75rem auto;
    column-gap: var(--space-3);
    row-gap: 0.5rem;
    align-items: center;
  }

  /* An author display value beats the UA rule for [hidden], so restate it. */
  .chart[hidden] {
    display: none;
  }

  .row-label {
    font-family: var(--display);
    font-size: var(--step--1);
    color: var(--slate);
  }

  .track {
    position: relative;
    height: 100%;
    background: var(--night);
    border-radius: 3px;
    overflow: hidden;
    transform-origin: left center;
  }

  .track :global(.band) {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--sun);
  }

  /* Spans both rows in the second column; draws the shared hours as one outline. */
  .shared-layer {
    position: absolute;
    grid-column: 2;
    grid-row: 1 / 3;
    inset: -4px 0;
    pointer-events: none;
  }

  .shared-layer :global(.shared) {
    position: absolute;
    top: 0;
    bottom: 0;
    border: 2px solid var(--lake);
    border-radius: 5px;
  }

  .ticks {
    grid-column: 2;
    display: flex;
    justify-content: space-between;
    font-size: var(--step--2);
    color: var(--slate);
  }

  .now {
    position: absolute;
    grid-column: 2;
    grid-row: 1 / 3;
    top: -0.5rem;
    bottom: -0.5rem;
    width: 2px;
    margin-left: -1px;
    background: var(--dusk);
  }

  /* The one load animation: both days draw from midnight, then the shared hours appear. */
  @media (prefers-reduced-motion: no-preference) {
    .chart:not([hidden]) .track {
      animation: draw 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
    }

    .chart:not([hidden]) .track + .row-label + .track {
      animation-delay: 120ms;
    }

    .chart:not([hidden]) .shared-layer {
      animation: appear 300ms ease-out 1000ms both;
    }
  }

  @keyframes draw {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }
</style>
```

Note: `.now` and `.shared-layer` are absolutely positioned grid items. They need a containing block whose left edge is the second column. Because absolute grid items use their grid area as the containing block when the grid container is positioned, `grid-column: 2` plus `left` percentages put them on the track. Verify this in the browser in Step 6.

- [ ] **Step 2: Wire the hero in `index.astro`**

In the frontmatter, replace `import Overlap from "../components/Overlap.astro";` with `import HourStrip from "../components/HourStrip.astro";` and add `availability` to the profile import.

Replace the whole `<section class="page hero" ...>` element with:

```astro
<section class="page hero" aria-labelledby="hero-title">
  <h1 id="hero-title">{profile.name}</h1>
  <HourStrip />
  <div class="hero-body">
    {intro.map((p) => <p>{p}</p>)}
    <ul class="links">
      {links.map((l) => <li><a href={l.href}>{l.label}</a></li>)}
    </ul>
  </div>
</section>
```

- [ ] **Step 3: Replace the hero styles**

In the `<style>` block, delete the rules for `.hero`, `.hero h1`, `.hero-body`, `.hero-aside`, the `@media (min-width: 64rem)` block that styles the hero, and `.hero-body p:first-child`. Add:

```css
.hero {
  padding-top: var(--space-5);
  padding-bottom: var(--space-7);
}

.hero h1 {
  font-size: var(--step-1);
  margin-bottom: var(--space-6);
}

.hero-body {
  max-width: var(--measure);
  margin-top: var(--space-6);
}
```

The name becomes a modest heading, because the strip is now the loudest thing on the page.

- [ ] **Step 4: Add availability to Contact**

In the contact section, change the `.block-body` contents to start with the availability paragraph:

```astro
<p class="contact-lead">{availability}</p>
<p class="contact-lead">
  If you have a role or a project where this experience would help, please email me. I usually reply within a day.
</p>
```

(The second paragraph is the existing copy, unchanged.)

- [ ] **Step 5: Delete the old widget**

```bash
git rm src/components/Overlap.astro
```

Check: `grep -rn "Overlap" src/` prints nothing.

- [ ] **Step 6: Verify in the browser**

Run: `npm test && npm run check && npm run build`
Expected: all pass, 0 errors.

Start `npm run dev`. Take headless screenshots:

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1280,900 --screenshot=/tmp/hero-1280.png http://localhost:4321/
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=360,900 --screenshot=/tmp/hero-360.png http://localhost:4321/
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1280,900 --blink-settings=scriptEnabled=false --screenshot=/tmp/hero-nojs.png http://localhost:4321/
TZ=America/Los_Angeles google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1280,900 --screenshot=/tmp/hero-pacific.png http://localhost:4321/
TZ=Asia/Kolkata google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1280,900 --screenshot=/tmp/hero-india.png http://localhost:4321/
```

Open each image and check:
- 1280: the time sentence and overlap sentence, then two dark tracks with yellow bands, a green outline around the shared hours spanning both rows, and the now line within the tracks.
- 360: nothing overflows horizontally, and the ticks fit.
- No JavaScript: only the UTC+3 sentence and no empty chart area.
- Pacific: Kevin's band is split (a sliver at 23–24 and 00–08), there's no green outline, and the "do not overlap" sentence shows.
- India: "five and a half hours".

Also check dark mode and reduced motion in a real browser (DevTools → Rendering → emulate `prefers-color-scheme: dark` and `prefers-reduced-motion: reduce`). With reduced motion, the strip appears without the draw animation. Tab through the page: every link shows the lake focus ring.

- [ ] **Step 7: Stage**

```bash
git add src/components/HourStrip.astro src/pages/index.astro
```

---

### Task 4: Call-path diagram

**Files:**
- Create: `src/components/CallPath.astro`
- Modify: `src/pages/index.astro` (featured project)

**Interfaces:**
- Consumes: the CSS tokens from Task 2.
- Produces: `<CallPath />`, which takes no props.

- [ ] **Step 1: Create `src/components/CallPath.astro`**

The diagram is built with HTML and CSS rather than SVG so the boxes can reflow from a row to a column at narrow widths. The labels come from the existing `featured.body` text.

```astro
---
/**
 * How a call moves through the AIBOS voice platform. A row of steps on wide screens and a column
 * on narrow ones. The live audio path is drawn in --lake; storage hangs off the stream service.
 */
---

<figure class="callpath">
  <ol class="steps">
    <li class="step">Caller</li>
    <li class="step">Twilio</li>
    <li class="step step-live">
      Audio stream service
      <span class="store">PostgreSQL</span>
    </li>
    <li class="step">OpenAI voice model</li>
  </ol>
  <figcaption>
    A call comes in through Twilio. The stream service carries the audio to and from the voice model in real time,
    and stores the conversation and customer data in PostgreSQL. The services run on Google Cloud Run.
  </figcaption>
</figure>

<style>
  .callpath {
    margin: 0 0 var(--space-5);
    padding: var(--space-4);
    background: var(--surface);
    border-radius: 6px;
  }

  .steps {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: grid;
    gap: var(--space-4);
  }

  .step {
    position: relative;
    font-family: var(--display);
    font-size: var(--step--1);
    font-weight: 600;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--slate);
    border-radius: 4px;
    background: var(--haze);
  }

  .step-live {
    border-color: var(--lake);
    border-width: 2px;
  }

  .store {
    display: block;
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px dashed var(--slate);
    font-weight: 400;
    color: var(--slate);
  }

  /* Connectors: vertical on narrow screens. The two sides of the stream service are the live path. */
  .step:not(:last-child)::after {
    content: "";
    position: absolute;
    left: var(--space-4);
    top: 100%;
    height: var(--space-4);
    border-left: 2px solid var(--slate);
  }

  .step:nth-child(2)::after,
  .step-live::after {
    border-color: var(--lake);
  }

  @media (min-width: 40rem) {
    .steps {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      align-items: start;
    }

    .step:not(:last-child)::after {
      left: 100%;
      top: 1.1rem;
      width: var(--space-4);
      height: 0;
      border-left: 0;
      border-top: 2px solid var(--slate);
    }

    .step:nth-child(2)::after,
    .step-live::after {
      border-color: var(--lake);
    }
  }

  figcaption {
    font-size: var(--step--1);
    color: var(--slate);
    max-width: var(--measure);
  }
</style>
```

This replaces the SVG described in the spec. It shows the same information and is easier to reflow. The figcaption doubles as the text alternative, so no `<title>` or `<desc>` is needed.

- [ ] **Step 2: Place it in the featured project**

In `src/pages/index.astro`, add `import CallPath from "../components/CallPath.astro";` to the frontmatter. In the `.featured` article, insert `<CallPath />` directly after `<p class="featured-outcome">…</p>`.

- [ ] **Step 3: Remove the duplicate paragraph**

The figcaption now explains the architecture, so the first `featured.body` paragraph repeats it. Leave `profile.ts` unchanged and render from the second paragraph on:

```astro
{featured.body.slice(1).map((p) => <p>{p}</p>)}
```

- [ ] **Step 4: Verify**

Run: `npm run check && npm run build`
Expected: 0 errors.

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1280,2400 --screenshot=/tmp/work-1280.png http://localhost:4321/
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=360,3200 --screenshot=/tmp/work-360.png http://localhost:4321/
```

Check that at 1280 there are four boxes in a row with connectors between them, the two connectors next to the stream service are green, and PostgreSQL sits inside the stream box under a dashed line. At 360, check the boxes stack with vertical connectors and nothing overflows.

- [ ] **Step 5: Stage**

```bash
git add src/components/CallPath.astro src/pages/index.astro
```

---

### Task 5: Final check

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run everything**

```bash
npm test && npm run check && npm run build
```

Expected: 10 tests pass, 0 check errors, and the build succeeds.

- [ ] **Step 2: Check for leftovers**

```bash
grep -rnE "bodoni|plex|newsreader|public-sans|--muted|--accent|--paper|Overlap|BoardingPass" src/ package.json
```

Expected: no output.

- [ ] **Step 3: Check that nothing new ships**

```bash
ls dist/ && ls dist/lab 2>&1
```

Expected: `dist/lab` does not exist.

- [ ] **Step 4: Hand over to Kevin**

Leave `npm run dev` running on `:4321`. Report:
- what changed
- the screenshots from Tasks 3 and 4
- the two open decisions: the hero sentences, and whether to set `cvPath`

Do not push.
