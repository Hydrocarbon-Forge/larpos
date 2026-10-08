// app/llm.js — OpenAI-compatible local LLM client for LarpOS
// Zero dependencies (plain Node.js http/url).
// Guarantees automatic fallback to combinatorial generator on ANY failure (never resolves to null).

const http = require('http');
const { PRNG } = require('./prng');
function getWorldModule() {
  return require('./world');
}

function getLarpModule() {
  return require('./larp');
}

function getLLMBase() {
  return process.env.LLM_BASE || 'http://192.168.1.72:8080';
}

function fetchJSON(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const reqOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 3000
      };

      const req = http.request(url, reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Invalid JSON: ${err.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Request timed out after ${reqOptions.timeout}ms`));
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function getModelName(baseUrl, timeout = 2500) {
  try {
    const data = await fetchJSON(`${baseUrl}/v1/models`, { timeout });
    if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].id) {
      return data.data[0].id;
    }
    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      return data.models[0].name || data.models[0].model;
    }
  } catch (_) {
    // Unreachable or timed out
  }
  return null;
}

async function chatCompletion(baseUrl, model, messages, options = {}) {
  const payload = JSON.stringify({
    model,
    messages,
    reasoning_effort: options.reasoning_effort || 'none',
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    max_tokens: options.max_tokens || 800
  });

  const res = await fetchJSON(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    body: payload,
    timeout: options.timeout || 10000
  });

  const choice = res.choices && res.choices[0];
  if (!choice) return null;
  const msg = choice.message;
  if (!msg) return null;

  if (msg.content && msg.content.trim()) {
    return msg.content.trim();
  }
  if (msg.reasoning_content && msg.reasoning_content.trim()) {
    return msg.reasoning_content.trim();
  }
  return null;
}

function extractJSON(text) {
  if (!text) return null;
  let clean = text.trim();
  // Strip markdown code fences if model enclosed JSON
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  // Try to find matching outer braces if extra text exists
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (_) {
    return null;
  }
}

function defaultCommandFallback(world, rawText) {
  const text = (rawText || '').trim();
  if (!text) {
    return `${world.keeper.prefix}: "The silence is thick enough to carve with a knife. Speak, or the chamber forgets you."`;
  }
  const lower = text.toLowerCase();
  const isHelp = (lower === 'help' || lower === '?' || lower === (world.helpVerb || '').toLowerCase());
  if (isHelp) {
    const verbList = (world.verbs || []).map(v => `  - ${v.name.toUpperCase()}: ${v.help}`).join('\n');
    const lawsList = (world.laws || []).map((l, i) => `  [Law ${i + 1}] ${l}`).join('\n');
    return `[${world.name} // SYSTEM REGISTER]\n${world.keeper.name} presiding.\nSYSTEM LAWS:\n${lawsList}\n\nOPERATIONAL VERBS:\n${verbList}`;
  }
  const matchedVerb = (world.verbs || []).find(v => v.name.toLowerCase() === lower);
  if (matchedVerb) {
    return `${world.keeper.prefix}: "${matchedVerb.help}"`;
  }
  for (const ent of (world.entities || [])) {
    if (lower.includes(ent.name.toLowerCase()) || lower.includes((ent.title || '').toLowerCase())) {
      const rv = (ent.reachVerbs || [])[0] || 'inspect';
      if (ent.responses && ent.responses[rv]) {
        return ent.responses[rv];
      }
      return `[${ent.title.toUpperCase()}]\n${ent.desc}\n${world.keeper.prefix}: "Reached via: ${(ent.reachVerbs || []).join(', ')}."`;
    }
  }
  return `${world.keeper.prefix}: "I have no ear for '${text}'. This place answers only to ${(world.verbs || []).map(v => v.name).join(', ')}."`;
}

async function generateWorldWithLLM(seedInput, options = {}) {
  const concept = (options.concept && String(options.concept).trim().toLowerCase() !== 'random')
    ? String(options.concept).trim()
    : 'random';

  const startTime = Date.now();
  const timeoutMs = options.timeout || parseInt(process.env.LARPOS_WORLD_TIMEOUT_MS, 10) || 120000;

  // Always prepare deterministic fallback for the exact same seed & concept
  const fallback = getWorldModule().generateWorld(seedInput, concept);
  fallback.concept = concept;
  fallback.generatedAt = Date.now();
  fallback.worldMeta = { concept, generatedAt: fallback.generatedAt };

  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return fallback;
  }

  const baseUrl = options.llmBase || getLLMBase();

  try {
    const model = await getModelName(baseUrl, options.probeTimeout || 2000);
    if (!model) {
      fallback.llmFailed = true;
      fallback.source = 'combinatorial';
      return fallback;
    }

    const prng = new PRNG(seedInput);
    const hexSeed = prng.hexSeed;

    const isPracticalDesktop = /practical|lightweight|desktop|fast|minimal|linux|work|office|utility/i.test(concept);

    let conceptInstruction;
    if (isPracticalDesktop) {
      conceptInstruction = [
        `INTENT SEED / CONCEPT: "${concept}".`,
        'CRITICAL TONE DIRECTIVE: The user wants a clean, highly practical and lightweight desktop operating system.',
        'The OS MUST have an authentic, clean computer/Linux texture (file manager, text editor, terminal emulator, system monitor, taskbar, system settings).',
        'Do NOT default to strange eerie mystical or horror fiction. Strangeness should appear ONLY as subtle light seasoning within normal computer reality.',
        'The interface MUST be "gui". Default keeper should be a system administrator or process supervisor.',
        'Entities must represent genuine desktop tools and system applications.'
      ].join(' ');
    } else if (concept !== 'random') {
      conceptInstruction = [
        `INTENT SEED / CONCEPT: "${concept}".`,
        `The entire operating system MUST be deeply and coherently shaped by this concept: theme, keeper, laws, entities, apps, and vocabulary.`
      ].join(' ');
    } else {
      conceptInstruction = 'INTENT SEED / CONCEPT: (none - you may manifest a strange, eerie, poetic inhabited hallucinated reality).';
    }

    const systemPrompt = [
      'You are the world engine for LarpOS, an operating system generator that manifests inhabited operating systems conditioned on user concept prompts.',
      'You must generate a coherent world spec matching the requested concept and seed.',
      conceptInstruction,
      'Every entity in the system is also an openable application written into the Larp script.',
      'Respond ONLY with a single raw JSON object matching the required schema.',
      'Do not wrap in markdown code blocks. No commentary before or after.',
      'Schema requirements:',
      '- name: string (e.g. "STATION NINE // GLASS REACHES" or "CAR-04 // LINE OF ASH")',
      '- theme: string (evocative one-line genre/setting description reflecting the concept)',
      '- concept: string (normalized short concept string)',
      '- palette: array of 4-5 CSS hex colors suited to the atmosphere (e.g. ["#09131b", "#0f2537", "#4ecdc4", "#cbe3db", "#e07a5f"])',
      '- keeper: object with { name: string, personality: string, idiom: string, prefix: string }',
      '- entities: array of 4-6 objects with {',
      '    name: string (slug),',
      '    title: string,',
      '    kind: string,',
      '    desc: string,',
      '    reachVerbs: array of strings,',
      '    responses: object mapping verb to 1-3 lines of tactile fiction,',
      '    app: {',
      '      title: string (app title in world idiom),',
      '      format: string (physical metaphor: e.g. gauge, mirror, filing-cabinet, mouth, valve, dial, lever, loom, retort),',
      '      screen: string (full-viewport running scene description in 2-4 evocative sentences),',
      '      element: {',
      '        name: string (slug for control),',
      '        label: string (action label for user button/control),',
      '        type: string (one of: "dial", "valve", "lever", "toggle", "slider", "button", "aperture"),',
      '        state: string (initial physical state),',
      '        action: string (primary interaction verb),',
      '        responses: object mapping action to evocative in-world outcome',
      '      }',
      '    }',
      '  }',
      '- laws: array of 2-4 strange, specific system laws',
      '- verbs: array of 5-8 objects with { name: string, help: string }',
      '- script: array of 3-6 lines of opening monologue / boot telemetry in keeper voice',
      '- helpVerb: string (the world-specific verb for help)',
      '- reseedVerb: string (the world-specific verb for rebooting/reseeding)',
      '- interface: string ("gui" | "tui" | "device" | "scene", steered by the concept)',
      '- bin: array of 2-3 objects with { name: string, behavior: string } (custom commands for local bin)',
      '- openVerb: string (the world-specific verb for opening an app, e.g. "unveil", "trepan", "board", "unfold")',
      '- homeVerb: string (the world-specific verb for returning to the overview, e.g. "watch", "vault", "berth", "selvedge")'
    ].join('\n');

    const userPrompt = `Generate a completely coherent, original LarpOS world for SEED: ${hexSeed}. Concept: "${concept}". Make it read as inhabited fiction with tactile consistency.`;

    const rawOutput = await chatCompletion(baseUrl, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.75,
      max_tokens: 2800,
      timeout: timeoutMs
    });

    const parsed = extractJSON(rawOutput);
    if (!parsed) {
      const duration = Date.now() - startTime;
      console.log(`[LarpOS] LLM world generation returned unparsable output after ${duration}ms, falling back to combinatorial (seed: ${hexSeed}, concept: "${concept}")`);
      fallback.llmFailed = true;
      fallback.source = 'combinatorial';
      return fallback;
    }

    // Validate and normalize essential schema fields
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
      const duration = Date.now() - startTime;
      console.log(`[LarpOS] LLM world generation schema invalid (missing name) after ${duration}ms, falling back to combinatorial (seed: ${hexSeed}, concept: "${concept}")`);
      fallback.llmFailed = true;
      fallback.source = 'combinatorial';
      return fallback;
    }
    if (typeof parsed.theme !== 'string' || !parsed.theme.trim()) {
      const duration = Date.now() - startTime;
      console.log(`[LarpOS] LLM world generation schema invalid (missing theme) after ${duration}ms, falling back to combinatorial (seed: ${hexSeed}, concept: "${concept}")`);
      fallback.llmFailed = true;
      fallback.source = 'combinatorial';
      return fallback;
    }

    // Palette normalization (accepts array or object map of hex colors)
    let palette = parsed.palette;
    if (!Array.isArray(palette) && palette && typeof palette === 'object') {
      palette = Object.values(palette).filter(c => typeof c === 'string' && c.startsWith('#'));
    }
    if (!Array.isArray(palette) || palette.length < 3) return fallback;

    // Keeper normalization (accepts object or string name)
    let keeper = parsed.keeper;
    if (typeof keeper === 'string') {
      keeper = {
        name: keeper,
        personality: 'mysterious and observant keeper of records',
        idiom: 'cryptic catalog entries and quiet observations',
        prefix: keeper.split(' ')[0]
      };
    }
    if (!keeper || typeof keeper.name !== 'string' || !keeper.name.trim()) return fallback;

    // Entities normalization
    if (!Array.isArray(parsed.entities) || parsed.entities.length < 4) return fallback;
    if (!Array.isArray(parsed.laws) || parsed.laws.length < 2) return fallback;
    if (!Array.isArray(parsed.verbs) || parsed.verbs.length < 5) return fallback;
    if (!Array.isArray(parsed.script) || parsed.script.length < 3) return fallback;

    const verbs = parsed.verbs.map(v => ({
      name: (v.name || '').toLowerCase().trim(),
      help: v.help || `${v.name} — interact with the world.`
    })).filter(v => v.name.length > 0);

    const helpVerb = (parsed.helpVerb || (verbs[0] && verbs[0].name) || 'help').toLowerCase();
    const reseedVerb = (parsed.reseedVerb || (verbs[verbs.length - 1] && verbs[verbs.length - 1].name) || 'reseed').toLowerCase();
    const openVerb = (parsed.openVerb || 'open').toLowerCase();
    const homeVerb = (parsed.homeVerb || 'home').toLowerCase();

    // Ensure openVerb and homeVerb exist in verbs list
    if (!verbs.some(v => v.name === openVerb)) {
      verbs.push({ name: openVerb, help: `${openVerb} [app] — open an apparatus and enter its running screen.` });
    }
    if (!verbs.some(v => v.name === homeVerb)) {
      verbs.push({ name: homeVerb, help: `${homeVerb} — step back from the running apparatus to the system overview.` });
    }

    const entities = parsed.entities.map(e => {
      const slug = (e.name || e.id || e.title || 'entity').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const title = e.title || e.name || e.id || 'Entity';
      const desc = e.desc || e.description || 'A strange presence in this system.';
      const responses = e.responses && typeof e.responses === 'object' ? { ...e.responses } : {};

      let reachVerbs = Array.isArray(e.reachVerbs) ? e.reachVerbs.map(v => v.toLowerCase().trim()) : [];
      if (reachVerbs.length === 0) {
        const available = verbs.filter(v => v.name !== helpVerb && v.name !== reseedVerb).map(v => v.name);
        reachVerbs = available.length > 0 ? [available[0]] : ['inspect'];
      }

      for (const rv of reachVerbs) {
        if (!responses[rv]) {
          responses[rv] = `You interact with the ${title}. ${desc}`;
        }
      }

      // App normalization
      let app = e.app;
      if (!app || typeof app !== 'object') {
        app = {
          title: `${title.toUpperCase()} INTERFACE`,
          format: 'gauge',
          screen: desc,
          element: {
            name: `${slug}-control`,
            label: `Operate ${title}`,
            type: 'dial',
            state: 'primed',
            action: reachVerbs[0] || 'turn',
            responses: { [reachVerbs[0] || 'turn']: `You operate the ${title}. ${desc}` }
          }
        };
      }

      const appElem = (app.element && typeof app.element === 'object') ? {
        name: app.element.name || `${slug}-control`,
        label: app.element.label || `Operate ${title}`,
        type: ['dial', 'valve', 'lever', 'toggle', 'slider', 'button', 'aperture'].includes(app.element.type) ? app.element.type : 'button',
        state: app.element.state || 'ready',
        action: app.element.action || reachVerbs[0] || 'operate',
        responses: app.element.responses && typeof app.element.responses === 'object' ? app.element.responses : {
          [app.element.action || reachVerbs[0] || 'operate']: `You activate the ${title}.`
        }
      } : {
        name: `${slug}-control`,
        label: `Operate ${title}`,
        type: 'button',
        state: 'ready',
        action: reachVerbs[0] || 'operate',
        responses: { [reachVerbs[0] || 'operate']: `You activate the ${title}.` }
      };

      const normalizedApp = {
        title: app.title || `${title.toUpperCase()} INTERFACE`,
        format: app.format || 'gauge',
        screen: app.screen || desc,
        element: appElem,
        elements: [appElem]
      };

      return {
        name: slug || 'entity',
        title,
        kind: e.kind || 'inhabited thing',
        desc,
        reachVerbs,
        responses,
        app: normalizedApp
      };
    });

    let iface = ['gui', 'tui', 'device', 'scene'].includes(parsed.interface) ? parsed.interface : fallback.interface;
    let bin = Array.isArray(parsed.bin) ? parsed.bin.map(b => ({
      name: String(b.name || 'cmd').toLowerCase().trim(),
      behavior: String(b.behavior || 'System command').trim()
    })) : fallback.bin;

    for (const b of bin) {
      if (!verbs.some(v => v.name === b.name)) {
        verbs.push({ name: b.name, help: `${b.name} — ${b.behavior}` });
      }
    }

    const world = {
      name: parsed.name.trim(),
      theme: parsed.theme.trim(),
      concept: parsed.concept || concept,
      interface: iface,
      palette,
      keeper: {
        name: keeper.name,
        personality: keeper.personality || 'mysterious and observant',
        idiom: keeper.idiom || 'cryptic technical jargon',
        prefix: keeper.prefix || keeper.name.split(' ')[0]
      },
      entities,
      laws: parsed.laws,
      verbs,
      bin,
      script: parsed.script,
      seed: hexSeed,
      helpVerb,
      reseedVerb,
      openVerb,
      homeVerb,
      isLLM: true,
      generatedAt: Date.now(),
      worldMeta: { concept: parsed.concept || concept, generatedAt: Date.now() }
    };

    const duration = Date.now() - startTime;
    console.log(`[LarpOS] World generation completed via LLM in ${duration}ms (seed: ${hexSeed}, concept: "${concept}")`);

    try {
      const { generateDesignSpec } = require('./design');
      world.designSpec = generateDesignSpec(world);
    } catch (_) {}

    try {
      getLarpModule().writeWorldLarp(world);
    } catch (_) {}

    return world;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(`[LarpOS] LLM world generation failed or timed out after ${duration}ms, falling back to combinatorial: ${err.message} (seed: ${seedInput}, concept: "${concept}")`);
    fallback.llmFailed = true;
    fallback.source = 'combinatorial';
    return fallback;
  }
}

