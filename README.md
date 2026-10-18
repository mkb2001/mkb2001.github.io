# mkb2001.github.io

Personal site of Kevin Mugarura. Plain HTML, CSS and JavaScript with no build step, deployed to
GitHub Pages.

## Editing content

- All text on the page (bio, projects, experience, skills, links) is written directly in `index.html`.
- Kevin's UTC offset is the `data-offset` attribute on the HUD in `index.html`. If you change it,
  also change "UTC+3" in the HUD's label.
- The hero motherboard is generated: edit `tools/board/` and run `node tools/board/build.mjs`,
  which rewrites the SVG between the `board:start` and `board:end` markers in `index.html`. Don't
  edit that SVG by hand. `node tools/board/build.mjs --audit` also checks the drawing's geometry
  (nothing sunk into anything, every overlap painted in the right order).
- The words on the board's labels (the skills) are the list items under the drawing in `index.html`.
- Colours, fonts and layout are in `styles.css`. The colour tokens are at the top.

To offer a CV download, put the PDF next to `index.html` and add a link to it in the link list.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole page. Readable with JavaScript turned off. |
| `styles.css` | Design tokens, font faces and all styles. |
| `js/hours.js` | The HUD: the high-precision Kampala clock. |
| `js/board.js` | The hero motherboard: builds it part by part as the page scrolls, hangs a skill label on each part, then powers it on. |
| `js/board-model.js` | The board's numbers (PCIe, DDR5, the regulators) and its power-on sequence, shared by the build script and `js/board.js`. |
| `js/motion.js` | Smooth scrolling (Lenis) and the page's GSAP animations. |
| `js/transit.js` | The transit map drawn slowly in the background (anime.js). |
| `js/waves.js` | The speech-wave bars beside the links (anime.js). |
| `js/clock.js` | The clock maths: time to the microsecond, and staying right after the computer sleeps. |
| `js/vendor/` | GSAP, Lenis and anime.js, self-hosted. |
| `fonts/` | Playfair Display and JetBrains Mono, self-hosted (SIL Open Font License). |
| `tools/serve.py` | Local preview server that turns off caching. Not published. |
| `tools/board/` | The build script that draws the motherboard (`layout.mjs` places the parts, `copper.mjs` routes the copper), and the isometric drawing kit it uses. Not published. |

## The hero board

The motherboard is a representative AM5 / B650 ATX board drawn for this site, not a copy of a
commercial design. What it is based on:

- **Real dimensions and standards:** the 305 x 244 mm ATX outline and hole pattern, the AM5 socket
  and 40 mm package, the 54 x 90 mm cooler holes, DDR5 slots and modules, the PCIe slot pitch and
  key, M.2 2280, the 24-pin and 8-pin connectors and their pin roles, a CR2032 cell.
- **Real platform behaviour:** which device each bus runs between (memory, the x16 slot and the
  first M.2 slot on the processor; SATA, USB and the other slots on the chipset), the bandwidth
  figures in `js/board-model.js`, and the order of the power-on (standby power, PS_ON#, the main
  rails, PWR_OK, the CPU regulators, clocks and reset, firmware, memory training, PCIe).
- **Approximated:** the placement of the parts, the regulator values (an ideal buck converter, not
  a circuit simulation) and the power-on timing, which is one step per stretch of scroll.
- **Illustrative only:** the copper routing and the inner layers' patterns, which follow the
  architecture but are not a signal-integrity checked layout, and the pulses along the copper.

## Running locally

```sh
npm run dev      # serves the folder at http://localhost:3000 without caching (needs python3)
npm test         # runs the tests in js/*.test.js with Node's built-in test runner (Node 22.6+)
```

`index.html` loads ES modules, so open it through the local server rather than as a file.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`. It runs the tests, copies the site files
(not `docs/` or the tests) into `_site/`, and publishes them with GitHub Pages. In the repository
settings, Pages must have its source set to **GitHub Actions**.
