// app/larp.js — .larp File Format Parser, Serializer & Live Watcher for LarpOS
// Zero dependencies. Follows reader-not-validator policy: corrupt lines are interpreted, not rejected.

const fs = require('fs');
const path = require('path');
const { getStateDir } = require('./storage');

function serializeToLarp(world) {
  const lines = [];

  // 1. world section
  lines.push(JSON.stringify({
    section: 'world',
    name: world.name,
    theme: world.theme,
    concept: world.concept || 'random',
    interface: world.interface || 'device',
    palette: world.palette,
    keeper: world.keeper,
    seed: world.seed,
    openVerb: world.openVerb || 'open',
    homeVerb: world.homeVerb || 'home',
    helpVerb: world.helpVerb || 'help',
    reseedVerb: world.reseedVerb || 'reseed'
  }));

  // 2. laws
  if (Array.isArray(world.laws)) {
    for (const law of world.laws) {
      lines.push(JSON.stringify({
        section: 'law',
        rule: typeof law === 'string' ? law : (law.rule || JSON.stringify(law))
      }));
    }
  }

  // 3. scene
  if (Array.isArray(world.script)) {
    for (const line of world.script) {
      lines.push(JSON.stringify({
        section: 'scene',
        line: typeof line === 'string' ? line : JSON.stringify(line)
      }));
    }
  }

  // 4. apps
  if (Array.isArray(world.entities)) {
    for (const ent of world.entities) {
      lines.push(JSON.stringify({
        section: 'app',
        name: ent.name,
        title: ent.title,
        kind: ent.kind,
        desc: ent.desc,
        reachVerbs: ent.reachVerbs || [],
        responses: ent.responses || {},
        app: ent.app || {
          title: ent.title.toUpperCase(),
          format: 'gauge',
          screen: ent.desc,
          element: {
            name: `${ent.name}-control`,
            label: `Operate ${ent.title}`,
            type: 'dial',
            state: 'primed',
            action: 'turn',
            responses: { turn: `You operate the ${ent.title}.` }
          }
        }
      }));
    }
  }

  // 5. bin commands
  if (Array.isArray(world.bin)) {
    for (const b of world.bin) {
      lines.push(JSON.stringify({
        section: 'bin',
        name: b.name,
        behavior: b.behavior
      }));
    }
  }

  return lines.join('\n') + '\n';
}

