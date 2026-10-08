// app/banks/palettes.js — Seeded HSL ramp palette generator for LarpOS
// Replaces fixed 5-color arrays with procedural ramps steered by concept & seed

const { PRNG } = require('../prng');

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n) => {
    const val = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generatePalette(seedInput, conceptInput) {
  const prng = new PRNG(seedInput);
  const concept = String(conceptInput || '').toLowerCase();

  let baseHue = 210;
  let baseSat = 65;

  if (/\b(practical|lightweight|desktop|fast|minimal|linux|work|office|utility)\b/i.test(concept)) {
    baseHue = prng.choice([215, 220, 225, 230]);
    baseSat = prng.int(35, 55);
  } else if (/\b(lighthouse|pharos|sea|ocean|brine|salt|submarine|water)\b/i.test(concept)) {
    baseHue = prng.int(185, 215);
    baseSat = prng.int(55, 75);
  } else if (/\b(railway|train|ash|siberia|frost|permafrost|tundra)\b/i.test(concept)) {
    baseHue = prng.choice([prng.int(15, 35), prng.int(200, 220)]);
    baseSat = prng.int(35, 60);
  } else if (/\b(cranium|skull|bone|god|marrow|titan|autopsy)\b/i.test(concept)) {
    baseHue = prng.choice([340, 350, 10, 20]);
    baseSat = prng.int(45, 70);
  } else if (/\b(loom|weave|monk|monastery|cloister|abbess|flax)\b/i.test(concept)) {
    baseHue = prng.int(32, 50);
    baseSat = prng.int(30, 55);
  } else if (/\b(kitchen|tea|domestic|flooded|scullery)\b/i.test(concept)) {
    baseHue = prng.int(25, 45);
    baseSat = prng.int(50, 75);
  } else if (/\b(solarium|garden|plant|botanic|orbital|flower)\b/i.test(concept)) {
    baseHue = prng.int(135, 165);
    baseSat = prng.int(55, 75);
  } else if (/\b(glacial|ice|cold|scriptorium|chancery|vellum)\b/i.test(concept)) {
    baseHue = prng.int(200, 230);
    baseSat = prng.int(30, 55);
  } else if (/\b(chime|bell|foundry|bronze|acoustic|metallurgy)\b/i.test(concept)) {
    baseHue = prng.int(30, 48);
    baseSat = prng.int(55, 75);
  } else {
    // Seeded random distribution
    baseHue = prng.int(0, 359);
    baseSat = prng.int(40, 80);
  }

  const bgHex = hslToHex(baseHue, baseSat * 0.25, prng.int(7, 11));
  const surfaceHex = hslToHex(baseHue, baseSat * 0.35, prng.int(13, 19));
  const accentShift = prng.choice([0, 15, -15, 30]);
  const accentHex = hslToHex((baseHue + accentShift + 360) % 360, baseSat, prng.int(55, 72));
  const fgHex = hslToHex(baseHue, 15, prng.int(88, 96));
  const dimHex = hslToHex(baseHue, baseSat * 0.45, prng.int(44, 55));
  const highlightHex = hslToHex((baseHue + 180) % 360, 75, 70);

  const array = [bgHex, surfaceHex, accentHex, fgHex, dimHex];

  return {
    array,
    tokens: {
      bg: bgHex,
      surface: surfaceHex,
      accent: accentHex,
      fg: fgHex,
      dim: dimHex,
      highlight: highlightHex
    },
    bands: {
      hue: baseHue,
      sat: baseSat,
      light: 50
    }
  };
}

module.exports = {
  hslToHex,
  generatePalette
};
