# LarpOS — Composition (runtime design decision + cohesion system)

**Owner:** composition designer (one of 4 parallel designers). **Status:** design.
**Depends on:** `spec.md` §11 (design spec, banks, seeded instantiator, tone),
`design/blocks.md` (block contract: envelope, palette slots, font slots, icon refs,
sound cues, action refs, 11 block types), `design/layouts.md` (15 layout ids,
concept-keyword→layout map, selection rules, seeded-variation ranges), `app/prng.js`
(seeded Mulberry32 + FNV hash), `app/banks/{palettes,fonts,icons,sounds}.js`.

This document specifies the **runtime mechanism** by which the LLM makes its own
layout, finds the blocks and banks it needs, and stitches them into a **cohesive
whole**. It answers five questions:

1. The single small low-thinking LLM **design call** (input, output schema, token
   budget, ~10 s timeout, deterministic offline fallback).
2. The **cohesion pass** — the rules that make independently-picked blocks look like
   *one OS* rather than *random parts*.
3. How the design spec is **persisted with the world** and served so the look is
   **stable per world** (same world = same look).
4. The **offline path** (seeded PRNG) that produces a valid design spec with **no LLM**.
5. A **worked example**: concept *"a highly practical and lightweight desktop
   operating system"* → resulting design spec JSON and what it renders.

It includes the exact design-spec **JSON schema**.

---

## 0. The one-sentence architecture

> **The LLM makes the *structural* decision (which paradigm, which layout, which
> blocks, which bank refs, which aesthetic enums). A seeded, pure-JS *materializer*
> turns that skeleton + the world seed into a *complete, fully-resolved* design spec
> (concrete palette hex, resolved font stacks, block envelopes, validated banks, a
> single design-token table). The client *instantiator* reads that spec with zero
> client-side randomness.**

The split is the whole point:

- The **LLM** is cheap and *low-thinking*: it never emits a pixel, a hex, an angle,
  or a font-size. It only picks **enums and ordinals** from a closed vocabulary.
- The **materializer** is *deterministic*: given the same skeleton + seed it produces
  the identical materialized spec. That is what makes the look **stable per world**.
- The **instantiator** is a *pure reader*: same materialized spec ⇒ identical DOM
  (class list, CSS custom properties, SVG path data). Assertable in selftest.

This satisfies three hard constraints at once: *"the LLM never emits pixel values"*,
*"same world = same look"*, and *"nothing is a template — every value is generated
from the seed, and the LLM only makes the structural choices."*

---

## 1. The single small low-thinking LLM design call

### 1.1 Position in the boot flow

World generation (`app/llm.js::generateWorldWithLLM` / `app/world.js::generateWorld`)
already decides the *world*: name, theme, keeper, entities, verbs, and `world.interface`
(the paradigm: `gui` / `tui` / `device` / `scene`). The **design call is a second,
separate, smaller call** that turns the decided world into a *design spec*. It runs
once per boot (server-side), *after* the world is decided and *before* the spec is
cached with the world.

```
POST /api/boot {concept, seed}
  ├─ world = generateWorld(seed, concept)          // existing; decides paradigm etc.
  ├─ spec  = decideDesign(world, concept, seed)   // THIS DOCUMENT
  │             ├─ try LLM design call (~10s, ~450 tok)
  │             └─ on any failure → seededSkeleton(seed, concept)
  ├─ spec  = materialize(skeleton, seed, concept) // deterministic; see §2
  ├─ world.designSpec = spec
  ├─ writeWorldLarp(world)                          // persists spec (§3)
  └─ GET /api/world → { ..., designSpec: spec }
```

`decideDesign` returns a **materialized** spec either way; `world.designSpec` is
populated (existing behavior, `app/design.js::generateDesignSpec` is extended per §4).

### 1.2 The call's INPUT

A single OpenAI-compatible chat completion. Prompt carries **only** what a layout
decision needs — no world fiction (that was the previous call):

```jsonc
// system prompt (short, ~120 tokens) — a *constrained* layout picker:
//   You are the layout engine. Given a concept and a seed, choose ONE layout and
//   its blocks. Reply ONLY with a raw JSON object matching the skeleton schema.
//   Use ONLY the enumerated values below. No pixels, no hex, no font sizes, no
//   angles. Do not wrap in code fences.
//   ENUMS — paradigm: gui|tui|device|scene|invented
//           layout: <the 15 ids from layouts.md §3>
//           radius: sharp|low|mid|high|full
//           density: tight|normal|loose
//           motion: none|subtle|lively
//           accentBand: warm|cool|cold|vivid|muted
//           iconGram: flat-line|duotone|glyph|pictogram|hand-drawn (or null)
//           bar: none|bottom|top   menu: none|top|left   rail: none|left|right
//           font: sans|mono|serif|display
//           wallpaper: solid|gradient|grid|scanlines|noise|radial|procedural
//           block types: window|taskbar|menu-bar|button|gauge|terminal|
//                        icon|card|wallpaper|clock|dock
// user prompt:
//   CONCEPT: "<concept>"   SEED: <hexSeed>   PARADIGM: <world.interface>
//   Emit the design skeleton for this world.
```

