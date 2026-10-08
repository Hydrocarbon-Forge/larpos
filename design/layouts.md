# LarpOS — Layouts (the layout vocabulary)

Owner: layouts designer (one of 4 parallel designers). Companion docs: blocks
contract (block types), banks (fonts/icons/palettes/sounds), composition (how
specs combine). This file is the **catalog of topologies** the design spec may
reference. A user prompt ("windows xp", "practical lightweight desktop",
"cockpit") must be steerable to exactly one entry here; the seeded PRNG then
materializes concrete values *inside* the ranges in this doc.

Core rule (from spec §11): **the LLM picks the layout id and paradigm — it never
emits pixel values.** Every value below is a *range*; the seeded instantiator
picks inside the range. Same seed ⇒ same values, always. Two boots with the
same layout id look the same *family* but differ in exact geometry, counts,
and hue offsets.

---

## 1. The layout spec shape (machine-readable)

The design spec carries `layout: <id>` plus a **materialized** instance (the
seeded values, filled in at world-gen time and cached with the world):

```jsonc
layoutSpec: {
  id: "windows-xp",              // one of the ids in §3
  paradigm: "gui",               // gui | tui | device | scene | invented
  topology: {
    chrome: "bottom-bar",        // where chrome lives (see §2 taxonomy)
    zones: [                     // positioned regions, fractions of viewport
      { name: "taskbar",  x: [0, 1],     y: [0.94, 1],     h: [0.05] },
      { name: "start",    x: [0.01,0.09], y: [0.95,0.99],  h: [0.035] },
      { name: "tray",     x: [0.85, 1],  y: [0.95,0.99] }
    ]
  },
  blocks: [                      // which blocks, in which zone, how many
    { type: "taskbar", zone: "taskbar", variant: "luna-3d" },
    { type: "icon",    zone: "desktop", count: [6, 12], grid: "left-anchored" },
    { type: "clock",   zone: "tray",    lines: [2] },
    { type: "wallpaper", variant: "bliss-like" }
  ],
  signature: {                   // the SEEDED values picked inside §3 ranges
    radius: 1, density: "high", accentHue: 218, motion: "hover-only"
  }
}
```

Zone unit convention: `x, y, w, h` are fractions of the viewport (1.0 = full
screen). Sizes are given as *reference px at 1920×1080* for the instantiator to
scale by `min(vw, vh) / 1080`. Stacking order (z, low→high): `wallpaper <
desktop-icons < windows < bars < huds/overlays`.

---

## 2. Shared block index

**Contract block types** (owned by the blocks designer — referenced by id only):
`window, taskbar, menu-bar, gauge, terminal, icon, dock, clock, wallpaper`.

**Auxiliary blocks** this catalog needs. They are *thin parameterized
renderings* the instantiator can produce generically; the blocks designer owns
their exact rendering, but the minimal parameter set is listed so a spec can
reference them unambiguously:

| aux block | minimal params |
|---|---|
| `start-button` | label, icon?, side (left/center), style (glossy/flat/pill) |
| `tray` | icon count 3–7, clock lines 1–2 |
| `readout` | text source (seeded value / clock), style: led-7seg \| dot-matrix \| glow-text, hue |
| `dial` | radius 24–56px, ticks 12–48, value 0–1, interactive (rotate) |
| `lever` | state on/off, height 28–56px, label |
| `ticker` | line-height 18–26px, rate 1–3s/line, direction |
| `crosshair` | size 4–12px, spread 4–16px |
| `minimap` | radius 40–70px, blips 3–9 |
| `vignette` | edge-darkness 15–40%, inner-radius 55–85% |
| `hub` | radius 12–20% of min side, label/glyph, glow 4–12px |
| `spine-row` | label, status-dot hue, height 20–30px |
| `bar-hud` | width 12–20% of viewport, fill 0–1, label, hue |
| `card` | w/h 75–95% of viewport, radius 10–24px, title line? |
| `fixture` | kind (cabinet/gauge/mirror/hatch/desk/terminal-desk), w 8–18% of viewport, x/y seed position, interactive |
| `ctx-panel` | w 8–14% of viewport, anchored to fixture, offset 4–10px, label line 0–1 |
| `ring` | radius-fraction 0.3–0.8 of min side, sectors 5–12, tickmarks 24–60, interactive (rotate) |

---

## 3. The layouts

Each entry: (1) topology, (2) key blocks, (3) aesthetic signature as *ranges*,
(4) concept keywords. `paradigm` shown is the default mapping; a world may
override (e.g. `tui` paradigm + `tty-terminal` layout is the canonical pair).

### 3.1 `windows-xp` — "Luna" (2001 desktop)

1. **Topology** — `chrome: bottom-bar`. Taskbar spans full width, bottom,
   h 4.5–6% (~48–56px). Start button leftmost, w 7–9% (glossy, wider than a
   task button). App/task buttons follow start, left-anchored. System tray on
   the right, 4–7 icons + 2-line clock. Desktop: icon grid **top-left
   anchored**, 2–4 columns, cell 7–10% wide, icons 16–24px + label below.
   Windows: 0.35–0.75 of viewport, 0–3 open at boot, free placement (seeded
   positions, no overlap of titlebars).
