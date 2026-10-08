// app/larp.js — .larp File Format Interpreter, Serializer & Live Watcher for LarpOS
// Zero dependencies. Follows reader-not-validator policy:
// The parser IS the interpreter. Loose text documents are interpreted by the LLM into a running OS,
// with an automatic combinatorial heuristic fallback offline.

const fs = require('fs');
const path = require('path');
const { getStateDir } = require('./storage');

function getLLMModule() {
  return require('./llm');
}

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

  // 6. design section (embedded design spec, design/composition.md §3.1)
  if (world.designSpec) {
    lines.push(JSON.stringify({
      section: 'design',
      spec: world.designSpec
    }));
  }

  return lines.join('\n') + '\n';
}

function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Try markdown code block
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  // Find outermost curly braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Clean trailing commas
      try {
        const withoutTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(withoutTrailingCommas);
      } catch (_) {}
    }
  }

  return null;
}

function normalizeInterpretedWorld(obj, originalContent = '') {
  if (!obj || typeof obj !== 'object') return null;

  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'UNBOUND REALITY';
  const theme = typeof obj.theme === 'string' && obj.theme.trim() ? obj.theme.trim() : 'An inhabited sector of LarpOS.';
  const concept = typeof obj.concept === 'string' && obj.concept.trim() ? obj.concept.trim() : 'larp-script';

  const validParadigms = ['gui', 'tui', 'device', 'scene'];
  let iface = (typeof obj.interface === 'string' && validParadigms.includes(obj.interface.toLowerCase()))
    ? obj.interface.toLowerCase()
    : 'device';

  // Palette
  let palette = ['#09131b', '#0f2537', '#4ecdc4', '#cbe3db', '#e07a5f'];
  if (Array.isArray(obj.palette) && obj.palette.length >= 3) {
    palette = obj.palette.slice(0, 5).map(c => String(c).trim());
  }

  // Keeper
  const kObj = (obj.keeper && typeof obj.keeper === 'object') ? obj.keeper : {};
  const keeper = {
    name: typeof kObj.name === 'string' && kObj.name.trim() ? kObj.name.trim() : 'The Sector Proctor',
    personality: typeof kObj.personality === 'string' ? kObj.personality.trim() : 'observant and austere',
    idiom: typeof kObj.idiom === 'string' ? kObj.idiom.trim() : 'mechanical registers and physical telemetry',
    prefix: typeof kObj.prefix === 'string' && kObj.prefix.trim() ? kObj.prefix.trim() : 'Proctor'
  };

  // Laws
  let laws = [];
  if (Array.isArray(obj.laws) && obj.laws.length > 0) {
    laws = obj.laws.map(l => (typeof l === 'string' ? l.trim() : (l.rule || JSON.stringify(l)))).filter(Boolean);
  }
  if (laws.length === 0) {
    laws.push('Nothing entered into the registry can be undone.', 'The screen dims whenever unobserved.');
  }

  // Script
  let script = [];
  if (Array.isArray(obj.script) && obj.script.length > 0) {
    script = obj.script.map(s => String(s).trim()).filter(Boolean);
  }
  if (script.length === 0) {
    script.push(
      `[LARP SCRIPT MOUNTED // ${name}]`,
      `${keeper.prefix}: "The sector has been reconstituted from document storage."`,
      `[SYSTEM READY]`
    );
  }

  // Entities & Apps
  let entities = [];
  if (Array.isArray(obj.entities) && obj.entities.length > 0) {
    for (let i = 0; i < obj.entities.length; i++) {
      const e = obj.entities[i];
      if (!e || typeof e !== 'object') continue;

      const entName = (e.name || `app-${i + 1}`).toLowerCase().replace(/[^a-z0-9\-]/g, '-');
      const title = e.title || `Apparatus ${i + 1}`;
      const desc = e.desc || e.description || `An inhabited apparatus inside ${name}.`;

      const appSpec = (e.app && typeof e.app === 'object') ? e.app : {};
      const format = appSpec.format || e.format || 'gauge';
      const appTitle = appSpec.title || title.toUpperCase();
      const appScreen = appSpec.screen || desc;

      const elemSpec = (appSpec.element && typeof appSpec.element === 'object') ? appSpec.element : {};
      const actionName = elemSpec.action || 'operate';
      const elemName = elemSpec.name || `${entName}-control`;
      const elemLabel = elemSpec.label || `Operate ${title}`;
      const elemType = elemSpec.type || 'dial';
      const elemState = elemSpec.state || 'ready';
      const responses = (elemSpec.responses && typeof elemSpec.responses === 'object')
        ? elemSpec.responses
        : { [actionName]: `You activate the ${elemLabel}. The mechanism responds.` };

      const element = {
        name: elemName,
        label: elemLabel,
        type: elemType,
        state: elemState,
        action: actionName,
        responses,
        currentValue: elemState
      };

      entities.push({
        name: entName,
        title,
        kind: e.kind || 'apparatus',
        desc,
        reachVerbs: Array.isArray(e.reachVerbs) && e.reachVerbs.length > 0 ? e.reachVerbs : [actionName, 'inspect'],
        responses: (e.responses && typeof e.responses === 'object') ? e.responses : { [actionName]: responses[actionName] },
        app: {
          title: appTitle,
          format,
          screen: appScreen,
          element,
          elements: [element]
        }
      });
    }
  }

  if (entities.length === 0) {
    entities.push({
      name: 'core-instrument',
      title: 'Core Instrument',
      kind: 'apparatus',
      desc: `The central apparatus identified within ${name}.`,
      reachVerbs: ['inspect', 'operate'],
      responses: { inspect: 'The needle hovers at steady oscillation.', operate: 'The instrument clicks into gear.' },
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

  // Bin commands
  let binCommands = [];
  if (Array.isArray(obj.bin)) {
    for (const b of obj.bin) {
      if (b && b.name) {
        binCommands.push({
          name: String(b.name).toLowerCase().trim(),
          behavior: b.behavior || b.desc || 'Custom bin command.'
        });
      }
    }
  }

  // Verbs
  const openVerb = obj.openVerb || 'open';
  const homeVerb = obj.homeVerb || 'home';
  const helpVerb = obj.helpVerb || 'help';
  const reseedVerb = obj.reseedVerb || 'reseed';

  const verbs = [
    { name: helpVerb, help: `${helpVerb} — consult the world verbs and operational laws.` },
    { name: openVerb, help: `${openVerb} [app] — open an apparatus running screen.` },
    { name: homeVerb, help: `${homeVerb} — step back to the system overview.` },
    { name: reseedVerb, help: `${reseedVerb} — dissolve reality and return to concept prompt.` }
  ];

  if (Array.isArray(obj.verbs)) {
    for (const v of obj.verbs) {
      if (v && v.name && !verbs.some(ex => ex.name.toLowerCase() === v.name.toLowerCase())) {
        verbs.push({ name: v.name.toLowerCase(), help: v.help || `${v.name} verb` });
      }
    }
  }

  const seed = obj.seed || ('0x' + Buffer.from(name).toString('hex').slice(0, 8));

  return {
    name,
    theme,
    concept,
    interface: iface,
    palette,
    keeper,
    entities,
    laws,
    bin: binCommands,
    script,
    verbs,
    seed,
    openVerb,
    homeVerb,
    helpVerb,
    reseedVerb,
    isParsedFromLarp: true,
    isLLM: !!obj.isLLM
  };
}

// Combinatorial heuristic fallback (offline approximation only — loose text still yields valid world)
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
      reachVerbs: ['inspect', 'operate'],
      responses: { inspect: 'The needle hovers at steady oscillation.', operate: 'The instrument cycles its power relay.' },
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

function parseLarpSync(content) {
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
    if (rawLine.startsWith('#')) continue;

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

  const verbs = [
    { name: worldMeta.helpVerb, help: `${worldMeta.helpVerb} — consult the world verbs and operational laws.` },
    { name: worldMeta.openVerb, help: `${worldMeta.openVerb} [app] — open an apparatus running screen.` },
    { name: worldMeta.homeVerb, help: `${worldMeta.homeVerb} — step back to the system overview.` },
    { name: worldMeta.reseedVerb, help: `${worldMeta.reseedVerb} — dissolve reality and return to concept prompt.` }
  ];

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

// Section 8: The 'parse' path must be the LLM reading the file and producing the world spec,
// with a combinatorial best-effort offline fallback.
async function parseLarp(content, options = {}) {
  const disableLLM = options.disableLLM || process.env.LLM_DISABLED === '1';
  if (disableLLM) {
    return parseLarpSync(content);
  }

  const llm = getLLMModule();
  const baseUrl = options.llmBase || llm.getLLMBase();
  const probeTimeout = options.probeTimeout || 1500;
  const timeout = options.timeout || 25000;

  try {
    const model = await llm.getModelName(baseUrl, probeTimeout);
    if (!model) {
      return parseLarpSync(content);
    }

    const systemPrompt = [
      'You are the LarpOS interpreter. You read loose .larp scripts and subjectively interpret them into an inhabited operating system world.',
      'There is NO required schema. Structure in the script is optional and non-normative.',
      'Reader-not-validator policy:',
      '- Read the document however it subjectively feels.',
      '- A section that reads like an app becomes an openable app with an interactive control (dial/valve/lever/toggle/aperture/button).',
      '- A rule, warning, or operational constraint becomes a world law.',
      '- A command or tool becomes a local bin command.',
      '- Garbled, corrupted, or incoherent text is interpreted as in-world damage, glitched lore, or an uncanny artifact — NEVER a reject or error.',
      '- If something is missing, invent evocative details in the idiom of the world.',
      '',
      'You MUST reply with ONLY a single valid JSON object representing the world spec. No commentary or markdown formatting outside JSON.',
      'JSON Schema to produce:',
      '{',
      '  "name": "WORLD NAME",',
      '  "theme": "1-2 sentence description of the reality",',
      '  "concept": "intent concept or short summary",',
      '  "interface": "gui | tui | device | scene",',
      '  "palette": ["#bg", "#surface", "#accent", "#fg", "#dim"],',
      '  "keeper": {',
      '    "name": "Keeper Name",',
      '    "personality": "demeanor description",',
      '    "idiom": "metaphor and speech style",',
      '    "prefix": "Short Prefix"',
      '  },',
      '  "laws": ["Binding rule 1", "Binding rule 2"],',
      '  "entities": [',
      '    {',
      '      "name": "slug-name",',
      '      "title": "APPARATUS TITLE",',
      '      "kind": "apparatus",',
      '      "desc": "physical description",',
      '      "reachVerbs": ["inspect", "operate"],',
      '      "responses": { "operate": "in-world effect" },',
      '      "app": {',
      '        "title": "APPARATUS TITLE",',
      '        "format": "gauge | mirror | filing-cabinet | mouth | device | register | etc",',
      '        "screen": "full-viewport scene description in the world idiom",',
      '        "element": {',
      '          "name": "control-name",',
      '          "label": "Operate label",',
      '          "type": "dial | valve | lever | toggle | aperture | button",',
      '          "state": "primed",',
      '          "action": "turn | pull | flip | depress | open",',
      '          "responses": { "action": "tactile effect description" }',
      '        }',
      '      }',
      '    }',
      '  ],',
      '  "bin": [',
      '    {',
      '      "name": "command-name",',
      '      "behavior": "one-line in-world behavior description"',
      '    }',
      '  ],',
      '  "script": ["opening monologue line 1", "line 2", "line 3"],',
      '  "verbs": [',
      '    { "name": "help", "help": "help — consult the world verbs and operational laws." },',
      '    { "name": "open", "help": "open [app] — open an apparatus running screen." },',
      '    { "name": "home", "help": "home — step back to the system overview." },',
      '    { "name": "reseed", "help": "reseed — dissolve reality and return to concept prompt." }',
      '  ]',
      '}'
    ].join('\n');

    const userMessage = [
      'Here is the .larp script document to interpret:',
      '---',
      String(content || '').trim(),
      '---',
      'Interpret it now into a complete valid world spec JSON object.'
    ].join('\n');

    const rawResponse = await llm.chatCompletion(baseUrl, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      reasoning_effort: 'none',
      temperature: 0.7,
      max_tokens: 3500,
      timeout
    });

    if (rawResponse && typeof rawResponse === 'string') {
      const parsedJSON = extractJSON(rawResponse);
      if (parsedJSON) {
        parsedJSON.isLLM = true;
        const normalized = normalizeInterpretedWorld(parsedJSON, content);
        if (normalized) {
          return normalized;
        }
      }
    }
  } catch (_) {
    // Fall back cleanly to combinatorial heuristics
  }

  return parseLarpSync(content);
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

  // Sidecar design spec (design/composition.md §3.1)
  if (world.designSpec) {
    try {
      const cleanSeed = String(world.seed || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const sidecarPath = path.join(dir, `world-${cleanSeed}.design.json`);
      fs.writeFileSync(sidecarPath, JSON.stringify(world.designSpec, null, 2), 'utf8');
    } catch (_) {}
  }

  return filePath;
}

async function readWorldLarp(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return await parseLarp(content, options);
}

function readWorldLarpSync(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return parseLarpSync(content);
}

// Section 10: Live rewriting watches the active .larp file and re-interprets on change
// using the same LLM-read path.
function watchWorldLarp(filePath, onChangeCallback, options = {}) {
  if (!fs.existsSync(filePath)) return null;

  let lastMtime = fs.statSync(filePath).mtimeMs;
  let debounceTimer = null;
  let isInterpreting = false;

  const trigger = async () => {
    try {
      if (!fs.existsSync(filePath) || isInterpreting) return;
      const curMtime = fs.statSync(filePath).mtimeMs;
      if (curMtime !== lastMtime) {
        lastMtime = curMtime;
        isInterpreting = true;
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const updatedWorld = await parseLarp(content, options);
          if (updatedWorld && onChangeCallback) {
            onChangeCallback(updatedWorld);
          }
        } finally {
          isInterpreting = false;
        }
      }
    } catch (_) {
      isInterpreting = false;
    }
  };

  let watcher = null;
  try {
    watcher = fs.watch(filePath, (event) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(trigger, 60);
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
  parseLarpSync,
  interpretLarpWithLLM: parseLarp,
  getWorldLarpPath,
  writeWorldLarp,
  readWorldLarp,
  readWorldLarpSync,
  watchWorldLarp
};
