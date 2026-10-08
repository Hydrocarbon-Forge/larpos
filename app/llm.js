// app/llm.js — OpenAI-compatible local LLM client for LarpOS
// Zero dependencies (plain Node.js http/url).

const http = require('http');
const { PRNG } = require('./prng');

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

async function generateWorldWithLLM(seedInput, options = {}) {
  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return null;
  }

  const baseUrl = options.llmBase || getLLMBase();
  const model = await getModelName(baseUrl, options.probeTimeout || 2000);
  if (!model) {
    return null;
  }

  const prng = new PRNG(seedInput);
  const hexSeed = prng.hexSeed;

  const systemPrompt = [
    'You are the world engine for LarpOS, an operating system that is an eerie, hallucinated reality.',
    'You must generate an inhabited, strange, coherent world spec based on the given seed.',
    'Respond ONLY with a single raw JSON object matching the required schema.',
    'Do not wrap in markdown code blocks. No commentary before or after.',
    'Schema requirements:',
    '- name: string (e.g. "STATION NINE // GLASS REACHES" or "CAR-04 // LINE OF ASH")',
    '- theme: string (evocative one-line genre/setting description)',
    '- palette: array of 4-5 CSS hex colors suited to the atmosphere (e.g. ["#09131b", "#0f2537", "#4ecdc4", "#cbe3db", "#e07a5f"])',
    '- keeper: object with { name: string, personality: string, idiom: string, prefix: string }',
    '- entities: array of 4-6 objects with { name: string (slug), title: string, kind: string, desc: string, reachVerbs: array of strings, responses: object mapping verb to 1-3 lines of tactile fiction }',
    '- laws: array of 2-4 strange, specific system laws',
    '- verbs: array of 5-7 objects with { name: string, help: string }',
    '- script: array of 3-6 lines of opening monologue / boot telemetry in keeper voice',
    '- helpVerb: string (the world-specific verb for help)',
    '- reseedVerb: string (the world-specific verb for rebooting/reseeding)'
  ].join('\n');

  const userPrompt = `Generate a completely coherent, original LarpOS world for SEED: ${hexSeed}. Make it read as inhabited fiction with tactile consistency.`;

  try {
    const rawOutput = await chatCompletion(baseUrl, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.75,
      max_tokens: 2400,
      timeout: options.timeout || 35000
    });

    const parsed = extractJSON(rawOutput);
    if (!parsed) return null;

    // Validate essential schema fields
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    if (typeof parsed.theme !== 'string' || !parsed.theme.trim()) return null;
    if (!Array.isArray(parsed.palette) || parsed.palette.length < 3) return null;
    if (!parsed.keeper || typeof parsed.keeper.name !== 'string' || !parsed.keeper.prefix) return null;
    if (!Array.isArray(parsed.entities) || parsed.entities.length < 4) return null;
    if (!Array.isArray(parsed.laws) || parsed.laws.length < 2) return null;
    if (!Array.isArray(parsed.verbs) || parsed.verbs.length < 5) return null;
    if (!Array.isArray(parsed.script) || parsed.script.length < 3) return null;

    const verbs = parsed.verbs.map(v => ({
      name: (v.name || '').toLowerCase().trim(),
      help: v.help || `${v.name} — interact with the world.`
    })).filter(v => v.name.length > 0);

    const helpVerb = (parsed.helpVerb || (verbs[0] && verbs[0].name) || 'help').toLowerCase();
    const reseedVerb = (parsed.reseedVerb || (verbs[verbs.length - 1] && verbs[verbs.length - 1].name) || 'reseed').toLowerCase();

    // Normalize entities
    const entities = parsed.entities.map(e => {
      const slug = (e.name || e.title || 'entity').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const title = e.title || e.name || 'Entity';
      const desc = e.desc || e.description || 'A strange presence in this system.';
      const responses = e.responses && typeof e.responses === 'object' ? { ...e.responses } : {};

      // Match reachVerbs against world verbs if possible
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

      return {
        name: slug || 'entity',
        title,
        kind: e.kind || 'inhabited thing',
        desc,
        reachVerbs,
        responses
      };
    });

    return {
      name: parsed.name.trim(),
      theme: parsed.theme.trim(),
      palette: parsed.palette,
      keeper: {
        name: parsed.keeper.name,
        personality: parsed.keeper.personality || 'mysterious and observant',
        idiom: parsed.keeper.idiom || 'cryptic technical jargon',
        prefix: parsed.keeper.prefix || parsed.keeper.name.split(' ')[0]
      },
      entities,
      laws: parsed.laws,
      verbs: parsed.verbs.map(v => ({
        name: (v.name || '').toLowerCase(),
        help: v.help || `${v.name} — interact with the world.`
      })),
      script: parsed.script,
      seed: hexSeed,
      helpVerb,
      reseedVerb,
      isLLM: true
    };
  } catch (err) {
    // If LLM times out or errors, return null so caller falls back
    return null;
  }
}

async function generateCommandResponseWithLLM(world, text, history = [], options = {}) {
  if (options.disableLLM || process.env.LLM_DISABLED === '1') {
    return null;
  }

  const baseUrl = options.llmBase || getLLMBase();
  const model = await getModelName(baseUrl, options.probeTimeout || 1500);
  if (!model) {
    return null;
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
    `Known Verbs: ${verbsStr}. Help verb is "${world.helpVerb}". Reseed verb is "${world.reseedVerb}".`,
    `Instructions:`,
    `- Respond strictly in character as ${keeper.prefix}.`,
    `- Keep responses concise: 1 to 3 evocative sentences.`,
    `- Never break character. You are NOT an AI assistant, you are the keeper of this world.`,
    `- If the user interacts with an entity, describe the uncanny result in tactile detail.`,
    `- If the command is unrecognized, react in-character with your idiom (do NOT say "command not found").`,
    `- If the user asks for help or says "${world.helpVerb}", guide them in character using your available verbs.`
  ].join('\n');

  const messages = [{ role: 'system', content: systemPrompt }];

  // Add recent context (up to 3 exchanges)
  const recentTurns = history.slice(-3);
  for (const h of recentTurns) {
    if (h.text && h.out) {
      messages.push({ role: 'user', content: h.text });
      messages.push({ role: 'assistant', content: h.out });
    }
  }

  messages.push({ role: 'user', content: text });

  try {
    const reply = await chatCompletion(baseUrl, model, messages, {
      temperature: 0.7,
      max_tokens: 800,
      timeout: options.timeout || 10000
    });

    if (reply && reply.trim()) {
      return reply.trim();
    }
  } catch (_) {
    // Return null to trigger fallback
  }

  return null;
}

module.exports = {
  getLLMBase,
  getModelName,
  chatCompletion,
  generateWorldWithLLM,
  generateCommandResponseWithLLM
};
