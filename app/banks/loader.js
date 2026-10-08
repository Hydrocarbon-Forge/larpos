// app/banks/loader.js — Asset Bank Catalog & Loader for LarpOS
// Conforms to design/banks.md universal entry schema with deterministic fallback.
// Zero network at runtime. Pure JS zero npm dependencies.

const fonts = require('./fonts');
const icons = require('./icons');
const palettes = require('./palettes');
const sounds = require('./sounds');

/**
 * Universal Entry Schema:
 * {
 *   id: string,               // "<bank>.<family>.<variant>"
 *   kind: string,             // "icon-style" | "font" | "sound-set" | "palette-band"
 *   source: object,           // { name, repo, url, license, verified, obtained }
 *   representation: string,   // "grammar" | "grammar-blend" | "bundled-png" | "image-package" | "stack-only" | "parametric" | "band"
 *   bundlePath: string|null,
 *   fallback: string,         // deterministic fallback id
 *   subjects: string[],       // core subjects it can draw (for icon-style)
 *   cues: string[],           // cues it provides (for sound-set)
 *   params: object,
 *   paradigmAffinity: string[],
 *   tags: string[],
 *   licenseNote: string
 * }
 */

const CORE_ICON_SUBJECTS = [
  'folder', 'folder-open', 'file', 'terminal', 'trash', 'system',
  'gauge', 'settings', 'clock', 'window', 'editor', 'device',
  'bell', 'network', 'drive', 'browser', 'mail', 'help', 'warning',
  'battery', 'app'
];

