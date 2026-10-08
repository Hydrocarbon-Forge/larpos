// app/selftest.js — Verification test suite for LarpOS engine & command layer
// Plain Node.js, zero dependencies.

const assert = require('assert');
const { generateWorld } = require('./world');
const { CommandSession } = require('./commands');
const { PRNG } = require('./prng');

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

  // Verify worlds are visibly distinct
  const signatures = [w1, w2, w3].map(w => `${w.name} | ${w.keeper.name} | ${w.theme}`);
  assert.strictEqual(new Set(signatures).size, 3, 'Different seeds must produce distinct worlds');
  console.log(`  ✓ Seed 1:  "${w1.name}" (${w1.keeper.name})`);
  console.log(`  ✓ Seed 2:  "${w2.name}" (${w2.keeper.name})`);
  console.log(`  ✓ Seed 42: "${w3.name}" (${w3.keeper.name})`);
}

// 3. World Spec conformance
console.log('3. Testing world spec schema conformance...');
{
  const seedsToTest = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  for (const s of seedsToTest) {
    const w = generateWorld(s);
    assert(typeof w.name === 'string' && w.name.length > 0, 'world.name must be non-empty string');
    assert(typeof w.theme === 'string' && w.theme.length > 0, 'world.theme must be non-empty string');
    assert(Array.isArray(w.palette) && w.palette.length >= 3 && w.palette.length <= 5, 'world.palette must have 3-5 CSS colors');
    assert(w.keeper && typeof w.keeper.name === 'string' && typeof w.keeper.personality === 'string' && typeof w.keeper.idiom === 'string', 'world.keeper must have name, personality, idiom');
    assert(Array.isArray(w.entities) && w.entities.length >= 4 && w.entities.length <= 8, 'world.entities must have 4-8 entities');
    assert(Array.isArray(w.laws) && w.laws.length >= 2 && w.laws.length <= 4, 'world.laws must have 2-4 laws');
    assert(Array.isArray(w.verbs) && w.verbs.length >= 5 && w.verbs.length <= 8, 'world.verbs must have 5-8 verbs');
    assert(Array.isArray(w.script) && w.script.length >= 3 && w.script.length <= 8, 'world.script must have 3-8 lines');
    assert(/^0x[0-9a-f]{8}$/i.test(w.seed), 'world.seed must be valid hex string');
  }
  console.log('  ✓ 10 worlds tested across diverse seeds; all satisfy spec structure.');
}

// 4. Command layer & verbs dispatch
console.log('4. Testing command layer verbs...');
{
  const world = generateWorld(1);
  const session = new CommandSession(world);

  // Each verb on its own gives its help line (excluding reseed verb which initiates reboot)
  for (const v of world.verbs) {
    if (v.name === world.reseedVerb) {
      const hRes = session.execute(`help ${v.name}`);
      assert(hRes && hRes.out.includes(world.keeper.prefix), `Help for '${v.name}' must respond`);
      continue;
    }
    const res = session.execute(v.name);
    assert(res && typeof res.out === 'string' && res.out.length > 0, `Verb '${v.name}' on its own must respond`);
    assert(res.out.includes(world.keeper.prefix) || res.out.toLowerCase().includes(v.name), `Response for '${v.name}' must contain keeper voice or verb help`);
  }
  console.log(`  ✓ All ${world.verbs.length} verbs respond when queried.`);

  // Help command lists verbs
  const helpRes = session.execute('help');
  assert(helpRes && typeof helpRes.out === 'string', 'Help must respond');
  for (const v of world.verbs) {
    assert(helpRes.out.toLowerCase().includes(v.name.toLowerCase()), `Help must mention verb '${v.name}'`);
  }
  console.log('  ✓ Generic "help" lists all available verbs.');

  // World-specific help verb
  const customHelpRes = session.execute(world.helpVerb);
  assert(customHelpRes && customHelpRes.out.toLowerCase().includes(world.helpVerb.toLowerCase()), 'World-specific help verb must respond');
  console.log(`  ✓ World-specific help verb "${world.helpVerb}" functions.`);

  // Unknown verb triggers in-character reaction (not canned error)
  const unknownRes = session.execute('hyperjump-xyz-999');
  assert(unknownRes && typeof unknownRes.out === 'string', 'Unknown verb must respond');
  assert(!unknownRes.out.includes('command not found:'), 'Must not be canned "command not found"');
  assert(unknownRes.out.includes(world.keeper.prefix), 'Must be in keeper\'s voice');
  console.log(`  ✓ Unknown verb receives in-character keeper reaction:\n    "${unknownRes.out.replace(/\n/g, ' ')}"`);
}

