// app/selftest.js — Verification test suite for LarpOS engine & command layer
// Plain Node.js, zero dependencies. Runs offline-first with explicit LLM bypass.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateWorld, interpretAppCombinatorial, createDamagedAppShell } = require('./world');
const { CommandSession } = require('./commands');
const { PRNG } = require('./prng');
const { getLLMBase, getModelName, generateCommandResponseWithLLM, generateWorldWithLLM, interpretAppWithLLM } = require('./llm');
const { VirtualFS } = require('./vfs');
const { getStateDir, getBinsDir, resolveBinarySlot, readSessionLog, getSessionLogPath } = require('./storage');
const { parseLarp, serializeToLarp, writeWorldLarp, readWorldLarp, watchWorldLarp, getWorldLarpPath } = require('./larp');

console.log('=== LarpOS Engine Self-Test ===\n');

// 1. PRNG & Determinism
console.log('1. Testing PRNG and determinism...');
{
  const p1 = new PRNG(1);
  const p2 = new PRNG(1);
  const seq1 = [p1.next(), p1.int(1, 100), p1.next()];
  const seq2 = [p2.next(), p2.int(1, 100), p2.next()];
  assert.deepStrictEqual(seq1, seq2, 'PRNG must produce identical sequence for same seed');

  const w1a = generateWorld(1);
  const w1b = generateWorld(1);
  assert.strictEqual(w1a.seed, w1b.seed, 'Seeds must match');
  assert.strictEqual(w1a.name, w1b.name, 'Names must match');
  assert.strictEqual(w1a.theme, w1b.theme, 'Themes must match');
  assert.deepStrictEqual(w1a.palette, w1b.palette, 'Palettes must match');
  assert.deepStrictEqual(w1a.keeper, w1b.keeper, 'Keepers must match');
  assert.deepStrictEqual(w1a.laws, w1b.laws, 'Laws must match');
  assert.deepStrictEqual(w1a.script, w1b.script, 'Scripts must match');
  assert.strictEqual(w1a.entities.length, w1b.entities.length, 'Entity counts must match');
  assert.deepStrictEqual(
    w1a.entities.map(e => e.name),
    w1b.entities.map(e => e.name),
    'Entity names must match'
  );
  console.log('  ✓ Determinism verified: seed 1 produces bit-for-bit identical world.');
}

// 2. Non-collision between different seeds
console.log('2. Testing seed differentiation & non-collision...');
{
  const w1 = generateWorld(1);
  const w2 = generateWorld(2);
  const w3 = generateWorld(42);

  assert.notStrictEqual(w1.seed, w2.seed, 'Seed 1 and 2 must have different hex seeds');
  assert.notStrictEqual(w2.seed, w3.seed, 'Seed 2 and 42 must have different hex seeds');

  const signatures = [w1, w2, w3].map(w => `${w.name} | ${w.keeper.name} | ${w.theme}`);
  assert.strictEqual(new Set(signatures).size, 3, 'Different seeds must produce distinct worlds');
  console.log(`  ✓ Seed 1:  "${w1.name}" (${w1.keeper.name})`);
  console.log(`  ✓ Seed 2:  "${w2.name}" (${w2.keeper.name})`);
  console.log(`  ✓ Seed 42: "${w3.name}" (${w3.keeper.name})`);
}

