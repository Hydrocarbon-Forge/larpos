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

### 5. Larp-script interpreter: apps as scripts, rendered live (Nathan, 2026-10-08)

The Larp script is the whole OS as a *document*. Apps are not pre-rendered static
screens — they are **written in the script**, and an **interpreter** turns a script
section into something that runs. The AI does the translation, live, at open time.

Architecture (two layers):

- **Layer 1 — the Larp script (boot time):** the LLM generates the full world spec
  once. Each app is *described*, not rendered: title, what it is, its interactive
  element(s) (dial/valve/register/mirror/hatch... named per-world), its vibe. This
  is the app's *script* — compact, stored in the world spec, served at /api/world.
  This is the catalog.
- **Layer 2 — the interpreter (open time):** when you open app X, the interpreter
  takes (app description + world context + palette + your interaction) and
  **generates the actual running screen + its behavior live** — not from a cached
  static HTML. The app is a spec that gets *instantiated* the moment you open it.

Interpretation policy (Nathan, 2026-10-08 — drift AND subjectivity are the point, not bugs):

- **The interpreter is a reader, not a validator.** The Larp script is made up by
  the AI, so there is no ground truth a line of it could be "wrong" against —
  you can't call it an error, because the whole script is the AI's fiction. When a
  section reads garbled, contradictory, or "like an error," the interpreter does
  not flag it or reject it; it *interprets it however it subjectively feels*. A
  corrupt section becomes a damaged/glitchy app; an incoherent line becomes
  in-world weirdness. Subjectivity is the feature, not a fallback to hide.
- The LLM is non-deterministic, so opening an app **may** produce a slightly
  different instantiation than last time, **or** the same one. We do NOT force
  variety or force stability — we let the model be what it is. "You don't intend
  for things to differ, but they will" is intended behavior, not an accident to
  paper over.
- **Held while open:** once an app instance is rendered, it does NOT re-roll while
  you are using it (no flicker under the cursor). Reinterpret happens on
  close/reopen, driven by the model's natural variance.
- **The only hard guard is transport, not content:** LLM unreachable / timeout /
  unparsable *response envelope* → the combinatorial fallback renders a valid app
  so the kiosk never hangs. Garbled *content* is never a fallback trigger — it is
  fiction to be interpreted. A minimal "damaged app" shell exists only as a
  last-resort against a literal white screen (the kiosk never dies), framed
  in-world as the app being broken — not a generic fallback that flattens the
  fiction.

UI contract:

- From the overview (keeper + app list) you open an app (verb or click) -> the view
  swaps to that app's *live-interpreted* screen (same kiosk, same palette,
  app-titled header). The app's interactive element is a REAL styled control, not
  text. Go-home always returns to the overview.
- The world's verb set includes the per-world word for OPENING an app and for GOING
  HOME.
- The FORMAT of what an app even is varies per world (a pressure gauge, a mirror, a
  filing cabinet, a mouth). That variability is the point — the interpreter's
  output format is itself part of the Larp script's "changes each time."

Selftest additions (per this section): every entity has an app with at least one
interactive element; the interpreter produces a valid running screen for each app
(LLM path when up, combinatorial path when offline); open-app and go-home verbs
work; a broken/empty LLM render exercises the generic-shell fallback (not a white
screen). Determinism note: because the model is intentionally non-deterministic,
do NOT assert exact-equality of live app renders across opens — assert *validity*
(well-formed screen, has the named element, renders within palette) instead.

### 6. Boot sequence: ASCII text, then the interface paradigm is generated (Nathan, 2026-10-08)

Clarification from the user: the ASCII/text look is a BOOT PHASE, not the whole OS.