2. **Blocks** — `window` ×0–3 (variant *luna-3d*: titlebar = 3–4% of window
   height, glossy blue gradient, title left, 3 controls right, each ~12×12px),
   `taskbar` (variant *luna*: glossy blue strip, 1px raised bevel),
   `start-button` (glossy, label "Start", optional small flag glyph),
   `icon` ×6–12 (desktop grid, 2-line label max), `clock` (2-line: time 11–13px
   over date 10–11px, in tray), `wallpaper` (variant *bliss-like*: sky gradient
   top 55–70% hue 205–215, overlapping green hill curves bottom 30–45%, hue
   100–130, 1–2 hills, optional cloud blobs 2–5).
3. **Signature** — radius 0–2px (windows/bars); start button pill (radius =
   50–100% of its height). Density **high**: bar padding 4–8px, task buttons
   36–48px wide, font 11–13px. Color: chrome = Luna blue vertical 3-stop
   gradient (hue 212–225, sat 45–70%, light 55–78%) with a gloss highlight
   band at 30–40% height; accent green (hue 135–155) on the start button and
   active states; 1px bevel borders everywhere (light top-left, dark
   bottom-right). Motion: hover only, 100–200ms; window open 150ms fade or
   none; arrow cursor.
4. **Keywords** — "windows xp", "xp", "luna", "bloody shoe", "2001 desktop",
   "glossy windows", "start button", "taskbar", "classic windows", "pre-vista".

### 3.2 `windows-10` — flat bottom taskbar

1. **Topology** — `chrome: bottom-bar`. Taskbar full width, bottom, h 4–5%
   (~40–48px), flat dark or light. Start leftmost (~48×h square). Pinned app
   icons left-anchored after start, 5–9 of them, 40–48px squares. Right side:
   2–4 status glyphs (network/speaker/bell) + 2-line clock. Optional search
   box next to start (30–50% wide). Desktop: icon grid top-left, 1–3 columns.
   Windows: 0.4–0.8 of viewport, 1–3 open, sharp corners, flat titlebar
   28–34px.
2. **Blocks** — `window` ×1–3 (variant *flat-10*: 1px border, flat titlebar,
   3 flat square controls right ~10–12px, title left 12–13px), `taskbar`
   (variant *flat-10*: solid #1f–#2b dark or #f0–#f8 light, no gradient, no
   bevel), `icon` ×5–9 (pinned row, flat glyphs 24–32px in 40–48px cells) +
   desktop icons ×3–6, `clock` (2-line small, right), `wallpaper` (variant
   *hero-abstract*: one large smooth gradient 1–2 hue stops + 3–8 bokeh
   circles 20–60px, or flat solid with a faint vignette).
3. **Signature** — radius **0** (all corners square; optional 1–2px on
   buttons). Density **medium**: generous but flat, spacing 8–12px, font
   12–13px. Color: chrome near-monochrome (dark: hsl 220 8% 12–18%; light:
   hsl 220 10% 94–98%) + ONE accent hue (default 210–220; seeded 200–240,
   sat 50–80) used only for focus rings and active states. No gradients, no
   bevels; 1px hairline borders; optional soft shadow under taskbar 0–4px.
   Motion: 150–250ms fade/slide, no bounce.
4. **Keywords** — "windows 10", "win10", "flat windows", "pinned taskbar",
   "action center", "cortana box", "modern windows".

### 3.3 `windows-11` — centered taskbar, Mica

1. **Topology** — `chrome: bottom-bar centered`. Taskbar full width, bottom,
   h 5–6% (~52–64px), translucent. **Centered cluster**: start + 3–7 pinned
   icons centered as one group. Right side: tray 2–4 glyphs + 1–2 line clock.
   Optional widgets panel bottom-left (small card 120–180px). Desktop: no
   icons by default (0–3). Windows: 0.4–0.8 viewport, 1–3 open; **top corners
   rounded 8–10px, bottom corners square** (signature detail); title centered,
   text 12px; 3 flat controls right, hover-revealed.
2. **Blocks** — `window` ×1–3 (variant *mica-11*: top-rounded, titlebar
   30–36px tinted 55–75% opacity over wallpaper, 1px border, soft shadow
   12–28px blur 10–20%), `taskbar` (variant *mica-11*: blur 20–40px, opacity
   30–60%, icons 28–36px in 40–56px cells, active pill underline 2–3px),
   `icon` ×3–7 (rounded-square containers 4–6px radius), `clock` (1–2 line,
   right, 12px), `wallpaper` (variant *mica-wash*: base wallpaper at 5–10%
   saturation desat + flat tint overlay 50–70%, or mesh-blob gradient).
3. **Signature** — radius 8–12px (windows, top only) / 4–6px (controls) /
   999 pill (active state). Density **low–medium**: padding 12–16px, spacing
   8–12px, font 12–14px. Color: chrome neutral translucent (light: white
   35–60% opacity; dark: hsl 225 15% 12–18% at 50–70% opacity) over
   wallpaper; accent = one seeded hue (default 210–225; any sat 55–85) for
   focus + active. Flat fills, no bevel, 1px hairline + soft shadow. Motion:
   180–300ms ease-out; window open = scale 0.98→1 + fade; hover = bg wash
   150ms.
4. **Keywords** — "windows 11", "win11", "centered taskbar", "rounded windows",
   "mica", "acrylic", "fluent", "modern flat".

### 3.4 `classic-macos` — Aqua (OS X ~2001–2009)

