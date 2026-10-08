// app/blocks/index.js — Building-Block Contract & Registry for LarpOS
// Conforms to design/blocks.md. Pure JS zero npm dependencies.

const { PRNG, fnv1a } = require('../prng');

const BLOCK_TYPES = [
  'window',
  'taskbar',
  'menu-bar',
  'button',
  'gauge',
  'terminal',
  'icon',
  'card',
  'wallpaper',
  'clock',
  'dock'
];

const VALID_ZONES = [
  'wallpaper',
  'top',
  'bottom',
  'left-rail',
  'right-rail',
  'desktop',
  'stack',
  'full',
  'inline'
];

const VALID_SIZES = ['s', 'm', 'l', 'xl', 'full'];
const VALID_FONTS = ['sans', 'mono', 'serif', 'display'];

const PALETTE_SLOTS = [
  'bg', 'surface', 'surface-2', 'accent', 'accent-2',
  'text', 'text-dim', 'border', 'ok', 'warn', 'danger',
  'glow', 'transparent'
];

// Default envelope parameters per block type (design/blocks.md §8)
const BLOCK_DEFAULTS = {
  window: {
    zone: 'stack',
    size: 'm',
    font: 'sans',
    palette: { fill: 'surface', titlebar: 'surface-2', border: 'border', label: 'text' },
    hooks: { drag: true, close: 'close-app', focus: 'focus-app' },
    variant: 'standard',
    state: 'normal'
  },
  taskbar: {
    zone: 'bottom',
    size: 'm',
    font: 'sans',
    side: 'bottom',
    palette: { fill: 'surface-2', hover: 'surface', label: 'text', accent: 'accent' },
    slots: ['apps', 'clock'],
    showOpenApps: true
  },
  'menu-bar': {
    zone: 'top',
    size: 's',
    font: 'sans',
    side: 'top',
    align: 'left',
    palette: { fill: 'surface', label: 'text', hover: 'surface-2', accent: 'accent' }
  },
  button: {
    zone: 'inline',
    size: 'm',
    font: 'sans',
    variant: 'raised',
    palette: { fill: 'surface', label: 'text', hover: 'surface-2', accent: 'accent' },
    sound: 'click'
  },
  gauge: {
    zone: 'inline',
    size: 'm',
    font: 'mono',
    kind: 'dial',
    orient: 'up',
    ticks: 'few',
    colorMap: 'accent',
    value: 0.5,
    palette: { face: 'surface', needle: 'accent', tick: 'text-dim', label: 'text', ok: 'ok', warn: 'warn', danger: 'danger' }
  },
  terminal: {
    zone: 'stack',
    size: 'm',
    font: 'mono',
    variant: 'windowed',
    prompt: '❯',
    seedLines: 6,
    palette: { bg: 'bg', text: 'text', prompt: 'accent', cursor: 'accent' }
  },
  icon: {
    zone: 'desktop',
    size: 'm',
    font: 'sans',
    subject: 'app',
    badge: 'none',
    palette: { fg: 'text', bg: 'transparent', accent: 'accent' }
  },
  card: {
    zone: 'desktop',
    size: 'm',
    font: 'sans',
    variant: 'panel',
    accentEdge: 'none',
    palette: { fill: 'surface', label: 'text', border: 'border', accent: 'accent' }
  },
  wallpaper: {
    zone: 'wallpaper',
    size: 'full',
    font: 'sans',
    style: 'gradient',
    from: 'bg',
    to: 'surface',
    accentLayer: 'none',
    opacity: 'full',
    palette: { base: 'bg' }
  },
  clock: {
    zone: 'inline',
    size: 's',
    font: 'mono',
    format: 'hhmm',
    palette: { text: 'text', accent: 'accent' }
  },
  dock: {
    zone: 'left-rail',
    size: 'm',
    font: 'sans',
    side: 'left',
    separator: 'none',
    magnify: 'subtle',
    palette: { fill: 'surface-2', accent: 'accent' }
  }
};

/**
 * Parses and validates action ref string against closed action grammar (design/blocks.md §4.5)
 * Format: "action" or "action:target" or "action:target=value"
 * Actions: open-app, focus-app, close-app, toggle, run, set, sound, noop
 */