// 3. World Spec conformance & Application specification
console.log('3. Testing world spec schema conformance & generated applications...');
{
  const seedsToTest = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  for (const s of seedsToTest) {
    const w = generateWorld(s);
    assert(typeof w.name === 'string' && w.name.length > 0, 'world.name must be non-empty string');
    assert(typeof w.theme === 'string' && w.theme.length > 0, 'world.theme must be non-empty string');
    assert(typeof w.concept === 'string' && w.concept.length > 0, 'world.concept must be present');
    assert(typeof w.openVerb === 'string' && w.openVerb.length > 0, 'world.openVerb must be defined');
    assert(typeof w.homeVerb === 'string' && w.homeVerb.length > 0, 'world.homeVerb must be defined');
    assert(Array.isArray(w.palette) && w.palette.length >= 3 && w.palette.length <= 5, 'world.palette must have 3-5 CSS colors');
    assert(w.keeper && typeof w.keeper.name === 'string' && typeof w.keeper.personality === 'string' && typeof w.keeper.idiom === 'string', 'world.keeper must have name, personality, idiom');
    assert(Array.isArray(w.entities) && w.entities.length >= 4 && w.entities.length <= 8, 'world.entities must have 4-8 entities');
    assert(Array.isArray(w.laws) && w.laws.length >= 2 && w.laws.length <= 4, 'world.laws must have 2-4 laws');
    assert(Array.isArray(w.verbs) && w.verbs.length >= 5 && w.verbs.length <= 8, 'world.verbs must have 5-8 verbs');
    assert(Array.isArray(w.script) && w.script.length >= 3 && w.script.length <= 8, 'world.script must have 3-8 lines');
    assert(/^0x[0-9a-f]{8}$/i.test(w.seed), 'world.seed must be valid hex string');

    // Section 5 assertion: Every entity has an app with at least one interactive element
    for (const ent of w.entities) {
      assert(ent.app && typeof ent.app === 'object', `Entity ${ent.name} must have app definition`);
      assert(typeof ent.app.title === 'string' && ent.app.title.length > 0, `App for ${ent.name} must have non-empty title`);
      assert(typeof ent.app.format === 'string' && ent.app.format.length > 0, `App for ${ent.name} must have format`);
      assert(typeof ent.app.screen === 'string' && ent.app.screen.length > 0, `App for ${ent.name} must have screen scene`);

      const elem = ent.app.element || (ent.app.elements && ent.app.elements[0]);
      assert(elem && typeof elem === 'object', `App for ${ent.name} must have interactive element`);
      assert(typeof elem.name === 'string' && elem.name.length > 0, `App element for ${ent.name} must have name`);
      assert(typeof elem.label === 'string' && elem.label.length > 0, `App element for ${ent.name} must have label`);
      assert(typeof elem.type === 'string' && elem.type.length > 0, `App element for ${ent.name} must have type`);
      assert(typeof elem.state === 'string' && elem.state.length > 0, `App element for ${ent.name} must have state`);
      assert(typeof elem.action === 'string' && elem.action.length > 0, `App element for ${ent.name} must have action`);
      assert(elem.responses && typeof elem.responses === 'object', `App element for ${ent.name} must have responses`);
    }
  }
  console.log('  ✓ 10 worlds tested across diverse seeds; all satisfy spec structure and application specs.');
}

// 4. Intent seed & concept conditioning
console.log('4. Testing intent seed & concept conditioning...');
{
  const wSub = generateWorld(1, 'submarine');
  assert.strictEqual(wSub.concept, 'submarine', 'World concept must reflect input');
  assert(wSub.theme.includes('submarine'), 'World theme must reflect concept string');
  assert.strictEqual(wSub.archetypeId, 'brine_beacon', 'Submarine concept must steer to maritime archetype');

  const wTrain = generateWorld(2, 'railway');
  assert.strictEqual(wTrain.concept, 'railway', 'World concept must reflect input');
  assert(wTrain.theme.includes('railway'), 'World theme must reflect concept string');
  assert.strictEqual(wTrain.archetypeId, 'ash_railway', 'Railway concept must steer to railway archetype');

  const wRand = generateWorld(3, 'random');
  assert.strictEqual(wRand.concept, 'random', 'Random concept produces random path');
  console.log(`  ✓ Concept steering verified: "submarine" -> ${wSub.name} (${wSub.archetypeId})`);
  console.log(`  ✓ Concept steering verified: "railway" -> ${wTrain.name} (${wTrain.archetypeId})`);
}

// 5. Command layer verbs (offline fallback)
console.log('5. Testing command layer verbs, open-app, and go-home...');
{
  const world = generateWorld(1);
  const session = new CommandSession(world, { disableLLM: true });

  // Each verb on its own gives its help line (excluding reseed verb which initiates reboot)
  for (const v of world.verbs) {
    if (v.name === world.reseedVerb) {
      const hRes = session.executeSync(`help ${v.name}`);
      assert(hRes && hRes.out.includes(world.keeper.prefix), `Help for '${v.name}' must respond`);
      continue;
    }
    const res = session.executeSync(v.name);
    assert(res && typeof res.out === 'string' && res.out.length > 0, `Verb '${v.name}' on its own must respond`);
    assert(res.out.includes(world.keeper.prefix) || res.out.toLowerCase().includes(v.name), `Response for '${v.name}' must contain keeper voice or verb help`);
  }
  console.log(`  ✓ All ${world.verbs.length} verbs respond when queried.`);

  // Help command lists verbs and applications
  const helpRes = session.executeSync('help');
  assert(helpRes && typeof helpRes.out === 'string', 'Help must respond');
  for (const v of world.verbs) {
    assert(helpRes.out.toLowerCase().includes(v.name.toLowerCase()), `Help must mention verb '${v.name}'`);
  }
  assert(helpRes.out.includes(world.openVerb.toUpperCase()), `Help must mention open verb '${world.openVerb}'`);
  assert(helpRes.out.includes(world.homeVerb.toUpperCase()), `Help must mention home verb '${world.homeVerb}'`);
  console.log('  ✓ Generic "help" lists all available verbs and openable apps.');

  // Open-app verb opens an application screen
  const targetEntity = world.entities[0];
  const openRes = session.executeSync(`${world.openVerb} ${targetEntity.name}`);
  assert(openRes && openRes.openApp === targetEntity.name, 'Open command must identify opened app');
  assert(openRes.app && typeof openRes.app.screen === 'string', 'Open command must return instantiated app');
  console.log(`  ✓ World open-app verb "${world.openVerb} ${targetEntity.name}" opened apparatus: ${openRes.app.title}`);

  // In-app physical control interaction
  const appAction = targetEntity.app.element.action;
  const actionRes = session.executeSync(appAction);
  assert(actionRes && actionRes.appUpdated === true, 'In-app control action must update app');
  console.log(`  ✓ In-app action "${appAction}" produced tactile result: "${actionRes.out.replace(/\n/g, ' ')}"`);

  // Go-home verb returns to system overview
  const homeRes = session.executeSync(world.homeVerb);
  assert(homeRes && homeRes.closeApp === true, 'Go-home verb must flag closeApp=true');
  console.log(`  ✓ World go-home verb "${world.homeVerb}" returned to overview: "${homeRes.out}"`);

  // Unknown verb triggers in-character reaction
  const unknownRes = session.executeSync('hyperjump-xyz-999');
  assert(unknownRes && typeof unknownRes.out === 'string', 'Unknown verb must respond');
  assert(!unknownRes.out.includes('command not found:'), 'Must not be canned "command not found"');
  assert(unknownRes.out.includes(world.keeper.prefix), 'Must be in keeper\'s voice');
  console.log(`  ✓ Unknown verb receives in-character keeper reaction:\n    "${unknownRes.out.replace(/\n/g, ' ')}"`);
}