1. **Topology** — `chrome: top-menu + bottom-center-dock`. Menu bar full
   width, top, h 3–4% (~24–30px): left = apple glyph + bold app-name menu +
   4–7 text menus; right = status items 2–4 + 1-line clock ("Tue 9:41 AM").
   Dock: **bottom-center**, glass slab, icons 44–64px, slab padding 10–16px,
   slab radius = 50% of slab height (full pill ends) or 12–18px, 60–80%
   opacity. Desktop icons: **top-right column**, 2–4 items. Windows 0.4–0.7
   viewport, 1–3 open; titlebar = 3D gradient slab 28–34px, **buttons LEFT**
   (red close, yellow min, green zoom, 12–14px circles).
2. **Blocks** — `menu-bar` (variant *aqua-top*: light 3-stop vertical
   gradient, 1px dark hairline below, app menu bold), `dock` (variant
   *aqua-glass*: 1px white inner highlight, reflection strip below icons
   15–25% height, magnification on hover 1.2–1.6×), `window` ×1–3 (variant
   *aqua-3d*: glossy gradient titlebar, left button cluster, 1px border),
   `icon` ×4–8 (glossy 3D glyphs, 48px with drop shadow 2–4px), `clock`
   (1-line, top-right), `wallpaper` (variant *aqua-sky*: big soft radial or
   linear pastel gradient, 1–2 hue, low sat 20–40%, bright 75–90%).
3. **Signature** — radius 0–2px (windows) + pill dock; titlebar has 3D top
   highlight (inset 1px white 40–70% opacity). Density **medium**: spacing
   8–12px, font 12–13px. Color: chrome = pastel gray (hsl 220, 8–25%,
   84–95%) with strong gloss highlight band; accent = saturated glossy blue
   (hue 205–220, sat 60–90%) + the three traffic-light hues; gloss =
   2-stop gradient with white 30–50% highlight at 35% height. Motion: open =
   scale 0.5→1 with overshoot 300–500ms (bounce), dock magnify 200ms, hover
   150ms.
4. **Keywords** — "mac os x", "os x", "aqua", "tigger lights", "glass dock",
   "glossy mac", "pale dock", "2003 mac", "leopard".

### 3.5 `modern-macos` — Big Sur+

1. **Topology** — `chrome: top-menu + bottom-center-dock`. Menu bar top, h
   3–3.5% (~26–32px): left apple + app menus; right 3–5 status glyphs +
   1-line clock. Dock bottom-center, icons 48–64px, glass slab radius 10–14px
   (not full pill), magnification optional (seeded on/off). **No desktop icons
   by default** (0–2). Windows 0.4–0.8 viewport, 1–3 open; **all corners
   rounded 10–14px**; titlebar 36–44px, title centered or left, **traffic
   lights left** (3×12px circles), 1px border, big soft shadow (20–40px blur,
   20–35%).
2. **Blocks** — `menu-bar` (variant *mac-modern*: flat or 50–70% translucent
   over wallpaper, 1px hairline), `dock` (variant *mac-glass-modern*: blur
   20–40px, opacity 55–75%, 1px white 20–35% border, radius 10–14px,
   optional magnify 1.1–1.4×), `window` ×1–3 (variant *mac-modern*: 10–14px
   all-radius, translucent titlebar 50–70%, traffic lights left, title
   13px), `icon` ×5–9 (squircle containers, radius 20–30% of size, 48–64px),
   `clock` (1-line right), `wallpaper` (variant *mesh-blob*: 2–4 large
   blurred radial blobs 30–60% of viewport, 1–3 hues, sat 40–75%, bright
   70–88%).
3. **Signature** — radius 10–14px (windows) / 6–8px (controls) / squircle 20–
   30%. Density **low**: padding 16–20px, spacing 12–16px, font 13–14px.
   Color: chrome translucent white 30–50% or dark hsl 225 15% 10–16% at 40–
   60% over wallpaper; accent = one seeded hue (sat 60–85). Flat-with-blur
   (backdrop-blur 20–40px), no bevels, 1px borders, big soft shadows.
   Motion: 200–350ms; window open scale 0.95→1 + fade; blur/opacity
   transitions; springy but subtle.
4. **Keywords** — "macos", "big sur", "macbook", "sonoma", "traffic lights",
   "squircle", "translucent dock", "mesh wallpaper", "apple".

### 3.6 `kde-plasma` — bottom panel, widgets

1. **Topology** — `chrome: bottom-panel`. Panel full width, bottom, h 4–6%
   (~44–56px): left = app-menu launcher button (36–48px square); middle =
   task buttons 0–5 (40–56px wide, title text optional); right = system tray
   3–5 icons + 2-line clock (time 12–13px / date 10–11px). Optional
   **plasmoids**: 1–3 small widget cards 120–200px on desktop (clock card,
   monitor-style gauge, notes card). Desktop icons: top-left or top-right
   column, 0–4. Windows 0.4–0.75 viewport, 1–3 open; headerbar 30–38px flat,
   title left 12–13px, 3 buttons right 11–13px.
2. **Blocks** — `taskbar` (variant *plasma-panel*: 3 zones left/mid/right,
   flat, 1px top hairline), `window` ×1–3 (variant *breeze-flat*: 0–3px
   radius, flat header, 1px border, title left, controls right), `icon` ×4–8
   (desktop column, flat 20–24px glyphs), `clock` (2-line right), `gauge` ×0–
   1 (as a plasmoid card, variant *widget-card*: 120–200px, flat card 6–10px
   radius), `wallpaper` (variant *plasma-photo*: procedural "photo-like" —
   smooth gradient field + 1–3 large soft shapes, or flat solid).