The **seed is passed as a hex string** so the same concept+seed is reproducible
across the LLM and the seeded fallback. `PARADIGM` is *pre-decided* by the world
(`world.interface`); the LLM does not re-roll it, only refines layout/blocks inside
that paradigm. If the LLM emits a paradigm ≠ the world's, the materializer **clamps**
it back to the world's paradigm (paradigm consistency, `layouts.md` §5.2).

### 1.3 The call's OUTPUT — the compact design skeleton

This is the **compact design spec** the task asks for. It is *data, not code*: only
enums, ordinals, bank refs, world-content labels, small integer counts (0..12),
booleans, and at most one bounded float (`value` 0..1 on gauges). **No px / % / hex /
angle / code strings.**

```jsonc
{
  "paradigm":   "gui",
  "layout":     "generic-flat-linux",
  "topology":   { "bar": "bottom", "menu": "none", "rail": "none", "wallpaper": true },
  "aesthetic":  { "radius": "sharp", "density": "tight", "motion": "subtle", "accentBand": "cold" },
  "banks":      {
    "fonts":    ["sans", "mono"],
    "iconGram": "flat-line",
    "sounds":   ["boot", "click", "open", "error"]
  },
  "blocks": [
    { "id": "wallpaper", "block": "wallpaper", "style": "gradient", "accentLayer": "none" },
    { "id": "taskbar",   "block": "taskbar",   "side": "bottom",
      "start": { "label": "⌂", "icon": { "gram": "flat-line", "subject": "home" } },
      "slots": ["apps", "clock"], "showOpenApps": true },
    { "id": "clock",     "block": "clock",     "format": "hhmm", "zone": "inline", "parent": "taskbar" },
    { "id": "term",      "block": "terminal",  "variant": "windowed", "title": "Shell", "prompt": "❯", "seedLines": 6, "size": "m" },
    { "id": "w-term",    "block": "window",    "appRef": "term", "title": "Shell",
      "titleIcon": { "gram": "flat-line", "subject": "terminal" }, "variant": "standard", "state": "normal", "size": "m" },
    { "id": "files",     "block": "icon", "subject": "folder", "label": "Files",   "appRef": "files",  "size": "m", "zone": "desktop", "order": 0 },
    { "id": "editor",    "block": "icon", "subject": "file",   "label": "Editor",  "appRef": "editor", "size": "m", "zone": "desktop", "order": 1 },
    { "id": "sysmon",    "block": "icon", "subject": "gauge",  "label": "System",  "appRef": "sysmon", "size": "m", "zone": "desktop", "order": 2 },
    { "id": "trash",     "block": "icon", "subject": "trash",  "label": "Trash",   "appRef": "trash",  "size": "m", "zone": "desktop", "order": 3 }
  ]
}
```

**What the LLM is and is not allowed to emit**

| Field | Allowed value | Never |
|---|---|---|
| `paradigm` / `layout` / enums | the closed enum sets above | free text |
| `banks.fonts` | slots `sans\|mono\|serif\|display` | family names, px sizes |
| `banks.iconGram` | one grammar id or `null` | hex, path data |
| `banks.sounds` | cue ids `boot\|click\|open\|close\|error\|alarm\|tick\|blip\|none` | audio bytes |
| `aesthetic.*` | the four enums | px, ms, % |
| `topology.*` | the position enums | coordinates |
| `blocks[*]` | block type + type-specific *data* fields (labels, `appRef`, `subject`, `variant`, `size` ordinal, `order`, `value` 0..1) | geometry, color, font-size |

A block's *envelope* fields it may omit (`zone` default, `palette` role-mapping
default, `font` default) are **filled by the materializer** from the block type's
declared defaults (`blocks.md` §3/§8) — the LLM only supplies the *content* fields
that make this world's block what it is (labels, subjects, `appRef`, `variant`).

### 1.4 Budget, temperature, timeout

| Param | Value | Why |
|---|---|---|
| `reasoning_effort` | `"none"` | low-thinking; pattern-complete the layout, don't deliberate |
| `temperature` | `0.2` | consistency over creativity (the *world* was creative; the *layout* is a decision) |
| `max_tokens` | **`520`** (target ~450) | a practical desktop skeleton is ~9–18 blocks; 9-block example ≈ ~420 tokens. Hard cap stops runaway |
| `timeout` | **`10000` ms (~10 s)** | the design decision must never block the kiosk like world-gen does |
| tool use | none | single-shot |

### 1.5 Failure → deterministic fallback (never hang)

The design call is wrapped so **any** failure resolves to the seeded fallback for the
*exact same* seed+concept, and the kiosk never waits:

