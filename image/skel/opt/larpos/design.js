// app/design.js — Seeded design spec generator for LarpOS
// Deterministically pulls building blocks from app/banks/ based on paradigm, seed, and concept

const { PRNG } = require('./prng');
const fonts = require('./banks/fonts');
const icons = require('./banks/icons');
const sounds = require('./banks/sounds');
const palettes = require('./banks/palettes');

function generateDesignSpec(worldOrSeed, conceptInput = '', options = {}) {
  let seedVal = 1;
  let paradigm = 'gui';
  let concept = String(conceptInput || '');

  if (typeof worldOrSeed === 'object' && worldOrSeed !== null) {
    seedVal = worldOrSeed.seed || 1;
    paradigm = worldOrSeed.interface || 'gui';
    if (!concept && worldOrSeed.concept) {
      concept = worldOrSeed.concept;
    }
  } else {
    seedVal = worldOrSeed;
  }

  const prng = new PRNG(seedVal);
  const paletteGen = palettes.generatePalette(seedVal, concept);

  // Normalize paradigm
  const validParadigms = ['gui', 'tui', 'device', 'scene', 'invented'];
  let normParadigm = validParadigms.includes(paradigm) ? paradigm : 'gui';

  // Bank pulls
  let fontPulls = [];
  let iconGrammar = null;
  let soundPulls = [];
  let topology = {};
  let aestheticParams = {};

  if (normParadigm === 'tui') {
    // TUI worlds pull NO icon bank items and NO sounds (Spec §11)
    fontPulls = ['mono_code'];
    iconGrammar = null;
    soundPulls = [];
    topology = {
      barPosition: 'bottom',
      windowStyle: 'tiled_box',
      chromeStyle: 'ascii_border',
      menuPosition: 'none'
    };
    aestheticParams = {
      radius: 0,
      borderWidth: 1,
      density: 'compact',
      wallpaperStyle: 'solid_black',
      motionAmount: 0
    };
  } else if (normParadigm === 'gui') {
    // Real desktop: bottom taskbar, wallpaper, draggable floating windows, icons
    const sans = prng.choice(['sans_clean', 'mono_code']);
    fontPulls = [sans, 'mono_code'];
    iconGrammar = prng.choice(['flat-line', 'duotone', 'pictogram']);
    soundPulls = ['boot', 'click', 'open', 'error'];
    topology = {
      barPosition: 'bottom',
      windowStyle: 'floating',
      chromeStyle: 'window_titlebar',
      menuPosition: 'bottom_left'
    };
    aestheticParams = {
      radius: prng.choice([3, 4, 6]),
      borderWidth: 1,
      density: 'comfortable',
      wallpaperStyle: prng.choice(['mesh', 'radial', 'lines']),
      motionAmount: 1
    };
  } else if (normParadigm === 'device') {
    // Instrument console: heavy bezel, analog gauges, top/side meters
    fontPulls = ['display_heavy', 'mono_dense'];
    iconGrammar = 'glyph';
    soundPulls = ['boot', 'click', 'open', 'alarm'];
    topology = {
      barPosition: 'top',
      windowStyle: 'console_rack',
      chromeStyle: 'instrument_bezel',
      menuPosition: 'top_right'
    };
    aestheticParams = {
      radius: 2,
      borderWidth: 3,
      density: 'compact',
      wallpaperStyle: 'dark_grid',
      motionAmount: 0.5
    };
  } else if (normParadigm === 'scene') {
    // Diegetic space: zero chrome, story prose
    fontPulls = ['serif_classic', 'mono_code'];
    iconGrammar = 'hand-drawn';
    soundPulls = ['boot', 'click', 'open'];
    topology = {
      barPosition: 'none',
      windowStyle: 'diegetic',
      chromeStyle: 'none',
      menuPosition: 'none'
    };
    aestheticParams = {
      radius: 0,
      borderWidth: 0,
      density: 'spacious',
      wallpaperStyle: 'atmosphere',
      motionAmount: 0.2
    };
  } else {
    // invented: default to gui structure
    fontPulls = ['sans_clean', 'mono_code'];
    iconGrammar = 'flat-line';
    soundPulls = ['boot', 'click', 'open'];
    topology = {
      barPosition: 'bottom',
      windowStyle: 'floating',
      chromeStyle: 'window_titlebar',
      menuPosition: 'bottom_left'
    };
    aestheticParams = {
      radius: 4,
      borderWidth: 1,
      density: 'comfortable',
      wallpaperStyle: 'radial',
      motionAmount: 1
    };
  }

  return {
    paradigm: normParadigm,
    bankPulls: {
      fonts: fontPulls,
      iconGrammar,
      sounds: soundPulls,
      paletteBands: paletteGen.bands
    },
    topology,
    aestheticParams,
    paletteTokens: paletteGen.tokens,
    paletteArray: paletteGen.array
  };
}

module.exports = {
  generateDesignSpec
};