async function interpretAppWithLLM(world, entityQuery, options = {}) {
  const clean = String(entityQuery || '').toLowerCase().trim();
  const entity = (world && world.entities ? world.entities.find(e =>
    e.name.toLowerCase() === clean ||
    (e.title && e.title.toLowerCase() === clean) ||
    (e.aliases && e.aliases.some(a => a.toLowerCase() === clean))
  ) : null) || (world && world.entities ? world.entities[0] : null);

  if (!entity) {
    return getWorldModule().createDamagedAppShell(world, entityQuery, 'Entity not found');
  }

  // Combinatorial fallback for this app
  const fallback = getWorldModule().interpretAppCombinatorial(world, entity.name);

  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return fallback;
  }

  const baseUrl = options.llmBase || getLLMBase();

  try {
    const model = await getModelName(baseUrl, options.probeTimeout || 1500);
    if (!model) {
      return fallback;
    }

    const systemPrompt = [
      'You are the LarpOS live application interpreter.',
      'The Larp script is the whole OS as a document; you instantiate an app script section live at open time.',
      'Interpretation policy:',
      'You are a reader, not a validator. The Larp script is made up by the AI, so there is no ground truth a line could be wrong against.',
      'Interpret the app script and its physical idiom subjectively into a live, running tactile screen.',
      `World: "${world.name}"`,
      `Theme: "${world.theme}"`,
      `Keeper: ${world.keeper.name} (${world.keeper.idiom})`,
      `Palette: ${world.palette.join(', ')}`,
      '',
      'Respond ONLY with a single raw JSON object matching this schema:',
      '{',
      '  "title": string (title of the app),',
      '  "format": string (physical metaphor: gauge, mirror, filing-cabinet, mouth, valve, dial, lever, etc.),',
      '  "screen": string (full-viewport running scene description in the world idiom in 2-4 evocative sentences),',
      '  "statusLine": string (one-line telemetry readout in the world idiom),',
      '  "element": {',
      '    "name": string (control slug),',
      '    "label": string (imperative action label),',
      '    "type": string (one of: "dial", "valve", "lever", "toggle", "slider", "button", "aperture"),',
      '    "state": string (current physical state),',
      '    "action": string (primary verb),',
      '    "responses": {',
      '      "<action>": string (evocative in-world outcome)',
      '    }',
      '  }',
      '}'
    ].join('\n');

    const appSpec = entity.app || {
      title: entity.title.toUpperCase(),
      format: 'gauge',
      screen: entity.desc,
      element: {
        name: `${entity.name}-control`,
        label: `Operate ${entity.title}`,
        type: 'button',
        state: 'ready',
        action: 'operate',
        responses: { operate: 'The mechanism moves.' }
      }
    };

    const userPrompt = [
      `Instantiate this app script live into a running screen:`,
      `Entity: ${entity.name} (${entity.title})`,
      `Kind: ${entity.kind}`,
      `Format: ${appSpec.format}`,
      `Script: ${appSpec.screen}`,
      `Base Control: ${JSON.stringify(appSpec.element)}`
    ].join('\n');

    const rawOutput = await chatCompletion(baseUrl, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.75,
      max_tokens: 1200,
      timeout: options.timeout || 12000
    });

    const parsed = extractJSON(rawOutput);

    // If unparsable or empty, check if we need the damaged app shell fallback
    if (!parsed || !parsed.screen || !parsed.element || !parsed.element.name) {
      return getWorldModule().createDamagedAppShell(world, entity.name, rawOutput || '');
    }

    const elem = {
      name: parsed.element.name || `${entity.name}-control`,
      label: parsed.element.label || `Operate ${entity.title}`,
      type: ['dial', 'valve', 'lever', 'toggle', 'slider', 'button', 'aperture'].includes(parsed.element.type) ? parsed.element.type : 'button',
      state: parsed.element.state || 'primed',
      action: parsed.element.action || 'engage',
      responses: (parsed.element.responses && typeof parsed.element.responses === 'object') ? parsed.element.responses : {
        [parsed.element.action || 'engage']: 'The apparatus hums with dark electricity.'
      },
      currentValue: parsed.element.state || 'primed'
    };

    return {
      entityName: entity.name,
      title: parsed.title || appSpec.title || entity.title.toUpperCase(),
      format: parsed.format || appSpec.format || 'gauge',
      screen: parsed.screen,
      statusLine: parsed.statusLine || `[${world.name} // ${parsed.format ? parsed.format.toUpperCase() : 'APPARATUS'}]`,
      element: elem,
      elements: [elem],
      palette: world.palette,
      isLLM: true
    };
  } catch (_) {
    // On transport failure, return combinatorial fallback so the kiosk never hangs
    return fallback;
  }
}