- LLM unreachable / probe fails → fallback.
- 10 s timeout → fallback (already running the combinatorial path — the fallback is
  computed *first*, the LLM is an *upgrade*, not a gate).
- Unparsable envelope / missing `paradigm` / `layout` → fallback.
- Schema-invalid enums → **clamped** to the nearest valid value (reader-not-validator,
  `spec.md` §5): unknown enum → the enum's declared default; unknown block type →
  dropped; a block with no content fields → defaulted.
- If clamping leaves **zero valid blocks** → whole-spec fallback.

The fallback is `seededSkeleton(seed, concept)` (§4). Because it is a pure function of
`(seed, concept)`, the fallback is **also** stable per world — a flaky LLM never
produces a *different* look, only the *same* seeded look.

---

## 2. The materializer + the COHESION pass

The materializer is the heart of this document. It takes the (LLM or seeded)
**skeleton** + `world.seed` + `concept` and produces a **fully-resolved design spec**
by computing **one design-token table** that every block then consumes.

### 2.1 One seed → one `Scale` → one token table (the cohesion mechanism)

Cohesion is not "shared code" — it is **shared data**. The materializer derives a
single **`tokens`** object **once**, from one seeded draw, and **every block reads
from it**. No block may introduce a value that is not in `tokens`.

```js
// computed ONCE by the materializer; the instantiator emits it as CSS custom props.
tokens = {
  // COLOR — from app/banks/palettes.generatePalette(seed, concept) (concept-steered)
  color: {
    bg, surface, surface2, accent, accent2,   // 5 core (palettes.js array)
    text, textDim, border, ok, warn, danger, glow
  },
  // GEOMETRY — from ONE seeded draw, one base unit
  unit:     u,            // em = viewportHeight / ~64 rows (one internal constant)
  spacing:  [2u, 4u, 6u, 8u],   // the ONLY allowed gaps/margins (4-step scale)
  radiusPx,               // sharp=0 low=2 mid=4 high=8 full=999, clamped to layout band
  borderW,               // hairline 1px (tight) / 2px (loose)
  fontBasePx,            // 11–16 from density
  font:  { primary: <stack>, mono: <stack> },  // the ONLY two families (fonts.js)
  stripH:  { s, m, l, xl },        // slot(size) × densityScale × u
  icon:  { gram, strokeW, slot: 'text' },      // one grammar for all icons
  motion:  { hoverMs, pressMs, blinkMs }       // from aesthetic.motion
}
```

`tokens` is emitted **once** as root CSS custom properties:

```css
:root{
  --p-bg:…; --p-surface:…; --p-surface-2:…; --p-accent:…; --p-accent-2:…;
  --p-text:…; --p-text-dim:…; --p-border:…; --p-ok:…; --p-warn:…; --p-danger:…; --p-glow:…;
  --u:…; --sp-1:…; --sp-2:…; --sp-3:…; --sp-4:…;
  --radius:…; --border-w:…; --font-base:…; --font-primary:…; --font-mono:…;
  --bar-s:…; --bar-m:…; --bar-l:…; --bar-xl:…; --icon-stroke:…;
  --motion-hover:…; --motion-press:…; --motion-blink:…;
}
```

A block never hard-codes a number; it references a variable. **That single emission
is the primary cohesion force**: every surface, gap, corner, font, stroke, and motion
duration in the whole OS is a value that came from the *same* one draw.

### 2.2 The six cohesion rules (assertable invariants)

The cohesion pass is a **set of invariants** the instantiator guarantees and the
selftest *verifies* by scanning the materialized DOM's computed styles. "One system,
not random parts" means:

| # | Cohesion force | Mechanism | Invariant the selftest asserts |
|---|---|---|---|
| C1 | **Shared palette propagation** | every block maps *roles → palette slots*, never hex; slots resolve to the one `tokens.color` set | every emitted color ∈ `tokens.color` (no block-introduced hex outside the palette) |
| C2 | **One radius, one scale** | every rounded element uses `tokens.radiusPx`; every gap/margin ∈ `tokens.spacing × ℤ` | all `border-radius` == `--radius` (per variant class); all `margin`/`gap`/`padding` ∈ the spacing scale |
| C3 | **Icon-grammar consistency** | the world pulls *one* `gram`; all icons (desktop, taskbar, menu, window controls) are drawn through the single `drawIcon(gram, subject, seed, palette)` | all icons share the same `gram` (unless a block explicitly overrides) and the same stroke slot/width |
| C4 | **Font pairing** | the world pulls *one pair* (primary + mono); a block's `font` is `"primary"` or `"mono"`, never an arbitrary family | all `font-family` ∈ {`tokens.font.primary`, `tokens.font.mono`} |
| C5 | **Spacing scale** | gaps are always multiples of `u` from `tokens.spacing` | no off-scale gap (see C2) |
| C6 | **Motion + chrome consistency** | one `motion` enum; all hover/press/blink durations from `tokens.motion`; all raised surfaces share the same `border` slot, `borderW`, and a motion-derived shadow | all shadows == the one motion-derived shadow; all raised surfaces use `--p-border` at `--border-w` |