function parseActionRef(refStr) {
  if (refStr === true) return { action: 'default', target: null, param: null, valid: true };
  if (typeof refStr !== 'string' || !refStr.trim()) return { action: 'noop', target: null, param: null, valid: false };

  const trimmed = refStr.trim();
  const parts = trimmed.split(':');
  const action = parts[0].toLowerCase();

  const VALID_ACTIONS = ['open-app', 'focus-app', 'close-app', 'toggle', 'run', 'set', 'sound', 'noop'];
  if (!VALID_ACTIONS.includes(action)) {
    return { action: 'noop', target: null, param: null, valid: false };
  }

  let target = parts.slice(1).join(':') || null;
  let param = null;
  if (target && target.includes('=')) {
    const eqIdx = target.indexOf('=');
    param = target.slice(eqIdx + 1);
    target = target.slice(0, eqIdx);
  }

  return { action, target, param, valid: true, raw: trimmed };
}

/**
 * Reader-not-validator normalization for block specs (design/blocks.md §10)
 * Malformed or unparseable specs degrade to nearest valid enum or damaged block shell. Never throws.
 */
function normalizeBlock(spec, defaultId = 'block-0') {
  if (!spec || typeof spec !== 'object') {
    return {
      id: String(defaultId),
      block: 'card',
      zone: 'desktop',
      order: 0,
      parent: null,
      visible: true,
      size: 'm',
      font: 'mono',
      palette: { fill: 'surface', label: 'text', border: 'danger' },
      hooks: {},
      damaged: true,
      title: 'SECTION UNREADABLE',
      body: 'Section unreadable; block envelope could not be materialized.'
    };
  }

  const id = typeof spec.id === 'string' && spec.id.trim() ? spec.id.trim() : defaultId;
  const blockType = BLOCK_TYPES.includes(spec.block) ? spec.block : 'card';
  const defaults = BLOCK_DEFAULTS[blockType] || BLOCK_DEFAULTS.card;

  const zone = VALID_ZONES.includes(spec.zone) ? spec.zone : defaults.zone;
  const order = typeof spec.order === 'number' && Number.isFinite(spec.order) ? Math.max(0, Math.min(99, Math.floor(spec.order))) : 0;
  const parent = typeof spec.parent === 'string' ? spec.parent : null;
  const visible = spec.visible !== false;
  const size = VALID_SIZES.includes(spec.size) ? spec.size : defaults.size;
  const font = VALID_FONTS.includes(spec.font) ? spec.font : defaults.font;

  // Palette role map normalization
  const palette = Object.assign({}, defaults.palette);
  if (spec.palette && typeof spec.palette === 'object') {
    for (const [role, slot] of Object.entries(spec.palette)) {
      if (typeof slot === 'string' && PALETTE_SLOTS.includes(slot)) {
        palette[role] = slot;
      }
    }
  }

  // Hooks normalization
  const hooks = {};
  if (spec.hooks && typeof spec.hooks === 'object') {
    for (const [hookName, actionRef] of Object.entries(spec.hooks)) {
      const parsed = parseActionRef(actionRef);
      if (parsed.valid) {
        hooks[hookName] = parsed.raw || actionRef;
      }
    }
  }

  const envelope = {
    id,
    block: blockType,
    zone,
    order,
    parent,
    visible,
    size,
    font,
    palette,
    hooks
  };

  // Merge block type specific fields with defaults
  return Object.assign({}, defaults, spec, envelope);
}

/**
 * Micro-geometry generator (design/blocks.md §5)
 * Fixed seeded draw order: [position jitter, size jitter, radius, shadow, micro-glyph choices, decorative seed]
 */
function resolveMicroGeometry(blockId, worldSeed) {
  const hash = fnv1a(String(worldSeed || 1) + ':' + String(blockId || 'b'));
  const rng = new PRNG(hash);

  return {
    posJitter: (rng.next() - 0.5) * 0.1, // ±5% jitter
    sizeJitter: (rng.next() - 0.5) * 0.08,
    radiusOffset: rng.int(0, 2),
    shadowIntensity: rng.next() * 0.4 + 0.1,
    glyphChoice: rng.int(0, 7),
    decorativeSeed: rng.hexSeed
  };
}

module.exports = {
  BLOCK_TYPES,
  VALID_ZONES,
  VALID_SIZES,
  VALID_FONTS,
  PALETTE_SLOTS,
  BLOCK_DEFAULTS,
  parseActionRef,
  normalizeBlock,
  resolveMicroGeometry
};
