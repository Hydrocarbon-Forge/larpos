// app/banks/icons.js — Procedural icon grammar bank for LarpOS
// Procedurally draws SVGs for (grammar, subject, seed, palette)

const { PRNG } = require('../prng');

const GRAMMARS = ['flat-line', 'duotone', 'glyph', 'pictogram', 'hand-drawn'];

const SUBJECT_SHAPES = {
  folder: {
    paths: [
      '<path d="M2 5a2 2 0 0 1 2-2h4l2 2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>'
    ]
  },
  terminal: {
    paths: [
      '<rect x="2" y="3" width="20" height="18" rx="2" ry="2"/>',
      '<polyline points="6 9 10 12 6 15"/>',
      '<line x1="12" y1="15" x2="18" y2="15"/>'
    ]
  },
  file: {
    paths: [
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',
      '<polyline points="14 2 14 8 20 8"/>',
      '<line x1="9" y1="13" x2="15" y2="13"/>',
      '<line x1="9" y1="17" x2="13" y2="17"/>'
    ]
  },
  trash: {
    paths: [
      '<polyline points="3 6 5 6 21 6"/>',
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
      '<path d="M10 11v6"/>',
      '<path d="M14 11v6"/>',
      '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'
    ]
  },
  system: {
    paths: [
      '<circle cx="12" cy="12" r="3"/>',
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    ]
  },
  gauge: {
    paths: [
      '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>',
      '<line x1="12" y1="12" x2="16" y2="8"/>',
      '<circle cx="12" cy="12" r="1.5"/>'
    ]
  },
  settings: {
    paths: [
      '<line x1="4" y1="21" x2="4" y2="14"/>',
      '<line x1="4" y1="10" x2="4" y2="3"/>',
      '<line x1="12" y1="21" x2="12" y2="12"/>',
      '<line x1="12" y1="8" x2="12" y2="3"/>',
      '<line x1="20" y1="21" x2="20" y2="16"/>',
      '<line x1="20" y1="12" x2="20" y2="3"/>',
      '<line x1="1" y1="14" x2="7" y2="14"/>',
      '<line x1="9" y1="8" x2="15" y2="8"/>',
      '<line x1="17" y1="16" x2="23" y2="16"/>'
    ]
  },
  clock: {
    paths: [
      '<circle cx="12" cy="12" r="10"/>',
      '<polyline points="12 6 12 12 16 14"/>'
    ]
  },
  window: {
    paths: [
      '<rect x="2" y="3" width="20" height="18" rx="2" ry="2"/>',
      '<line x1="2" y1="8" x2="22" y2="8"/>',
      '<circle cx="5" cy="5.5" r="1"/>',
      '<circle cx="8" cy="5.5" r="1"/>'
    ]
  },
  editor: {
    paths: [
      '<path d="M12 20h9"/>',
      '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'
    ]
  },
  device: {
    paths: [
      '<rect x="3" y="2" width="18" height="20" rx="3" ry="3"/>',
      '<circle cx="12" cy="9" r="4"/>',
      '<line x1="12" y1="9" x2="14" y2="7"/>',
      '<line x1="7" y1="17" x2="17" y2="17"/>'
    ]
  },
  bell: {
    paths: [
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
    ]
  },
  network: {
    paths: [
      '<rect x="2" y="2" width="6" height="6" rx="1"/>',
      '<rect x="16" y="2" width="6" height="6" rx="1"/>',
      '<rect x="9" y="16" width="6" height="6" rx="1"/>',
      '<path d="M5 8v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>',
      '<line x1="12" y1="13" x2="12" y2="16"/>'
    ]
  },
  app: {
    paths: [
      '<rect x="3" y="3" width="7" height="7"/>',
      '<rect x="14" y="3" width="7" height="7"/>',
      '<rect x="14" y="14" width="7" height="7"/>',
      '<rect x="3" y="14" width="7" height="7"/>'
    ]
  }
};

function normalizeSubject(subject) {
  const clean = String(subject || 'app').toLowerCase().replace(/[^a-z0-9\-]/g, '');
  if (SUBJECT_SHAPES[clean]) return clean;
  if (/file|doc|text|note|log/i.test(clean)) return 'file';
  if (/folder|dir|cabinet|archive/i.test(clean)) return 'folder';
  if (/term|shell|console|cli|cmd|bash/i.test(clean)) return 'terminal';
  if (/gauge|meter|dial|manometer|sensor/i.test(clean)) return 'gauge';
  if (/system|cpu|proc|task|daemon|gear/i.test(clean)) return 'system';
  if (/net|network|eth|wifi|ip|wpa/i.test(clean)) return 'network';
  if (/edit|write|author|feather/i.test(clean)) return 'editor';
  if (/clock|time|timer|sched/i.test(clean)) return 'clock';
  if (/bell|chime|sound|ping/i.test(clean)) return 'bell';
  if (/trash|waste|del|dump/i.test(clean)) return 'trash';
  if (/device|apparatus|machine|console/i.test(clean)) return 'device';
  if (/setting|config|pref|lever/i.test(clean)) return 'settings';
  if (/window|view|screen/i.test(clean)) return 'window';
  return 'app';
}

function drawIcon(grammar, rawSubject, seed = 1, palette = {}) {
  const subject = normalizeSubject(rawSubject);
  const def = SUBJECT_SHAPES[subject] || SUBJECT_SHAPES.app;
  const accent = palette.accent || '#4ecdc4';
  const fg = palette.fg || '#ffffff';
  const surface = palette.surface || '#1e1e2e';

  const prng = new PRNG(seed);
  const g = GRAMMARS.includes(grammar) ? grammar : 'flat-line';

  let bodyContent = '';

  if (g === 'flat-line') {
    bodyContent = def.paths.map(p =>
      p.replace(/<([a-z]+)/, `<$1 stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`)
    ).join('');
  } else if (g === 'duotone') {
    bodyContent = def.paths.map((p, idx) => {
      const fillVal = idx === 0 ? accent : 'none';
      const fillOpacity = idx === 0 ? '0.22' : '0';
      return p.replace(/<([a-z]+)/, `<$1 stroke="${accent}" stroke-width="2" fill="${fillVal}" fill-opacity="${fillOpacity}" stroke-linecap="round" stroke-linejoin="round"`);
    }).join('');
  } else if (g === 'glyph') {
    bodyContent = def.paths.map(p =>
      p.replace(/<([a-z]+)/, `<$1 fill="${accent}" stroke="${accent}" stroke-width="1"`)
    ).join('');
  } else if (g === 'pictogram') {
    const badge = `<rect x="1" y="1" width="22" height="22" rx="5" fill="${surface}" stroke="${accent}" stroke-width="1.5"/>`;
    const inner = def.paths.map(p =>
      p.replace(/<([a-z]+)/, `<$1 transform="scale(0.7) translate(5.1, 5.1)" stroke="${fg}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"`)
    ).join('');
    bodyContent = badge + inner;
  } else if (g === 'hand-drawn') {
    // Jittered stroke
    const rot = (prng.int(-3, 3));
    const jitter = def.paths.map(p =>
      p.replace(/<([a-z]+)/, `<$1 stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24 1" fill="none"`)
    ).join('');
    bodyContent = `<g transform="rotate(${rot} 12 12)">${jitter}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class="larpos-icon grammar-${g} subject-${subject}">${bodyContent}</svg>`;
}

module.exports = {
  GRAMMARS,
  SUBJECT_SHAPES,
  normalizeSubject,
  drawIcon
};