function parseLooseText(content) {
  const text = String(content || '').trim();
  const sentences = text.split(/[.\n]+/).map(s => s.trim()).filter(Boolean);
  const firstLine = sentences[0] || 'Unknown Domain';
  const name = firstLine.slice(0, 36).replace(/^(the|a|an|in|at)\s+/i, '').trim().toUpperCase() || 'UNBOUND REALITY';

  // Extract potential laws
  const laws = [];
  const lawRegex = /(?:law|rule|decree)\s*\d*[:\s-]+([^.\n]+)/gi;
  let match;
  while ((match = lawRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) laws.push(match[1].trim());
  }
  for (const s of sentences) {
    if (/\b(never|must not|forbidden|always|shall not)\b/i.test(s) && !laws.includes(s)) {
      laws.push(s);
    }
  }
  if (laws.length === 0) {
    laws.push('Nothing observed here remains stationary.', 'The frequency of silence dictates the pressure.');
  }

  // Extract potential bin commands
  const binCommands = [];
  const binRegex = /(?:bin|cmd|command)\s*([a-zA-Z0-9_\-]+)[:\s-]+([^.\n]+)/gi;
  while ((match = binRegex.exec(text)) !== null) {
    binCommands.push({ name: match[1].toLowerCase(), behavior: match[2].trim() });
  }
  if (binCommands.length === 0) {
    binCommands.push({ name: 'pulse', behavior: 'Emits a localized resonance wave through the chamber.' });
  }

  // Derive apps from keywords in text
  const entityKeywords = ['gauge', 'valve', 'pump', 'register', 'hatch', 'mirror', 'conduit', 'furnace', 'screen', 'terminal', 'vault'];
  const entities = [];
  for (const kw of entityKeywords) {
    if (text.toLowerCase().includes(kw)) {
      const entName = kw;
      entities.push({
        name: entName,
        title: `${entName.charAt(0).toUpperCase() + entName.slice(1)} Unit`,
        kind: 'apparatus',
        desc: `A physical ${kw} described in the sector's documentation.`,
        reachVerbs: ['inspect', 'operate'],
        responses: { inspect: `The ${kw} remains active.`, operate: `You manipulate the ${kw}.` },
        app: {
          title: `${kw.toUpperCase()} INTERFACE`,
          format: kw === 'mirror' ? 'mirror' : (kw === 'terminal' ? 'terminal' : 'gauge'),
          screen: `Telemetry displays active readings across the ${kw}.`,
          element: {
            name: `${kw}-regulator`,
            label: `Operate ${kw}`,
            type: 'dial',
            state: 'idle',
            action: 'turn',
            responses: { turn: `The ${kw} hums with adjusted tension.` }
          },
          elements: []
        }
      });
      if (entities.length >= 3) break;
    }
  }

  if (entities.length === 0) {
    entities.push({
      name: 'core-instrument',
      title: 'Core Instrument',
      kind: 'apparatus',
      desc: 'The central apparatus identified within this sector.',
      reachVerbs: ['inspect'],
      responses: { inspect: 'The needle hovers at steady oscillation.' },
      app: {
        title: 'CORE INSTRUMENT',
        format: 'gauge',
        screen: 'The dial indicates nominal resonance.',
        element: {
          name: 'core-switch',
          label: 'Flip Instrument Switch',
          type: 'toggle',
          state: 'armed',
          action: 'flip',
          responses: { flip: 'The instrument cycles its power relay.' }
        },
        elements: []
      }
    });
  }

  // Detect interface paradigm from text
  let iface = 'device';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('terminal') || lowerText.includes('cli') || lowerText.includes('shell')) {
    iface = 'tui';
  } else if (lowerText.includes('room') || lowerText.includes('cathedral') || lowerText.includes('monastery') || lowerText.includes('chamber')) {
    iface = 'scene';
  } else if (lowerText.includes('window') || lowerText.includes('desktop') || lowerText.includes('panel')) {
    iface = 'gui';
  }

  const keeper = {
    name: 'The Sector Proctor',
    personality: 'attentive and austere',
    idiom: 'mechanical readings and structural endurance',
    prefix: 'Proctor'
  };

  const script = sentences.slice(0, 5).map(s => `[CHRONICLE]: "${s}"`);

  const verbs = [
    { name: 'help', help: 'help — consult the world verbs and operational laws.' },
    { name: 'open', help: 'open [app] — open an apparatus running screen.' },
    { name: 'home', help: 'home — step back to the system overview.' },
    { name: 'reseed', help: 'reseed — dissolve reality and return to concept prompt.' }
  ];

  for (const b of binCommands) {
    if (!verbs.some(v => v.name === b.name)) {
      verbs.push({ name: b.name, help: `${b.name} — ${b.behavior}` });
    }
  }

  return {
    name,
    theme: text.slice(0, 140),
    concept: 'hand-authored larp',
    interface: iface,
    palette: ['#0a192f', '#172a45', '#64ffda', '#ccd6f6', '#8892b0'],
    keeper,
    seed: '0x' + Buffer.from(name).toString('hex').slice(0, 8),
    openVerb: 'open',
    homeVerb: 'home',
    helpVerb: 'help',
    reseedVerb: 'reseed',
    laws,
    script,
    entities,
    bin: binCommands,
    verbs,
    isParsedFromLarp: true,
    isLooseText: true
  };
}

