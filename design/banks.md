# LarpOS — Asset Bank Catalog (design doc)

Status: design (no code). Owner: designer #4 of 4 (banks). Companion docs: building
blocks, layouts, composition (their files). Implementation today lives in
`app/banks/{fonts,icons,sounds,palettes}.js` + `app/design.js`; this doc is the
*catalog* those files implement, and where they extend.

---

## 0. Rules of the bank

1. **Zero network at runtime.** Every asset a world can reference must exist on disk
   inside the image (`/opt/larpos/...`) or be generable in-memory from a seed. No
   CDN, no Google Fonts, no fetch() to any host other than `127.0.0.1:8080`
   (same-origin static files) in the post-boot UI. The build host *may* fetch;
   the kiosk may not.
2. **Selective pull.** A world's design spec references bank items **by id only**.
   A `tui` world references **zero** icon entries and zero or one sound cue. A
   `scene` world may reference no icon style at all. "Pull nothing" is a valid,
   explicit pull — the spec carries an explicit `null`/`[]`, not an implicit
   default, so the instantiator can assert it (selftest).
3. **Deterministic.** Given (seed, concept) the same world pulls the same ids,
   always. Id selection happens in exactly one place: the seeded `PRNG`
   (`app/prng.js`) or the low-thinking LLM call, and the LLM may emit **ids from a
   closed list only** — never a hex color, a path, a frequency, or a family name.
   The instantiator maps id → concrete asset. Unknown id → deterministic
   fallback (documented per bank), never a fetch.
4. **Zero npm.** Asset conversion (PNG crop, FLAC→WAV, TTF subset) happens at
   *build time* on the build host. Runtime is: serve bytes + `new Audio(dataUri)`
   / inline SVG / `@font-face` to a local path.
5. **License hygiene.** Every bundled third-party asset keeps its license file
   under `assets/licenses/<name>.txt`. Bundling decision per item below is
   license-aware: GPL icon *themes* are used as style reference for the grammar,
   not re-bundled wholesale; public-domain and OFL/CC-BY/ISC/MIT items are
   bundled directly with credit.
6. **Size budget.** `app/assets/` total ≤ ~1.2 MB (icons ≤ 250 KB, fonts ≤
   700 KB, sounds ≤ 200 KB). Image is 2 GB; the budget is about boot-time parse
   speed and keeping the image diffable, not raw capacity.

### Where assets live in the image

`build.sh` already runs `cp -a app/* image/skel/opt/larpos/`, so everything
placed in **`app/assets/`** lands at **`/opt/larpos/assets/`** with zero changes
to `build.sh`:

```
app/assets/
  icons/<style-id>/<subject>.svg|png     # bundled tier (small curated subsets)
  fonts/<family>/<weight>.ttf           # OFL families (optional tier)
  sounds/<cue>.wav                       # converted 16kHz mono WAVs
  licenses/<source>.txt                  # OFL / CC-BY / CC-BY-SA / Unlicense text
```

`server.js` serves `/assets/<path>` from that directory (same origin). The
instantiator inlines nothing at build time; it loads on demand per world — a
`tui` world's boot never touches `icons/` at all (selective pull is physical,
not just logical).

---

## 1. Universal entry schema

Every bank item is one object; the catalog (a JSON array per bank, or one merged
array) is the only thing the LLM ever sees (as id + short description) and the
only thing the instantiator resolves.

```jsonc
// bank-entry.schema (all fields)
{
  "id":            "icons.lucide.outline",   // "<bank>.<family>.<variant>" — unique across catalog
  "kind":          "icon-style",             // icon-style | font | sound-set | palette-band
  "source": {
    "name":        "lucide",
    "repo":        "lucide-icons/lucide",
    "url":         "https://github.com/lucide-icons/lucide",
    "license":     "ISC",
    "verified":    "2026-10-08",            // date we confirmed repo+license exist
    "obtained":    "bundled"                // bundled | image-package | grammar | parametric | reference-only
  },
  "representation": "bundled-svg",          // see per-bank enum below
  "bundlePath":     "assets/icons/lucide/",  // when bundled; null otherwise
  "fallback":       "icons.grammar.flat-line", // deterministic fallback id when asset missing
  "subjects":       ["folder","terminal","file","app"],   // icon-style: subjects it can draw (full list in §2.1)
  "cues":           ["boot","click","open","error"],      // sound-set: cues it provides (full list in §4.1)
  "params":         { },                   // style rules / grammar spec / recipe (see per-bank)
  "paradigmAffinity": ["gui","invented"],  // paradigms this item is pulled for
  "tags":           ["outline","modern"],
  "licenseNote":    "ISC — keep assets/licenses/lucide.txt"
}
```

Per-bank `representation` enums:

- **icons**: `bundled-svg` (curated subset rendered as-is), `bundled-png` (retro
  pixel PNGs), `image-package` (files already on disk via an Alpine package),
  `grammar` (drawn from seeded spec, no assets), `grammar-blend` (bundled shape
  library + seeded jitter/variants), `none`.
- **fonts**: `image-package` (DejaVu via `font-dejavu` — always present),
  `bundled-ttf` (OFL files under `assets/fonts/`), `stack-only` (generic
  fallback, guaranteed by the browser).
- **sounds**: `parametric` (synthesized at boot, zero assets), `bundled-wav`
  (curated real samples, converted to 16 kHz mono at build time).
- **palettes**: `band` (hue/sat/lightness ranges, exact values seeded at world
  gen — never a fixed hex list), `reference-only` (real-world anchor used only
  to steer bands).

---

## 2. Icons bank

### 2.1 Representation decision per style — and why