Because C1–C6 all read from the *same* `tokens`, a `taskbar`, a `window`, a `card`,
a `terminal`, and a `gauge` automatically share the same six colors, the same
corner radius, the same font pair, the same spacing rhythm, the same icon hand, and
the same motion timing. **That is what makes independently-picked blocks read as one
OS.** The blocks were chosen for *this* world's content (its entities, its apps);
they look like *one system* because they all consume the same token table.

### 2.3 Materialization steps (deterministic order)

The materializer runs these in a **fixed order** (documented so a seeded run is
reproducible):

1. **Normalize** `paradigm` (clamp to `world.interface`), `layout` (clamp to the
   paradigm's valid ids, `layouts.md` §5.2), all aesthetic enums (clamp to the
   layout family's band).
2. **Validate banks** — `fonts` slots → resolved stacks via `fonts.js`; `iconGram`
   → a valid grammar (or `null` for tui, which pulls *no* icons); `sounds` → valid
   cue ids (empty for tui).
3. **Generate palette** — `palettes.generatePalette(seed, concept)` → `tokens.color`
   (concept-steered hue/sat band; seed sets exact hex).
4. **Derive `Scale`** — one seeded draw → `unit`, `spacing`, `radiusPx` (clamped to
   layout band), `borderW`, `fontBasePx`, `stripH`, `icon`, `motion`.
5. **Build block list** — for each skeleton block: resolve the envelope defaults
   (`zone`, `size`, `palette` role-map, `font`) from the block type's declared
   defaults; keep the skeleton's content fields; ensure the home affordance block is
   wired to the world's `homeVerb` (every layout defines exactly one, `layouts.md` §7).
6. **Emit** the materialized spec (§3 schema) with `source` = `"llm"` or `"seeded"`.

Because steps 1–6 are pure and the only source of entropy is the seed (and the
skeleton, which is itself either the LLM output or `seededSkeleton`), the result is
**deterministic**: same `(seed, concept, skeleton)` ⇒ identical spec.

---

## 3. Persistence & per-world stability

### 3.1 Where the spec lives

- **In memory:** `world.designSpec` (already the field the server serves,
  `app/server.js:72` → `designSpec: world.designSpec`).
- **On disk:** written with the world. The engine already writes
  `<stateDir>/world-<seed>.larp` (`app/larp.js::writeWorldLarp`). The design spec is
  embedded as a machine-readable section of that `.larp` file **and** mirrored to a
  sidecar `<stateDir>/world-<seed>.design.json` so the client can fetch it directly
  without parsing the loose `.larp` body.
- **Served:** `GET /api/world` returns `designSpec` in the world payload (existing).
  The client **instantiator runs client-side** and reads `designSpec` — zero
  client-side randomness, so the kiosk renders instantly and the look is identical on
  every reload of the same world.

### 3.2 Why the look is stable per world

Stability is a **property of the data, not the process**:

- `designSpec = materialize(skeleton(seed, concept), seed, concept)`, and the
  instantiator is a **pure reader** of that spec.
- Same world (same `seed` + `concept`) ⇒ same `skeleton` ⇒ same materialized spec ⇒
  same `tokens` ⇒ **identical DOM** (class list, CSS custom properties, SVG path
  data). A reload, a kiosk restart, or a re-fetch all render the *same* look.
- The **live app *content*** may drift on reopen (model variance is the feature,
  `spec.md` §5) — but the **look** (the spec / the `tokens`) is *stable*. Structure
  may drift, pixels don't (`blocks.md` §6).
- **Selftest assert:** `deepEqual(spec(seed, concept), spec(seed, concept))` and
  `deepEqual(instantiate(spec).classes, instantiate(spec).classes)`; and
  `spec(seedA, concept) ≠ spec(seedB, concept)` (non-collision between seeds).

> Determinism note: this stability is about the **world spec level** (the look).
> Acceptance criterion §11: "identical seed+concept ⇒ identical design spec; the
> instantiator is deterministic." That is exactly what this persistence model gives.

### 3.3 Re-interpretation is content, not look

When the active `.larp` file is live-rewritten (`spec.md` §10), the engine may add a
law, a verb, or an app — those change the *content* and can add a *block* (an app tile).
The **design spec (the look) is not re-rolled** on content edits; a new *world* (new
seed/concept) is what changes the look. This keeps the skin stable while the fiction
is allowed to mutate.

---

## 4. The offline path (seeded PRNG, no LLM)

`seededSkeleton(seed, concept)` is the deterministic fallback and the whole offline
engine. It is a **pure function** of `(seed, concept)` using **one** `PRNG` stream
(`app/prng.js`, fixed draw order) so the output is reproducible. This is what the
current `app/design.js::generateDesignSpec` already does (paradigm-branch pulls); the
offline path **extends** it to also emit `layout`, `blocks`, `aesthetic`, and the
`tokens` hand-off.

```
seededSkeleton(seed, concept):
  prng = new PRNG(seed)                      # one stream, fixed draw order
  # 1. paradigm — from world.interface if a world is present; else concept-steered
  paradigm = world ? world.interface : conceptParadigm(concept)   # layouts.md §4
  # 2. layout — concept-keyword map (layouts.md §4); neutral default = generic-flat-linux
  layout   = conceptLayout(concept) || "generic-flat-linux"
  # 3. aesthetic enums — drawn inside the layout family's band (layouts.md §3/§6)
  aesthetic = drawAesthetic(prng, layout)    # radius/density/motion/accentBand enums
  # 4. bank pulls — seeded, paradigm-gated
  iconGram = (paradigm === "tui") ? null : prng.choice(GRAMMARS)
  fonts    = selectFontsForWorld(prng, paradigm).slots
  sounds   = selectSoundsForWorld(paradigm, seed).names   # empty for tui
  # 5. topology — from the layout entry's ranges, seeded within
  topology = drawTopology(prng, layout)      # bar/menu/rail/wallpaper enums
  # 6. blocks — the layout's required block set + one per world entity
  blocks   = layoutBlocks(layout)
             + worldEntities.map(e => iconForEntity(e))    # icon (+ optional window/card)
             .forEach(b => b.order = nextOrder(prng))
  return { paradigm, layout, topology, aesthetic,
           banks: { fonts, iconGram, sounds }, blocks }
```

**Determinism guarantees**

- One PRNG stream, **fixed draw order** (paradigm → layout → aesthetic → banks →
  topology → blocks). Reordering the draws would change values, so the order is
  documented and never reordered.
- Bank pulls are **paradigm-gated**: a `tui` world pulls **no** icon-grammar and **no**
  sounds (`spec.md` §11 criterion; `sounds.js` already returns `{}` for tui).
- **Selftest:** `deepEqual(seededSkeleton(seed, concept), seededSkeleton(seed,
  concept))` (bit-identical), and two different seeds produce different skeletons.

This is the path that runs when the LLM is down, when `LLM_DISABLED=1`, or in
`app/selftest.js` (which must pass **offline**). The LLM is an *upgrade* on top of
this; the offline path is the *floor* — the kiosk always has a valid, stable spec.

---

## 5. Worked example — "a highly practical and lightweight desktop operating system"

### 5.1 The decision

- **Concept:** `a highly practical and lightweight desktop operating system`
- **Seed:** `0x0005eed1`
- **Paradigm:** the world engine (`world.js`) sees `practical|lightweight|desktop`
  → `practical_desktop` archetype → `world.interface = "gui"`.
- **Layout:** the concept-keyword map (`layouts.md` §4) matches
  `"practical", "lightweight", "practical and lightweight desktop operating system"`
  → **`generic-flat-linux`** (the neutral "practical workbench", *never* a flashy
  default — `spec.md` §11).

### 5.2 The resulting design spec (materialized)

Palette / font / sound values below are the **real** bank outputs for this
seed+concept (from `app/banks/palettes.js` + `fonts.js` + `sounds.js`); the
topology / aesthetic / blocks come from the `generic-flat-linux` layout entry.
This is what `world.designSpec` holds and what `GET /api/world` serves.

```jsonc
{
  "schema": 1,
  "source": "seeded",                       // LLM or seeded
  "seed": "0x0005eed1",
  "concept": "a highly practical and lightweight desktop operating system",
  "paradigm": "gui",
  "layout": "generic-flat-linux",
  "topology": { "bar": "bottom", "menu": "none", "rail": "none", "wallpaper": true },
  "aesthetic": { "radius": "sharp", "density": "tight", "motion": "subtle", "accentBand": "cold" },
  "banks": {
    "fonts":    ["sans", "mono"],
    "iconGram": "flat-line",
    "sounds":   ["boot", "click", "open", "error"]
  },
  "paletteBands": { "hue": 215, "sat": 41, "light": 50 },
  "palette": {
    "bg": "#101214", "surface": "#292f37", "surface2": "#313943", "accent": "#7a9ac7",
    "fg": "#f0f2f4", "dim": "#6b7e99", "highlight": "#ecbc79"
  },
  "tokens": {                                // the single cohesion table (§2.1)
    "color": { "bg":"#101214","surface":"#292f37","surface2":"#313943",
               "accent":"#7a9ac7","accent2":"#5f7f9e","text":"#f0f2f4","textDim":"#6b7e99",
               "border":"#3a434e","ok":"#67c08a","warn":"#d7a04a","danger":"#d06a5a","glow":"#7a9ac7" },
    "unit": 16,
    "spacing": [8, 16, 24, 32],
    "radiusPx": 0,
    "borderW": 1,
    "fontBasePx": 12,
    "font": { "primary": "ui-sans-serif, system-ui, \"DejaVu Sans\", sans-serif",
              "mono":    "ui-monospace, \"DejaVu Sans Mono\", \"Courier New\", monospace" },
    "stripH": { "s": 24, "m": 36, "l": 48, "xl": 64 },
    "icon": { "gram": "flat-line", "strokeW": 1.5, "slot": "text" },
    "motion": { "hoverMs": 120, "pressMs": 80, "blinkMs": 600 }
  },
  "blocks": [
    { "id": "wallpaper", "block": "wallpaper", "zone": "wallpaper", "order": 0,
      "style": "gradient", "from": "bg", "to": "surface", "accentLayer": "none", "opacity": "full" },
    { "id": "taskbar", "block": "taskbar", "zone": "bottom", "order": 0, "size": "m", "side": "bottom",
      "start": { "label": "⌂", "icon": { "gram": "flat-line", "subject": "home" } },
      "slots": ["apps", "clock"], "showOpenApps": true },
    { "id": "clock", "block": "clock", "zone": "inline", "parent": "taskbar", "size": "s",
      "format": "hhmm", "font": "mono" },
    { "id": "term", "block": "terminal", "zone": "stack", "order": 0, "size": "m",
      "variant": "windowed", "title": "Shell", "prompt": "❯", "seedLines": 6, "font": "mono" },
    { "id": "w-term", "block": "window", "zone": "stack", "order": 0, "size": "m",
      "appRef": "term", "title": "Shell", "titleIcon": { "gram": "flat-line", "subject": "terminal" },
      "variant": "standard", "state": "normal" },
    { "id": "files",  "block": "icon", "zone": "desktop", "order": 0, "size": "m", "subject": "folder", "label": "Files",  "appRef": "files" },
    { "id": "editor", "block": "icon", "zone": "desktop", "order": 1, "size": "m", "subject": "file",   "label": "Editor", "appRef": "editor" },
    { "id": "sysmon", "block": "icon", "zone": "desktop", "order": 2, "size": "m", "subject": "gauge",  "label": "System", "appRef": "sysmon" },
    { "id": "trash",  "block": "icon", "zone": "desktop", "order": 3, "size": "m", "subject": "trash",  "label": "Trash",  "appRef": "trash" }
  ]
}
```

### 5.3 What it renders

A **normal, practical desktop** — the `generic-flat-linux` topology, dark neutral
palette (cool blue-grey, hue 215, low-sat), one accent (`#7a9ac7`) used *only* for
focus/active:

- **Wallpaper** (full-bleed, z0): a flat two-stop `bg→surface` gradient, no texture,
  no glow — a plain neutral backdrop, not a sci-fi default.
- **Bottom taskbar** (full-width, `--bar-m` = 36 px, flat solid `surface2`, 1 px
  hairline, no bevel/translucency): left = a plain square **Menu** button (`⌂`, 16 px
  grid glyph, *no brand*); center = one quick-button per open window (a `Shell`
  entry, active = accent underline); right = a 1-line mono **clock** (`hhmm`, 12 px).
- **Desktop icon grid** (top-left, 1–3 columns, 4 icons, 16–20 px): `Files`,
  `Editor`, `System`, `Trash` — all drawn through the single `flat-line` grammar in
  the `text` slot, so the four icons read as *one icon set*.
- **One open window** — `Shell`, a plain titled frame (headerbar 30 px, title
  **left**, 3 square control buttons on the right, 0–2 px corners, flat fill, 1 px
  border, no shadow) hosting the **terminal** block: mono text, `❯` prompt, a seeded
  6-line boot log, a blinking block cursor (blink 600 ms, `motion: subtle` — hover
  120 ms, press 80 ms).
- **Cohesion in practice:** every one of those pieces shares the *same* six colors,
  the *same* 0 radius, the *same* `tight` spacing scale (8/16/24/32 px), the *same*
  `sans + mono` pair, the *same* `flat-line` icon hand, and the *same* 120/80/600 ms
  motion timing — all from the one `tokens` table. It reads as **one practical
  workbench**, not four unrelated widgets. The only strangeness is *content* (the
  keeper's voice, the world's laws), never the look — exactly the `spec.md` §11
  "practical desktop with normal computer/Linux texture" acceptance criterion.

Compare: the *same* concept with a different seed produces a different accent hue
(within the cool band), a different wallpaper variant, a different app set and icon
count — a *different machine*, same family. A *wildly different* concept (e.g.
"tty1", "cockpit") produces a different **paradigm and layout** entirely (`tui` /
`instrument-console`), so no two worlds share a template look.

---

## 6. The exact design-spec JSON Schema

The materialized design spec (`world.designSpec`) conforms to this schema. The LLM
**skeleton** (§1.3) is the same object *minus* `tokens` / `palette` / `paletteBands`
(those are materializer-filled).

```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "larpos.designSpec",
  "type": "object",
  "required": ["schema","paradigm","layout","topology","aesthetic","banks","blocks"],
  "properties": {
    "schema":   { "const": 1 },
    "source":   { "enum": ["llm","seeded"] },
    "seed":     { "type": "string", "pattern": "^0x[0-9a-f]{1,8}$" },
    "concept":  { "type": "string" },
    "paradigm": { "enum": ["gui","tui","device","scene","invented"] },
    "layout": {
      "enum": ["windows-xp","windows-10","windows-11","classic-macos","modern-macos",
               "kde-plasma","gnome","generic-flat-linux","tty-terminal","instrument-console",
               "game-hud","radial-orbital","vertical-ledger","card-deck","diegetic-room"]
    },
    "topology": {
      "type": "object",
      "properties": {
        "bar":       { "enum": ["none","bottom","top"] },
        "menu":      { "enum": ["none","top","left"] },
        "rail":      { "enum": ["none","left","right"] },
        "wallpaper": { "type": "boolean" }
      },
      "required": ["bar","menu","rail","wallpaper"]
    },
    "aesthetic": {
      "type": "object",
      "properties": {
        "radius":     { "enum": ["sharp","low","mid","high","full"] },
        "density":    { "enum": ["tight","normal","loose"] },
        "motion":     { "enum": ["none","subtle","lively"] },
        "accentBand": { "enum": ["warm","cool","cold","vivid","muted"] }
      },
      "required": ["radius","density","motion","accentBand"]
    },
    "banks": {
      "type": "object",
      "properties": {
        "fonts":    { "type":"array", "items": { "enum":["sans","mono","serif","display"] }, "minItems":1, "maxItems":2 },
        "iconGram": { "enum":["flat-line","duotone","glyph","pictogram","hand-drawn", null] },
        "sounds":   { "type":"array", "items": { "enum":["boot","click","open","close","error","alarm","tick","blip","none"] } }
      },
      "required": ["fonts","iconGram","sounds"]
    },
    "paletteBands": { "type":"object", "properties": { "hue":{"type":"integer","minimum":0,"maximum":359}, "sat":{"type":"integer","minimum":0,"maximum":100}, "light":{"type":"integer","minimum":0,"maximum":100} } },
    "palette": {
      "type":"object",
      "properties": { "bg":{"$ref":"#/$defs/hex"}, "surface":{"$ref":"#/$defs/hex"}, "accent":{"$ref":"#/$defs/hex"}, "fg":{"$ref":"#/$defs/hex"}, "dim":{"$ref":"#/$defs/hex"}, "highlight":{"$ref":"#/$defs/hex"} }
    },
    "tokens": {
      "type":"object",
      "properties": {
        "color":    { "type":"object", "additionalProperties": { "$ref":"#/$defs/hex" } },
        "unit":     { "type":"integer", "minimum":1 },
        "spacing":  { "type":"array", "items":{ "type":"integer" }, "minItems":1 },
        "radiusPx": { "type":"integer", "minimum":0 },
        "borderW":  { "type":"integer", "minimum":0 },
        "fontBasePx":{ "type":"integer", "minimum":8, "maximum":32 },
        "font":     { "type":"object", "properties": { "primary":{"type":"string"}, "mono":{"type":"string"} } },
        "stripH":   { "type":"object", "properties": { "s":{"type":"integer"},"m":{"type":"integer"},"l":{"type":"integer"},"xl":{"type":"integer"} } },
        "icon":     { "type":"object", "properties": { "gram":{"type":["string","null"]}, "strokeW":{"type":"number"}, "slot":{"type":"string"} } },
        "motion":   { "type":"object", "properties": { "hoverMs":{"type":"integer"}, "pressMs":{"type":"integer"}, "blinkMs":{"type":"integer"} } }
      }
    },
    "blocks": {
      "type":"array", "minItems":1, "maxItems":40,
      "items": { "$ref":"#/$defs/block" }
    }
  },
  "$defs": {
    "hex": { "type":"string", "pattern": "^#[0-9a-fA-F]{6}$" },
    "paletteRef": { "type":"object", "additionalProperties": { "enum":["bg","surface","surface-2","accent","accent-2","text","text-dim","border","ok","warn","danger","glow","transparent"] } },
    "iconRef": {
      "type":"object",
      "properties": { "gram":{"enum":["flat-line","duotone","glyph","pictogram","hand-drawn"]}, "subject":{"type":"string"} }
    },
    "actionRef": { "enum":["noop","open-app","focus-app","close-app","toggle","run","set","sound"],
      "description": "closed action grammar, blocks.md §4.5 (full form 'open-app:<id>' etc.)" },
    "block": {
      "type":"object",
      "required":["id","block"],
      "properties": {
        "id":      { "type":"string", "pattern":"^[a-z0-9][a-z0-9\\-]{0,31}$" },
        "block":   { "enum":["window","taskbar","menu-bar","button","gauge","terminal","icon","card","wallpaper","clock","dock"] },
        "zone":    { "enum":["wallpaper","top","bottom","left-rail","right-rail","desktop","stack","inline","full"] },
        "order":   { "type":"integer", "minimum":0, "maximum":99 },
        "parent":  { "type":["string","null"] },
        "visible": { "type":"boolean" },
        "size":    { "enum":["s","m","l","xl","full"] },
        "palette": { "$ref":"#/$defs/paletteRef" },
        "font":    { "enum":["sans","mono","serif","display"] },
        "value":   { "type":"number", "minimum":0, "maximum":1 },
        "hooks":   { "type":"object", "additionalProperties": { "oneOf":[{"const": true},{"type":"string","pattern":"^(open-app|focus-app|close-app|toggle|run|set|sound|noop)(:[\\w\\-]+(=[^\\s]+)?)?$"} ] } }
      }
    }
  }
}
```

> The `font` slot is one of the four bank slots (`sans\|mono\|serif\|display`) — the
> instantiator resolves it against the world's pulled pair (`tokens.font`); a block
> asking for a slot the world didn't pull gets the pair's primary. Block-*type-specific*
> fields (e.g. `appRef` on `window`, `subject` on `icon`, `kind` on `gauge`, `style` on
> `wallpaper`) are defined by `blocks.md` §8 and are **additional** to the envelope above
> (the schema above is the *envelope*; each type adds its own fields, validated by the
> instantiator's reader-not-validator pass — `blocks.md` §10).

---

## 7. Implementation notes for the engine (no code, just the seams)

- **Extend `app/design.js::generateDesignSpec`** to emit the full materialized spec
  (§6) for the *seeded* path; keep the existing paradigm branches but add `layout`,
  `aesthetic`, `tokens`, and `blocks`.
- **Add `decideDesign(world, concept, seed)`** (new, in `app/design.js`): try the LLM
  skeleton call (§1) with `reasoning_effort:"none"`, `temperature:0.2`,
  `max_tokens:520`, `timeout:10000`; on any failure fall back to
  `seededSkeleton` (§4); then `materialize` (§2) and return. Compute the seeded
  fallback *first* so the kiosk never gates on the LLM.
- **Wire into `world.js::generateWorld`** (already calls `generateDesignSpec` in a
  `try/catch`) and into the LLM path in `app/llm.js` — set `world.designSpec` from
  `decideDesign`.
- **Persist** in `app/larp.js::writeWorldLarp` (embed the spec + write
  `world-<seed>.design.json` sidecar).
- **Serve** already at `app/server.js:72` (`designSpec: world.designSpec`).
- **Client instantiator** (`app/index.html::instantiateParadigm`): read
  `world.designSpec`, emit `tokens` as `:root` custom properties **once** (§2.1),
  then materialize each block from `designSpec.blocks` — **zero** client-side
  randomness.
- **Selftest** (`app/selftest.js`) additions: (a) `spec` determinism (bit-identical
  for same seed+concept); (b) non-collision across seeds; (c) cohesion invariants
  C1–C6 (scan materialized DOM computed styles); (d) the LLM-failure path returns a
  valid seeded spec for the exact same seed+concept; (e) the practical-desktop
  concept yields `layout: "generic-flat-linux"`, `paradigm: "gui"`, and a `generic-
  flat-linux` block set (no flashy default).

## 8. Boundaries & open questions for the other designers

- **Blocks designer:** this doc *references* your `blockSpec` envelope and 11 types;
  I do not redefine them. The materializer fills your declared per-type defaults
  (§8). If a type's default envelope changes, the materializer's step 5 follows.
- **Layouts designer:** `layout` is your 15-id vocabulary; `aesthetic` enums are
  clamped to your family bands (§3); `topology` is drawn within your ranges (§6).
  The concept-keyword→layout map (§4) is yours; I consume it.
- **Banks / fonts / icons / palettes:** I consume `fonts.selectFontsForWorld`,
  `icons.drawIcon`, `sounds.selectSoundsForWorld`, `palettes.generatePalette` — all
  seeded, all paradigm-gated. I never re-derive a bank value; I only *resolve* slots
  to the `tokens` table.
- **Open:** whether `accentBand` should also feed a *light/dark* mode choice
  (`generic-flat-linux` allows both). Currently the palette's `bg` lightness decides
  mode; `accentBand` only steers the accent hue. If the instantiator needs an
  explicit `mode: "light"|"dark"` token, add it to `tokens` (one seeded draw) and
  this doc's schema (`$defs` + `tokens.properties`).