function parseLarp(content) {
  const lines = String(content || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return parseLooseText('Void sector with no recorded transactions.');
  }

  // Check if content appears to be JSON lines
  const jsonLineCount = lines.filter(l => l.startsWith('{') && l.endsWith('}')).length;
  if (jsonLineCount === 0) {
    return parseLooseText(content);
  }

  let worldMeta = {
    name: 'HALT-REALITY',
    theme: 'an unparsed sector of the LarpOS document',
    concept: 'random',
    interface: 'device',
    palette: ['#09131b', '#0f2537', '#4ecdc4', '#cbe3db', '#e07a5f'],
    keeper: {
      name: 'The Clerk of Fragments',
      personality: 'speaks in half-sentences',
      idiom: 'torn ledgers and missing registers',
      prefix: 'Clerk'
    },
    seed: '0x00000000',
    openVerb: 'open',
    homeVerb: 'home',
    helpVerb: 'help',
    reseedVerb: 'reseed'
  };

  const laws = [];
  const script = [];
  const entities = [];
  const binCommands = [];
  let corruptIndex = 0;

  for (const rawLine of lines) {
    if (rawLine.startsWith('#')) continue; // Comment line

    let item = null;
    try {
      item = JSON.parse(rawLine);
    } catch (_) {
      // Reader-not-validator: interpret corrupt text as in-world artifact
      corruptIndex++;
      script.push(`[CORRUPT LOG ENTRY #${corruptIndex}]: "${rawLine.slice(0, 100)}"`);
      continue;
    }

    if (!item || typeof item !== 'object') continue;

    const section = item.section || (item.name && item.palette ? 'world' : (item.rule ? 'law' : (item.app ? 'app' : null)));

    if (section === 'world') {
      worldMeta = {
        ...worldMeta,
        name: item.name || worldMeta.name,
        theme: item.theme || worldMeta.theme,
        concept: item.concept || worldMeta.concept,
        interface: item.interface || worldMeta.interface,
        palette: (Array.isArray(item.palette) && item.palette.length >= 3) ? item.palette : worldMeta.palette,
        keeper: (item.keeper && typeof item.keeper === 'object') ? item.keeper : worldMeta.keeper,
        seed: item.seed || worldMeta.seed,
        openVerb: item.openVerb || worldMeta.openVerb,
        homeVerb: item.homeVerb || worldMeta.homeVerb,
        helpVerb: item.helpVerb || worldMeta.helpVerb,
        reseedVerb: item.reseedVerb || worldMeta.reseedVerb
      };
    } else if (section === 'law') {
      const ruleText = item.rule || item.text || item.law || 'The document refuses to be read twice.';
      laws.push(ruleText);
    } else if (section === 'scene') {
      const lineText = item.line || item.text || item.monologue;
      if (lineText) script.push(lineText);
      else if (Array.isArray(item.lines)) script.push(...item.lines);
    } else if (section === 'app') {
      const entName = (item.name || item.id || `app-${entities.length + 1}`).toLowerCase().replace(/[^a-z0-9\-]/g, '-');
      const title = item.title || item.name || 'Apparatus';
      const desc = item.desc || item.description || 'A physical apparatus written into the Larp script.';
      const appSpec = item.app || {
        title: title.toUpperCase(),
        format: item.format || 'gauge',
        screen: item.screen || desc,
        element: item.element || {
          name: `${entName}-control`,
          label: `Engage ${title}`,
          type: 'button',
          state: 'primed',
          action: 'engage',
          responses: { engage: `You engage the ${title}.` }
        }
      };

      const elem = (appSpec.element && typeof appSpec.element === 'object') ? {
        name: appSpec.element.name || `${entName}-control`,
        label: appSpec.element.label || `Operate ${title}`,
        type: appSpec.element.type || 'dial',
        state: appSpec.element.state || 'ready',
        action: appSpec.element.action || 'turn',
        responses: appSpec.element.responses || { turn: `You operate the ${title}.` },
        currentValue: appSpec.element.state || 'ready'
      } : {
        name: `${entName}-control`,
        label: `Operate ${title}`,
        type: 'button',
        state: 'ready',
        action: 'operate',
        responses: { operate: `You operate the ${title}.` }
      };

      entities.push({
        name: entName,
        title,
        kind: item.kind || 'inhabited thing',
        desc,
        reachVerbs: Array.isArray(item.reachVerbs) ? item.reachVerbs : [elem.action || 'inspect'],
        responses: item.responses || {},
        app: {
          title: appSpec.title || title.toUpperCase(),
          format: appSpec.format || 'gauge',
          screen: appSpec.screen || desc,
          element: elem,
          elements: [elem]
        }
      });
    } else if (section === 'bin') {
      if (item.name) {
        binCommands.push({
          name: String(item.name).toLowerCase().trim(),
          behavior: item.behavior || item.desc || 'A custom command written into local bin.'
        });
      }
    }
  }

  // Fallbacks if sections were sparse
  if (laws.length === 0) {
    laws.push('Nothing entered into the registry can be undone.', 'The screen dims whenever unobserved.');
  }
  if (script.length === 0) {
    script.push(
      `[LARP SCRIPT MOUNTED // SEED: ${worldMeta.seed}]`,
      `${worldMeta.keeper.prefix}: "The sector has been reconstituted from document storage."`,
      `[SYSTEM READY]`
    );
  }
  if (entities.length === 0) {
    entities.push({
      name: 'primary-register',
      title: 'Primary Register',
      kind: 'apparatus',
      desc: 'The fundamental register of this sector.',
      reachVerbs: ['inspect'],
      responses: { inspect: 'The register is active.' },
      app: {
        title: 'PRIMARY REGISTER',
        format: 'gauge',
        screen: 'The dial rests at zero.',
        element: {
          name: 'reg-knob',
          label: 'Turn Register Knob',
          type: 'dial',
          state: 'idle',
          action: 'turn',
          responses: { turn: 'The pointer vibrates.' }
        },
        elements: []
      }
    });
  }

  // Construct verbs array
  const verbs = [
    { name: worldMeta.helpVerb, help: `${worldMeta.helpVerb} — consult the world verbs and operational laws.` },
    { name: worldMeta.openVerb, help: `${worldMeta.openVerb} [app] — open an apparatus running screen.` },
    { name: worldMeta.homeVerb, help: `${worldMeta.homeVerb} — step back to the system overview.` },
    { name: worldMeta.reseedVerb, help: `${worldMeta.reseedVerb} — dissolve reality and return to concept prompt.` }
  ];

  // Add bin commands as executable commands in the world
  for (const b of binCommands) {
    if (!verbs.some(v => v.name === b.name)) {
      verbs.push({ name: b.name, help: `${b.name} — ${b.behavior}` });
    }
  }

  return {
    ...worldMeta,
    laws,
    script,
    entities,
    bin: binCommands,
    verbs,
    isParsedFromLarp: true
  };
}