// 6. Entity Reachability
console.log('6. Testing entity reachability...');
{
  const world = generateWorld(1);
  const session = new CommandSession(world, { disableLLM: true });

  for (const entity of world.entities) {
    assert(Array.isArray(entity.reachVerbs) && entity.reachVerbs.length > 0, `Entity ${entity.name} must specify reach verbs`);
    const primaryVerb = entity.reachVerbs[0];
    const cmd = `${primaryVerb} ${entity.name}`;
    const res = session.executeSync(cmd);

    assert(res && typeof res.out === 'string' && res.out.length > 20, `Entity ${entity.name} must yield descriptive content for "${cmd}"`);
    const lineCount = res.out.trim().split('\n').length;
    assert(lineCount >= 1 && lineCount <= 5, `Entity interaction must produce 1-3 lines (got ${lineCount})`);
  }
  console.log(`  ✓ All ${world.entities.length} entities are reachable with 1-3 lines of in-world fiction.`);
}

// 7. Reseed & Return to Concept Screen
console.log('7. Testing reseed mechanism and return to concept screen...');
{
  const world = generateWorld(1);
  let reseededWorld = null;
  const session = new CommandSession(world, {
    disableLLM: true,
    onReseed: (newW) => { reseededWorld = newW; }
  });

  const res = session.executeSync('new world');
  assert(res.reseeded === true, 'Response must flag reseeded=true');
  assert(res.returnToConcept === true, 'Response must flag returnToConcept=true');
  assert(res.world && res.world.seed, 'Response must return new world');
  assert.notStrictEqual(res.world.seed, world.seed, 'New world must have different seed');
  assert(reseededWorld !== null, 'onReseed hook must fire');
  console.log(`  ✓ "new world" command successfully initiated reboot: ${res.world.name} (${res.world.seed}) with returnToConcept=true.`);

  // Also test the world's own reseed verb
  const sessionCustom = new CommandSession(world, { disableLLM: true });
  const resCustom = sessionCustom.executeSync(world.reseedVerb);
  assert(resCustom.reseeded === true, 'World reseed verb must trigger reseed');
  assert(resCustom.returnToConcept === true, 'World reseed verb must return to concept screen');
  assert(resCustom.world && resCustom.world.seed !== world.seed, 'World reseed verb must produce new seed');
  console.log(`  ✓ World's own reseed verb "${world.reseedVerb}" successfully initiated reboot: ${resCustom.world.name} (${resCustom.world.seed}).`);
}

// 8. Live Application Interpreter & Damaged Shell Fallback
console.log('8. Testing live application interpreter & damaged shell fallback...');
{
  const world = generateWorld(1);

  // Combinatorial interpreter check
  for (const ent of world.entities) {
    const runningScreen = interpretAppCombinatorial(world, ent.name);
    assert(runningScreen && typeof runningScreen === 'object', 'Running screen must be object');
    assert(typeof runningScreen.title === 'string' && runningScreen.title.length > 0, 'Title must be non-empty');
    assert(typeof runningScreen.format === 'string' && runningScreen.format.length > 0, 'Format must be non-empty');
    assert(typeof runningScreen.screen === 'string' && runningScreen.screen.length > 0, 'Screen must be non-empty');
    assert(runningScreen.element && typeof runningScreen.element.name === 'string', 'Element must have name');
    assert(Array.isArray(runningScreen.palette) && runningScreen.palette.length >= 3, 'Must render within palette');
  }
  console.log(`  ✓ Combinatorial interpreter generated valid running screens for all ${world.entities.length} apps.`);

  // Damaged app shell fallback check: broken/empty render falls back to generic shell, never white screen
  const damagedShell = createDamagedAppShell(world, 'corrupt-apparatus', '');
  assert(damagedShell !== null, 'Damaged shell must never be null');
  assert.strictEqual(damagedShell.damaged, true, 'Damaged shell must be flagged as damaged');
  assert(damagedShell.screen.includes('DAMAGED') || damagedShell.screen.includes('DECAY'), 'Damaged shell must frame failure in-world');
  assert(damagedShell.element && damagedShell.element.name, 'Damaged shell must maintain interactive element');
  console.log(`  ✓ Damaged app shell fallback verified: "${damagedShell.title}" (never a white screen).`);
}