3. **Signature** — radius 0–4px. Density **medium**: padding 8–12px, spacing
   6–10px, font 12–13px. Color: Breeze-neutral — light: hsl 210 12–20%
   94–98%; dark: hsl 210 8% 13–18%; accent = ONE seeded hue (default 210
   Breeze-blue; sat 55–90%) on launcher, active button, focus. Flat fills,
   1px borders, optional thin shadow 2–8px. Motion: 120–200ms, no bounce.
4. **Keywords** — "kde", "plasma", "kubuntu", "breeze", "linux desktop",
   "linux panel", "kicker", "plasmoids".

### 3.7 `gnome` — top bar + centered clock + left dock

1. **Topology** — `chrome: top-bar + left-dock`. Top bar full width, h 3–4%
   (~24–30px): **left = "Activities" text button**; **center = clock**
   ("Thu 10:41", 13–14px — the signature); right = 2–4 indicator glyphs +
   power. Dock: **left-anchored vertical column** (Ubuntu-style; seeded alt:
   bottom-center), w 5–7% (~56–72px), icons 40–56px, flat or faint glass
   slab. **No desktop icons** (0–1). Windows 0.45–0.75 viewport, 1–3 open;
   headerbar 38–46px (taller than other desktops), title centered 13–14px,
   window buttons **right**, circular 10–12px, top corners 6–10px.
2. **Blocks** — `menu-bar` (variant *gnome-top*: flat, "Activities" left,
   **clock centered**, indicators right, 1px bottom hairline), `dock`
   (variant *gnome-rail*: left vertical, optional faint slab 4–8px radius,
   optional running-dot under icons), `window` ×1–3 (variant *adwaita*: flat
   headerbar taller than titlebar norms, title centered, round buttons
   right, 6–10px top radius, 1px border), `icon` ×4–7 (dock, flat 40–56px),
   `clock` (top-center, 1-line, 13–14px), `wallpaper` (variant *gnome-wash*:
   single-hue soft gradient or big soft blob, low sat 15–45%, bright 75–92%,
   often pastel).
3. **Signature** — radius 6–10px (windows top) / circular (window buttons) /
   4–8px (dock slab). Density **low**: sparse top bar, padding 14–18px, font
   13–14px. Color: neutral light hsl 210 10–20% 92–98% or dark hsl 215 10–
   15% 10–14%; accent = ONE seeded hue (Ubuntu-orange 22–38 or any; sat
   55–85) used sparingly (Activities hover, active dock). Flat, hairline
   borders, subtle shadow 6–16px. Motion: 150–250ms scale/opacity.
4. **Keywords** — "gnome", "activities", "ubuntu", "adwaita", "centered clock",
   "left dock", "fedora desktop".

### 3.8 `generic-flat-linux` — the neutral "practical workbench"

The **default for unadorned practical concepts** (spec §11 criterion: "a
highly practical and lightweight desktop operating system" → *this*, never a
flashy default). Deliberately the least distinctive entry in the catalog.

1. **Topology** — `chrome: bottom-bar` (seeded alt: `top-bar`, 50/50). Bar
   full width, h 4–5% (~40–48px): left = plain app-menu button (36×h square,
   label "Menu" or a 16px grid glyph — no brand); task buttons 0–4; right = 2–
   3 status glyphs + 1-line clock. No dock. Desktop: icon grid top-left, 1–3
   columns, 4–8 icons, 16–20px. Windows 0.4–0.75 viewport, 1–2 open; headerbar
   28–34px, title **left**, 3 buttons right 10–12px, 0–2px radius.
2. **Blocks** — `taskbar` (variant *plain*: flat solid, 1px hairline, no
   gradient, no bevel, no translucency), `window` ×1–2 (variant *plain*: flat
   header, 1px border, title left, square or 0–2px corners), `icon` ×4–8
   (flat 16–20px, 1-color or 2-tone, no gloss), `clock` (1-line, 12px, right),
   `wallpaper` (variant *neutral*: flat solid OR 2-stop subtle gradient 5–10%
   lightness delta; low sat 5–25%; light 88–96% or dark 8–14%).
3. **Signature** — radius 0–2px. Density **high/compact**: padding 4–8px,
   spacing 4–8px, font 11–13px, small controls. Color: neutral gray family
   (hsl 210–230, sat 4–15%, light 90–96% light mode / 10–16% dark mode) + one
   **low-sat accent** (sat 20–50%, any hue) for active/focus only. No shadow
   or 0–2px, hairline borders, flat fills. Motion: 100–150ms or none; hover =
   10–15% background lightness shift.
4. **Keywords** — "practical", "lightweight", "no-frills", "normal linux",
   "plain desktop", "utility", "workstation", "neutral", "practical and
   lightweight desktop operating system", "daily driver".

### 3.9 `tty-terminal` — tty1, text only

1. **Topology** — `chrome: none`. Full-viewport monospace text on a character
   grid (~80×24 logical cells scaled to fit; cell ~16×24px @1080). Structure:
   optional **status line** top (1 line: session name left, window/pane
   center, time right — 2-color, dim + bright), main text region (85–95% of
   height), input line = inline prompt after last output (`user@host:~$ `), no
   separate bar. No wallpaper (solid background), no icons (ASCII/box glyphs
   only: ▸ ● ■ ▌), no windows (optional: `screen`-style split = 2 panes
   divided by 1-char border, seeded 50/50).