- **Boot phase (text):** before the OS exists, the kiosk shows a full-viewport
  *terminal* (monospace, palette-neutral dark). A short ASCII art header (LarpOS
  mark), a boot log that types itself out (fake-ish, fast, in-world: "loading
  hallucination core...", "seeding reality..."), then the concept prompt renders as
  a terminal prompt — tagline + "what OS are you making?" + input + [RANDOM]. This
  is the only screen that is *always* text/ASCII.
- **The interface paradigm is part of the generation.** After the concept is
  submitted, the world spec gains `world.interface` — the *kind of interface the
  OS presents*: `gui` (windows/panels), `tui` (full terminal), `single-panel`,
  `device` (the whole OS is one strange instrument), `scene` (you are *in* it,
  no chrome at all) — or a per-world invention. The concept prompt steers it
  ("a terminal" → tui, "a cockpit" → device, "just a room" → scene). The UI shell
  renders *whichever paradigm the world chose* — the shell is a paradigm
  renderer, not one fixed layout. Apps and the terminal are components that live
  inside whatever paradigm got generated.
- Everything after boot is **rendered by JS from the spec** — GUI, TUI, or
  whatever. No fixed layout assumption.

### 7. The terminal is a component of the OS, with a hallucinated filesystem (Nathan, 2026-10-08)

The terminal is not the whole machine — it is one (usually prominent) component
inside the OS, alongside the apps. It behaves like a real shell whose state is
held by the AI:

- **Virtual filesystem (in the LLM context, not on disk):** paths, folders, and
  files exist as conversation state in the world engine. `cd`, `ls`, `cat`,
  `mkdir`, `echo`, `type`... all manipulate/reflect that virtual state. File
  *contents* live in the LLM context (ASCII text), not on the real filesystem.
- **Hallucination is the mechanic:** if you `cd` into a folder that didn't
  exist, the AI may decide it does now — and the next `ls` shows it, with
  contents. Incoherent input becomes in-world weirdness (see reader-not-validator
  policy, §5). The filesystem is *whatever the AI believes it is* at this
  moment.
- **Binary slot:** a small real storage area (`/var/larpos/bins/` in the image;
  `~/.larpos/bins` locally) holds binary files the user can create/reference.
  When a conversation references a binary by name, the terminal layer resolves
  the *real* file (size, head, run it if executable) and feeds that into the
  AI's understanding ("you call the real cat and figure it out"). The LLM
  doesn't parse the bytes; the engine does.
- **Conversation store:** all terminal exchanges (and world events) persist as
  JSONL under `/var/larpos/state/` (image) / `~/.larpos/state/` (local): one
  file per world boot. This is the "spot where all the conversation json is
  stored."
- **Responsiveness (the feel rule):** terminal responses go through the LLM at
  *minimal thinking* — short system prompt, low max tokens, low temperature,
  no tool-use, sub-second target. The AI is prompted to *not think much or at
  all* — pattern-complete the shell, don't deliberate. When the LLM is down,
  the combinatorial shell (echo-style: `ls` lists the current virtual dir,
  `cat` shows stored content) keeps it feeling instant. The terminal must never
  visibly wait on a slow model — if a response isn't in ~1s, it renders the
  combinatorial line and patches in the LLM line if it lands (best-effort,
  never a blocking spinner).
- **Bin commands are Larp script (item 10):** the world spec lists `world.bin`
  — per-world custom commands (names + one-line behavior). They are `.larp`
  entries interpreted at run time (see §8): typing one runs its interpreted
  behavior, not a real binary. New commands "in local bin" = larpscript
  entries the world (or the keeper) can add during play.

### 8. The Larp script is a FILE: `.larp` — loose text, AI-interpreted (Nathan, 2026-10-08)

The OS is *defined by Larp script files*. Correction from the user (2026-10-08):
**`.larp` is NOT a laid-out file format.** There is no required schema. The point
of `.larp` is that you can write *whatever* and the AI interprets it.

- A `.larp` file is a loose text document — prose, fragments, half-finished
  things, whatever. It MAY contain structure (a title line, an app description,
  a law, a command name) when that makes interpretation easier, but structure is
  optional and non-normative. **The parser is the interpreter, not a regex** —
  the reader-not-validator policy (§5) applies to the file itself: a section that
  reads like an app becomes an app; a garbled chunk becomes a damaged law; a
  command-ish line becomes a bin command. Nothing is rejected.
- Boot writes the boot's world to `<state dir>/world-<seed>.larp` (and keeps the
  last N). The running OS's source of truth is that file, read through the
  interpreter — so the app catalog, bin commands, laws, and scene are whatever
  the interpreter understands from the file, not fields of a schema.
- **Live rewriting (item 5):** the engine watches for edits to the active `.larp`
  file (fs.watch where available, mtime poll fallback) and re-interprets on
  change — so the OS literally rewrites itself live: edit the file (by hand, by
  the keeper, by another process) and the running OS changes shape. The in-world
  "rewrite" verb can also append/patch through the LLM. Corrupt edits are
  interpreted, not rejected — a broken section is in-world damage, never a parse
  error.
- Practical note for the engine: the LLM-generated boot file naturally has some
  shape (a name, an app list, laws) because the generator knows what a world
  needs — but that's a *generator* convenience, not a format contract. Hand-edited
  files can be anything, including just a paragraph.

### 9. The kiosk disguise: no browser, ever (Nathan, 2026-10-08)

Once booted, there is **no way to see it's a browser** (item 6):

- Global capture: `document`-level `keydown`/`mousedown`/`wheel` handlers
  (capture phase) route everything through the OS layer. Every key and click
  is an OS input, not a page input.
