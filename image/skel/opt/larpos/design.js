// app/design.js — Seeded design spec generator & composition engine for LarpOS
// Conforms to design/composition.md, design/blocks.md, design/layouts.md, design/banks.md.
// Pure JS zero npm dependencies. Deterministic per (seed, concept).

const { PRNG, fnv1a } = require('./prng');
const fonts = require('./banks/fonts');
const icons = require('./banks/icons');
const sounds = require('./banks/sounds');
const palettes = require('./banks/palettes');
const { normalizeBlock, BLOCK_TYPES } = require('./blocks');

const LAYOUT_IDS = [
  'windows-xp', 'windows-10', 'windows-11', 'classic-macos', 'modern-macos',
  'kde-plasma', 'gnome', 'generic-flat-linux', 'tty-terminal', 'instrument-console',
  'game-hud', 'radial-orbital', 'vertical-ledger', 'card-deck', 'diegetic-room'
];

/**
 * Concept-keyword to layout map (design/layouts.md §4)
 */
function conceptLayout(conceptInput) {
  const concept = String(conceptInput || '').toLowerCase();

  if (/\b(windows xp|xp|luna|bloody shoe|2001 desktop|start button)\b/i.test(concept)) {
    return 'windows-xp';
  }
  if (/\b(windows 10|win10|flat windows|pinned taskbar|action center)\b/i.test(concept)) {
    return 'windows-10';
  }
  if (/\b(windows 11|win11|centered taskbar|mica|acrylic|fluent)\b/i.test(concept)) {
    return 'windows-11';
  }
  if (/\b(mac os x|os x|aqua|glass dock|glossy mac|tigger lights)\b/i.test(concept)) {
    return 'classic-macos';
  }
  if (/\b(macos|macbook|big sur|sonoma|traffic lights|squircle)\b/i.test(concept)) {
    return 'modern-macos';
  }
  if (/\b(kde|plasma|kubuntu|breeze|plasmoids|linux panel)\b/i.test(concept)) {
    return 'kde-plasma';
  }
  if (/\b(gnome|ubuntu|activities|adwaita|centered clock)\b/i.test(concept)) {
    return 'gnome';
  }
  if (/\b(practical|lightweight|no-frills|normal|plain|utility|workstation|daily driver|desktop)\b/i.test(concept)) {
    return 'generic-flat-linux';
  }
  if (/\b(tty|tty1|terminal only|text|console|bash|ncurses|monospace|no gui)\b/i.test(concept)) {
    return 'tty-terminal';
  }
  if (/\b(instrument|machine|cockpit|gauges|dials|levers|industrial|control panel)\b/i.test(concept)) {
    return 'instrument-console';
  }
  if (/\b(game|hud|crosshair|rpg|first person|health bar|dashboard)\b/i.test(concept)) {
    return 'game-hud';
  }
  if (/\b(radial|dial menu|orbital|spinning|combination dial|clock face)\b/i.test(concept)) {
    return 'radial-orbital';
  }
  if (/\b(ledger|dense|newsroom|spine|two-column|monastery)\b/i.test(concept)) {
    return 'vertical-ledger';
  }
  if (/\b(cards|deck|swipe|flip|slides|one at a time)\b/i.test(concept)) {
    return 'card-deck';
  }
  if (/\b(room|scene|diegetic|spatial|just a room|kitchen|lighthouse|cathedral)\b/i.test(concept)) {
    return 'diegetic-room';
  }

  return 'generic-flat-linux';
}

/**
 * Clamps layout to ensure paradigm consistency (design/layouts.md §5.2)
 */
function clampLayoutToParadigm(layout, paradigm) {
  if (paradigm === 'tui') return 'tty-terminal';
  if (paradigm === 'device') return 'instrument-console';
  if (paradigm === 'scene') return 'diegetic-room';

  // GUI paradigm defaults to desktop layouts
  const guiLayouts = [
    'windows-xp', 'windows-10', 'windows-11', 'classic-macos',
    'modern-macos', 'kde-plasma', 'gnome', 'generic-flat-linux'
  ];
  if (guiLayouts.includes(layout)) return layout;
  return 'generic-flat-linux';
}

