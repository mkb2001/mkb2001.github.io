# mkb2001.github.io

Personal site of Kevin Mugarura. Plain HTML, CSS and JavaScript with no build step, deployed to
GitHub Pages.

## Editing content

- All text on the page (bio, projects, experience, skills, links) is written directly in `index.html`.
- Kevin's UTC offset and working hours are the `data-offset`, `data-start` and `data-end`
  attributes on the `.telemetry` figure in `index.html`. If you change the offset, also change
  "UTC+3" in the HUD.
- Colours, fonts and layout are in `styles.css`. The colour tokens are at the top.

To offer a CV download, put the PDF next to `index.html` and add a link to it in the link list.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole page. Readable with JavaScript turned off. |
| `styles.css` | Design tokens, font faces and all styles. |
| `js/hours.js` | Flight control: the hour shown on the orbit (live or dragged), the HUD clock and the flat fallback dial. |
| `js/telemetry.js` | The 3D radar globe, Kampala beacon, 24-hour orbit and draggable plane (Three.js). |
| `js/motion.js` | Smooth scrolling (Lenis) and the page's GSAP animations. |
| `js/transit.js` | The transit map drawn slowly in the background (anime.js). |
| `js/waves.js` | The speech-wave bars beside the links (anime.js). |
| `js/overlap.js` | Works out how a visitor's working day overlaps with Kevin's. |
| `js/clock.js` | The clock maths: time to the microsecond, and staying right after the computer sleeps. |
| `js/orbit.js` | Geometry for the flat fallback dial. |
| `js/sun.js` | Where the sun is overhead, for lighting the globe. |
| `js/vendor/` | GSAP, Lenis, anime.js and a trimmed Three.js build, self-hosted. |
| `fonts/` | Playfair Display and JetBrains Mono, self-hosted (SIL Open Font License). |
| `tools/serve.py` | Local preview server that turns off caching. Not published. |

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