- Browser escapes blocked: `contextmenu` (right-click) suppressed,
  `Ctrl/Cmd+R, F11, F12, Ctrl+Shift+I/J/C, Ctrl+P, Alt+Left/Right` (nav)
  suppressed, `Esc` repurposed (in-world: "the OS does not close"), drag
  disabled, `user-select: none` globally (allow selection only inside the
  terminal's own copy affordance if any).
- No browser chrome cues: kiosk mode hides the toolbar; the UI never shows a
  URL, tab, or scrollbar-like artifact; document title stays the OS name.
- Note for the image: Firefox kiosk already hides most chrome; this section is
  the JS-side layer so even a non-kiosk window can't reveal the browser.
- Exception: the *boot screen* (ASCII, §6) may allow right-click for the
  concept input; the disguise is a post-boot state.

### 10. Dynamic / live-rewritable OS (Nathan, 2026-10-08)

- The running OS is a *live interpretation* of the active `.larp` file + the
  conversation state. Reboot a world (same seed, same concept) → same shape,
  but the interpreter may render it slightly differently (model variance is
  the feature).
- In-world verbs can mutate the active world spec (keeper rewrites a law, an
  app gets added mid-play) — the spec file updates, the UI re-renders. The OS
  is never frozen at boot.

### 11. Concept-primary tone + real skin/paradigm rendering (Nathan, 2026-10-08)

The concept prompt is the PRIMARY driver of the OS. The baked-in gimmicks
(hallucinated FS markers, stratum logs, keeper, laws, verbs, live re-interpret)
are always present as *mechanisms*, but the *visible tone* must match the
concept. "A highly practical and lightweight desktop operating system" → a
normal, practical desktop with normal computer/Linux texture (files, terminal,
taskbar, system settings); the strangeness appears only as light seasoning that
fits the fiction, never as the default sci-fi look. No concept / random → the
strange inhabited-reality tone is allowed. The "eerie hallucinated reality"
framing moves OUT of the default system prompt and INTO the concept-conditioned
instruction.

**Design banks + composition (NOT preset skins).** No fixed "windows-xp
pack" that forces a whole look onto a world. Instead `app/banks/` ships curated
*building blocks* a world **pulls from only as much as it needs**:

- `fonts.js` — a font bank: named family stacks present in the image (monospace
  tiers, a flat sans, a serif, a display weight). A world pulls 1-2 stacks.
- `icons.js` — an **icon-grammar bank**: a set of *style functions* (flat-line,
  duotone, glyph, pictogram, hand-drawn stroke) that, given a subject
  (folder/terminal/file/trash/system/gauge...) and a seed, **procedurally draw the
  SVG**. A world pulls a grammar (or a blend) + a subject set; nothing is a
  shared pre-rendered set.
- `sounds.js` — a **sound bank**: synthesized short cues (boot, click, error,
  open, alarm) as tiny generated WAV/OGG + a few parametric generators (a blip
  with pitch/decay/ring). A world pulls a handful; a tty world may pull *none*.
- `palettes.js` — a **palette generator**: seeded HSL/OKLCH ramps, not 5 fixed
  palettes. The world's concept steers the hue/saturation/lightness *bands*; the
  seed sets exact values. (Replaces the old `world.palette` as a fixed 5-array.)

**One fast design decision, then a deterministic instantiator.** A single *small*
low-thinking LLM call (or seeded PRNG offline) emits a compact **design spec**:
`paradigm`, which bank items to pull (fonts, icon grammar, sounds, palette bands),
**topology** (where the bar/menu/chrome lives: bottom bar, top menu, side rail, no
chrome), and a few **aesthetic params** (radius range, spacing/density, accent
hue, motion amount). A **pure-JS seeded instantiator** then materializes the real
DOM/CSS/SVG from that spec. Seeded ⇒ same world looks the same; different worlds
genuinely differ. Nothing is "edited for the sake of it" because nothing is a
template — every value is generated from the seed, and the LLM only makes the
*structural* choices (a user expects "a bar at the bottom"; the LLM picks that),
while the exact radius/height/position/glyphs are seeded inside the chosen
structure. The LLM never emits pixel values.

**Paradigms rebuild the DOM, they do not re-skin it.** The current four
paradigms are CSS re-skins of one layout — that's the bug behind "it doesn't
really do gui". Each paradigm must build its OWN DOM:

- `gui` → a real desktop: wallpaper layer (procedural from palette/skin),
  desktop icons (the entities, as apps), **draggable, closable windows** with
  titlebars (world verbs as the close/home glyphs), a taskbar with a start-like
  menu (lists apps) and a clock, the terminal as one of the windows.
- `tui` → full-screen monospace box-drawing layout (no gradient, no cards):
  header line, app panels in ASCII frames, command line at the bottom, keyboard-
  first.
- `device` → instrument console: gauges/dials/levers as real SVG instruments
  (not text boxes), readouts, the terminal as a log panel.
- `scene` → diegetic space: the entities ARE the scene; no chrome; interaction
  by pointing/verbs.
- `invented` (LLM may name its own paradigm) → the LLM emits a short
  `paradigmSpec` (layout zones, chrome elements, interaction style) and the UI
  builds from it; on parse failure, fall back to `gui`.

The concept steers paradigm + banks together ("desktop OS" → gui + flat font +
icon grammar + bottom bar + a few sounds; "terminal" → tui + monospace + no
icons; "machine" → device + instrument gauges). The four-paradigm CSS
re-skins are REMOVED (reduced to base tokens) so paradigms can never look
identical. The design spec is cached with the world and is what the UI renders
from — the instantiator runs client-side, so the kiosk is fast and the look is
stable per world.

**Boot-request correctness (bug fixes).**

- The LLM world-gen timeout on `POST /api/boot` is 25s — too short for the
  local 27B box under load; raise to a configurable default (env
  `LARPOS_WORLD_TIMEOUT_MS`, default 120000) and log actual duration to
  `/var/log/larpos-server.log`. On LLM timeout/failure the UI shows a visible
  `[BOOT] local brain unreachable — offline reality` line (never a silent
  weird fallback).
- Race: two concurrent world generations (pre-boot random + user concept) can
  interleave such that the user's world is shadowed or the pre-boot one wins.
  Server-side: serialize generation through a queue and tag the active world
  with the concept that produced it (`worldMeta = { concept, generatedAt }`);
  `GET /api/world` returns `202 {booting:true}` while a generation is in flight
  (even if a stale world exists). UI: after a concept is submitted, only accept
  a `200` world whose `concept` matches the submitted one (or `random` if the
  user submitted blank); the background poll must not accept a pre-boot world
  once a concept is pending.
- Input UX: while a concept boot or command is in flight, the inputs are
  disabled (further typing/Enter ignored) and a visible progress line shows
  elapsed seconds; re-enabled when the response lands.

## Acceptance criteria

1. `node app/server.js` (zero deps) serves `/`, `/api/world`, `/api/command` on :8080.
2. `node app/selftest.js` passes (offline and with LLM up).
3. Two boots (seeds) produce clearly different worlds; same seed reproduces exactly
   (world spec level; live renders may drift by design).
4. `build.sh` wires the app into the image via skel dir; `run_larpos.sh` points the
   kiosk at the engine. (Image build itself left as manual step.)
5. The fiction is *good*: the worlds feel inhabited and coherent, not template fill.
6. Boot = ASCII terminal with self-typing log, then the concept prompt ("what OS
   are you making?"). Submitting the concept generates the world *including its
   interface paradigm* (gui/tui/device/scene or invented) — the UI renders the
   chosen paradigm.
7. Apps are Larp-script sections, interpreted live at open; open-app and go-home
   always work; interpreter is a reader (garbled = interpreted, damaged shell last
   resort); held while open, may drift on reopen.
8. The terminal component: `cd`/`ls`/`cat`/`mkdir`/`echo` over a virtual
   filesystem held in the LLM context; hallucinated folders materialize; binary
   slot resolves real files; conversation JSONL persisted per boot; minimal-thinking
   LLM prompting keeps it sub-second-feeling, combinatorial echo fallback offline.
9. `.larp` files: loose text, AI-interpreted — no required schema (write whatever,
   the interpreter makes it an OS). Boot writes `world-<seed>.larp`; the running OS
   reads it through the interpreter as its source of truth; file edits re-interpret
   live (OS rewrites itself); bin commands are `.larp`-interpreted entries run at
   runtime. A hand-edited `.larp` that is just a paragraph still yields a world.
10. Post-boot disguise: global key/click capture, right-click and browser shortcuts
    blocked, no URL/tab/scrollbar cues, in-world `Esc`. Selftest verifies the
    handlers exist and the suppressed shortcuts fire no browser behavior.
11. Tone + design (per §11): with concept "a highly practical and lightweight
    desktop operating system" the rendered OS reads as a *normal practical
    desktop* (taskbar/menu present, neutral texture, no default sci-fi) and a
    second boot with a wildly different concept renders a clearly different
    paradigm/layout/color/geometry — no two worlds share the same template look.
    Bank pulls are selective (a tui world references no icon bank items). The
    design spec is seeded: identical seed+concept ⇒ identical design spec; the
    instantiator is deterministic. `POST /api/boot` world-gen timeout is
    configurable (`LARPOS_WORLD_TIMEOUT_MS`, default 120000) and duration is
    logged; an in-flight generation makes `GET /api/world` return `202
    {booting:true}` and the UI only accepts a world tagged with the submitted
    concept; inputs are disabled with a visible elapsed-time line while a boot
    or command is in flight.
