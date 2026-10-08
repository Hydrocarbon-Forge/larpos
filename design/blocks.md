# LarpOS — Building-Block Contract

**Owner:** blocks designer · **Status:** design · **Depends on:** `spec.md` §5/§11 (design spec,
banks, instantiator), `app/prng.js` (seeded PRNG).

The instantiator builds a whole OS from **blocks**: atomic, reusable UI units. A world's
design spec is a list of small block specs; the instantiator materializes each one into
DOM/CSS/SVG and wires its hooks. This document defines the contract every block must
expose so that:

1. the LLM (or seeded PRNG offline) can **pick a block and pass a small spec** and get
   **consistent rendered output**;
2. the LLM **never emits pixel values** — all geometry, color, font, and glyph detail is
   resolved by the instantiator from topology, aesthetic params, bank refs, and the world
   seed;
3. the same world seed + same block spec ⇒ **identical DOM** (class list, CSS custom
   properties, SVG paths). Deterministic per world, different across worlds.

---

## 1. Core principles

- **Specs are data, not code.** A block spec contains only: enums, ordinals, bank refs,
  world-content labels, small integer counts (0..12), booleans, and at most one bounded
  float `value: 0..1`. No px, %, hex, angles, or code strings.
- **No pixels in specs.** Every concrete number (position, width, radius, spacing, angle,
  shadow) is computed: `f(zone, order, size ordinal, topology, aesthetic, seeded PRNG)`.
- **Blocks are paradigm-agnostic; the instantiator materializes per paradigm.** One
  spec shape, four materializations (gui / tui / device / scene) — a `button` in tui is a
  text label `[open]`, in gui a styled `<button>`, in device a bezeled control. See §7.
- **Reader-not-validator (spec §5).** A malformed spec degrades, never throws: unknown
  enum → nearest listed value; unknown ref → the ref's declared default; unparseable spec
  → a "damaged" block shell (in-world damage, never a white screen). See §10.
- **Hooks are action refs, not handlers.** Interactivity is declared as
  `hooks: { click: "open-app:term" }` — a small closed grammar (§4.5) the instantiator
  resolves against the world engine.

---

## 2. Layout spec — the composition unit

A design spec carries the paradigm, topology, aesthetic params, bank pulls, and the
block list. Blocks compose by **zone** (where they live) and **order** (sibling order),
plus optional nesting via `parent`.

```js
layoutSpec = {
  paradigm: "gui" | "tui" | "device" | "scene" | "invented",
  topology: {
    bar:       "none" | "bottom" | "top",        // taskbar location
    menu:      "none" | "top" | "left",          // menu-bar location
    rail:      "none" | "left" | "right",        // dock location
    wallpaper: true | false
  },
  aesthetic: {
    radius:  "sharp" | "low" | "mid" | "high" | "full",
    density: "tight" | "normal" | "loose",       // spacing/scale band
    motion:  "none" | "subtle" | "lively",       // hover/press/blink amount
    accentBand: "warm" | "cool" | "cold" | "vivid" | "muted" // steers palette gen
  },
  banks: {
    fonts:    ["sans", "mono"],                  // slots pulled from app/banks/fonts.js
    iconGram: "flat-line",                       // grammar pulled from app/banks/icons.js
    sounds:   ["click", "open", "blip"],        // cues pulled from app/banks/sounds.js
    palette:  "world-palette"                    // world palette id (app/banks/palettes.js)
  },
  blocks: [ /* blockSpec[] — §3 */ ]
}
```

**Zone model** (the only "where" vocabulary — no coordinates):

| zone | region | typical residents |
|---|---|---|
| `wallpaper` | full-bleed, z-index 0 | `wallpaper` |
| `top` | full-width strip at top, height = size × density slot | `menu-bar`, `taskbar` (top), `clock` |
| `bottom` | full-width strip at bottom | `taskbar`, `clock` |
| `left-rail` / `right-rail` | full-height column, width = size × density slot | `dock` |
| `desktop` | remaining rectangle, icon grid (columns from density + aspect) | `icon`, `card` |
| `stack` | desktop region minus bars/rails; windows cascade here | `window` |
| `full` | entire viewport | `terminal` (tui), `wallpaper` |
| `inline` | inside `parent`'s content box | everything |

A block may also carry `parent: "<block-id>"` with `zone: "inline"` to nest (e.g. a
`gauge` inside a `card`, a `clock` inside a `taskbar`).

---

## 3. Block envelope — shared fields

Every block spec starts with this envelope, then adds type-specific fields:

```js
blockSpec = {
  id:    "w-term",            // string, instance id, unique within layout
  block: "window",            // string, one of the 11 types (§8)
  zone:  "stack",             // enum, §2
  order: 2,                  // int 0.., sibling order within zone (z-order + layout)
  parent: null,              // block id when zone === "inline", else null
  visible: true,             // bool, default true
  size: "m",                 // ordinal: "s" | "m" | "l" | "xl" (per-block default if omitted)
  palette: { /* role → palette slot, §4.1 */ },
  font: "sans",              // font slot or [primary, secondary], §4.2
  hooks: { /* hook → action ref, §4.5 */ }
}
```

---

## 4. Reference vocabulary

The LLM references bank entries **by name only**; the instantiator resolves them.

### 4.1 Palette slots (`app/banks/palettes.js`)

The world's palette is generated once (seeded HSL/OKLCH, steered by `accentBand`) into
named slots. Blocks never see hex — they map **roles → slots**, and the instantiator
emits CSS custom properties `--p-<slot>`.

| slot | role |
|---|---|
| `bg` | page / wallpaper base |
| `surface` | raised panel |
| `surface-2` | nested panel / hover |
| `accent` | the world's accent (hue from accentBand) |
| `accent-2` | secondary accent |
| `text` | primary text |
| `text-dim` | secondary text |
| `border` | hairline / stroke |
| `ok` / `warn` / `danger` | status |
| `glow` | luminance (device/scene) |

Palette ref shape (role names are block-specific, slots are from this table):

```js
palette: { fill: "surface", stroke: "border", label: "text", accent: "accent" }
```

Omitted role → the block's declared default role→slot mapping. Unknown slot → `surface`.

### 4.2 Font slots (`app/banks/fonts.js`)

`font: "mono" | "sans" | "serif" | "display"` or `[primary, secondary]`. Each slot is a
named family stack present in the image (monospace tiers, flat sans, serif, display).
Size is **not** in the spec: computed from `size` ordinal × density.

### 4.3 Icon refs (`app/banks/icons.js`)

```js
icon: { gram: "flat-line", subject: "terminal" }
```