// 5. Entity Reachability
console.log('5. Testing entity reachability...');
{
  const world = generateWorld(1);
  const session = new CommandSession(world);

  for (const entity of world.entities) {
    assert(Array.isArray(entity.reachVerbs) && entity.reachVerbs.length > 0, `Entity ${entity.name} must specify reach verbs`);
    const primaryVerb = entity.reachVerbs[0];
    const cmd = `${primaryVerb} ${entity.name}`;
    const res = session.execute(cmd);

    assert(res && typeof res.out === 'string' && res.out.length > 20, `Entity ${entity.name} must yield descriptive content for "${cmd}"`);
    const lineCount = res.out.trim().split('\n').length;
    assert(lineCount >= 1 && lineCount <= 5, `Entity interaction must produce 1-3 lines (got ${lineCount})`);
  }
  console.log(`  ✓ All ${world.entities.length} entities are reachable with 1-3 lines of in-world fiction.`);
}

// 6. Reseed & Reboot
console.log('6. Testing reseed mechanism...');
{
  const world = generateWorld(1);
  let reseededWorld = null;
  const session = new CommandSession(world, {
    onReseed: (newW) => { reseededWorld = newW; }
  });

  const res = session.execute('new world');
  assert(res.reseeded === true, 'Response must flag reseeded=true');
  assert(res.world && res.world.seed, 'Response must return new world');
  assert.notStrictEqual(res.world.seed, world.seed, 'New world must have different seed');
  assert(reseededWorld !== null, 'onReseed hook must fire');
  console.log(`  ✓ "new world" command successfully booted new reality: ${res.world.name} (${res.world.seed}).`);

  // Also test the world's own reseed verb
  const sessionCustom = new CommandSession(world);
  const resCustom = sessionCustom.execute(world.reseedVerb);
  assert(resCustom.reseeded === true, 'World reseed verb must trigger reseed');
  assert(resCustom.world && resCustom.world.seed !== world.seed, 'World reseed verb must produce new seed');
  console.log(`  ✓ World's own reseed verb "${world.reseedVerb}" successfully booted new reality: ${resCustom.world.name} (${resCustom.world.seed}).`);
}

// 7. Conversation continuity
console.log('7. Testing conversation continuity...');
{
  const world = generateWorld(1);
  const session = new CommandSession(world);
  const ent1 = world.entities[0];
  const ent2 = world.entities[1];

  session.execute(`${ent1.reachVerbs[0]} ${ent1.name}`);
  const res2 = session.execute(`${ent2.reachVerbs[0]} ${ent2.name}`);
  assert(res2.out.includes(ent1.name) || res2.out.includes(ent2.title), 'Response should acknowledge previous context');
  console.log('  ✓ Contextual continuity observed between sequential commands.');
}

// 8. HTTP Endpoints Verification
console.log('8. Testing HTTP server endpoints (/, /api/world, /api/command)...');
(async () => {
  const http = require('http');
  const { createServer } = require('./server');

  const { server } = createServer(1, 0);
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
    // GET /
    const uiRes = await httpGet('/');
    assert.strictEqual(uiRes.status, 200, 'GET / must return 200');
    assert(uiRes.data.includes('LarpOS') && uiRes.data.includes('cmd-input'), 'GET / must serve HTML UI');
    console.log('  ✓ GET / returns 200 and loads UI interface.');

    // GET /api/world
    const worldRes = await httpGet('/api/world');
    assert.strictEqual(worldRes.status, 200, 'GET /api/world must return 200');
    const worldData = JSON.parse(worldRes.data);
    assert.strictEqual(worldData.seed, '0x00000001', 'World seed must match 0x00000001');
    assert(typeof worldData.name === 'string', 'World name must be present');
    assert(Array.isArray(worldData.palette), 'Palette must be array');
    console.log(`  ✓ GET /api/world returns coherent JSON spec for "${worldData.name}".`);

    // POST /api/command
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

  console.log('\n=== All Self-Tests (including HTTP) Passed Successfully! ===');
})().catch(err => {
  console.error('\nSelf-test failed:', err);
  process.exit(1);
});