2. **Blocks** — `terminal` (full viewport, variant *tty*: monospace only, 1–3
   colors, prompt prefix seeded, scrollback 200–500 lines), `readout` ×0–1
   (optional htop-style header line: 5–7 columns of monospace stats, 1 line
   every 1–2s), `clock` (inline text in status line, 12px, HH:MM), NO
   `wallpaper`, NO `icon`, NO `dock`, NO `taskbar`, NO `window`.
3. **Signature** — radius 0 (everything). Density: line-height 1.1–1.4 of
   font, font 13–16px monospace, spacing = character grid. Color: **2–3 colors
   only** — bg hsl(any hue, 5–18%, 4–10%); fg hsl(same hue ±10, 0–20%,
   75–90%); ONE accent hsl(seed hue, 70–100%, 55–70%). Classic families:
   phosphor green (hue 90–135), amber (hue 28–45), cyan (hue 165–195),
   plain white-on-black. No motion except cursor blink (500–900ms period,
   block or underscore, seeded style). Inverse-video for selection/header.
4. **Keywords** — "tty", "tty1", "terminal", "console", "text only", "bash",
   "ncurses", "monospace", "command line", "no gui", "screen", "tmux".

### 3.10 `instrument-console` — gauges, dials, levers

1. **Topology** — `chrome: none` (no bars). The whole viewport is an
   instrument faceplate. Zones: **gauge cluster** center 45–65% of viewport —
   3–7 radial gauges 120–220px arranged in an arc (4–6) or 2×3 grid (≤4);
   **control column** left OR right (seeded), w 8–12% — 2–5 `lever`/`dial`
   controls stacked, each with an engraved label; **readout strip** top or
   bottom, full width, 8–12% — 2–4 `readout` cells (7-seg/dot-matrix); **log
   strip** bottom, full width, 14–20% — `terminal` variant *log-panel*
   (monospace 11–13px, 3–5 lines, dimmed). Faceplate: panels 8–20px padding,
   4–8px radius, inset shadow 2–4px, 1px rivet/screw dots at panel corners
   (optional, 0–4).
2. **Blocks** — `gauge` ×3–7 (variant *instrument*: tick marks 8–24, needle,
   3-zone arc coloring [ok/warn/danger], center value 12–16px, label
   uppercase 9–10px letterspaced), `dial` ×1–3 (24–48px, ticks 24–48,
   rotatable), `lever` ×2–5 (on/off, 28–56px, label), `readout` ×2–4
   (style: led-7seg | dot-matrix | glow-text; hue amber 30–45 / green 100–
   140 / cyan 180–200), `terminal` ×1 (log strip, monospace), `clock` ×0–1
   (digital segment display in readout strip), NO `window`, NO `taskbar`, NO
   `icon` (engraved text labels instead), `wallpaper` = faceplate (variant
   *brushed-metal*: dark #16–#22 base, 3–8% lightness noise streaks, or
   beige control-room 65–80% lightness).
3. **Signature** — radius 4–8px (panels); gauges fully circular. Density
   **medium-high**: instruments packed but with 12–24px gutters. Color:
   faceplate dark 5–15% lightness (or beige 65–80%); accents = status
   colors: amber 32–45° / green 100–145° / red 0–12° / cyan 180–200°;
   **emissive glow** on readouts and needles (text-shadow / drop-shadow 4–
   12px, 50–80%). Labels uppercase, 9–10px, letterspacing 1–3px. Motion:
   needle settle 300–600ms ease-out, readout tick 1–2s, no window anims.
4. **Keywords** — "instrument", "machine", "console", "gauges", "dials",
   "levers", "control panel", "cockpit", "instrument panel", "industrial",
   "machine console", "dials and levers".

### 3.11 `game-hud` — edge-anchored clusters, no chrome

1. **Topology** — `chrome: none` (diegetic overlay). The "world" wallpaper
   fills everything; HUD clusters **anchored to edges**, center 55–70% kept
   clear. Zones: top-left = `minimap` (radius 40–70px) + objective list (2–4
   text lines, 12–13px, dim); top-center = breadcrumb/quest tracker (1–2
   lines, 13–14px, centered, 70–90% opacity); top-right = 1–2 small status
   glyphs + optional 1-line clock; bottom-left = resource panel: `bar-hud` ×
   2–4 (health/XP etc., w 12–20% of viewport, h 12–16px, label above 10–11px)
   + 2–3 stat lines; bottom-right = ability cluster: 4–8 circular slots 40–
   64px in a row or 2×2, 1px ring, 1–3 with cooldown fill; bottom-center =
   optional chat/log 2–4 lines (max w 30%). Center: `crosshair` (4–12px).
   `vignette` edge-darkness 20–40%.
2. **Blocks** — `icon` ×4–8 (ability slots, circular, flat 2-tone glyphs 24–
   32px in 40–64px rings), `bar-hud` ×2–4, `gauge` ×0–2 (radial XP ring or
   radar sweep), `minimap` ×1, `crosshair` ×1, `terminal` ×1 (variant
   *chat-log*: bottom-left or bottom-center, monospace 12px, 2–4 lines,
   60–80% opacity), `clock` ×0–1 (top-right, 11–12px), NO `window`, NO
   `taskbar`, NO `dock`, `wallpaper` (variant *game-scene*: procedural depth
   field — gradient horizon + 3–8 parallax shape silhouettes at 2 depth
   levels, or abstract void + glow).