const CATALOG = [
  // --- ICONS BANK (design/banks.md §2) ---
  {
    id: 'icons.grammar.flat-line',
    kind: 'icon-style',
    source: {
      name: 'procedural-flat-line',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, strokeWidth: 1.5, linecap: 'round', linejoin: 'round',
      fill: 'none', colorRole: 'accent'
    },
    paradigmAffinity: ['gui', 'invented'],
    tags: ['outline', 'modern', 'clean', 'flat-line'],
    licenseNote: 'Procedural zero-dependency grammar'
  },
  {
    id: 'icons.lucide.outline',
    kind: 'icon-style',
    source: {
      name: 'lucide',
      repo: 'lucide-icons/lucide',
      url: 'https://github.com/lucide-icons/lucide',
      license: 'ISC',
      verified: '2026-10-08',
      obtained: 'grammar-blend'
    },
    representation: 'grammar-blend',
    bundlePath: 'assets/icons/lucide/',
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, strokeWidth: 2, linecap: 'round', linejoin: 'round',
      fill: 'none', colorRole: 'accent'
    },
    paradigmAffinity: ['gui', 'invented'],
    tags: ['outline', 'modern', 'lucide'],
    licenseNote: 'ISC'
  },
  {
    id: 'icons.xp.luna-pixel',
    kind: 'icon-style',
    source: {
      name: 'XPIcons',
      repo: 'softwarehistorysociety/XPIcons',
      url: 'https://github.com/softwarehistorysociety/XPIcons',
      license: 'Unlicense',
      verified: '2026-10-08',
      obtained: 'bundled-png'
    },
    representation: 'bundled-png',
    bundlePath: 'assets/icons/xp-luna/',
    fallback: 'icons.grammar.duotone',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      sizes: [16, 32], colorRole: 'none', pixelGrid: 16, crispEdges: true
    },
    paradigmAffinity: ['gui', 'invented'],
    tags: ['pixel', 'retro', '2000s', 'xp', 'luna'],
    licenseNote: 'Unlicense (public domain)'
  },
  {
    id: 'icons.grammar.duotone',
    kind: 'icon-style',
    source: {
      name: 'procedural-duotone',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, strokeWidth: 1.5, fillOpacity: 0.22, colorRole: 'accent'
    },
    paradigmAffinity: ['gui', 'invented'],
    tags: ['duotone', 'flat', 'papirus-like'],
    licenseNote: 'Procedural zero-dependency grammar'
  },
  {
    id: 'icons.grammar.glyph',
    kind: 'icon-style',
    source: {
      name: 'procedural-glyph',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, solid: true, colorRole: 'text'
    },
    paradigmAffinity: ['device', 'gui'],
    tags: ['glyph', 'solid', 'crt'],
    licenseNote: 'Procedural zero-dependency grammar'
  },
  {
    id: 'icons.grammar.pictogram',
    kind: 'icon-style',
    source: {
      name: 'procedural-pictogram',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, strokeWidth: 1.8, badge: true
    },
    paradigmAffinity: ['gui', 'device'],
    tags: ['pictogram', 'chunky'],
    licenseNote: 'Procedural zero-dependency grammar'
  },
  {
    id: 'icons.grammar.hand-drawn',
    kind: 'icon-style',
    source: {
      name: 'procedural-hand-drawn',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: {
      grid: 24, strokeWidth: 1.5, jitter: 1.2
    },
    paradigmAffinity: ['scene'],
    tags: ['sketch', 'ink', 'hand-drawn'],
    licenseNote: 'Procedural zero-dependency grammar'
  },
  {
    id: 'icons.adwaita.real',
    kind: 'icon-style',
    source: {
      name: 'adwaita-icon-theme',
      repo: 'apk:adwaita-icon-theme',
      url: 'https://pkgs.alpinelinux.org/package/edge/x86_64/community/adwaita-icon-theme',
      license: 'GPL-2.0-or-later',
      verified: '2026-10-08',
      obtained: 'image-package'
    },
    representation: 'image-package',
    bundlePath: '/usr/share/icons/Adwaita',
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: { size: 24 },
    paradigmAffinity: ['gui'],
    tags: ['linux', 'gnome', 'desktop'],
    licenseNote: 'Package-provided on image'
  },
  {
    id: 'icons.aqua.glass',
    kind: 'icon-style',
    source: {
      name: 'procedural-aqua',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'grammar'
    },
    representation: 'grammar',
    bundlePath: null,
    fallback: 'icons.grammar.flat-line',
    subjects: CORE_ICON_SUBJECTS,
    params: { cornerR: 5, gloss: true },
    paradigmAffinity: ['gui'],
    tags: ['gloss', 'glass', 'macos-like'],
    licenseNote: 'Procedural grammar'
  },

  // --- FONTS BANK (design/banks.md §3) ---
  {
    id: 'fonts.sans',
    kind: 'font',
    source: {
      name: 'system-sans',
      repo: null,
      url: null,
      license: 'OFL/System',
      verified: '2026-10-08',
      obtained: 'stack-only'
    },
    representation: 'stack-only',
    bundlePath: null,
    fallback: 'fonts.sans',
    params: {
      stack: 'ui-sans-serif, system-ui, "DejaVu Sans", sans-serif',
      category: 'sans'
    },
    paradigmAffinity: ['gui', 'invented'],
    tags: ['clean', 'neutral', 'workstation'],
    licenseNote: 'DejaVu / System fallback stack'
  },
  {
    id: 'fonts.mono',
    kind: 'font',
    source: {
      name: 'dejavu-mono',
      repo: 'apk:font-dejavu',
      url: 'https://dejavu-fonts.github.io/',
      license: 'Bitstream Vera / Public Domain',
      verified: '2026-10-08',
      obtained: 'image-package'
    },
    representation: 'image-package',
    bundlePath: null,
    fallback: 'fonts.mono',
    params: {
      stack: 'ui-monospace, "DejaVu Sans Mono", "Courier New", monospace',
      category: 'mono'
    },
    paradigmAffinity: ['tui', 'gui', 'device'],
    tags: ['monospace', 'terminal', 'code'],
    licenseNote: 'DejaVu Sans Mono guaranteed via font-dejavu package'
  },
  {
    id: 'fonts.serif',
    kind: 'font',
    source: {
      name: 'dejavu-serif',
      repo: 'apk:font-dejavu',
      url: 'https://dejavu-fonts.github.io/',
      license: 'Bitstream Vera / Public Domain',
      verified: '2026-10-08',
      obtained: 'image-package'
    },
    representation: 'image-package',
    bundlePath: null,
    fallback: 'fonts.serif',
    params: {
      stack: '"DejaVu Serif", Georgia, serif',
      category: 'serif'
    },
    paradigmAffinity: ['scene', 'invented'],
    tags: ['classic', 'book', 'liturgical'],
    licenseNote: 'DejaVu Serif'
  },
  {
    id: 'fonts.display',
    kind: 'font',
    source: {
      name: 'display-heavy',
      repo: null,
      url: null,
      license: 'System',
      verified: '2026-10-08',
      obtained: 'stack-only'
    },
    representation: 'stack-only',
    fallback: 'fonts.mono',
    params: {
      stack: 'Impact, "DejaVu Sans Mono", sans-serif',
      category: 'display'
    },
    paradigmAffinity: ['device'],
    tags: ['heavy', 'industrial', 'bezel'],
    licenseNote: 'System font stack'
  },

  // --- SOUNDS BANK (design/banks.md §4) ---
  {
    id: 'sounds.default',
    kind: 'sound-set',
    source: {
      name: 'larpos-synth',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'parametric'
    },
    representation: 'parametric',
    bundlePath: null,
    fallback: 'sounds.default',
    cues: ['boot', 'click', 'open', 'close', 'error', 'alarm', 'tick', 'blip'],
    params: { sampleRate: 11025, bitDepth: 8 },
    paradigmAffinity: ['gui', 'device', 'scene'],
    tags: ['parametric', 'synthesized', 'audio'],
    licenseNote: 'In-memory procedural synthesis'
  },
  {
    id: 'sounds.tui',
    kind: 'sound-set',
    source: {
      name: 'silent-tui',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'parametric'
    },
    representation: 'parametric',
    bundlePath: null,
    fallback: 'sounds.tui',
    cues: [],
    params: {},
    paradigmAffinity: ['tui'],
    tags: ['silent', 'tui'],
    licenseNote: 'Silence'
  },

  // --- PALETTES BANK (design/banks.md §5) ---
  {
    id: 'palettes.ramp',
    kind: 'palette-band',
    source: {
      name: 'hsl-ramp',
      repo: null,
      url: null,
      license: 'MIT',
      verified: '2026-10-08',
      obtained: 'parametric'
    },
    representation: 'band',
    bundlePath: null,
    fallback: 'palettes.ramp',
    params: { stops: 5 },
    paradigmAffinity: ['gui', 'tui', 'device', 'scene', 'invented'],
    tags: ['hsl', 'procedural', 'adaptive'],
    licenseNote: 'Procedural seeded ramp'
  }
];

