# Ming — personal site

A playful 3D interactive portfolio for **Ming**, an independent software engineer.
The homepage is a little explorable game: enter a lamp-lit workshop inside a star, or
drift out to a constellation where every published project is a glowing planet.

## Design: "The Night Workshop"

- **Concept**: a dark, lamp-lit space centered on an amber star. Click the star to fly
  *inside* it — a cozy low-poly workshop room. Around the star, four tilted orbital rings —
  Arcade (amber), Toolbench (cyan), Open Source (mint), Pocket (rose) — carry one glowing
  planet per project.
- **Type**: Fraunces Variable (display + body, high optical size with SOFT/WONK axes) and
  IBM Plex Mono (labels/UI).
- **Palette**: ink `#0a0e15`, paper `#ece7da`, amber `#ffb454`, cyan `#6fd8e0`, mint `#9ee493`,
  rose `#f2889b`. Film-grain overlay, vignette, glow sprites (no post-processing — cheap on mobile).

## The game: a camera state machine

`src/scripts/scene.ts` runs a five-state view machine, all driven by clicking 3D objects and
the breadcrumb console (top-center). Zoom in, look around, zoom back out — like a tiny point-
and-click adventure.

```
overview ──click star───▶ workshop ──click furniture──▶ spot
   │                         (room interior)             (screen / poster / shelf / window)
   ├──click ring label──▶ cluster ──click planet──▶ node (project detail)
   ├──click planet───────────────────────────────▶ node
   └──click rocket 🚀───▶ flight ──click a star──▶ discovery (surprise!)
```

- **overview** — the whole constellation; the star pulses at center.
- **workshop** — fly *into* the star. The star fades out (fast, by 40% of the reveal, so its
  wireframe never overlaps the room) and a low-poly room fades in: desk + live terminal screen,
  a framed "quiet machines" manifesto poster, a shelf of project tokens, and a window looking
  back out at the planets drifting past. Each is a clickable **spot**.
- **spot** — camera pushes in on a piece of furniture; the panel shows that spot's story and an
  action button (scroll to the numbers / house rules, or step back outside).
- **cluster / node** — face-on to a ring, then in to a single project.

- **flight** — click the docked rocket to launch. It flies out on a curved path (camera chases,
  amber exhaust trail) and parks in open space. Five **mystery stars** are scattered in deep space
  (radius ~20–30, beyond the project rings). Click one and the rocket auto-pilots there.
- **discovery** — on arrival a particle burst fires and a panel reveals that star's surprise. The
  "sky charted" counter (top-left) ticks up. Two stars have extra effects: **The Maker** reveals a
  hidden line-drawn constellation, **Wanderlust** launches a comet streak. Charting all five
  triggers a finale (shooting stars + the home star earns a halo + a closing note from Ming).
  Stars remember they're charted; revisiting re-opens the panel without re-counting.

Interaction details:
- **Nearest-hit wins** (`pickConstellation`): a planet drifting in front of the star gets the
  click; the star and the docked rocket are also in this contest, so each is reachable by aiming
  at its clear part. Same logic for hover.
- Breadcrumb crumbs are all clickable; − / + do smooth dolly zoom. Trackpad **pinch** also zooms
  (macOS delivers pinch as ctrl+wheel, handled on the `.hero` element); plain two-finger scroll is
  left untouched so the page still scrolls down to the sections below.
- Empty-space click or Escape steps back one level. On touch, taps drive everything and
  drag-to-orbit is disabled so the page scrolls.
- Entering any non-overview state adds `.exploring` to `<html>`, which dissolves the hero
  headline so the 3D scene has the stage.

## GitHub panel (`src/components/GithubPanel.astro`, moved up to section 02)

Build-time fetch of **public** data for `@quietbuildlab` + the `quiet-build` org
(`src/lib/github.ts`), falling back to the committed `src/data/github-snapshot.json`
(public repos only — **regenerate WITHOUT private scope so private repos never leak**; the
fetch itself filters `visibility=public`). If the fetch fails, a "showing a saved snapshot"
note appears. Contents:

- **Stat tiles** with count-up: 51 repos, 29 stars, 36 followers, 12 years (each with a witty subtitle).
- **Language bar** — segments grow in on scroll; hovering a segment or legend row cross-highlights.
- **Cadence chart** — repos-per-year SVG bars that grow on scroll, hover tooltips, selective labels.
- **Expandable "recently touched" feed** — 12 repos with language dots, relative timestamps,
  stars, and descriptions; shows 5, "Show 7 more" reveals the rest with a staggered animation.

Chart palette is CVD-validated for the dark surface (dataviz six-checks):
`#c97c14 #1f9dab #57a24d #d14a66 #8563e0` + neutral gray for "Other".

## App Store links

`Project.appStore` in `src/data/projects.ts` — currently empty everywhere because none of the
iOS apps have App Store listings yet (verified via iTunes Search API, 2026-07-15). Fill it in
when an app ships: the 3D panel gains an " App Store" button and the work-grid card gains a
chip + link automatically.

## Stack

- **Astro 7** (static output, SEO: canonical/OG/JSON-LD, crawlable HTML mirror of the 3D scene)
- **Three.js** — vanilla, in `src/scripts/scene.ts` (no react-three-fiber). Room + terminal +
  poster are drawn with primitives and canvas textures — no external 3D assets.
- **@quietbuildlab/ui 0.7** (Manuscript design system) via Tailwind v4 — `midnight` theme
  overridden with Night Workshop tokens in `src/styles/global.css`; `buttonVariants` styles the
  panel's action buttons.
- **pnpm**

## Page sections

Hero (3D) → Work grid (01) → **GitHub numbers (02)** → About Ming (03) → House rules (04) → footer.

## Behaviors to know

- Rendering pauses when the hero scrolls out of view (IntersectionObserver on the canvas).
- `prefers-reduced-motion` disables auto-rotate, orbits, bobbing, grain, count-ups, and bar grow-ins.
- Projects without a `url`/`appStore` render as non-links.
- Note: `requestAnimationFrame` is throttled when the tab isn't painting, so the room transition
  looks choppy in headless screenshots but is smooth for a real, visible tab.

## TODO before deploy

- Set the real domain in `astro.config.mjs` (`site` is a placeholder — update before sitemaps/canonicals).
- Deploy via GitHub Actions / CI (house rule: no manual production deploys). CI has network, so
  the GitHub panel fetches live there; the snapshot is only a fallback.
- Optional: OG image, `@astrojs/sitemap` once the domain is real.

## Run

```sh
pnpm install
pnpm astro dev --background   # dev (see CLAUDE.md)
pnpm build                    # production build
```