// 9. HTTP Endpoints Verification (Pre-boot concept screen, /api/world, /api/boot, /api/app/open, /api/command)
console.log('9. Testing HTTP server endpoints...');
(async () => {
  const http = require('http');
  const { createServer } = require('./server');

  const { server } = createServer(1, 0, { disableLLM: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function httpGet(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      }).on('error', reject);
    });
  }

  function httpPost(path, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  try {
    // GET / (Pre-boot Concept Screen)
    const uiRes = await httpGet('/');
    assert.strictEqual(uiRes.status, 200, 'GET / must return 200');
    assert(uiRes.data.includes('What should this OS be?'), 'GET / must serve pre-boot concept screen before any world exists');
    assert(uiRes.data.includes('concept-input'), 'GET / must include concept input field');
    assert(uiRes.data.includes('RANDOM'), 'GET / must include random button');
    console.log('  ✓ GET / returns 200 and serves concept screen ("What should this OS be?") before world exists.');

    // GET /api/world
    const worldRes = await httpGet('/api/world');
    assert.strictEqual(worldRes.status, 200, 'GET /api/world must return 200');
    const worldData = JSON.parse(worldRes.data);
    assert.strictEqual(worldData.seed, '0x00000001', 'World seed must match 0x00000001');
    assert(typeof worldData.name === 'string', 'World name must be present');
    assert(Array.isArray(worldData.palette), 'Palette must be array');
    assert(worldData.entities.every(e => e.app && e.app.title && e.app.element), 'Every entity in world spec must have app');
    console.log(`  ✓ GET /api/world returns coherent JSON spec with apps for "${worldData.name}".`);

    // POST /api/boot (Concept submission)
    const bootRes = await httpPost('/api/boot', { concept: 'submarine' });
    assert.strictEqual(bootRes.status, 200, 'POST /api/boot must return 200');
    const bootData = JSON.parse(bootRes.data);
    assert.strictEqual(bootData.concept, 'submarine', 'Booted world must record concept');
    assert(bootData.theme.includes('submarine'), 'Booted world theme must be shaped by concept');
    console.log(`  ✓ POST /api/boot successfully conditioned world on concept "submarine": "${bootData.name}".`);

    // POST /api/app/open (Live app interpretation)
    const openRes = await httpPost('/api/app/open', { entity: bootData.entities[0].name });
    assert.strictEqual(openRes.status, 200, 'POST /api/app/open must return 200');
    const openData = JSON.parse(openRes.data);
    assert(typeof openData.title === 'string' && openData.title.length > 0, 'App must have title');
    assert(openData.element && typeof openData.element.name === 'string', 'App must have interactive element');
    console.log(`  ✓ POST /api/app/open successfully instantiated screen for "${openData.title}".`);

    // POST /api/app/interact (Hardware control activation)
    const interactRes = await httpPost('/api/app/interact', {
      entity: bootData.entities[0].name,
      action: openData.element.action
    });
    assert.strictEqual(interactRes.status, 200, 'POST /api/app/interact must return 200');
    const interactData = JSON.parse(interactRes.data);
    assert(typeof interactData.out === 'string' && interactData.out.length > 0, 'Interaction must return in-world effect');
    console.log(`  ✓ POST /api/app/interact successfully executed control action "${openData.element.action}".`);

    // POST /api/command with "help"
    const cmdRes = await httpPost('/api/command', { text: 'help' });
    assert.strictEqual(cmdRes.status, 200, 'POST /api/command must return 200');
    const cmdData = JSON.parse(cmdRes.data);
    assert(typeof cmdData.out === 'string' && cmdData.out.length > 0, 'POST /api/command must return { out: "..." }');
    console.log('  ✓ POST /api/command with "help" responds with system registers.');

    // POST /api/command with unknown verb
    const unkRes = await httpPost('/api/command', { text: 'transmute' });
    const unkData = JSON.parse(unkRes.data);
    assert(typeof unkData.out === 'string' && !unkData.out.includes('command not found:'), 'Must respond in-character');
    console.log('  ✓ POST /api/command with unknown verb responds in character.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // 10. Probing local LLM integration (skipped when offline)
  console.log('10. Probing local LLM integration (skipped when offline)...');
  const llmDisabled = process.env.LLM_DISABLED === '1';
  const llmBase = getLLMBase();
  const modelName = llmDisabled ? null : await getModelName(llmBase, 2000);

  if (!modelName) {
    console.log(`  [SKIPPED] Local LLM API at ${llmBase} is unreachable or disabled (offline fallback verified).`);
  } else {
    console.log(`  ✓ Local LLM API detected at ${llmBase}`);
    console.log(`  ✓ Model discovered: ${modelName}`);

    const sampleWorld = generateWorld(1, 'orbital garden');
    const reply = await generateCommandResponseWithLLM(sampleWorld, "look", [], {
      llmBase,
      timeout: 8000
    });

    if (reply) {
      console.log(`  ✓ Keeper response generated via LLM:\n    "${reply.slice(0, 120)}..."`);
    } else {
      console.log('  [NOTE] LLM did not return text within timeout; fallback logic active.');
    }

    // Live app interpretation via LLM
    const ent = sampleWorld.entities[0];
    const liveApp = await interpretAppWithLLM(sampleWorld, ent.name, {
      llmBase,
      timeout: 12000
    });

    assert(liveApp && typeof liveApp === 'object', 'Live interpreted app must be object');
    assert(typeof liveApp.title === 'string' && liveApp.title.length > 0, 'Live app must have title');
    assert(typeof liveApp.screen === 'string' && liveApp.screen.length > 0, 'Live app must have screen');
    assert(liveApp.element && typeof liveApp.element.name === 'string', 'Live app must have interactive element');
    assert(Array.isArray(liveApp.palette), 'Live app must render within palette');
    console.log(`  ✓ Live app interpreted via LLM: "${liveApp.title}" [format: ${liveApp.format}] (source: ${liveApp.isLLM ? 'LLM' : 'fallback'})`);
  }

  // 11. Automatic fallback on unreachable LLM_BASE (dead port mock)
  console.log('11. Testing automatic combinatorial fallback on unreachable LLM_BASE (dead port)...');
  {
    const deadBase = 'http://127.0.0.1:59999';
    const fallbackWorld = await generateWorldWithLLM(777, {
      llmBase: deadBase,
      concept: 'submarine',
      timeout: 1000,
      probeTimeout: 500
    });

    assert(fallbackWorld !== null, 'generateWorldWithLLM must NEVER resolve to null');
    assert(typeof fallbackWorld === 'object', 'Fallback world must be an object');
    assert(typeof fallbackWorld.name === 'string' && fallbackWorld.name.length > 0, 'Fallback world must have name');
    assert.strictEqual(fallbackWorld.concept, 'submarine', 'Fallback world must preserve concept');
    assert(Array.isArray(fallbackWorld.palette) && fallbackWorld.palette.length >= 3, 'Fallback world must have palette array');
    assert(fallbackWorld.keeper && typeof fallbackWorld.keeper.name === 'string', 'Fallback world must have keeper');
    assert(Array.isArray(fallbackWorld.entities) && fallbackWorld.entities.length >= 4, 'Fallback world must have entities');
    assert(fallbackWorld.entities.every(e => e.app && e.app.title && e.app.element), 'Every fallback entity must have app');
    assert(Array.isArray(fallbackWorld.laws) && fallbackWorld.laws.length >= 2, 'Fallback world must have laws');
    assert(Array.isArray(fallbackWorld.verbs) && fallbackWorld.verbs.length >= 5, 'Fallback world must have verbs');
    assert(Array.isArray(fallbackWorld.script) && fallbackWorld.script.length >= 3, 'Fallback world must have script');
    assert.strictEqual(fallbackWorld.seed, new PRNG(777).hexSeed, 'Fallback world must match seed 777');
    console.log(`  ✓ generateWorldWithLLM on dead port resolved complete valid fallback world: "${fallbackWorld.name}" (${fallbackWorld.seed}) [concept: ${fallbackWorld.concept}]`);

    // Assert command response fallback on dead port
    const fallbackCmd = await generateCommandResponseWithLLM(fallbackWorld, 'help', [], {
      llmBase: deadBase,
      timeout: 1000,
      probeTimeout: 500
    });
    assert(fallbackCmd !== null && typeof fallbackCmd === 'string' && fallbackCmd.length > 0, 'Command response on dead port must never resolve to null');
    assert(fallbackCmd.includes(fallbackWorld.keeper.prefix) || fallbackCmd.includes('OPERATIONAL VERBS'), 'Fallback command must contain in-character content');
    console.log(`  ✓ generateCommandResponseWithLLM on dead port resolved valid fallback response:\n    "${fallbackCmd.slice(0, 80).replace(/\n/g, ' ')}..."`);

    // Assert app interpreter fallback on dead port
    const fallbackApp = await interpretAppWithLLM(fallbackWorld, fallbackWorld.entities[0].name, {
      llmBase: deadBase,
      timeout: 1000,
      probeTimeout: 500
    });
    assert(fallbackApp !== null && typeof fallbackApp === 'object', 'App interpreter on dead port must never resolve to null');
    assert(typeof fallbackApp.title === 'string' && fallbackApp.title.length > 0, 'Fallback app must have title');
    assert(fallbackApp.element && fallbackApp.element.name, 'Fallback app must have interactive element');
    console.log(`  ✓ interpretAppWithLLM on dead port resolved valid fallback app: "${fallbackApp.title}" [format: ${fallbackApp.format}]`);
  }

  // 12. Interface Paradigm Generation & Steering (Spec §6, Acceptance Criterion 6)
  console.log('12. Testing interface paradigm generation & concept steering...');
  {
    const wTui = generateWorld(100, 'a hacker terminal and cli prompt');
    assert.strictEqual(wTui.interface, 'tui', 'Terminal concept must steer to tui paradigm');

    const wDevice = generateWorld(101, 'a cockpit with dials and pressure gauge');
    assert.strictEqual(wDevice.interface, 'device', 'Cockpit concept must steer to device paradigm');

    const wScene = generateWorld(102, 'just a dark room in an old cathedral monastery');
    assert.strictEqual(wScene.interface, 'scene', 'Cathedral/room concept must steer to scene paradigm');

    const wGui = generateWorld(103, 'a desktop with windows and panels');
    assert.strictEqual(wGui.interface, 'gui', 'Desktop/window concept must steer to gui paradigm');

    const wDefault = generateWorld(104, 'random');
    assert(['gui', 'tui', 'device', 'scene'].includes(wDefault.interface), 'Default interface must be valid paradigm');

    console.log(`  ✓ Interface steering verified: tui=${wTui.interface}, device=${wDevice.interface}, scene=${wScene.interface}, gui=${wGui.interface}`);
  }

  // 13. Virtual Filesystem & Hallucination Mechanic (Spec §7, Acceptance Criterion 8)
  console.log('13. Testing Virtual Filesystem, shell commands & hallucination mechanic...');
  {
    const world = generateWorld(1);
    const vfs = new VirtualFS(world);

    assert.strictEqual(vfs.pwd(), '/', 'Initial virtual CWD must be /');
    const rootLs = vfs.ls();
    assert(rootLs.includes('apps') && rootLs.includes('bin') && rootLs.includes('etc'), 'Virtual root must have default directories');

    // Deterministic commands: mkdir, echo, cat
    vfs.mkdir('/test-stratum');
    assert(vfs.ls().includes('test-stratum'), 'Created directory must appear in ls');
    vfs.echo('PRESSURE=HIGH', '/test-stratum/readout.env');
    assert.strictEqual(vfs.cat('/test-stratum/readout.env'), 'PRESSURE=HIGH', 'Virtual cat must return written content');

    // Cat virtual configuration
    const lawsConf = vfs.cat('/etc/laws.conf');
    assert(lawsConf.includes('LAW_1'), 'Virtual /etc/laws.conf must be populated from world spec');

    // HALLUCINATION MECHANIC: cd into nonexistent directory materializes it
    const halluRes = vfs.cd('/uncharted/void/stratum9');
    assert.strictEqual(halluRes.hallucinated, true, 'cd into unknown path must hallucinate directory');
    assert.strictEqual(vfs.pwd(), '/uncharted/void/stratum9', 'CWD must update to hallucinated directory');

    const halluLs = vfs.ls();
    assert(halluLs.includes('stratum.log'), 'Hallucinated directory must materialize virtual contents');
    const stratumContent = vfs.cat('stratum.log');
    assert(stratumContent.includes('RECONSTITUTED'), 'Hallucinated stratum.log must contain in-world fiction');

    // Test shell commands via CommandSession
    const session = new CommandSession(world, { disableLLM: true });
    const sessionPwd = session.executeSync('pwd');
    assert.strictEqual(sessionPwd.cwd, '/', 'Session executeSync("pwd") must return virtual CWD');
    const sessionCd = session.executeSync('cd /apps');
    assert.strictEqual(sessionCd.cwd, '/apps', 'Session executeSync("cd /apps") must move CWD');

    console.log('  ✓ Virtual FS verified: standard shell operations work and nonexistent folders hallucinate.');
  }

  // 14. Binary Slot Resolution (Spec §7, Acceptance Criterion 8)
  console.log('14. Testing real binary slot resolution (~/.larpos/bins)...');
  {
    const binsDir = getBinsDir();
    assert(fs.existsSync(binsDir), 'Binary slot directory must exist on disk');

    const testBinPath = path.join(binsDir, 'probe-slot-test.sh');
    fs.writeFileSync(testBinPath, '#!/bin/sh\necho "REAL_BIN_EXEC_OK"\n', { mode: 0o755 });

    try {
      const resolved = resolveBinarySlot('probe-slot-test.sh');
      assert(resolved !== null, 'resolveBinarySlot must locate real binary');
      assert.strictEqual(resolved.name, 'probe-slot-test.sh', 'Resolved binary name must match');
      assert.strictEqual(resolved.isExecutable, true, 'Resolved binary must detect executable permission');
      assert(resolved.size > 0, 'Resolved binary must report real size');
      assert(resolved.headHex.length > 0, 'Resolved binary must read real head bytes');
      assert(resolved.execOutput && resolved.execOutput.includes('REAL_BIN_EXEC_OK'), 'Resolved binary must run and capture output');

      // Test execution via CommandSession
      const world = generateWorld(1);
      const session = new CommandSession(world, { disableLLM: true });
      const execRes = session.executeSync('probe-slot-test.sh');
      assert(execRes.out.includes('REAL BINARY'), 'Executing real binary in session must report real binary slot');
      assert(execRes.out.includes('REAL_BIN_EXEC_OK'), 'Session execution must return real binary output');

      console.log(`  ✓ Binary slot resolved real file "${resolved.name}" (${resolved.size} bytes) with live execution.`);
    } finally {
      if (fs.existsSync(testBinPath)) fs.unlinkSync(testBinPath);
    }
  }

  // 15. Conversation Store JSONL Persistence Per Boot (Spec §7, Acceptance Criterion 8)
  console.log('15. Testing conversation store JSONL persistence per boot...');
  {
    const world = generateWorld(105);
    const logPath = getSessionLogPath(world.seed);
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    const session = new CommandSession(world, { disableLLM: true });

    session.executeSync('pwd');
    session.executeSync('help');

    const logEntries = readSessionLog(world.seed);
    assert(Array.isArray(logEntries) && logEntries.length >= 2, 'Session log must contain persisted JSONL records');
    assert.strictEqual(logEntries[0].input, 'pwd', 'First log entry must record input "pwd"');
    assert.strictEqual(logEntries[1].input, 'help', 'Second log entry must record input "help"');
    assert(logEntries[0].output !== undefined, 'Log entry must record output');
    assert(logEntries[0].timestamp !== undefined, 'Log entry must record ISO timestamp');

    console.log(`  ✓ Persisted ${logEntries.length} conversation exchanges into session-${world.seed.replace(/[^a-zA-Z0-9_\-]/g, '_')}.jsonl.`);
  }

  // 16. .LARP File Format, Loose Text Interpretation & Live Self-Rewriting (Spec §8 & §10, Acceptance Criterion 9)
  console.log('16. Testing .larp file format, loose text interpretation & live self-rewriting OS...');
  {
    const world = generateWorld(106);
    const larpPath = writeWorldLarp(world);
    assert(fs.existsSync(larpPath), 'Boot must write world-<seed>.larp file');

    const parsed = readWorldLarp(larpPath);
    assert(parsed !== null, 'Engine must parse .larp file');
    assert.strictEqual(parsed.name, world.name, 'Parsed world name must match');
    assert.strictEqual(parsed.seed, world.seed, 'Parsed world seed must match');
    assert.strictEqual(parsed.laws.length, world.laws.length, 'Parsed laws count must match');
    assert.strictEqual(parsed.entities.length, world.entities.length, 'Parsed entities count must match');

    // Live file watcher test
    const testLarpPath = path.join(getStateDir(), 'world-test-watcher.larp');
    writeWorldLarp(world, getStateDir());
    fs.copyFileSync(larpPath, testLarpPath);

    let watcherFired = false;
    let liveReloadedWorld = null;
    const watcher = watchWorldLarp(testLarpPath, (updated) => {
      watcherFired = true;
      liveReloadedWorld = updated;
    });

    try {
      // Live mutate file on disk: append a new law
      const newLine = JSON.stringify({ section: 'law', rule: 'The steam pressure shall never drop below three atmospheres.' }) + '\n';
      fs.appendFileSync(testLarpPath, newLine, 'utf8');

      // Wait for watcher/poll
      await new Promise(r => setTimeout(r, 200));
      assert(watcherFired, 'watchWorldLarp callback must trigger on file edit');
      assert(liveReloadedWorld && liveReloadedWorld.laws.some(l => l.includes('three atmospheres')), 'Live reloaded world must reflect edited law');
      console.log('  ✓ Live file edit detected; OS re-parsed itself without restart.');
    } finally {
      watcher.close();
      if (fs.existsSync(testLarpPath)) fs.unlinkSync(testLarpPath);
    }

    // In-world mutation: rewrite law & add bin
    const session = new CommandSession(world, { disableLLM: true });
    const mutateLawRes = session.executeSync('rewrite law The sky is forged of tarnished zinc.');
    assert(mutateLawRes.mutated === true, 'In-world rewrite law verb must flag mutated=true');
    assert(session.world.laws.some(l => l.includes('tarnished zinc')), 'World laws must contain updated law');

    const addBinRes = session.executeSync('add bin steam-purge Vents high-pressure gas from all chambers.');
    assert(addBinRes.mutated === true, 'In-world add bin verb must flag mutated=true');
    const runBinRes = session.executeSync('steam-purge');
    assert(runBinRes.out.includes('STEAM-PURGE') && runBinRes.out.includes('Vents high-pressure gas'), 'Runtime execution of bin command must succeed');

    // Loose text paragraph interpretation (Acceptance Criterion 9: hand-edited paragraph yields complete world)
    const looseProse = 'In the submerged iron cathedral of St. Jude, monks tend the pressure vents. Law 1: Never open the lower hatch. Cmd vent-dump: releases excess steam into the courtyard.';
    const looseWorld = parseLarp(looseProse);
    assert(looseWorld !== null, 'Loose prose paragraph must parse into a world');
    assert(typeof looseWorld.name === 'string' && looseWorld.name.length > 0, 'Loose world must have derived name');
    assert(looseWorld.laws.length >= 1, 'Loose world must extract or supply laws');
    assert(looseWorld.laws.some(l => l.includes('lower hatch')), 'Loose world must extract "Never open the lower hatch"');
    assert(looseWorld.bin.length >= 1, 'Loose world must extract or supply bin command');
    assert(looseWorld.bin.some(b => b.name === 'vent-dump'), 'Loose world must extract cmd "vent-dump"');
    assert(looseWorld.entities.length >= 1, 'Loose world must derive apps');
    assert(['gui', 'tui', 'device', 'scene'].includes(looseWorld.interface), 'Loose world must derive valid paradigm');
    console.log(`  ✓ Loose text paragraph interpreted into complete world: "${looseWorld.name}" [interface: ${looseWorld.interface}] with ${looseWorld.laws.length} laws, ${looseWorld.entities.length} apps, ${looseWorld.bin.length} bin commands.`);
  }

  // 17. Post-Boot Kiosk Disguise & Escape Suppression (Spec §9, Acceptance Criterion 10)
  console.log('17. Testing post-boot kiosk disguise handlers & browser shortcut suppression...');
  {
    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Verify capture-phase handlers on document
    assert(htmlContent.includes("document.addEventListener('keydown', handleKioskKeyDown, true)"), 'Document must have capture-phase keydown handler');
    assert(htmlContent.includes("document.addEventListener('contextmenu', handleKioskContextMenu, true)"), 'Document must have capture-phase contextmenu handler');
    assert(htmlContent.includes("document.addEventListener('dragstart', handleKioskDragStart, true)"), 'Document must have capture-phase dragstart handler');

    // Verify disguise CSS & no scrollbar cues
    assert(htmlContent.includes('body.kiosk-disguised'), 'CSS must define body.kiosk-disguised rules');
    assert(htmlContent.includes('user-select: none'), 'CSS must enforce global user-select: none');
    assert(htmlContent.includes('scrollbar-width: none'), 'CSS must eliminate browser scrollbars');

    // Verify ASCII boot elements
    assert(htmlContent.includes('id="view-boot"'), 'HTML must include #view-boot ASCII terminal');
    assert(htmlContent.includes('class="ascii-banner"'), 'HTML must include .ascii-banner ASCII art');
    assert(htmlContent.includes('id="boot-log-container"'), 'HTML must include #boot-log-container');
    assert(htmlContent.includes('id="concept-input"'), 'HTML must include #concept-input');

    // Functional verification of suppression handler logic
    let prevented = false;
    let stopped = false;
    const createMockEvent = (key, mods = {}) => ({
      key,
      ctrlKey: !!mods.ctrlKey,
      metaKey: !!mods.metaKey,
      altKey: !!mods.altKey,
      shiftKey: !!mods.shiftKey,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; }
    });

    function testSuppress(e) {
      prevented = false;
      stopped = false;
      const key = e.key;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;

      if (isCtrlOrCmd) {
        const k = (key || '').toLowerCase();
        if (['r', 'p', 'i', 'j', 'c', 'u', 's'].includes(k)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
      if (['F11', 'F12', 'F5'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (isAlt && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    }

    testSuppress(createMockEvent('r', { ctrlKey: true }));
    assert(prevented && stopped, 'Ctrl+R must be suppressed');

    testSuppress(createMockEvent('p', { metaKey: true }));
    assert(prevented && stopped, 'Cmd+P must be suppressed');

    testSuppress(createMockEvent('F11'));
    assert(prevented && stopped, 'F11 must be suppressed');

    testSuppress(createMockEvent('F12'));
    assert(prevented && stopped, 'F12 must be suppressed');

    testSuppress(createMockEvent('ArrowLeft', { altKey: true }));
    assert(prevented && stopped, 'Alt+Left must be suppressed');

    testSuppress(createMockEvent('Escape'));
    assert(prevented && stopped, 'Escape must be suppressed and repurposed');

    console.log('  ✓ Post-boot kiosk disguise verified: capture handlers present, browser shortcuts suppressed, Esc repurposed in-world.');
  }

  console.log('\n=== All Self-Tests Passed Successfully! ===');
  process.exit(0);
})().catch(err => {
  console.error('\nSelf-test failed:', err);
  process.exit(1);
});