const CATALOG_INDEX = new Map();
for (const entry of CATALOG) {
  CATALOG_INDEX.set(entry.id, entry);
}

/**
 * Resolves a bank entry by ID. If not found, falls back deterministically without throwing.
 */
function getBankEntry(id) {
  if (!id) return CATALOG_INDEX.get('icons.grammar.flat-line');
  if (CATALOG_INDEX.has(id)) {
    return CATALOG_INDEX.get(id);
  }

  // Normalization for short names (e.g. "flat-line" -> "icons.grammar.flat-line", "sans" -> "fonts.sans")
  if (id === 'flat-line') return CATALOG_INDEX.get('icons.grammar.flat-line');
  if (id === 'duotone') return CATALOG_INDEX.get('icons.grammar.duotone');
  if (id === 'glyph') return CATALOG_INDEX.get('icons.grammar.glyph');
  if (id === 'pictogram') return CATALOG_INDEX.get('icons.grammar.pictogram');
  if (id === 'hand-drawn') return CATALOG_INDEX.get('icons.grammar.hand-drawn');
  if (id === 'sans' || id === 'sans_clean') return CATALOG_INDEX.get('fonts.sans');
  if (id === 'mono' || id === 'mono_code' || id === 'mono_dense') return CATALOG_INDEX.get('fonts.mono');
  if (id === 'serif' || id === 'serif_classic') return CATALOG_INDEX.get('fonts.serif');
  if (id === 'display' || id === 'display_heavy') return CATALOG_INDEX.get('fonts.display');

  // Generic prefix matching
  if (id.startsWith('icons.')) return CATALOG_INDEX.get('icons.grammar.flat-line');
  if (id.startsWith('fonts.')) return CATALOG_INDEX.get('fonts.mono');
  if (id.startsWith('sounds.')) return CATALOG_INDEX.get('sounds.default');
  if (id.startsWith('palettes.')) return CATALOG_INDEX.get('palettes.ramp');

  return CATALOG_INDEX.get('icons.grammar.flat-line');
}

/**
 * Resolves an icon to SVG string using the bank's grammar.
 */
function resolveIcon(styleId, subject, seed, palette) {
  const entry = getBankEntry(styleId || 'icons.grammar.flat-line');
  const grammar = (entry.tags && entry.tags.find(t => ['flat-line', 'duotone', 'glyph', 'pictogram', 'hand-drawn'].includes(t))) || 'flat-line';
  return icons.drawIcon(grammar, subject, seed, palette);
}

/**
 * Resolves a font slot/id to a CSS font stack string.
 */
function resolveFont(fontId) {
  const entry = getBankEntry(fontId || 'fonts.mono');
  return entry.params && entry.params.stack ? entry.params.stack : fonts.FONT_STACKS.mono_code;
}

/**
 * Resolves a sound cue to a base64 WAV data URI.
 */
function resolveSound(cue, seed) {
  return sounds.generateSoundCue(cue, seed);
}

/**
 * Resolves palette bands and tokens.
 */
function resolvePalette(bandId, seed, concept) {
  return palettes.generatePalette(seed, concept);
}

module.exports = {
  CATALOG,
  CORE_ICON_SUBJECTS,
  getBankEntry,
  resolveIcon,
  resolveFont,
  resolveSound,
  resolvePalette
};