/**
 * Generates compact seeded design skeleton (design/composition.md §4)
 * Deterministic PRNG draw order: paradigm -> layout -> aesthetic -> banks -> topology -> blocks
 */
function seededSkeleton(seedVal, conceptInput = '', world = null) {
  const prng = new PRNG(seedVal);
  const concept = String(conceptInput || '');

  // 1. paradigm
  let paradigm = 'gui';
  if (world && world.interface) {
    paradigm = world.interface;
  } else if (/\b(terminal|cli|shell|prompt|tui|ncurses|bash)\b/i.test(concept)) {
    paradigm = 'tui';
  } else if (/\b(cockpit|dials|gauges|console|device|hardware|meter)\b/i.test(concept)) {
    paradigm = 'device';
  } else if (/\b(room|cathedral|chamber|monastery|forest|scene)\b/i.test(concept)) {
    paradigm = 'scene';
  }

  // 2. layout
  const rawLayout = conceptLayout(concept);
  const layout = clampLayoutToParadigm(rawLayout, paradigm);

  // 3. aesthetic enums
  let radius = 'sharp';
  let density = 'normal';
  let motion = 'subtle';
  let accentBand = 'cool';

  if (layout === 'windows-xp') {
    radius = 'low';
    density = 'normal';
    motion = 'subtle';
    accentBand = 'vivid';
  } else if (layout === 'windows-11' || layout === 'modern-macos') {
    radius = 'high';
    density = 'normal';
    motion = 'lively';
    accentBand = 'cool';
  } else if (layout === 'tty-terminal') {
    radius = 'sharp';
    density = 'tight';
    motion = 'none';
    accentBand = 'warm';
  } else if (layout === 'instrument-console') {
    radius = 'low';
    density = 'tight';
    motion = 'subtle';
    accentBand = 'warm';
  } else if (layout === 'generic-flat-linux') {
    radius = 'sharp';
    density = 'tight';
    motion = 'subtle';
    accentBand = 'cold';
  }

  const aesthetic = { radius, density, motion, accentBand };

  // 4. banks (selective pulls per paradigm)
  let iconGram = null;
  let fontPulls = ['sans', 'mono'];
  let soundPulls = [];

  if (paradigm === 'tui') {
    iconGram = null;
    soundPulls = [];
    fontPulls = ['mono'];
  } else if (paradigm === 'gui') {
    iconGram = prng.choice(['flat-line', 'duotone', 'pictogram']);
    soundPulls = ['boot', 'click', 'open', 'error'];
    fontPulls = ['sans', 'mono'];
  } else if (paradigm === 'device') {
    iconGram = 'glyph';
    soundPulls = ['boot', 'click', 'open', 'alarm'];
    fontPulls = ['display', 'mono'];
  } else if (paradigm === 'scene') {
    iconGram = 'hand-drawn';
    soundPulls = ['boot', 'click', 'open'];
    fontPulls = ['serif', 'mono'];
  } else {
    iconGram = 'flat-line';
    soundPulls = ['boot', 'click', 'open'];
    fontPulls = ['sans', 'mono'];
  }

  const banks = {
    fonts: fontPulls,
    iconGram,
    sounds: soundPulls
  };

  // 5. topology
  let bar = 'bottom';
  let menu = 'none';
  let rail = 'none';
  let wallpaper = true;

  if (paradigm === 'tui') {
    bar = 'bottom';
    menu = 'none';
    rail = 'none';
    wallpaper = false;
  } else if (paradigm === 'device') {
    bar = 'top';
    menu = 'top';
    rail = 'left';
    wallpaper = true;
  } else if (paradigm === 'scene') {
    bar = 'none';
    menu = 'none';
    rail = 'none';
    wallpaper = true;
  } else if (layout === 'classic-macos' || layout === 'modern-macos') {
    bar = 'none';
    menu = 'top';
    rail = 'none';
    wallpaper = true;
  }

  const topology = { bar, menu, rail, wallpaper };

  // 6. blocks
  const blocks = [];

  // Wallpaper block
  if (wallpaper) {
    blocks.push(normalizeBlock({
      id: 'wallpaper',
      block: 'wallpaper',
      zone: 'wallpaper',
      order: 0,
      style: paradigm === 'scene' ? 'procedural' : (paradigm === 'device' ? 'grid' : 'gradient'),
      from: 'bg',
      to: 'surface',
      accentLayer: paradigm === 'scene' ? 'horizon' : 'none',
      opacity: 'full'
    }));
  }

  // Shell / Terminal block
  blocks.push(normalizeBlock({
    id: 'term',
    block: 'terminal',
    zone: paradigm === 'tui' ? 'full' : 'stack',
    order: 0,
    size: paradigm === 'tui' ? 'full' : 'm',
    variant: paradigm === 'tui' ? 'full' : 'windowed',
    title: 'Shell',
    prompt: paradigm === 'tui' ? '#' : '❯',
    seedLines: 6,
    font: 'mono'
  }));

  // Window frame for shell in GUI
  if (paradigm === 'gui') {
    blocks.push(normalizeBlock({
      id: 'w-term',
      block: 'window',
      zone: 'stack',
      order: 0,
      size: 'm',
      appRef: 'term',
      title: 'Shell',
      titleIcon: iconGram ? { gram: iconGram, subject: 'terminal' } : null,
      variant: 'standard',
      state: 'normal',
      hooks: { drag: true, close: 'close-app:term', focus: 'focus-app:term' }
    }));
  }

  // Taskbar / Menu-bar / Dock
  if (bar !== 'none') {
    blocks.push(normalizeBlock({
      id: 'taskbar',
      block: 'taskbar',
      zone: bar === 'top' ? 'top' : 'bottom',
      order: 0,
      size: 'm',
      side: bar === 'top' ? 'top' : 'bottom',
      start: {
        label: '⌂',
        icon: iconGram ? { gram: iconGram, subject: 'home' } : null
      },
      slots: ['apps', 'clock'],
      showOpenApps: true
    }));

    blocks.push(normalizeBlock({
      id: 'clock',
      block: 'clock',
      zone: 'inline',
      parent: 'taskbar',
      size: 's',
      format: 'hhmm',
      font: 'mono'
    }));
  }

  if (rail === 'left' || rail === 'right') {
    blocks.push(normalizeBlock({
      id: 'dock',
      block: 'dock',
      zone: rail === 'left' ? 'left-rail' : 'right-rail',
      order: 0,
      size: 'm',
      side: rail === 'left' ? 'left' : 'right',
      items: [
        { icon: { gram: iconGram || 'glyph', subject: 'terminal' }, appRef: 'term', label: 'Shell' }
      ]
    }));
  }

  // Entities as icons / cards / gauges
  const entities = (world && Array.isArray(world.entities) && world.entities.length > 0)
    ? world.entities
    : [
        { name: 'files', title: 'Files', subject: 'folder' },
        { name: 'editor', title: 'Editor', subject: 'file' },
        { name: 'sysmon', title: 'System', subject: 'gauge' },
        { name: 'trash', title: 'Trash', subject: 'trash' }
      ];

  entities.forEach((ent, idx) => {
    const entId = String(ent.name || `app-${idx}`).toLowerCase().replace(/[^a-z0-9\-]/g, '-');
    const subj = ent.subject || (ent.name && ent.name.includes('log') ? 'file' : (ent.name && ent.name.includes('gear') ? 'gauge' : 'app'));

    if (paradigm === 'gui') {
      blocks.push(normalizeBlock({
        id: `icon-${entId}`,
        block: 'icon',
        zone: 'desktop',
        order: idx,
        size: 'm',
        subject: subj,
        label: ent.title || ent.name,
        appRef: ent.name || entId,
        hooks: { click: `open-app:${ent.name || entId}` }
      }));
    } else if (paradigm === 'device') {
      blocks.push(normalizeBlock({
        id: `gauge-${entId}`,
        block: 'gauge',
        zone: 'stack',
        order: idx,
        size: 'm',
        kind: 'dial',
        label: ent.title || ent.name,
        value: 0.5,
        hooks: { click: `open-app:${ent.name || entId}`, change: `set:${entId}:dial` }
      }));
    } else {
      blocks.push(normalizeBlock({
        id: `card-${entId}`,
        block: 'card',
        zone: 'desktop',
        order: idx,
        size: 'm',
        variant: paradigm === 'tui' ? 'frame' : 'panel',
        title: ent.title || ent.name,
        body: ent.desc || 'Apparatus resting in register.',
        hooks: { click: `open-app:${ent.name || entId}` }
      }));
    }
  });

  return {
    paradigm,
    layout,
    topology,
    aesthetic,
    banks,
    blocks
  };
}

