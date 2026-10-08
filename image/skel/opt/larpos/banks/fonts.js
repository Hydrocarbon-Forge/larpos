// app/banks/fonts.js — Font stack bank for LarpOS
// Named family stacks present in the image (guaranteed via font-dejavu & generic system fallbacks)

const FONT_STACKS = {
  mono_code: 'ui-monospace, "DejaVu Sans Mono", "Courier New", monospace',
  mono_dense: '"DejaVu Sans Mono", monospace',
  sans_clean: 'ui-sans-serif, system-ui, "DejaVu Sans", sans-serif',
  serif_classic: '"DejaVu Serif", Georgia, serif',
  display_heavy: 'Impact, "DejaVu Sans Mono", sans-serif'
};

function getFontStack(name) {
  return FONT_STACKS[name] || FONT_STACKS.mono_code;
}

function selectFontsForWorld(prng, paradigm) {
  if (paradigm === 'tui') {
    return {
      primary: FONT_STACKS.mono_code,
      ui: FONT_STACKS.mono_code,
      names: ['mono_code']
    };
  }
  if (paradigm === 'gui') {
    const sans = prng ? prng.choice(['sans_clean', 'mono_code']) : 'sans_clean';
    return {
      primary: FONT_STACKS[sans],
      mono: FONT_STACKS.mono_code,
      ui: FONT_STACKS[sans],
      names: [sans, 'mono_code']
    };
  }
  if (paradigm === 'device') {
    const disp = prng ? prng.choice(['display_heavy', 'mono_dense']) : 'mono_dense';
    return {
      primary: FONT_STACKS[disp],
      mono: FONT_STACKS.mono_code,
      ui: FONT_STACKS.mono_dense,
      names: [disp, 'mono_code']
    };
  }
  // scene / invented
  const choice = prng ? prng.choice(['serif_classic', 'sans_clean', 'mono_code']) : 'serif_classic';
  return {
    primary: FONT_STACKS[choice],
    mono: FONT_STACKS.mono_code,
    ui: FONT_STACKS[choice],
    names: [choice, 'mono_code']
  };
}

module.exports = {
  FONT_STACKS,
  getFontStack,
  selectFontsForWorld
};
