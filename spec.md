# LarpOS — build spec (Nathan, 2026-10-08)

## The concept (from LarpOS.md — the source of truth for the idea)

- The entire operating system is an AI hallucination. The user "sees" an OS, but the
  whole thing is a generated fiction — there is no real filesystem, no real apps.
- It is different every time: each boot produces a *different* world / "OS".
- "The entire format of what a Larp script even is changes each time" — the genre,
  structure, and vocabulary of the experience are not fixed. A boot might be a terminal
  on a dying station, a desktop of a dead god, a kitchen table in a dream, etc.
- Implementation note: on network boot, a new buildroot instance is downloaded (i.e. a
  fresh, disposable base OS per boot). We approximate this with the existing Alpine
  kiosk image + a Node.js world engine injected at build time.

## What exists already (do not rebuild the VM plumbing)

- `build.sh` — builds `larpos.img` via `tools/alpine-make-vm-image` (2G raw, Alpine
  latest-stable, packages: cage, firefox-esr, seatd, nodejs, npm, etc).
- `run_larpos.sh` — runs inside the image at build time: adds kiosk user, autologin on
  tty1, Cage + `firefox-esr --kiosk`, and if `/opt/larpos/server.js` exists it runs
  `node /opt/larpos/server.js &` before launching the browser.
- `repos` — Alpine repository list.

Environment facts: host is Linux, Node v26.7.0 / npm 11.19.0, CPU-only, **no GPU, no
display server on the dev host** — verify headlessly (HTTP endpoints + node-based page
load checks). The real kiosk runs on tty1 over Wayland/Cage.

## What to build

### 1. `app/` — the LarpOS world engine (plain Node, ZERO dependencies)

`node app/server.js` must serve everything on **port 8080** (env `PORT` to override):

- `GET /` — full-viewport single-page UI (inline or linked vanilla JS/CSS, no framework,
  no CDN). No build step.
- `GET /api/world` — the current boot's world spec (see below).
- `POST /api/command` — body `{ "text": "..." }` → `{ "out": "..." }` (the world's
  response to a user command). The UI's terminal talks to this.

#### World generation (the core)

On boot, generate a fully coherent world from a seed (default: time+random; `--seed N`
for reproducible worlds, also `LARPOS_SEED` env). The generation is pure/deterministic
given the seed. The spec object at least includes:

- `world.name` — the name of the "OS" (it is never actually called an OS by the world;
  it is whatever it is).