3. **Signature** — radius 0–4px (angular) or 6–10px (futuristic, seeded
   flavor); slots circular. Density **sparse**: edge clusters only, center
   empty, font 11–14px. Color: dark world base (hsl any, sat 15–40%, light
   8–18%) + ONE high-contrast accent hue (seeded, sat 70–100%, light 55–70%)
   on bars/slots/crosshair; neutral white 80–95% for text; emissive 2–6px on
   accent elements. Corner-bracket framing on panels (⌐¬ style, 2–3px).
   Motion: bar fill 200–300ms, damage/flash 150–300ms, crosshair static,
   minimap blips pulse 2–4s.
4. **Keywords** — "game", "hud", "head-up display", "crosshair", "ability bar",
   "rpg", "first person", "dashboard", "quest tracker", "health bar".

### 3.12 `invented: radial-orbital` — concentric rings around a core

A never-seen-before archetype: **no bars at all** — navigation is concentric
rings rotating around a central hub, like a giant combination dial / clock
face / spacecraft wheel.

1. **Topology** — `chrome: radial`. Zones: **core hub** center, radius 14–20%
   of min viewport side (keeper identity glyph/name, glow 4–12px); **inner
   ring** radius 28–38% of min side — 5–8 sector cells (apps), each sector
   w = 360°/n; **outer ring** radius 34–44% — 8–12 tick cells (secondary
   verbs/tools, smaller glyphs); **tick arc** radius 45–55% — 60 ticks as a
   clock-face (clock block rendered as the tick arc; minute = highlighted
   tick); **context panel** — single anchored panel in the bottom third (w
   35–55%, h 25–35%) or top third, showing the selected app's content;
   selected sector highlights + context panel swaps. Interaction: pointer
   drag rotates rings (inertial, 100–300ms settle).
2. **Blocks** — `hub` ×1 (circular, glyph or face, glow), `ring` ×2 (sectors
   5–8 / ticks 8–12, glyphs from icon bank), `clock` (variant *tick-arc*:
   60 ticks, current-minute tick lit accent), `window` ×1 (variant
   *orbital-panel*: the context panel, no titlebar — 1-line label top, 8–12px
   radius, 70–90% opacity), `terminal` ×1 (as one sector's context: log text
   in the panel), `icon` ×5–12 (sector glyphs 16–28px), `gauge` ×0–2
   (optional: power/energy arc wrapping the hub), NO `taskbar`, NO `dock`,
   `wallpaper` (variant *radial-glow*: radial gradient from hub hue, dark
   8–14% base, 2–3 orbit-ring hairlines at 10–20% opacity).
3. **Signature** — everything circular (radius ∞ for rings/hub; panels 8–12px).
   Density **medium**: 5–12 interactive elements per ring, generous angular
   spacing. Color: dark base hsl (any hue, 10–25%, 8–14%) + 1–2 accent hues
   (hub glow hue seeded, ring highlight 2nd hue 30–60° apart, sat 60–90%);
   hairline rings 1px 15–30% opacity; emissive 4–10px on active sector.
   Motion: ring rotation ease-out 100–300ms, sector highlight 150ms, hub glow
   pulse 2–4s, panel swap fade 200ms.
4. **Keywords** — "radial", "dial", "orbital", "circular menu", "dial
   interface", "steering wheel", "clock face", "combination dial", "spinning
   rings".

### 3.13 `invented: vertical-ledger` — spine + pane + ticker

Never-seen-before archetype (evokes old Unix workstations / newsroom
terminals, but as a *layout*): a dense 3-zone text-first screen, no windows.

1. **Topology** — `chrome: left-spine`. Zones: **left spine** w 6–10% —
   header block (world name 12–13px bold, version/seed 9–10px dim, 2 lines)
   then a vertical stack of 4–8 `spine-row` app rows (each 20–30px: glyph
   12–14px + label 11–12px + status dot 4–6px right); **main pane** w 70–80%
   — the active app's content: 1-line header (title left, index center, 12px)
   then body (terminal-style text or app content), NO window frame — pane
   separated from spine by 1px divider; **right rail** w 8–12% — `ticker`
   (status lines appending 1–3s/line, monospace 10–11px, 20–40 visible
   lines, older fade to 40%) + bottom: 1 `gauge` mini (uptime/load, 60–90px,
   variant *strip*) + 1-line `clock`.
2. **Blocks** — `terminal` ×1 (main pane body when the active "app" is the
   shell; monospace 12–13px), `spine-row` ×4–8, `ticker` ×1, `gauge` ×1 (mini
   strip), `clock` (1-line, rail bottom, 10–11px), `readout` ×0–1 (spine
   header stats), `icon` ×0–8 (spine-row glyphs 12–14px, 1-color), NO
   `window` (the pane IS the app — frameless), NO `taskbar` (spine replaces
   it), NO `dock`, `wallpaper` = none (solid bg 2 zones at most: bg + 1
   slightly lighter rail tone 3–6% delta).
3. **Signature** — radius **0**. Density **high**: line-height 20–28px, font
   10–13px monospace-dominant, spacing 4–8px. Color: **2-color system** —
   dark base hsl (any, 8–20%, 8–12%) + ONE accent hsl (seeded, sat 75–100%,
   light 50–65%) for active row dot, header, gauge fill; everything else
   dimmed text 40–60%. Hairline dividers 1px 10–20% opacity. Motion: line
   append 100ms or none; ticker steady; active-row highlight instant or 80–
   120ms. Cursor blink 500–900ms in any text field.