| style id | look | real-world anchor (researched) | representation | why |
|---|---|---|---|---|
| `icons.lucide.outline` | 24px, 2px round-cap single-color stroke | lucide-icons/lucide (ISC, ~24.9k★ — verified 2026-10-08) | `grammar-blend` | The subject set is *open* (worlds invent subjects: "mouth", "valve", "seal"), so no finite set can cover it. We bundle **~14 core-subject SVGs** as the shape library and extend with the seeded grammar (same grid, same stroke rules). ISC is trivially bundle-safe. |
| `icons.feather.outline` | same grid, slightly tighter curves | feathericons/feather (MIT, ~26k★ — verified; note the old `phistrom/feather` org is dead, repo is now `feathericons/feather`) | `grammar-blend` (shares shape library with lucide; only stroke params differ) | Feather ≈ lucide geometrically; bundling both doubles bytes for one look. Keep as a *param variant* of the same library instead of a second bundle. |
| `icons.tabler.outline` | 24px, 2px, squared caps | tabler/tabler-icons (MIT, ~22k★ — verified) | `grammar-blend` | Same reasoning; param variant (cap=`square`, width 2). |
| `icons.papirus.flat-duotone` | flat, rounded, 22%-opacity accent fill, 1px padding | PapirusDevelopmentTeam/papirus-icon-theme (GPL-3.0, ~8.1k★ — verified; PNG-generated, not SVG in-repo) | `grammar` | GPL-3.0 PNG set: *not* re-bundled (keep image free of GPL asset weight). The style is fully reproducible by rule: rounded-rect subject silhouette + accent fill @ 0.22 + 1.5px stroke. Look, not license-carrying pixels. |
| `icons.elementary.flat` | flat, subtle gradients | elementary/icons (GPL-3.0 — verified 598★) | `grammar` | Same GPL reasoning as papirus: capture rules, not files. |
| `icons.xp.luna-pixel` | 16/32px pixel, saturated gradients, 2px bevel | softwarehistorysociety/XPIcons (**Unlicense / public domain** — verified; 559 PNGs of XP/Longhorn/Whistler-era icons) | `bundled-png` | **The one bundled pixel set.** Public domain = zero friction, and hand-drawing authentic Luna gradients procedurally is the hardest look in the catalog; ~12 curated PNGs (folder, folder-open, drive, terminal-ish, network, settings, trash, file, email, browser, help, warning) at 16+32px < 80 KB. Reproduction-fidelity wins. |
| `icons.xp.luna-gloss` (invented subjects) | pixel-gloss | same anchor | `grammar` with pixel constraint | Invented subjects can't be in the PNG set; drawn on a 16×16 grid, `shape-rendering: crispEdges`, ≤6 colors from the palette, one radial highlight ellipse. |
| `icons.aqua.glass` | glossy glass, white radial highlight top-half | **no obtainable open set exists** (researched 2026-10-08: searches only surface non-free macOS rips / third-party Discord themes — all license-unknown) | `grammar` | Since there is no clean source, it must be procedural: rounded-rect body, vertical linearGradient (palette-driven), white 0.6→0 ellipse highlight, 1px inner stroke. Purely palette-driven ⇒ fits any world. |
| `icons.adwaita.real` | real GNOME look | adwaita-icon-theme **already installed in the image** (`build.sh` package list — verified) → files at `/usr/share/icons/Adwaita/` | `image-package` | Zero additional assets, zero network: a "normal Linux desktop" world renders the *actual* Adwaita SVGs from disk by standard freedesktop naming (`system-file-finder`, `utilities-terminal`, …). This is the cheapest authentic-look in the catalog. GPL-licensed package is a distribution concern of Alpine, not of our bundle. |
| `icons.breeze.real` | real KDE look | KDE/breeze-icons (LGPL-2.1, ~281★ — verified; **SVG-based**, unlike papirus) | `image-package` *preferred* / `bundled-svg` fallback | Prefer an `apk add breeze-icon-theme` in `build.sh` (verify package name at next image build) → `/usr/share/icons/Breeze/` on disk. If the package doesn't exist, fallback = bundle a ~15-subject SVG subset (LGPL permits bundling with license file). Do not bundle the whole theme. |
| `icons.tango.real` | 2000s freedesktop standard | Distrotech/tango-icon-theme — repo COPYING: *"released into the Public Domain"* (verified 2026-10-08); the canonical tango.freedesktop.org is dead (400) and `tango/IconLibrary` is an empty repo | `bundled-svg` (small subset) | Public-domain per the mirror's own license file ⇒ ~14 subjects (1.4 KB each, hand-traced SVG is fine too). If the public-domain claim is disputed at review, demote to `grammar` (tango = flat blue-ish, soft bevel — easy by rule). |
| `icons.crt.glyph` | monochrome, 1-bit, blocky | classic terminal glyphs | `grammar` | 2–3px solid shapes, no gradient, single fg color. Used by `device` paradigms (and by `tui` worlds *inside* the terminal only when the world's fiction has a logo — still no desktop icons). |
| `icons.sketch.hand-drawn` | wobbly ink | — | `grammar` | Seeded jitter on stroke paths + slight rotation (already in `banks/icons.js`). `scene` paradigm. |

**Core subject set** (the closed list any icon entry's `subjects` may contain):
`folder, folder-open, file, terminal, trash, system, gauge, settings, clock,
window, editor, device, bell, network, drive, browser, mail, help, warning,
battery` — plus `app` as the fallback shape. World-specific subjects (keeper-
named things) are **never** in the set: they route to that style's grammar with
the subject name as seed input, so two worlds with the same grammar and subject
"mouth" render different mouths, and the same world always renders the same one.

### 2.2 Entry examples (complete, machine-readable)

```json
[
  {
    "id": "icons.lucide.outline",
    "kind": "icon-style",
    "source": {
      "name": "lucide",
      "repo": "lucide-icons/lucide",
      "url": "https://github.com/lucide-icons/lucide",
      "license": "ISC",
      "verified": "2026-10-08",
      "obtained": "bundled"
    },
    "representation": "grammar-blend",
    "bundlePath": "assets/icons/lucide/",
    "fallback": "icons.grammar.flat-line",
    "subjects": ["folder","file","terminal","trash","system","gauge","settings","clock","window","editor","device","bell","network","drive","browser","mail","help","warning","battery","app"],
    "params": {
      "grid": 24, "strokeWidth": 2, "linecap": "round", "linejoin": "round",
      "fill": "none", "colorRole": "accent",
      "jitter": 0, "pixelSnap": false
    },
    "paradigmAffinity": ["gui", "invented"],
    "tags": ["outline", "modern", "clean"],
    "licenseNote": "ISC — keep assets/licenses/lucide.txt"
  },
  {
    "id": "icons.xp.luna-pixel",
    "kind": "icon-style",
    "source": {
      "name": "XPIcons",
      "repo": "softwarehistorysociety/XPIcons",
      "url": "https://github.com/softwarehistorysociety/XPIcons",
      "license": "Unlicense",
      "verified": "2026-10-08",
      "obtained": "bundled"
    },
    "representation": "bundled-png",
    "bundlePath": "assets/icons/xp-luna/",
    "fallback": "icons.xp.luna-gloss",
    "subjects": ["folder","folder-open","file","drive","network","settings","trash","mail","browser","help","warning","terminal","system","gauge","app"],
    "params": {
      "sizes": [16, 32], "colorRole": "none",
      "pixelGrid": 16, "crispEdges": true,
      "maxColors": 6, "inventedSubject": "icons.xp.luna-gloss"
    },
    "paradigmAffinity": ["gui", "invented"],
    "tags": ["pixel", "retro", "2000s", "xp", "luna"],
    "licenseNote": "Unlicense (public domain) — keep assets/licenses/xpicons.txt"
  },
  {
    "id": "icons.aqua.glass",
    "kind": "icon-style",
    "source": {
      "name": "none-clean",
      "repo": null,
      "url": null,
      "license": "none",
      "verified": "2026-10-08",
      "obtained": "grammar"
    },
    "representation": "grammar",
    "bundlePath": null,
    "fallback": "icons.grammar.flat-line",
    "subjects": ["folder","file","terminal","trash","system","gauge","settings","clock","window","editor","device","bell","network","drive","browser","mail","help","warning","battery","app"],
    "params": {
      "grid": 24, "body": "rounded-rect", "cornerR": 5,
      "gradient": { "stops": [1.0, 0.55], "colors": ["highlight", "accent"], "dir": "vertical" },
      "highlight": { "ellipse": true, "opacity": [0.65, 0.0], "yBias": -4 },
      "innerStroke": 1, "colorRole": "palette", "jitter": 0, "pixelSnap": false
    },
    "paradigmAffinity": ["gui", "invented"],
    "tags": ["gloss", "glass", "2000s", "macos-like"],
    "licenseNote": "fully procedural — no third-party pixels"
  },
  {
    "id": "icons.adwaita.real",
    "kind": "icon-style",
    "source": {
      "name": "adwaita-icon-theme (Alpine package)",
      "repo": "apk:adwaita-icon-theme",
      "url": "https://pkgs.alpinelinux.org/package/edge/x86_64/community/adwaita-icon-theme",
      "license": "GPL-2.0-or-later (package-level)",
      "verified": "2026-10-08",
      "obtained": "image-package"
    },
    "representation": "image-package",
    "bundlePath": "/usr/share/icons/Adwaita",
    "fallback": "icons.grammar.flat-line",
    "subjects": ["folder","folder-open","file","terminal","trash","system","settings","clock","window","editor","device","bell","network","drive","browser","mail","help","warning","battery","app"],
    "params": {
      "freedesktopNames": {
        "folder": "folder", "file": "text-x-generic", "terminal": "utilities-terminal",
        "trash": "user-trash", "system": "computer", "settings": "preferences-system",
        "clock": "preferences-system-time", "window": "window", "editor": "accessories-text-editor",
        "device": "phone", "bell": "notifications", "network": "network-workgroup",
        "drive": "drive-harddisk", "browser": "web-browser", "mail": "mail-unread",
        "help": "help-browser", "warning": "dialog-warning", "battery": "battery-full",
        "gauge": "utilities-system-monitor", "app": "application-x-executable"
      },
      "size": 48, "colorRole": "none"
    },
    "paradigmAffinity": ["gui"],
    "tags": ["real-linux", "gnome", "flat"],
    "licenseNote": "files belong to the Alpine package; no copy ships in app/assets"
  }
]
```

*(Feather/tabler/papirus/elementary/tango/crt/sketch entries follow the same
shape — full JSON in the implementation; the four above show the four
`representation` modes that matter.)*

### 2.3 Pull contract for icons

- Design spec field: `bankPulls.icons = null | { styleId, subjects[] }`.
- `gui`/`invented`: exactly one `styleId` (chosen by seeded PRNG weighted by
  `paradigmAffinity` + concept keywords, e.g. concept mentions "XP"/"2000" →
  `xp.luna-pixel`; "modern" → outline family). `subjects` = the world's entities
  mapped through the style's `subjects` list; unmatched entity → style's
  `inventedSubject` grammar path.
- `tui`: **`icons: null` — hard rule, selftest-asserted.** A tty1 world has no
  iconography; the only sanctioned glyph is ASCII/box-drawing in the terminal
  pane itself (a font concern, not an icon concern).
- `device`: `styleId` from `{crt.glyph, xp.luna-pixel, papirus.flat-duotone,
  aqua.glass}`; icons are *instruments' face glyphs*, sparse (≤4 on screen).
- `scene`: `{sketch.hand-drawn}` or `null`.
- A style the world doesn't pull is never fetched, even lazily.

---

## 3. Fonts bank

### 3.1 Tiers and decision

| tier | what | source (researched) | representation | why |
|---|---|---|---|---|
| T0 — guaranteed | DejaVu Sans / Sans Mono / Serif | `font-dejavu` package already in `build.sh` (verified) | `image-package` | Always on disk → every stack's last-resort fallback. Never referenced as the *primary* look (too default) except the `mono_tui` role. |
| T0b — guaranteed | generic + browser-embedded (FreeSans via firefox-esr) | browser itself | `stack-only` | The `ui-sans-serif, system-ui` head of stacks; free. |
| T1 — bundled | **IBM Plex** (Sans / Serif / Mono / Condensed), OFL-1.1 | IBM/plex (OFL-1.1, ~11.7k★ — verified 2026-10-08) | `bundled-ttf` | OFL-1.1 explicitly permits bundling self-hosted font files with the license text. One family gives four distinct voices (1990s-utility / newsprint / code / condensed-display) — the biggest era-diversity win per kilobyte. |
| T1 — bundled | **JetBrains Mono**, OFL-1.1 | JetBrains/JetBrainsMono (OFL-1.1, ~13k★ — verified) | `bundled-ttf` | The "modern code editor" voice (GUI worlds that want a 2010s-2020s developer texture). Bundle Mono Regular+Bold only (~400 KB). |
| T2 — reference | Silkscreen (pixel display) | googlefonts/dharma (repo path needs re-verification — `dharmatype/silkscreen` 404'd on 2026-10-08; canonical home is the googlefonts org) | `bundled-ttf` *if verified at build time*, else grammar | If the file can't be verified, a pixel display is faked instead: DejaVu Mono at 10px on a dark grid with `letter-spacing` — visually "enough" for a `device` paradigm, zero risk. |
| T2 — reference | Impact / pixel display | not obtainable cleanly | `stack-only` | The current `display_heavy` stack. Kept as-is; Impact is not guaranteed on the image, so the stack *must* end in a guaranteed fallback (`"DejaVu Sans Mono"` — ugly but present). |

Bundle policy: regular+bold only per family; no variable fonts, no CJK, no
icons-in-font. `@font-face` points at `/assets/fonts/...` (same origin, offline
by construction). If a T1 file is missing at runtime (image rebuilt without
it), the stack's fallback chain silently carries the world — fonts never throw.

### 3.2 Entry examples

```json
[
  {
    "id": "fonts.dejavu.mono",
    "kind": "font",
    "source": { "name": "DejaVu (font-dejavu apk)", "repo": "apk:font-dejavu",
                "url": "https://pkgs.alpinelinux.org/package/edge/x86_64/main/font-dejavu",
                "license": "Bitstream Vera + public-domain additions",
                "verified": "2026-10-08", "obtained": "image-package" },
    "representation": "image-package",
    "bundlePath": null,
    "fallback": "monospace",
    "stack": "\"DejaVu Sans Mono\", monospace",
    "roles": ["mono_tui", "mono_code"],
    "paradigmAffinity": ["tui", "device", "gui", "scene", "invented"],
    "tags": ["mono", "guaranteed"],
    "licenseNote": "package-level; no asset copy"
  },
  {
    "id": "fonts.plex.sans",
    "kind": "font",
    "source": { "name": "IBM Plex Sans", "repo": "IBM/plex",
                "url": "https://github.com/IBM/plex",
                "license": "OFL-1.1", "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-ttf",
    "bundlePath": "assets/fonts/plex-sans/",
    "fallback": "\"DejaVu Sans\", ui-sans-serif, sans-serif",
    "stack": "\"IBM Plex Sans\", \"DejaVu Sans\", ui-sans-serif, sans-serif",
    "weights": [400, 700],
    "roles": ["sans_clean", "ui_default"],
    "paradigmAffinity": ["gui", "invented"],
    "tags": ["sans", "neutral", "2010s"],
    "licenseNote": "OFL-1.1 — keep assets/licenses/IBM-Plex.txt"
  },
  {
    "id": "fonts.plex.mono",
    "kind": "font",
    "source": { "name": "IBM Plex Mono", "repo": "IBM/plex",
                "url": "https://github.com/IBM/plex",
                "license": "OFL-1.1", "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-ttf",
    "bundlePath": "assets/fonts/plex-mono/",
    "fallback": "\"DejaVu Sans Mono\", monospace",
    "stack": "\"IBM Plex Mono\", \"DejaVu Sans Mono\", monospace",
    "weights": [400, 700],
    "roles": ["mono_code", "mono_dense"],
    "paradigmAffinity": ["tui", "device", "gui"],
    "tags": ["mono", "code"],
    "licenseNote": "OFL-1.1 — keep assets/licenses/IBM-Plex.txt"
  },
  {
    "id": "fonts.plex.serif",
    "kind": "font",
    "source": { "name": "IBM Plex Serif", "repo": "IBM/plex",
                "url": "https://github.com/IBM/plex",
                "license": "OFL-1.1", "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-ttf",
    "bundlePath": "assets/fonts/plex-serif/",
    "fallback": "\"DejaVu Serif\", Georgia, serif",
    "stack": "\"IBM Plex Serif\", \"DejaVu Serif\", Georgia, serif",
    "weights": [400, 700],
    "roles": ["serif_classic"],
    "paradigmAffinity": ["scene", "invented"],
    "tags": ["serif", "newsprint", "keeper-voice"],
    "licenseNote": "OFL-1.1 — keep assets/licenses/IBM-Plex.txt"
  },
  {
    "id": "fonts.jb.mono",
    "kind": "font",
    "source": { "name": "JetBrains Mono", "repo": "JetBrains/JetBrainsMono",
                "url": "https://github.com/JetBrains/JetBrainsMono",
                "license": "OFL-1.1", "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-ttf",
    "bundlePath": "assets/fonts/jetbrains-mono/",
    "fallback": "\"IBM Plex Mono\", \"DejaVu Sans Mono\", monospace",
    "stack": "\"JetBrains Mono\", \"IBM Plex Mono\", \"DejaVu Sans Mono\", monospace",
    "weights": [400, 700],
    "roles": ["mono_code", "mono_dense"],
    "paradigmAffinity": ["gui", "device", "tui"],
    "tags": ["mono", "modern", "dev"],
    "licenseNote": "OFL-1.1 — keep assets/licenses/JetBrains-Mono.txt"
  }
]
```

`roles` is the bridge to the existing `banks/fonts.js` names (`mono_code`,
`sans_clean`, …): the design spec pulls **font ids**, and the instantiator maps
role → chosen id's `stack`, keeping the current API stable.

### 3.3 Pull contract for fonts

- `bankPulls.fonts` = array of 1–2 ids: one *primary* role + `mono_code`
  implicit for the terminal component (the terminal is a component in every
  paradigm, §7 of the spec — it always gets a mono stack).
- `tui`: exactly `[fonts.*.mono]` (one id). `scene`: serif primary. `device`:
  condensed/mono primary. `gui`: sans primary.
- The concept steers *within* the affinity: "old newsroom" → `plex.serif`;
  "modern dev machine" → `jb.mono`. Never a family the browser can't render —
  every stack ends in a T0 fallback.

---

## 4. Sounds bank

### 4.1 Two tiers, one decision rule

| tier | what | source (researched) | representation | why |
|---|---|---|---|---|
| **parametric** (default for every world) | blip / buzz / chime / drone / noise-burst / bell recipes → 8-bit 16 kHz mono WAV built at boot (existing `buildWavDataUri`) | — (pure math) | `parametric` | Deterministic from (cue, seed, world-tone params); zero assets; works for the "fictional OS that has never existed" default. This is the *primary* representation by far. |
| **bundled samples** | real short system cues, only for "authentic-sounding" worlds | (a) **xdg-sound-theme** — gitlab.freedesktop.org/xdg/xdg-sound-theme (verified 2026-10-08; default freedesktop theme; inclusion rules: no licensing issues, < 1 s event sounds, normalized; per-CREDITS entries are CC-BY-SA, relicensed with author permission) · (b) **Redox OS sounds** — acidburn0zzz/sounds, **CC-BY-4.0** (verified: 18 FLAC cues: startup, shutdown, logon, logoff, pop, kernel-panic, system-error, alarm…) | `bundled-wav` | These are the only two *verified, license-clean, small* real-cue sets found. A world whose concept names a real-feeling desktop pulls one set; all other worlds get parametric. (Papirus sounds: repo not found on GitHub 2026-10-08 — **do not reference**; mark unverified, excluded from the catalog.) |

**The naming contract matters as much as the files.** XDG sound names are the
de facto system-sound vocabulary: `startup, shutdown, terminal-bell, dialog-
critical, dialog-warning, message-new, window-close, complete, alarm-clock-
elapsed, battery-low…` (from the xdg-sound-theme CREDITS list, verified). The
parametric tier emits the *same cue names*, so a world can move between tiers
without the instantiator changing. Cue set (closed list):

`boot, click, open, close, complete, error, alarm, terminal-bell, tick, pop`
— `boot`/`shutdown` may run up to 5 s (XDG background rule); all others ≤ 1 s
(XDG event rule) — we adopt the XDG rules as house rules for the parametric
recipes too.

### 4.2 Build-time conversion (zero runtime deps)

FLAC files from Redox → **16 kHz mono 16-bit WAV** under `assets/sounds/`
(FFLAC→WAV via `ffmpeg` on the *build host*; the kiosk never decodes FLAC —
Firefox ESR FLAC support is real but we don't depend on it). Keep originals'
license texts in `assets/licenses/` (CC-BY requires attribution; CC-BY-SA
requires source sharing — satisfied by the credit file + our repo being open).
Budget: ≤ 10 cues × ~40 KB = < 400 KB, fine.

### 4.3 Entry examples

```json
[
  {
    "id": "sounds.parametric",
    "kind": "sound-set",
    "source": { "name": "procedural (banks/sounds.js recipes)", "repo": null,
                "url": null, "license": "none", "verified": "2026-10-08",
                "obtained": "parametric" },
    "representation": "parametric",
    "bundlePath": null,
    "fallback": null,
    "cues": ["boot","click","open","close","complete","error","alarm","terminal-bell","tick","pop"],
    "params": {
      "sampleRate": 16000, "bitDepth": 8,
      "recipe": {
        "boot":    { "type": "chime",   "freqs": [392, 523, 659], "durMs": 900,  "wave": "sine",    "glide": 0 },
        "click":   { "type": "blip",    "freq0": 1200, "freqEnd": 900, "durMs": 45, "wave": "square", "decay": 0.5 },
        "open":    { "type": "blip",    "freq0": 520, "freqEnd": 780, "durMs": 120, "wave": "triangle", "decay": 0.3 },
        "close":   { "type": "blip",    "freq0": 780, "freqEnd": 520, "durMs": 120, "wave": "triangle", "decay": 0.3 },
        "complete":{ "type": "chime",   "freqs": [523, 659], "durMs": 250, "wave": "sine", "glide": 0 },
        "error":   { "type": "buzz",    "freq0": 110, "freqEnd": 98, "durMs": 300, "wave": "square", "decay": 0.2 },
        "alarm":   { "type": "buzz",    "freq0": 440, "freqEnd": 440, "durMs": 600, "wave": "sawtooth", "decay": 0.05, "pulse": 4 },
        "terminal-bell": { "type": "blip", "freq0": 1760, "freqEnd": 1760, "durMs": 80, "wave": "sine", "decay": 0.7 },
        "tick":    { "type": "noise",   "durMs": 30, "wave": "square", "decay": 0.9 },
        "pop":     { "type": "blip",    "freq0": 300, "freqEnd": 90, "durMs": 90, "wave": "sine", "decay": 0.6 }
      },
      "seedMods": { "freqJitterPct": 4, "waveSwapChance": 0.15 }
    },
    "paradigmAffinity": ["gui", "device", "scene", "invented"],
    "tags": ["procedural", "default"],
    "licenseNote": "no third-party audio"
  },
  {
    "id": "sounds.xdg.default",
    "kind": "sound-set",
    "source": { "name": "freedesktop default sound theme",
                "repo": "xdg/xdg-sound-theme",
                "url": "https://gitlab.freedesktop.org/xdg/xdg-sound-theme",
                "license": "CC-BY-SA (per-CREDITS, relicensed with author permission)",
                "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-wav",
    "bundlePath": "assets/sounds/xdg/",
    "fallback": "sounds.parametric",
    "cues": ["boot","close","complete","error","open","terminal-bell","alarm","tick","pop"],
    "params": {
      "cueMap": {
        "boot": "startup", "open": "dialog-warning", "close": "window-close",
        "complete": "complete", "error": "dialog-critical",
        "terminal-bell": "terminal-bell", "alarm": "alarm-clock-elapsed",
        "click": "complete", "tick": "terminal-bell", "pop": "dialog-warning"
      },
      "src": "stereo/ (converted to 16kHz mono WAV at build time)"
    },
    "paradigmAffinity": ["gui", "tui", "invented"],
    "tags": ["authentic", "linux", "xdg"],
    "licenseNote": "CC-BY-SA — keep assets/licenses/xdg-sound-theme.txt with credit list"
  },
  {
    "id": "sounds.redox.rustic",
    "kind": "sound-set",
    "source": { "name": "Redox OS sound effects (rustic theme)",
                "repo": "acidburn0zzz/sounds",
                "url": "https://github.com/acidburn0zzz/sounds",
                "license": "CC-BY-4.0",
                "verified": "2026-10-08", "obtained": "bundled" },
    "representation": "bundled-wav",
    "bundlePath": "assets/sounds/redox/",
    "fallback": "sounds.parametric",
    "cues": ["boot","open","close","complete","error","alarm","terminal-bell","pop"],
    "params": {
      "cueMap": {
        "boot": "redox_startup", "open": "redox_logon", "close": "redox_logoff",
        "complete": "redox_application_notification", "error": "redox_system_error",
        "alarm": "redox_kernel_panic", "terminal-bell": "redox_pop",
        "pop": "redox_pop", "tick": "redox_hardware_detect"
      }
    },
    "paradigmAffinity": ["tui", "device", "invented"],
    "tags": ["authentic", "terminal", "warm"],
    "licenseNote": "CC-BY-4.0 — keep assets/licenses/redox-sounds.txt"
  }
]
```

### 4.4 Pull contract for sounds

- `bankPulls.sounds` = `{ setId, cues[] }`.
- `gui`/`invented`: one set, 4–6 cues. `device`: one set incl. `alarm`.
  `scene`: 0–2 cues (ambience only, `tick`/`pop`).
- `tui`: **zero or exactly `terminal-bell`** (a tty world that never chimes is
  the default; a world whose fiction is a "bell-wired" terminal pulls the one
  cue). No desktop cues in a tty world — selftest-asserted alongside the icon
  rule.
- If a `bundled-wav` file is missing at runtime → `fallback: sounds.parametric`
  for that cue (never silence-as-error; never a fetch).

---

## 5. Palettes bank

### 5.1 Decision

Palettes are **never asset files**. Two representations only:

1. `band` — hue/saturation/lightness *ranges* + a topology hint. Exact colors
   are seeded at world gen (the existing `banks/palettes.js` HSL ramp is the
   mechanism — kept). A band steers the *bands*, the seed sets the values, so
   two "xp-luna" worlds are both blue-ish but never pixel-identical, and the
   same world is identical forever.
2. `reference-only` — an anchor in the real world (a named era look) used only
   as the numeric basis for a band's ranges. No image assets, no licensing
   question (color values are not copyrightable; we cite the anchor for
   provenance, not as a source of pixels).

Anchors are chosen **selectively**: a `tui` world pulls exactly one band from
the terminal anchors; a `gui` world pulls from the desktop anchors; concept
keywords ("frost", "foundry") shift hue *within* the chosen band, never across
families.

### 5.2 Anchor catalog (bands, all values in HSL)

```json
[
  {
    "id": "palettes.phosphor.green",
    "kind": "palette-band",
    "source": { "name": "reference-only: P1/P3 phosphor CRT terminals",
                "repo": null, "url": null, "license": "none (values, not assets)",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [140, 160], "sat": [60, 90], "light": [4, 8] },
      "fg":      { "hue": [120, 140], "sat": [80, 100], "light": [65, 80] },
      "accent":  { "hue": [95, 115],  "sat": [70, 95], "light": [55, 70] },
      "dim":     { "hue": [130, 150], "sat": [50, 70], "light": [35, 45] },
      "surface": { "hue": [140, 155], "sat": [40, 60], "light": [10, 16] }
    },
    "topologyHint": { "radius": 0, "glow": "text-shadow 0 0 6px fg", "scanlines": true },
    "paradigmAffinity": ["tui", "device"],
    "tags": ["crt", "terminal", "1-bit-feel"],
    "licenseNote": "none"
  },
  {
    "id": "palettes.phosphor.amber",
    "kind": "palette-band",
    "source": { "name": "reference-only: amber CRT (DEC VT400-class)",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [25, 35],  "sat": [80, 100], "light": [5, 9] },
      "fg":      { "hue": [35, 45],  "sat": [90, 100], "light": [60, 75] },
      "accent":  { "hue": [45, 55],  "sat": [85, 100], "light": [55, 70] },
      "dim":     { "hue": [30, 40],  "sat": [70, 90],  "light": [35, 45] },
      "surface": { "hue": [28, 38],  "sat": [60, 80],  "light": [10, 16] }
    },
    "topologyHint": { "radius": 0, "glow": "text-shadow 0 0 6px fg", "scanlines": true },
    "paradigmAffinity": ["tui", "device"],
    "tags": ["crt", "terminal"],
    "licenseNote": "none"
  },
  {
    "id": "palettes.luna.blues",
    "kind": "palette-band",
    "source": { "name": "reference-only: Windows XP Luna default (blue desktop)",
                "repo": null, "url": null, "license": "none (values, not assets)",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [210, 225], "sat": [55, 75], "light": [35, 55] },
      "fg":      { "hue": [220, 230], "sat": [10, 25], "light": [90, 97] },
      "accent":  { "hue": [205, 215], "sat": [70, 90], "light": [45, 60] },
      "dim":     { "hue": [215, 225], "sat": [35, 50], "light": [55, 65] },
      "surface": { "hue": [218, 228], "sat": [25, 40], "light": [88, 96] }
    },
    "topologyHint": { "radius": 3, "titlebarGradient": "accent→accent+20L", "bevel": "1px outset" },
    "paradigmAffinity": ["gui"],
    "tags": ["2000s", "xp", "desktop"],
    "licenseNote": "none — band only; paired with icons.xp.luna-pixel"
  },
  {
    "id": "palettes.aqua.aqua",
    "kind": "palette-band",
    "source": { "name": "reference-only: 2000s glossy aqua desktop",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [195, 215], "sat": [45, 65], "light": [60, 75] },
      "fg":      { "hue": [210, 225], "sat": [20, 40], "light": [10, 25] },
      "accent":  { "hue": [200, 215], "sat": [60, 85], "light": [50, 65] },
      "dim":     { "hue": [205, 220], "sat": [30, 45], "light": [45, 58] },
      "surface": { "hue": [200, 215], "sat": [30, 50], "light": [90, 97] }
    },
    "topologyHint": { "radius": 12, "glass": true, "titlebarGradient": "white65%→accent" },
    "paradigmAffinity": ["gui"],
    "tags": ["gloss", "2000s", "desktop"],
    "licenseNote": "none — band only; pairs with icons.aqua.glass"
  },
  {
    "id": "palettes.adwaita.cool",
    "kind": "palette-band",
    "source": { "name": "reference-only: modern GNOME/Adwaita-ish neutral",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [220, 240], "sat": [8, 18],  "light": [93, 97] },
      "fg":      { "hue": [220, 240], "sat": [8, 15],  "light": [12, 20] },
      "accent":  { "hue": [215, 235], "sat": [65, 85], "light": [45, 55] },
      "dim":     { "hue": [220, 235], "sat": [8, 15],  "light": [40, 52] },
      "surface": { "hue": [220, 240], "sat": [8, 15],  "light": [98, 100] }
    },
    "topologyHint": { "radius": 10, "flat": true, "softShadow": true },
    "paradigmAffinity": ["gui"],
    "tags": ["modern", "linux", "neutral", "practical"],
    "licenseNote": "none — band only; pairs with icons.adwaita.real"
  },
  {
    "id": "palettes.tango.blue",
    "kind": "palette-band",
    "source": { "name": "reference-only: freedesktop Tango standard colors",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [210, 225], "sat": [12, 25], "light": [85, 92] },
      "fg":      { "hue": [220, 235], "sat": [20, 35], "light": [15, 25] },
      "accent":  { "hue": [205, 220], "sat": [60, 80], "light": [45, 58] },
      "dim":     { "hue": [215, 230], "sat": [15, 30], "light": [50, 62] },
      "surface": { "hue": [210, 225], "sat": [10, 20], "light": [95, 99] }
    },
    "topologyHint": { "radius": 4, "softBevel": true },
    "paradigmAffinity": ["gui"],
    "tags": ["2000s", "freedesktop", "linux"],
    "licenseNote": "none"
  },
  {
    "id": "palettes.ember.industrial",
    "kind": "palette-band",
    "source": { "name": "reference-only: instrument console / foundry",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [25, 40],  "sat": [15, 30], "light": [8, 14] },
      "fg":      { "hue": [30, 45],  "sat": [80, 100], "light": [65, 78] },
      "accent":  { "hue": [18, 30],  "sat": [85, 100], "light": [55, 68] },
      "dim":     { "hue": [28, 40],  "sat": [30, 45], "light": [30, 40] },
      "surface": { "hue": [26, 38],  "sat": [18, 30], "light": [13, 19] }
    },
    "topologyHint": { "radius": 2, "bezel": "3px", "readoutGlow": true },
    "paradigmAffinity": ["device"],
    "tags": ["industrial", "warm", "console"],
    "licenseNote": "none"
  },
  {
    "id": "palettes.paper.aged",
    "kind": "palette-band",
    "source": { "name": "reference-only: aged paper / scriptorium",
                "repo": null, "url": null, "license": "none",
                "verified": "2026-10-08", "obtained": "reference-only" },
    "representation": "band",
    "bundlePath": null,
    "fallback": null,
    "bands": {
      "bg":      { "hue": [38, 50],  "sat": [25, 45], "light": [84, 92] },
      "fg":      { "hue": [25, 35],  "sat": [30, 50], "light": [12, 22] },
      "accent":  { "hue": [350, 360], "sat": [45, 65], "light": [40, 52] },
      "dim":     { "hue": [35, 48],  "sat": [25, 40], "light": [45, 58] },
      "surface": { "hue": [40, 52],  "sat": [20, 35], "light": [93, 98] }
    },
    "topologyHint": { "radius": 0, "paperTexture": "subtle noise 3%", "serifPreferred": true },
    "paradigmAffinity": ["scene"],
    "tags": ["paper", "aged", "warm", "diegetic"],
    "licenseNote": "none"
  }
]
```

Plus the existing **concept-steered free ramp** (`palettes.seeded.free`) as the
catch-all band when the concept matches no anchor (the current
`generatePalette` random-fallback path): all hue/sat/light ranges open, seeded
exactly. That is the entry that makes "something never seen before" possible.

### 5.3 Pull contract for palettes

- `bankPulls.palette` = exactly one id.
- Anchor choice = paradigm affinity ∩ concept keywords (same keyword tables as
  today's `palettes.js`, promoted to band *selection* instead of hue guessing).
- Within the band, the seed sets exact values → same world = same colors,
  forever; different worlds = different values, guaranteed by band width.
- `world.palette` (the old fixed 5-array in the spec) is *derived*: the
  instantiator computes the 5 tokens from (band, seed) and stores them in the
  design spec, so `/api/world` consumers keep working while the *source of
  truth* is band+seed, not a frozen array.

---

## 6. Selective pull — the full matrix

| bank \ paradigm | `tui` | `gui` | `device` | `scene` | `invented` |
|---|---|---|---|---|---|
| **icons** | `null` (hard) | 1 style, full subjects | sparse ≤4 face-glyphs | `sketch` or `null` | 1 style |
| **fonts** | 1 mono | sans + mono | condensed/mono + mono | serif + mono | 1–2 by concept |
| **sounds** | `[]` or `terminal-bell` only | 4–6 cues | cues + `alarm` | 0–2 ambient | by concept |
| **palette** | phosphor/amber (or 1 concept band) | desktop anchors | industrial/warm | paper/atmosphere | free ramp |

`invented` paradigms may mix (e.g. `aqua.glass` icons + `phosphor.green`
palette — a "glossy CRT" that has never existed); the LLM's only job is picking
ids that pass the affinity check, the seeded values do the rest.

**Selftest assertions to add** (contract for the test designer):
1. every id in every design spec exists in the catalog;
2. `tui` ⇒ `bankPulls.icons === null` and `sounds` ⊆ `{terminal-bell}`;
3. same (seed, concept) ⇒ byte-identical design spec (including every pulled id);
4. each `bundled-*` entry's `bundlePath` files exist on disk at boot;
5. every font `stack` ends in a T0-guaranteed fallback;
6. each pulled sound cue resolves to a file *or* a recipe (never both, never
   neither).

---

## 7. Verification log (what was actually checked, 2026-10-08)

| source | checked via | result |
|---|---|---|
| PapirusDevelopmentTeam/papirus-icon-theme | GitHub API | live, GPL-3.0, ~8.1k★ |
| KDE/breeze-icons | GitHub API | live, **LGPL-2.1**, SVG theme |
| Distrotech/tango-icon-theme | GitHub API + COPYING | live; COPYING: public domain; canonical freedesktop site dead (400); `tango/IconLibrary` empty |
| softwarehistorysociety/XPIcons | GitHub API + LICENSE + tree | live, **Unlicense**, 559 PNGs (XP/Longhorn/Whistler) |
| B00merang-Artwork/LinXP | GitHub API | live but **no license** → excluded from catalog |
| papirus-sounds | GitHub search | **not found on GitHub** → excluded, marked unverified |
| xdg/xdg-sound-theme (gitlab.freedesktop.org) | GitLab API + README + CREDITS | live; inclusion rules; CC-BY-SA entries |
| acidburn0zzz/sounds | GitHub API + README + tree | live, **CC-BY-4.0**, 18 FLAC cues (redox rustic theme) |
| IBM/plex | GitHub API | live, **OFL-1.1** |
| JetBrains/JetBrainsMono | GitHub API | live, **OFL-1.1** |
| lucide-icons/lucide | GitHub API + LICENSE file | live, **ISC** (repo's MIT description is stale — file says ISC) |
| feathericons/feather | GitHub API | live, **MIT** (old `phistrom/feather` org dead) |
| tabler/tabler-icons | GitHub API | live, **MIT** |
| elementary/icons | GitHub API | live, GPL-3.0 → grammar reference only |
| numixproject/numix-icon-theme | GitHub API | live, GPL-3.0 → grammar reference only |
| gnome-icons/gnome-icon-theme | GitHub API | **404** (repo moved to GNOME infra; image's `adwaita-icon-theme` apk is the ground truth instead — verified present in `build.sh` package list) |
| Silkscreen (dharmatype/silkscreen) | GitHub API | **404** → T2 "verify at build time" |
| macOS Aqua open icon set | multiple GitHub searches | **none clean found** → procedural-only |

## 8. What this doc deliberately does NOT do

- No pixel values from the LLM (spec §11 contract — ids only).
- No runtime fetch of any kind, even "one small icon".
- No full-theme bundles (no 3 MB icon themes into the image).
- No GPL *asset* copies inside `app/assets/` (GPL themes stay grammar-references
  or Alpine packages); OFL/CC-BY/CC-BY-SA/Unlicense items are the only bundled
  third-party files, each with its license text kept on disk.
- No audio beyond ~1 s per event cue (XDG house rule, adopted).