/**
 * Materializes skeleton into full design spec with tokens cohesion pass (design/composition.md §2)
 */
function materialize(skeleton, seedVal, conceptInput = '', world = null) {
  const prng = new PRNG(seedVal);
  const concept = String(conceptInput || '');

  // 1. Generate Palette
  const paletteGen = palettes.generatePalette(seedVal, concept);
  const basePalette = paletteGen.tokens;
  const paletteArray = paletteGen.array;

  // 2. Derive scale and tokens table (Cohesion pass §2.1)
  const aesthetic = skeleton.aesthetic || { radius: 'sharp', density: 'normal', motion: 'subtle', accentBand: 'cool' };
  const radiusMap = { sharp: 0, low: 2, mid: 4, high: 8, full: 999 };
  const radiusPx = radiusMap[aesthetic.radius] !== undefined ? radiusMap[aesthetic.radius] : 0;

  const density = aesthetic.density || 'normal';
  const borderW = density === 'loose' ? 2 : 1;
  const fontBasePx = density === 'tight' ? 12 : (density === 'loose' ? 14 : 13);

  const motion = aesthetic.motion || 'subtle';
  const motionTimes = motion === 'none'
    ? { hoverMs: 0, pressMs: 0, blinkMs: 0 }
    : (motion === 'lively'
        ? { hoverMs: 180, pressMs: 100, blinkMs: 500 }
        : { hoverMs: 120, pressMs: 80, blinkMs: 600 });

  const primaryFontStack = fonts.FONT_STACKS.sans_clean;
  const monoFontStack = fonts.FONT_STACKS.mono_code;

  // Derive cohesive tokens
  const tokens = {
    color: {
      bg: basePalette.bg,
      surface: basePalette.surface,
      surface2: basePalette.surface,
      accent: basePalette.accent,
      accent2: basePalette.dim,
      text: basePalette.fg,
      textDim: basePalette.dim,
      border: basePalette.surface,
      ok: '#67c08a',
      warn: '#d7a04a',
      danger: '#d06a5a',
      glow: basePalette.accent
    },
    unit: 16,
    spacing: [8, 16, 24, 32],
    radiusPx,
    borderW,
    fontBasePx,
    font: {
      primary: primaryFontStack,
      mono: monoFontStack
    },
    stripH: { s: 24, m: 36, l: 48, xl: 64 },
    icon: {
      gram: skeleton.banks.iconGram,
      strokeW: 1.5,
      slot: 'text'
    },
    motion: motionTimes
  };

  // 3. Normalize all blocks
  const normalizedBlocks = (skeleton.blocks || []).map((b, i) => normalizeBlock(b, `block-${i}`));

  // Backwards compatibility structures for existing tests
  const bankPulls = {
    fonts: skeleton.banks.fonts,
    iconGrammar: skeleton.banks.iconGram,
    sounds: skeleton.banks.sounds,
    paletteBands: paletteGen.bands
  };

  const aestheticParams = {
    radius: radiusPx,
    borderWidth: borderW,
    density,
    wallpaperStyle: skeleton.topology && skeleton.topology.wallpaper ? 'gradient' : 'none',
    motionAmount: motion === 'none' ? 0 : (motion === 'lively' ? 1.5 : 1)
  };

  return {
    schema: 1,
    source: skeleton.source || 'seeded',
    seed: prng.hexSeed,
    concept,
    paradigm: skeleton.paradigm,
    layout: skeleton.layout,
    topology: skeleton.topology,
    aesthetic: skeleton.aesthetic,
    banks: skeleton.banks,
    paletteBands: paletteGen.bands,
    palette: basePalette,
    tokens,
    blocks: normalizedBlocks,
    // Compat fields
    bankPulls,
    aestheticParams,
    paletteTokens: basePalette,
    paletteArray
  };
}