- `world.theme` — a one-line genre/setting description (e.g. "abandoned lighthouse
  control desk, 1911, the sea is made of glass").
- `world.palette` — 3-5 CSS colors the UI uses, derived from the theme (the look is
  part of the hallucination, never a generic default).
- `world.keeper` — the "resident" of the system: name, one-line personality, and the
  idiom it speaks in.
- `world.entities` — 4-8 named things that exist "on disk" (files/apps/rooms/creatures
  — the *kind* of entity is itself per-world: the filesystem metaphor may not even be
  files).
- `world.laws` — 2-4 "system laws" (weird, specific, consistent — e.g. "screens only
  show what is being watched", "nothing can be saved twice").
- `world.verbs` — the per-world command vocabulary: 5-8 verbs with names that fit the
  world (never just ls/cat/open — e.g. `knock`, `listen`, `unseal`), each with a
  short help line in the world's idiom.
- `world.script` — a short opening monologue/scene (3-8 lines) the keeper speaks at
  boot, in character. This is the "Larp Script"; its *format* may vary (dialogue,
  log entries, instructions, riddle) per world — that variability is the point.
- `world.seed` — the seed used (hex string), surfaced in the UI footer so two boots
  can be compared.

All generation content comes from the engine (word banks + seeded combination logic).
No network calls, no external APIs — the "AI" is the combinatorial engine; the fiction
must feel like something lived in it, not lorem ipsum. Consistency matters more than
quantity: entities, laws, and verbs must reference each other coherently.

#### The command layer

- `POST /api/command` accepts free text; the engine parses leading verb + args,
  responds in the keeper's voice and world logic:
  - a verb on its own → help line for that verb,
  - unknown verb → the keeper reacts *in character* (not a canned "command not found"),
  - `help`-equivalent (the world's own word for help) → lists verbs with their
    per-world names,
  - each named entity is reachable through at least one verb with 1-3 lines of
    in-world content,
  - `new world` / the world's own reseed verb → boots a fresh world (new seed).
- Keep a small conversation state (last few commands) so responses can reference
  what the user did a moment ago.

#### The UI

- Full screen, palette-driven (CSS custom properties from `world.palette`).
- On load: fetch `/api/world`, render the opening scene (`world.script`) as the
  keeper's first words, then a command input (terminal-style).
- Every command the user types → `POST /api/command` → append keeper response as
  styled text. Keep it minimal and legible: scene + exchange log + input. No fake
  window chrome required for MVP — the chrome *is* the world's own aesthetic.
- Footer: world name + seed.
- Works at small and large sizes; keyboard-first (Enter submits, no button needed).

### 2. Integration with the kiosk image

- `build.sh` must inject the app into the image at `/opt/larpos/` so
  `run_larpos.sh`'s existing `node /opt/larpos/server.js` hook fires. The image tool
  supports `--fs-skel-dir` (content copied into `/`) — create a skel dir
  (e.g. `image/skel/` containing `opt/larpos/...`) and wire it into `build.sh`.
- The browser's kiosk URL should point at the world engine (`http://127.0.0.1:8080/`)
  — update `run_larpos.sh` accordingly (keep everything else in that script intact).
- Do NOT run `./build.sh` yourself in this environment (needs sudo + slow). Leave the
  image build as a documented manual step.

### 3. Verification (you must do this, headlessly)

- `node app/server.js --seed 1` → `GET /` returns the UI; `GET /api/world` returns a
  coherent spec; two different seeds → visibly different worlds; same seed → identical
  world (determinism check in code, e.g. `node app/selftest.js`).
- `POST /api/command` with each verb + an unknown verb → sensible, in-character
  responses.
- A tiny `app/selftest.js` (node, zero deps) that runs the generation + command layer
  with fixed seeds and asserts: determinism, non-collision between seeds, all verbs
  respond, entities are reachable. It must pass: `node app/selftest.js`.

## Git rule

This repo is under git. Commit as you go — at least: engine complete + selftest
passing (one commit), UI + integration wired (one commit), fixes (their own commits).
Use `git config user.name "Slopworks Builder"`, `user.email
"slopworks@hydrocarbonforge.local"` (already set in this repo).

### 4. Pre-boot concept prompt (Nathan, 2026-10-08)

Before the world is entered, the kiosk shows a **concept screen** (instead of jumping
straight into a world):

- A one-line title ("What should this OS be?") + a free-text input + a "random" button.
- On submit (Enter), the prompt is passed into world generation as the **intent seed**:
  the LLM prompt (and the combinatorial fallback's selection logic) are conditioned on
  the user's idea — the world is *about* what they typed, not just a random one.
- Empty input (or "random") → the existing seed-based random path.
- The concept is stored in the world spec (`world.concept`, possibly a normalized
  short version) and surfaces in the footer next to the seed.
- The in-world `new world` / reseed verb returns to this concept screen (fresh idea,
  or random).

### 5. Generated applications, not just entities (Nathan, 2026-10-08)

Entities are not only queryable things — every entity is also a **generated
application**:

- Each entity's spec gains `app`: a generated title, a `screen` (the app's own
  full-viewport content/scene description in the world's idiom), and at least one
  **interactive element** the app has (dial, valve, register, mirror, hatch, … —
  named per-world) with behavior: interacting with it produces an in-world
  effect/response from the engine (LLM-generated in-character, combinatorial
  fallback offline).
- The world's verb set includes the per-world word for *opening an app* and for
  *going home* (back to the desktop/overview). The UI supports it: from the overview
  (the keeper + the list of apps) you can open an app (verb or clicking its entry),
  which swaps the view to the app's generated screen (same kiosk, same palette,
  app-titled header), and you can always go home.
- Apps render as real UI in the browser (HTML/CSS from the generated spec + a bit of
  layout logic), not just text logs: the app screen has its own look within the
  world palette (e.g. the "dial" is an actual styled control you can turn via the
  input or clicking). The *format* of what an app even is varies per world — a
  pressure gauge, a mirror, a filing cabinet, a mouth. That variability is the point.
- Selftest additions: every entity has an `app` with an interactive element;
  the open-app and go-home verbs work; concept-screen flow is reachable (GET / shows
  the concept screen before any world exists); the concept string flows into
  generation (same concept + different randoms → worlds both *about* the concept;
  verify via the LLM path when available, combinatorial path asserts the concept is
  stored and referenced in theme).

## Acceptance criteria

1. `node app/server.js` (zero deps) serves `/`, `/api/world`, `/api/command` on :8080.
2. `node app/selftest.js` passes (offline and with LLM up).
3. Two boots (seeds) produce clearly different worlds; same seed reproduces exactly.
4. `build.sh` wires the app into the image via skel dir; `run_larpos.sh` points the
   kiosk at the engine. (Image build itself left as manual step.)
5. The fiction is *good*: the worlds feel inhabited and coherent, not template fill.
   This is the bar — judge it by reading a few generated worlds with different seeds.
6. Booting shows the concept screen first; typing an idea steers the generated world
   toward that idea (LLM path), random/blank still works.
7. Every entity opens as a generated application with its own screen and at least one
   interactive element; going home always works.