- `gram` — icon-grammar style function: `flat-line | duotone | glyph | pictogram | hand-drawn`.
- `subject` — a core subject id (`app, folder, file, terminal, trash, system, gauge,
  clock, power, sound, home, close, minimize, user, world, log, hatch, mouth, mirror`)
  **or a world-named subject** (e.g. `"valve"`, `"eye"`). The grammar draws the SVG
  procedurally from `(subject, seed)` — an unknown subject still draws (seeded motif
  derived from the subject's hash), never a blank.
- The world pulls one grammar globally (`banks.iconGram`); a block's `icon.gram` may
  override per-block. Icons render as inline SVG with strokes/fills from palette slots.

### 4.4 Sound cues (`app/banks/sounds.js`)

`sound: "boot" | "click" | "open" | "close" | "error" | "alarm" | "tick" | "blip" | "none"`
— a small cue id; the bank synthesizes it (parametric blip with pitch/decay/ring).

### 4.5 Action refs (hook targets)

Closed grammar — the only strings a hook may reference:

```
open-app:<app-id>      open/raise the app's window or view
focus-app:<app-id>     raise + focus without reinterpreting
close-app:<app-id>     close the app's window/view
toggle:<block-id>      toggle a menu/dock/popover open state
run:<verb>             execute a world verb through the engine
set:<app>:<elem>       set a gauge/control value (used by change hooks)
sound:<cue>            play a sound cue
noop                   explicitly do nothing
```

`hooks` maps a **hook name** (from §8's per-block hook list) to an action ref, or to
`true` (enable default behavior, e.g. `drag: true`). Unknown hook name → ignored;
unknown action → `noop` (with a one-time `console.warn`, never a crash).

---

## 5. Geometry resolution — where pixels come from

The instantiator's internal tables (never in specs):

- **Strip heights / rail widths:** `slot(size)` = `{s: 1, m: 1.5, l: 2, xl: 2.8}` ×
  `densityScale` = `{tight: 0.85, normal: 1, loose: 1.2}` × a base unit (1 base unit =
  the layout's em, derived from viewport height / ~64 rows — one internal constant).
- **`size` ordinal → scale:** `{s: 0.75, m: 1, l: 1.35, xl: 1.8}` × `densityScale`.
- **Desktop grid:** columns = `clamp(floor(desktopW / (iconUnit × densityScale)), 3, 8)`;
  rows follow; `order` → grid position.
- **Stack cascade:** window *i* offset = seeded jitter (±10% of window size) + i ×
  cascadeStep (density-derived); z-index = `order`, focus raises to top.
- **Inline flow:** `order` → source order within the parent's content box (flex/grid).
- **Micro-geometry** (radius px, shadow, gradient angle, tick counts, glyph jitter,
  scanline period): drawn from the world's seeded PRNG, stream initialized
  `rng = mulberry32(fnv1a(world.seed + ":" + block.id))` (`app/prng.js`). **Draw order is
  fixed and documented** so the stream is stable: `[position jitter, size jitter,
  radius, shadow, micro-glyph choices, decorative seed]`.

**Numbers a spec may contain:** `order` (int), small counts (0..12), `value` (float 0..1,
gauges only). Nothing else.

---

## 6. Determinism and drift

- **Geometry is pure:** same `world.seed` + same block spec ⇒ identical DOM (assertable in
  selftest: instantiate twice, compare class list + computed CSS vars + SVG path data).
- **Structure may drift, pixels don't:** the LLM's choice of *which* blocks/specs exist
  is allowed to vary between opens (spec §5 — model variance is the feature). Once a spec
  is fixed, its materialization is constant.
- **Bank pulls are seeded:** `banks.*` entries for a given seed are the same every time;
  a tui world references no icon-gram entries; a tty-only world pulls zero sounds.
- The design spec is **cached with the world** and served at `/api/world`; the
  instantiator runs client-side, so the kiosk renders instantly and stably.

---

## 7. Per-paradigm materialization

One spec, four skins. The instantiator selects the materializer from `layoutSpec.paradigm`:

| block | gui | tui | device | scene |
|---|---|---|---|---|
| window | titled draggable frame | ASCII-framed pane (`┌─┐│`) | dialog card w/ glow | diegetic frame (or none — app content only) |
| taskbar | bottom strip | bottom text line `[apps] [clock]` | console base strip | none |
| menu-bar | top button row | top text line of names | instrument header strip | floating title line |
| button | styled `<button>` | `[label]` text token | bezeled control | physical-looking prop |
| gauge | inline SVG instrument | text bar `[###···]` + value | SVG instrument + glow | diegetic instrument |
| terminal | windowed `<pre>`-box | the whole screen | log panel | diegetic slate |
| icon | grid cell, SVG + label | named text entry | indicator glyph | diegetic object |
| card | panel w/ header | box-drawing frame | readout card | prop |
| wallpaper | procedural CSS/SVG layer | flat `bg` fill | console backdrop | dominant layer |
| clock | text readout | header time token | time readout | rare |
| dock | rail of large icons | none | side rail (levers) | none |

TUI materialization rule: **no gradients, no shadows, no rounded rects** — only
monospace text, box-drawing characters, and at most 2 palette colors. Device rule:
everything gets a faint `glow` stroke; motion adds slow breathing. Scene rule: chrome
blocks are skipped; only `wallpaper`, `icon` (as props), `terminal` (as slate) and
in-app content render.

---

## 8. Block types

Per block: **(1) purpose / when needed, (2) input (spec fields beyond the envelope),
(3) output (DOM/CSS/SVG + hooks), (4) dependencies (bank entries), (5) paradigms.**

### 8.1 `window`

**(1) Purpose.** A titled, draggable container that hosts one app (via `appRef`). A
layout needs windows when `paradigm === "gui"` (each open app is a window; the terminal
is one of them), or for dialog/alert overlays in device worlds.

**(2) Input:**

```js
{
  appRef:  "term",                    // which app/entity this window hosts (instantiated inside)
  title:   "Shell",                   // world-content label
  titleIcon: { gram: "flat-line", subject: "terminal" } | null,
  variant: "standard" | "dialog" | "sheet",
  state:   "normal" | "minimized",    // initial state
  // envelope fields: size, zone (default "stack"), order, palette, font, hooks
  palette: { fill: "surface", titlebar: "surface-2", border: "border", label: "text" }
}
```

**(3) Output.** DOM: `.win` (abs-positioned in `#stack`) → `.win-bar` (titleIcon SVG +
title + control glyphs: minimize, close — drawn from the icon bank as `close` /
`minimize` subjects) → `.win-body` (the app's live-interpreted content). CSS: radius
from `aesthetic.radius`, border `--p-border`, shadow scaled by `motion`, titlebar `--p-surface-2`;
focused window: `--p-accent` titlebar tint + z-top. **Hooks:** `drag` (titlebar pointer
capture → translate, clamped to stack; `drag: true`), `close` (`close-app:<id>` →
fade/collapse, focus falls to next window), `focus` (`focus-app:<id>` → z-top + titlebar
accent), `minimize` (→ bottom-bar entry if taskbar present), keyboard: click/Tab moves
focus, `Esc` = in-world (minimize; never a browser action).

**(4) Dependencies:** fonts, icons (titleIcon + control glyphs), palette slots, sounds
(`open`, `close` via `hooks.sound`), app content from the interpreter (never a static
cache), engine (close/focus events).

**(5) Paradigms:** gui (primary), device (dialog variant), scene (optional frame), tui
(none — tui panes are `card` with `variant: "frame"`).

---

### 8.2 `taskbar` (with start menu)

**(1) Purpose.** The chrome strip listing open apps with a start-like menu and clock
slot. Needed when `topology.bar !== "none"` and paradigm is gui — practical desktops
always have one; the start menu is how apps are launched from the bar.

**(2) Input:**

```js
{
  side:  "bottom" | "top" | "left" | "right",   // follows topology, override allowed
  start: { label: "⌂", icon: { gram: "flat-line", subject: "home" },
           menu: {
             sections: [                          // 1..4 sections, each 0..8 items
               { id: "apps", label: "Apps", items: [
                   { id: "term", label: "Shell", icon: { gram: "flat-line", subject: "terminal" } },
                   /* ... */
               ]}
             ]
           } },
  slots: ["apps", "clock", "status"],           // display order of fixed slots
  showOpenApps: true,                            // one quick-button per open window
  palette: { fill: "surface-2", hover: "surface", label: "text", accent: "accent" }
}
```

**(3) Output.** DOM: `.bar` full-bleed strip (height from size×density) → `.bar-start`
(button) + `.bar-apps` (one `.bar-app` per open window: icon + title, active = accent
underline) + `.bar-clock` (nested `clock` block, `zone: inline`) + `.bar-status`
(seeded status glyph from the icon bank). Start menu: `.menu` panel (grid of app icons
from the section list) anchored to the start button; opens on click, closes on
outside-click / `Esc`. **Hooks:** `click` per app → `focus-app:<id>` (or `open-app:<id>`
if closed), start → `toggle:<menu-id>`, menu item → `open-app:<id>` or `run:<verb>`,
`hover` (surface-2), keyboard: arrows/Tab traverse apps, menu arrow-navigable, `Esc`
closes the menu (in-world).

**(4) Dependencies:** icons (all app subjects + start glyph), fonts, palette, sounds
(`click`, `open`), the `clock` block (nested), window registry (open-app state).

**(5) Paradigms:** gui (primary), device (thin base strip with status), scene (none).

---

### 8.3 `menu-bar`

**(1) Purpose.** A row of named menus with submenus. Needed when `topology.menu !==
"none"`: gui classic desktops, tui header line, device instrument header.

**(2) Input:**

```js
{
  side: "top" | "left",
  items: [                                 // 2..8 items
    { id: "laws", label: "Laws", icon: null,
      submenu: [
        { id: "laws-1", label: "Read the laws", verb: "laws" },
        { id: "hatch",  label: "Open the hatch", verb: "hatch", icon: { gram: "flat-line", subject: "hatch" } }
      ] },
    /* ... */
  ],
  align: "left" | "center",
  palette: { fill: "surface", label: "text", hover: "surface-2", accent: "accent" }
}
```

**(3) Output.** DOM: `.menubar` strip → `.menu-item` buttons; open item anchors a `.menu`
panel (list of `.menu-item` rows, optional icons). tui: a single text line of names;
pressing one (click or its letter) toggles a text submenu below. **Hooks:** `click` →
toggle submenu, submenu row → `run:<verb>` or `open-app:<id>`, `focus` (keyboard: Tab
enters the bar, arrows move between items, Enter opens, `Esc` closes — all in-world).

**(4) Dependencies:** icons (optional per-item), fonts, palette, verbs (engine), sounds
(`click`).

**(5) Paradigms:** gui, tui (text header), device (labeled instrument strip), scene
(rare floating title).

---

### 8.4 `button`

**(1) Purpose.** The atomic control. Needed for: taskbar slots, window controls (composed
internally), device consoles (many), overview actions, tui command tokens. Any layout
with a click target that isn't a window/menu item.

**(2) Input:**

```js
{
  label: "Open",
  icon: { gram: "flat-line", subject: "hatch" } | null,
  variant: "flat" | "raised" | "outline" | "ghost" | "hazard",
  iconOnly: false,
  sound: "click",                          // default "none"
  // envelope: size ("s"|"m"|"l"), zone, order, parent, palette, font, hooks
  palette: { fill: "surface", label: "text", hover: "surface-2", accent: "accent",
             hazard: "danger" }
}
```

**(3) Output.** DOM: a real `<button class="btn btn-<variant>">` (a11y: focusable,
Enter/Space activate) → inline icon SVG (if any) + label span. CSS per variant:
`raised` = `--p-surface` fill + `--p-border` border + shadow(motion); `flat` =
transparent, hover `--p-surface-2`; `outline` = transparent + accent border; `ghost` =
label only, accent on hover; `hazard` = `--p-danger` fill + `--p-text` label. Motion
adds press scale (subtle) or press flash (lively). **Hooks:** `click` (any action ref),
`focus` (accent ring), `hover`, `active`. tui: `[label]` token, `:` prefix marks active.

**(4) Dependencies:** icons (optional), fonts, palette, sounds, engine (for `run:`
actions).

**(5) Paradigms:** all four (materialization per §7).

---

### 8.5 `gauge` (dial / instrument control)

**(1) Purpose.** A value-bearing instrument — the signature `device` block; also the
interactive element of any app whose script names a dial/valve/gauge/lever/toggle.
Needed when `paradigm === "device"` or an app's `elem.type` is `dial | arc | needle |
bar | ring | valve | lever`.

**(2) Input:**

```js
{
  kind:     "dial" | "arc" | "needle" | "bar" | "ring" | "valve" | "lever",
  label:    "Sea Pressure",
  unit:     "kPa",                        // world-content caption
  value:    0.62,                         // normalized 0..1 — the ONLY float a spec may hold
  orient:   "up" | "down" | "left" | "right" | "full",
  ticks:    "none" | "few" | "many",      // tick-mark density enum
  colorMap: "accent" | "ramp" | "status", // how value maps to slot (status: <0.4 ok, <0.75 warn, else danger)
  palette: { face: "surface", needle: "accent", tick: "text-dim", label: "text",
             ok: "ok", warn: "warn", danger: "danger" }
}
```

**(3) Output.** Inline **SVG** with `viewBox="0 0 100 100"` (width = size ordinal ×
density — the only computed dimension): face (circle/arc path), tick marks (count from
`ticks` × seeded micro-jitter), pointer/needle rotated by
`angle(orient) × value` (e.g. `up`: −120° + value×240°), hub, label + live value
readout (font slot, usually `mono`). Interactivity: pointer drag along the arc → value
0..1 (throttled `change`), click = +step (step = 1/20), dblclick = center, keyboard:
←/→ ±step, Home/End 0/1. **Hooks:** `change` (`set:<app>:<elem>` — fed back to the
engine so the keeper can react), `click`, `focus` (needle `--p-accent` glow when
focused; device adds a `glow` stroke scaled by `motion`). tui: `[####····] 0.62 kPa`
line, `kind` changes the bar's shape.

**(4) Dependencies:** palette slots (incl. status slots), font `mono`, sounds (`blip`
on step, optional), engine (`set:`/`change` round-trip). No icon bank.

**(5) Paradigms:** device (primary), gui (in-app content), scene (diegetic instrument),
tui (text bar).

---

### 8.6 `terminal`

**(1) Purpose.** The shell component (spec §7) — behaves like a real shell whose state
the engine holds. Needed when: paradigm `tui` (the whole screen), `gui` (one of the
windows), `device` (log panel), `scene` (diegetic slate).

**(2) Input:**

```js
{
  title:  "Shell",
  variant: "windowed" | "full" | "panel" | "log",
  prompt: "❯",                            // world-content prompt glyph (">", "❯", "»", "knock:")
  seedLines: 6,                           // count of seeded fake boot/log lines the engine fabricates
  palette: { bg: "bg", text: "text", prompt: "accent", cursor: "accent" }
}
```
Envelope `size`: `s|m|l|full`. `variant: "full"` forces `zone: "full"`.

**(3) Output.** DOM: `.term` box → `.term-lines` (scrolling block of seeded lines,
`white-space: pre-wrap`, font `mono`, line-height from density) + `.term-input` line
(prompt span + inline `<input>` styled to be invisible except the caret) + blinking
cursor block (blink only when `motion !== "none"`). Auto-scroll on append; only place
in the UI where `user-select: text` is allowed (copy affordance, spec §9). **Hooks:**
`input` (Enter → `POST /api/command`; response lines append; engine handles the
combinatorial fast-path), `focus` (click/Tab → cursor active, prompt `--p-accent`),
`scroll`, `copy`. Keyboard-first: all engine verbs reachable by typing.

**(4) Dependencies:** font `mono` only, palette, engine (`/api/command`, seeded boot
lines), sounds (`tick`, optional).

**(5) Paradigms:** all four (per §7).

---

### 8.7 `icon`

**(1) Purpose.** A clickable entity glyph — the desktop's app representation and the
start-menu grid cell. Needed when `paradigm === "gui"` with a `desktop` zone, or for
menu grids; scene uses it as diegetic objects.

**(2) Input:**

```js
{
  subject: "terminal",                    // core or world-named subject (icons.js)
  label:   "Shell",                       // entity name; "" = icon-only cell
  appRef:  "term",
  badge:   "none" | "dot" | "count",
  palette: { fg: "text", bg: "transparent", accent: "accent" }
}
```
Envelope `size`: `s|m|l`. `zone` default `desktop` (grid position from `order`).

**(3) Output.** DOM: `.icon` cell → inline SVG from `iconBank.draw(gram, subject, seed,
palette)` (procedural — the same grammar+subject+seed always draws the same paths) +
`.icon-label` (desktop grid only; menu grid labels on hover). Selection state: accent
ring + label highlight; `badge` = accent dot or count chip (mono, tiny). Grid:
position from `order` × grid layout (§5). **Hooks:** `click` (`open-app:<appRef>`),
`focus` (ring), `hover` (lift per `motion`). tui: the entity's name as a text entry in
the listing; device: small indicator glyph; scene: the SVG rendered as a prop at a
seeded position in the wallpaper layer.

**(4) Dependencies:** icon bank (grammar + subject, both procedural), palette, fonts
(label), engine (open/focus events).

**(5) Paradigms:** gui (primary), scene (props), device (indicator), tui (text entry).

---

### 8.8 `card`

**(1) Purpose.** A content container — app tile in the overview, info panel, TUI framed
pane, device readout. Needed when the paradigm shows an app grid (gui overview), tui
(panels in ASCII frames), device (readout cards), or any layout with grouped content.

**(2) Input:**

```js
{
  title:  "The Filing Cabinet",
  icon:   { gram: "flat-line", subject: "folder" } | null,
  body:   "Three drawers. The top one is warm."   // world-content text lines
        | { block: "gauge", /* nested block spec, §8.5 */ },  // or an inline block
  variant: "panel" | "frame" | "card" | "tile",
  accentEdge: "none" | "top" | "left",
  palette: { fill: "surface", label: "text", border: "border", accent: "accent" }
}
```
`body` is either a text string or a nested block spec (the nested block gets
`zone: "inline"`, `parent: <card.id>`). Envelope `size`: `s|m|l`.

**(3) Output.** DOM: `.card-<variant>` → header row (icon + title, font slot) → body
(text lines, font slot) or the nested instantiated block; `accentEdge` = 2px accent
edge (device: glow edge). tui `variant: "frame"`: box-drawing frame (`┌─┐│└┘`, title in
the top border), text-only body — no gradients/shadows. **Hooks:** `click`
(`open-app:<appRef>` when the card is an app tile), `focus` (border → `--p-accent`).

**(4) Dependencies:** fonts, palette, icons (optional), nested blocks (any type).

**(5) Paradigms:** gui, tui (frame variant), device (readouts), scene (rare, as props).

---

### 8.9 `wallpaper`

**(1) Purpose.** The background layer — the first thing that makes a world read as
itself. Needed when `topology.wallpaper === true`: gui desktop, device console
backdrop, scene (where it is *nearly everything*). tui: flat fill only.

**(2) Input:**

```js
{
  style:   "solid" | "gradient" | "grid" | "scanlines" | "noise" | "radial" | "procedural",
  from:    "bg",                            // palette slots for gradient endpoints
  to:      "surface",
  accentLayer: "none" | "dots" | "lines" | "horizon",
  accentColor: "accent",
  opacity: "full" | "dim",
  palette: { base: "bg" }
}
```
`zone: "wallpaper"` forced; `size` ignored (full-bleed).

**(3) Output.** A fixed full-bleed `.wallpaper` div (z-index 0, no pointer events).
Materialized **procedurally, offline** from `style` + palette slots + seeded params:
`gradient` = linear-gradient with seeded angle from the style family; `grid` =
repeating-linear-gradient, cell size seeded from density; `scanlines` = repeating
gradient (period seeded); `noise` = SVG `feTurbulence` data-URI, seed from world seed;
`radial` = radial-gradient with seeded center offset; `procedural` = a seeded SVG
scene (horizon/lines/dots motif drawn by the instantiator's procedural layer — same
seed ⇒ same paths). `accentLayer` adds an absolutely-positioned SVG overlay
(dots/lines/horizon, seeded placement). Static when `motion: none`; `lively` adds a
very slow drift (CSS animation, seeded duration). **Hooks:** none interactive
(`click: noop`, `focus: false`) — it is scenery.

**(4) Dependencies:** palette slots (endpoints), world seed. No fonts, icons, or sounds.

**(5) Paradigms:** gui (primary), device (backdrop), scene (dominant), tui (`solid` only).

---

### 8.10 `clock`

**(1) Purpose.** Time readout — taskbar slot, device readout, tui header token. Needed
when a taskbar has the `clock` slot, or a device/tui layout wants time.

**(2) Input:**

```js
{
  format: "hhmm" | "hhmmss" | "h12" | "ticks" | "bars",
  label:  "DECK TIME" | null,              // optional caption
  palette: { text: "text", accent: "accent" },
  font: "mono"
}
```
Envelope `size`: `s|m`. Usually `zone: "inline"` inside a taskbar (or `top`/`bottom`).

**(3) Output.** `.clock` mono text, updated on a 1 s interval — the engine's world
clock if the world defines one, else kiosk local time. `ticks` = colon blink (blink
only when `motion !== "none"`); `bars` = 12 tick marks, current hour highlighted
(`--p-accent`) — the tui header form. **Hooks:** none interactive (`focus: false`);
emits `tick` (1 s) for scene ambience wiring.

**(4) Dependencies:** font `mono`, palette, engine clock. No icon/sound banks.

**(5) Paradigms:** gui (taskbar slot), tui (header), device (readout), scene (rare).

---

### 8.11 `dock`

**(1) Purpose.** A strip of large app icons (or instrument levers) on a rail. Needed
when `topology.rail !== "none"`: modern desktops (gui), device side rails of levers.

**(2) Input:**

```js
{
  side:      "left" | "right" | "bottom",
  items: [                                   // 3..10 items
    { icon: { gram: "flat-line", subject: "terminal" }, appRef: "term", label: "Shell" },
    { icon: { gram: "flat-line", subject: "valve" },    appRef: "hatch", label: "Hatch", kind: "lever" }
  ],
  separator: "none" | "line" | "gap",
  magnify:   "none" | "subtle" | "strong"    // hover scale, scaled by aesthetic.motion
}
```
`items[].kind: "lever"` renders that item as a small lever instead of an icon (device).
Envelope `size`: `s|m|l` → rail slot width.

**(3) Output.** DOM: `.dock` strip (flex column when side is left/right, row when
bottom) → `.dock-item` cells: icon SVG (or lever SVG: slot + handle, handle position
seeded per item) + optional label + active dot (`--p-accent`). Hover: scale per
`magnify` × `motion`; active app = accent dot. **Hooks:** `click` → `open-app:<appRef>`
(or `focus-app:<appRef>` if already open), `hover` (sound `blip` when pulled in the
world's sound set), `focus` (arrow keys traverse items).

**(4) Dependencies:** icon bank, fonts (labels), palette, sounds (`blip`), window
registry (active state).

**(5) Paradigms:** gui (primary), device (lever rail), tui (none), scene (none).

---

## 9. Precise examples

### 9.1 A `window` block

The LLM's complete contribution — no pixels, no colors, no angles:

```js
{
  id: "w-term",
  block: "window",
  zone: "stack",
  order: 2,
  appRef: "term",
  title: "Shell — the keeper's log",
  titleIcon: { gram: "flat-line", subject: "terminal" },
  variant: "standard",
  size: "l",
  state: "normal",
  palette: { fill: "surface", titlebar: "surface-2", border: "border", label: "text" },
  font: "sans",
  hooks: {
    drag: true,
    focus: "focus-app:w-term",
    close: "close-app:w-term",
    minimize: true,
    sound: { open: "open", close: "close" }
  }
}
```

What the instantiator resolves from this (deterministic given `world.seed` — shown for
illustration, never authored): position = stack cascade slot 2 (seeded jitter ±10%),
width = `l` × densityScale × windowUnit, height = 62% of stack, radius = aesthetic
`mid` → seeded 6–10px, shadow = `motion: subtle` → 0 8px 24px rgba from `--p-bg` at
18%, titlebar = 1 slot × density, control glyphs = icon bank `close`/`minimize`
subjects drawn with `--p-text-dim` (hover `--p-danger`/`--p-accent`), z-index =
order. Same seed ⇒ bit-identical layout; a different world seed ⇒ different cascade
offset, radius, and jitter.

### 9.2 A `gauge` block

```js
{
  id: "g-pressure",
  block: "gauge",
  zone: "inline",
  parent: "c-hull",          // a card, §8.8
  order: 1,
  kind: "dial",
  label: "Sea Pressure",
  unit: "kPa",
  value: 0.62,
  orient: "up",
  ticks: "many",
  colorMap: "status",
  size: "m",
  palette: { face: "surface", needle: "accent", tick: "text-dim", label: "text",
             ok: "ok", warn: "warn", danger: "danger" },
  font: "mono",
  hooks: { change: "set:term:g-pressure", click: "sound:blip", focus: true }
}
```

Instantiator math (internal): SVG width = `m` × densityScale × gaugeUnit; face arc
sweep = 240° (orient `up`: start −120°); needle rotation = −120 + 0.62 × 240 = 28.8°;
ticks = `many` → 25 marks (5 major, seeded sub-jitter ±1.5°); `value` 0.62 →
`colorMap: status` → `--p-warn` needle tip; drag along arc → `change` event →
`set:term:g-pressure` → the engine can have the keeper react ("the sea is pushing
back"). tui materialization of the *same* spec: `Sea Pressure [####····] 0.62 kPa`,
arrows adjust.

---

## 10. Validation & degradation (reader-not-validator)

The instantiator never throws on a spec. Rules:

| failure | behavior |
|---|---|
| unknown `block` type | render as `card` with a "damaged" look (in-world damage) |
| unknown enum value | nearest listed value (fixed order in this doc) |
| unknown palette slot | `surface` |
| unknown font slot | `mono` (safe) / `sans` (chrome) |
| unknown icon subject | still draws — seeded motif from the subject's hash |
| unknown sound cue | `none` |
| unknown action ref | `noop` (+ one `console.warn`) |
| out-of-range number | clamped to its documented range |
| spec fails to parse | damaged block shell (visible, in-world, never a white screen) |
| hook name not in block's list | ignored |

Every degradation is logged to the engine's conversation store so the world "knows" it
is damaged — consistent with spec §5: garbage is fiction, not error.

---

## 11. Instantiator API (sketch)

```js
// app/blocks.js (future home; zero deps)
const blockRegistry = {
  window:  { defaults, materialize(spec, ctx) → element, hooks: ["drag","focus","close","minimize","click"] },
  taskbar: { defaults, materialize, hooks: ["click","hover","focus"] },
  "menu-bar": { defaults, materialize, hooks: ["click","focus"] },
  button:  { defaults, materialize, hooks: ["click","hover","focus","active"] },
  gauge:   { defaults, materialize, hooks: ["change","click","focus"] },
  terminal:{ defaults, materialize, hooks: ["input","focus","scroll","copy"] },
  icon:    { defaults, materialize, hooks: ["click","focus","hover"] },
  card:    { defaults, materialize, hooks: ["click","focus"] },
  wallpaper: { defaults, materialize, hooks: [] },
  clock:   { defaults, materialize, hooks: ["tick"] },
  dock:    { defaults, materialize, hooks: ["click","hover","focus"] },
};

// ctx = { world, layout, rng, banks, engine, paradigm }
function instantiate(layoutSpec, world, engine) → rootElement   // builds zone containers,
                                                                // materializes blocks in zone+order,
                                                                // nests inline blocks, wires hooks
ui.on("app:open" | "app:close" | "focus" | "input" | "change" | "tick", cb);
```

Keyboard model (global, spec §9): Tab order = zone order → block `order`; arrows
navigate within menubar/dock/menu; Enter/Space activate focused control; `Esc` =
in-world (close top menu, else minimize top window) — never a browser action.

---

## 12. Contract checklist (what "conforming" means)

A block type conforms when:

1. its spec fields are all from the closed set: enums, ordinals, refs, labels, counts
   (0..12), booleans, `value` (0..1) — **no px/%/hex/angles/code**;
2. its materializer is a pure function of `(spec, ctx)` — no `Math.random()`, no
   `Date.now()` (clock updates only), no network;
3. it resolves every color through palette slots and every font through font slots;
4. it exposes its declared hooks on `ui` with the exact event names in §8;
5. it degrades per §10 instead of throwing;
6. instantiated twice with the same seed it produces identical class lists, CSS custom
   properties, and SVG path data (assertable in `selftest.js`).