/**
 * Synchronous design spec generator (Spec §11 requirement: deterministic per seed + concept)
 */
function generateDesignSpec(worldOrSeed, conceptInput = '', options = {}) {
  let seedVal = 1;
  let concept = String(conceptInput || '');
  let world = null;

  if (typeof worldOrSeed === 'object' && worldOrSeed !== null) {
    world = worldOrSeed;
    seedVal = worldOrSeed.seed || 1;
    if (!concept && worldOrSeed.concept) {
      concept = worldOrSeed.concept;
    }
  } else {
    seedVal = worldOrSeed;
  }

  const skeleton = seededSkeleton(seedVal, concept, world);
  skeleton.source = 'seeded';
  return materialize(skeleton, seedVal, concept, world);
}

/**
 * Async design decision with low-thinking LLM call and automatic seeded fallback (design/composition.md §1)
 */
async function decideDesign(world, conceptInput = '', seedInput = 1, options = {}) {
  const seedVal = seedInput || (world ? world.seed : 1);
  const concept = String(conceptInput || (world ? world.concept : ''));

  // Always compute deterministic fallback first
  const fallbackSkeleton = seededSkeleton(seedVal, concept, world);
  fallbackSkeleton.source = 'seeded';
  const fallbackSpec = materialize(fallbackSkeleton, seedVal, concept, world);

  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return fallbackSpec;
  }

  try {
    const { getLLMBase } = require('./llm');
    const http = require('http');
    const llmBase = options.llmBase || getLLMBase();
    const url = new URL('/v1/chat/completions', llmBase);

    const systemPrompt = `You are the layout engine. Given a concept and a seed, choose ONE layout and its blocks. Reply ONLY with a raw JSON object matching the skeleton schema. Use ONLY the enumerated values below. No pixels, no hex, no font sizes, no angles. Do not wrap in code fences.
ENUMS — paradigm: gui|tui|device|scene|invented
        layout: windows-xp|windows-10|windows-11|classic-macos|modern-macos|kde-plasma|gnome|generic-flat-linux|tty-terminal|instrument-console|game-hud|radial-orbital|vertical-ledger|card-deck|diegetic-room
        radius: sharp|low|mid|high|full
        density: tight|normal|loose
        motion: none|subtle|lively
        accentBand: warm|cool|cold|vivid|muted
        iconGram: flat-line|duotone|glyph|pictogram|hand-drawn (or null)
        bar: none|bottom|top   menu: none|top|left   rail: none|left|right
        font: sans|mono|serif|display
        wallpaper: solid|gradient|grid|scanlines|noise|radial|procedural
        block types: window|taskbar|menu-bar|button|gauge|terminal|icon|card|wallpaper|clock|dock`;

    const userPrompt = `CONCEPT: "${concept}"   SEED: ${new PRNG(seedVal).hexSeed}   PARADIGM: ${world ? world.interface : 'gui'}
Emit the design skeleton for this world.`;

    const payload = JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 520,
      stream: false
    });

    const llmPromise = new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: options.timeout || 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
              resolve(content);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`LLM status ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('LLM design call timed out'));
      });
      req.write(payload);
      req.end();
    });

    const rawContent = await llmPromise;
    if (!rawContent) return fallbackSpec;

    // Clean JSON output
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }

    const parsedSkeleton = JSON.parse(cleanJson);
    if (!parsedSkeleton || typeof parsedSkeleton !== 'object') return fallbackSpec;

    parsedSkeleton.source = 'llm';
    // Ensure paradigm matches world interface
    if (world && world.interface) {
      parsedSkeleton.paradigm = world.interface;
    }
    parsedSkeleton.layout = clampLayoutToParadigm(parsedSkeleton.layout || 'generic-flat-linux', parsedSkeleton.paradigm);

    return materialize(parsedSkeleton, seedVal, concept, world);
  } catch (_) {
    return fallbackSpec;
  }
}

module.exports = {
  LAYOUT_IDS,
  conceptLayout,
  clampLayoutToParadigm,
  seededSkeleton,
  materialize,
  generateDesignSpec,
  decideDesign
};