function getWorldLarpPath(seed, stateDir = null) {
  const dir = stateDir || getStateDir();
  const cleanSeed = String(seed || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(dir, `world-${cleanSeed}.larp`);
}

function writeWorldLarp(world, stateDir = null) {
  const dir = stateDir || getStateDir();
  const filePath = getWorldLarpPath(world.seed, dir);
  const larpContent = serializeToLarp(world);
  fs.writeFileSync(filePath, larpContent, 'utf8');
  return filePath;
}

function readWorldLarp(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return parseLarp(content);
}

function watchWorldLarp(filePath, onChangeCallback) {
  if (!fs.existsSync(filePath)) return null;

  let lastMtime = fs.statSync(filePath).mtimeMs;
  let debounceTimer = null;

  const trigger = () => {
    try {
      if (!fs.existsSync(filePath)) return;
      const curMtime = fs.statSync(filePath).mtimeMs;
      if (curMtime !== lastMtime) {
        lastMtime = curMtime;
        const updatedWorld = readWorldLarp(filePath);
        if (updatedWorld && onChangeCallback) {
          onChangeCallback(updatedWorld);
        }
      }
    } catch (_) {}
  };

  let watcher = null;
  try {
    watcher = fs.watch(filePath, (event) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(trigger, 50);
    });
  } catch (_) {
    // Fall back to polling
  }

  // Poll fallback every 500ms
  const pollInterval = setInterval(trigger, 500);
  if (pollInterval.unref) pollInterval.unref();

  return {
    close: () => {
      if (watcher) watcher.close();
      clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
    }
  };
}

module.exports = {
  serializeToLarp,
  parseLarp,
  getWorldLarpPath,
  writeWorldLarp,
  readWorldLarp,
  watchWorldLarp
};