4. **Keywords** — "ledger", "workbench", "ide", "terminal workbench", "spine",
   "two-column", "dense", "monospace workbench", "newsroom", "bloomberg",
   "unix workstation".

### 3.14 `invented: card-deck` — stacked full-bleed cards

Never-seen-before archetype: one app per full card; navigation is a deck, not
a window manager.

1. **Topology** — `chrome: top-strip + center-stack`. Zones: **top strip** h
   2.5–3.5% — world name left (12–13px), deck index center ("3 / 7", 12–13px,
   70% opacity), seed glyph right (10–12px); **card stack** center — top card
   w 82–94% of min side, h 70–85% of viewport, centered (slightly below
   vertical center, +2–4%); **1–2 ghost cards** behind: offset 8–16px down,
   scale 0.96–0.98, 30–50% opacity; bottom-center = optional hint line (keys,
   10–11px, 50–60% opacity). Each app = exactly one card; open = card comes
   forward; close/home = card goes back.
2. **Blocks** — `card` ×1 + ghosts ×1–2 (w/h as above, radius 12–20px, title
   line 0–1 top-left 12–13px), `terminal` ×1 (as one card's content), `gauge`
   ×0–2 (per-card widget, 80–140px), `icon` ×1–3 (ghost-card title glyphs,
   14–18px), `clock` (top strip right or center, 10–12px), `window` = the
   card itself (no titlebar chrome beyond 1 line), NO `taskbar`, NO `dock`,
   `wallpaper` (variant *desk-under*: visible in the 5–18% margins around the
   stack — subtle gradient or solid, 2–4% contrast with card).
3. **Signature** — radius 12–20px (cards), 8–10px (inner controls). Density
   **low**: one content block per card, large type 16–24px body / 12–13px
   chrome. Color: card solid fill (light 95–98% or dark 12–16%, seeded) + ONE
   accent hue (seeded, sat 55–85%); soft big shadow under top card (20–40px
   blur, 15–30%); ghost cards dimmed not blurred. Motion: card slide/scale
   250–400ms ease-out with the next card scaling up simultaneously; hover
   120–180ms.
4. **Keywords** — "cards", "deck", "swipe", "stack", "flip", "slides", "page
   by page", "book", "one thing at a time".

### 3.15 `invented: diegetic-room` — the room IS the UI

Never-seen-before archetype (layout-level detail for the `scene` paradigm):
no chrome at all; entities are physical fixtures in a 2D room.

1. **Topology** — `chrome: none`. The viewport is a 2D room: **wall/floor**
   split at 55–75% height (wall = 92–97% of floor lightness, 1px floor line,
   optional perspective floor shading 3–6%); **3–6 `fixture` objects** placed
   at seeded positions (15–40% padding from edges, no overlap; floor objects
   bottom-half, wall objects top-half); each fixture 8–18% of viewport wide.
   Click/hover a fixture → its **`ctx-panel`** appears anchored to it (w 8–
   14% of viewport, offset 4–10px from fixture edge, 1-line label 10–11px, 6–
   10px radius, 85–95% opacity). Only ONE panel open at a time. Optional
   faint bottom hint line (1 line, 60% opacity, fades after 4–8s). `vignette`
   15–30%.
2. **Blocks** — `fixture` ×3–6 (kinds: cabinet, gauge, mirror, hatch, desk,
   terminal-desk — seeded from the world's entity kinds), `ctx-panel` ×1
   (anchored, diegetic — the ONLY window-like element), `terminal` ×0–1 (as a
   desk-terminal fixture's content, inside its ctx-panel), `gauge` ×0–2 (as
   wall-gauge fixtures), `clock` ×0–1 (as a wall-clock fixture, round or
   digital, 32–56px), `icon` ×3–6 (the fixture faces themselves, 24–48px
   procedural), NO `window` (except ctx-panel), NO `taskbar`, NO `dock`,
   `wallpaper` = the room (variant *room*: wall gradient 1–2 hues, floor
   tone, 1 seeded light-source corner → 10–20% radial light pool).
3. **Signature** — radius per-object 0–8px (fixtures angular, panels 6–10px).
   Density **low**: 3–6 fixtures, 60–75% empty space. Color: one dominant
   hue family (seeded, sat 25–60%) + complementary 2nd hue on 1 fixture;
   lightness 35–65% (dim room) or 70–88% (bright); 1 light source = 10–20%
   radial light pool + vignette 15–30%. Motion: fixture hover scale 1.02–
   1.05 (80–150ms), panel fade-in 200ms, hint-line fade 1–2s. No chrome
   motion at all.
4. **Keywords** — "room", "scene", "diegetic", "just a room", "walk in",
   "spatial", "objects", "kitchen", "control room", "lighthouse", "you are
   in it".

---

## 4. Concept-keyword → layout map

The LLM's design decision is: **prompt phrases → layout id** (then paradigm +
bank pulls). Explicit layout names win over adjectives; adjectives win over
silence.

| Prompt signals (any of) | layout |
|---|---|
| "windows xp", "luna", "bloody shoe", "glossy windows", "2001 desktop", "start button" | `windows-xp` |
| "windows 10", "win10", "flat windows", "pinned taskbar", "action center" | `windows-10` |
| "windows 11", "win11", "centered taskbar", "mica", "acrylic", "fluent" | `windows-11` |
| "mac os x", "os x", "aqua", "glass dock", "glossy mac", "tigger lights" | `classic-macos` |
| "macos", "macbook", "big sur", "sonoma", "traffic lights", "squircle" | `modern-macos` |
| "kde", "plasma", "kubuntu", "breeze", "plasmoids", "linux panel" | `kde-plasma` |
| "gnome", "ubuntu", "activities", "adwaita", "centered clock" | `gnome` |
| "practical", "lightweight", "no-frills", "normal", "plain", "utility", "workstation", "daily driver", "practical and lightweight desktop operating system" | `generic-flat-linux` |
| "tty", "tty1", "terminal only", "text", "console", "bash", "ncurses", "monospace", "no gui" | `tty-terminal` |
| "instrument", "machine", "cockpit", "gauges", "dials", "levers", "industrial", "control panel" | `instrument-console` |
| "game", "hud", "crosshair", "rpg", "first person", "health bar", "dashboard" | `game-hud` |
| "radial", "dial menu", "orbital", "spinning", "combination dial", "clock face" | `invented: radial-orbital` |
| "ledger", "workbench", "ide", "dense", "newsroom", "spine", "two-column" | `invented: vertical-ledger` |
| "cards", "deck", "swipe", "flip", "slides", "one at a time" | `invented: card-deck` |
| "room", "scene", "diegetic", "spatial", "just a room", "kitchen", "lighthouse" | `invented: diegetic-room` |

## 5. Selection rules

1. **Explicit name > paradigm hint > aesthetic adjectives > silence.**
   "windows xp" → `windows-xp` even if the world is otherwise strange.
2. **Paradigm consistency**: `gui` paradigm ⇒ one of the 7 desktop layouts
   (§3.1–3.8); `tui` ⇒ `tty-terminal`; `device` ⇒ `instrument-console`;
   `scene` ⇒ `diegetic-room` (or `game-hud` if the concept is game-like);
   `invented` ⇒ the LLM may choose any of the four invented archetypes or
   combine (e.g. `radial-orbital` topology + `vertical-ledger` ticker).
   If the LLM's paradigm/layout combo is invalid, fall back to the paradigm's
   canonical layout (per spec: parse failure → `gui` → `generic-flat-linux`).
3. **Neutral default**: no signal at all ⇒ `generic-flat-linux` (practical
   desktop), **never** a flashy default (spec §11).
4. **Concept seasoning**: a layout is the skeleton; the world's strangeness
   arrives via banks (palette hue, icon grammar, fonts) and block variants,
   not by breaking the topology. A "dying lighthouse" world in `device`
   paradigm is still `instrument-console` with a teal palette.

## 6. Seeded variation (what differs between two boots of the same layout)

Everything the layout entry leaves as a range is seed-drawn:

- **Counts**: window count, icon count, tray icon count, gauge count, sectors
  per ring, fixture count.
- **Geometry**: zone height/width within range, window sizes/positions, dock
  icon size, ring radii, fixture positions.
- **Hue**: accent hue within the family band (e.g. Luna 212–225 ± seeded
  ±6° offset), palette lightness/saturation within band.
- **Booleans**: Windows-10 search box, dock magnify on/off, tty status line,
  gnome dock left-vs-center, panel bottom-vs-top, light-vs-dark mode,
  corner rounding within range.
- **Variants**: wallpaper variant choice, gauge tick count, clock lines.

Rule of thumb: two boots of `windows-xp` must be *recognizably the same OS
family but different machines* (different wallpaper hills, different accent
offset, different app set) — never a pixel-identical clone, never a
different family.

## 7. Instantiation notes for the UI

- **Zones → CSS grid**: the instantiator lays zones out as absolutely
  positioned layers in z-order §1 (wallpaper → desktop icons → windows →
  bars → huds). Zone fractions convert to px with the 1080-scaling factor.
- **Blocks are data-driven**: each block entry renders via its blocks-
  contract component with the params in the entry; aux blocks (§2) are thin
  SVG/CSS renderers keyed by `type` + `variant`.
- **Determinism**: all seed draws happen in world-gen (server-side), the
  materialized `layoutSpec` is cached with the world and shipped in
  `/api/world`; the client instantiator only reads values — so the look is
  identical across reloads of the same world, with zero client-side
  randomness.
- **Input mapping**: every layout defines exactly one "go home" affordance
  (start button / Activities / spine header / hub / home card / any fixture
  click-away / Esc in tui) wired to the world's home verb — the blocks
  designer renders it, this doc names where it lives.
- **Small screens**: at min-side < 700px, bars/docks shrink to 90% of
  range minimums; invented layouts keep topology (rings scale, cards keep
  ratio, room keeps fixture count).
- **Palette handoff**: layout signatures define *family bands*; exact colors
  come from the palette bank (concept-steered) — the instantiator clamps
  layout band ∩ palette band and falls back to the layout band.

## 8. Coverage checklist

Required layouts present: Windows XP (Luna) §3.1 ✓ · Windows 10 §3.2 ✓ ·
Windows 11 §3.3 ✓ · classic macOS (Aqua) §3.4 ✓ · modern macOS §3.5 ✓ · KDE
Plasma §3.6 ✓ · GNOME §3.7 ✓ · generic flat Linux §3.8 ✓ · tty/terminal-only
§3.9 ✓ · instrument/machine console §3.10 ✓ · game-HUD §3.11 ✓ · 4
invented archetypes §3.12–3.15 ✓ (radial-orbital, vertical-ledger,
card-deck, diegetic-room).