async function generateCommandResponseWithLLM(world, text, history = [], options = {}) {
  const getFallback = () => options.fallback ? options.fallback(world, text, history) : defaultCommandFallback(world, text);

  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return getFallback();
  }

  const baseUrl = options.llmBase || getLLMBase();

  try {
    const model = await getModelName(baseUrl, options.probeTimeout || 1500);
    if (!model) {
      return getFallback();
    }

    const keeper = world.keeper;
    const lawsStr = world.laws.map((l, i) => `[Law ${i + 1}] ${l}`).join('; ');
    const entitiesStr = world.entities.map(e => `${e.name} (${e.title})`).join(', ');
    const verbsStr = world.verbs.map(v => v.name).join(', ');

    const systemPrompt = [
      `You are ${keeper.name}, the resident keeper of the hallucinated OS "${world.name}".`,
      `Theme: ${world.theme}.`,
      `Your personality: ${keeper.personality}.`,
      `Your idiom: ${keeper.idiom}. Speaker prefix: ${keeper.prefix}.`,
      `Station Laws: ${lawsStr}.`,
      `Known Entities: ${entitiesStr}.`,
      `Known Verbs: ${verbsStr}. Help verb is "${world.helpVerb}". Reseed verb is "${world.reseedVerb}". Open verb is "${world.openVerb}". Home verb is "${world.homeVerb}".`,
      `Instructions:`,
      `- Respond strictly in character as ${keeper.prefix}.`,
      `- Keep responses concise: 1 to 3 evocative sentences.`,
      `- Never break character. You are NOT an AI assistant, you are the keeper of this world.`,
      `- If the user interacts with an entity or app, describe the uncanny result in tactile detail.`,
      `- If the command is unrecognized, react in-character with your idiom (do NOT say "command not found").`,
      `- If the user asks for help or says "${world.helpVerb}", guide them in character using your available verbs.`
    ].join('\n');

    const messages = [{ role: 'system', content: systemPrompt }];

    const recentTurns = history.slice(-3);
    for (const h of recentTurns) {
      if (h.text && h.out) {
        messages.push({ role: 'user', content: h.text });
        messages.push({ role: 'assistant', content: h.out });
      }
    }

    messages.push({ role: 'user', content: text });

    const reply = await chatCompletion(baseUrl, model, messages, {
      temperature: 0.7,
      max_tokens: 800,
      timeout: options.timeout || 10000
    });

    if (reply && reply.trim()) {
      return reply.trim();
    }
  } catch (_) {
    // Return fallback on any error
  }

  return getFallback();
}

module.exports = {
  getLLMBase,
  getModelName,
  chatCompletion,
  generateWorldWithLLM,
  interpretAppWithLLM,
  generateCommandResponseWithLLM
};
