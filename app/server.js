// app/server.js — Plain Node.js HTTP server for LarpOS
// Zero npm dependencies. Serves /, /api/world, and /api/command on port 8080.
// Integrates local LLM API (OpenAI-compatible) with automatic combinatorial fallback.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateWorld, interpretAppCombinatorial } = require('./world');
const { CommandSession } = require('./commands');
const { getLLMBase, generateWorldWithLLM, interpretAppWithLLM } = require('./llm');
const { writeWorldLarp, readWorldLarp, readWorldLarpSync, watchWorldLarp, getWorldLarpPath } = require('./larp');

function parseCliArgs() {
  let seed = process.env.LARPOS_SEED;
  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  let disableLLM = process.env.LLM_DISABLED === '1';
  let llmBase = process.env.LLM_BASE || getLLMBase();

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      seed = args[++i];
    } else if (arg.startsWith('--seed=')) {
      seed = arg.slice(7);
    } else if (arg === '--port' && i + 1 < args.length) {
      port = parseInt(args[++i], 10);
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.slice(7), 10);
    } else if (arg === '--llm-base' && i + 1 < args.length) {
      llmBase = args[++i];
    } else if (arg.startsWith('--llm-base=')) {
      llmBase = arg.slice(11);
    } else if (arg === '--no-llm' || arg === '--offline') {
      disableLLM = true;
    }
  }

  return { seed, port, disableLLM, llmBase };
}

function serializeWorld(world) {
  if (!world) return null;
  return {
    name: world.name,
    theme: world.theme,
    concept: world.concept || 'random',
    generatedAt: world.generatedAt || Date.now(),
    worldMeta: world.worldMeta || { concept: world.concept || 'random', generatedAt: world.generatedAt || Date.now() },
    interface: world.interface || 'device',
    palette: world.palette,
    keeper: world.keeper,
    entities: (world.entities || []).map(e => ({
      name: e.name,
      title: e.title,
      kind: e.kind,
      desc: e.desc,
      reachVerbs: e.reachVerbs,
      app: e.app
    })),
    bin: world.bin || [],
    laws: world.laws || [],
    verbs: world.verbs || [],
    script: world.script || [],
    seed: world.seed,
    openVerb: world.openVerb || 'open',
    homeVerb: world.homeVerb || 'home',
    helpVerb: world.helpVerb || 'help',
    reseedVerb: world.reseedVerb || 'reseed',
    source: world.isLLM ? 'llm' : 'combinatorial',
    llmFailed: !!world.llmFailed,
    designSpec: world.designSpec || null,
    isParsedFromLarp: !!world.isParsedFromLarp
  };
}

function createServer(initialSeed, port = 8080, options = {}) {
  const disableLLM = !!options.disableLLM;
  const llmBase = options.llmBase || getLLMBase();

  let activeWorld = options.initialWorld || null;
  let isWorldReady = !!activeWorld;
  let activeLarpPath = null;
  let larpWatcher = null;
  let session = null;

  let pendingGenerations = 0;
  let generationQueue = Promise.resolve();

  function serializeWorldGeneration(taskFn) {
    pendingGenerations++;
    const run = generationQueue.then(async () => {
      try {
        return await taskFn();
      } finally {
        pendingGenerations--;
      }
    });
    generationQueue = run.catch(() => {});
    return run;
  }

  const setupWatcher = (filePath) => {
    if (larpWatcher) larpWatcher.close();
    larpWatcher = watchWorldLarp(filePath, (updatedWorld) => {
      activeWorld = updatedWorld;
      if (session) session.setWorld(updatedWorld);
      console.log(`[LarpOS] Live reloaded active world from ${filePath}: "${updatedWorld.name}"`);
    }, { disableLLM, llmBase });
  };

  const setupWorld = (world) => {
    if (!world) return;
    activeWorld = world;
    isWorldReady = true;

    try {
      activeLarpPath = writeWorldLarp(world);
      const parsedFromLarp = readWorldLarpSync(activeLarpPath);
      if (parsedFromLarp) {
        activeWorld = parsedFromLarp;
      }
    } catch (_) {}

    if (!session) {
      session = new CommandSession(activeWorld, {
        disableLLM,
        llmBase,
        onReseed: (newWorld) => {
          setupWorld(newWorld);
          console.log(`[LarpOS] Reality reseeded: "${activeWorld.name}" (${activeWorld.seed}) [${activeWorld.isLLM ? 'LLM' : 'combinatorial'}]`);
        }
      });
    } else {
      session.setWorld(activeWorld);
    }

    if (activeLarpPath) {
      setupWatcher(activeLarpPath);
    }
  };

  // 1. Initial world or background promise setup
  if (options.initialWorld) {
    setupWorld(options.initialWorld);
  } else if (options.worldPromise) {
    serializeWorldGeneration(async () => {
      try {
        const world = await options.worldPromise;
        setupWorld(world);
        return world;
      } catch (err) {
        console.error('[LarpOS] Background world generation error, using fallback:', err);
        const fallback = generateWorld(initialSeed, options.concept);
        setupWorld(fallback);
        return fallback;
      }
    });
  } else if (!options.noInitialWorld && !options.pendingWorldGen && !options.delayWorldGenMs && initialSeed !== undefined && initialSeed !== null) {
    // Synchronous fallback (e.g. unit tests initializing world directly with seed)
    const initial = generateWorld(initialSeed, options.concept);
    setupWorld(initial);
  }

  // Support injected slow world-gen delay for automated testing
  if (options.delayWorldGenMs) {
    setTimeout(() => {
      const generated = options.worldGenFactory ? options.worldGenFactory() : generateWorld(initialSeed, options.concept);
      setupWorld(generated);
    }, options.delayWorldGenMs);
  }

  const htmlPath = path.join(__dirname, 'index.html');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve UI immediately regardless of background generation status
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      fs.readFile(htmlPath, 'utf8', (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Failed to load UI interface: ' + err.message);
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(content);
      });
      return;
    }

    // World metadata endpoint: returns 200 when ready, 202 when still booting or generating
    if (req.method === 'GET' && pathname === '/api/world') {
      if (pendingGenerations > 0 || !isWorldReady || !activeWorld) {
        res.writeHead(202, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          booting: true,
          status: pendingGenerations > 0 ? 'generating' : 'awaiting_concept',
          message: pendingGenerations > 0 ? 'Reality matrix is materializing...' : 'Awaiting intent seed concept...'
        }));
        return;
      }

      const publicWorld = serializeWorld(activeWorld);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(publicWorld, null, 2));
      return;
    }

    // Pre-boot boot endpoint: POST /api/boot or POST /api/world with { concept, seed }
    if (req.method === 'POST' && (pathname === '/api/boot' || pathname === '/api/world')) {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        let concept = 'random';
        let seed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
        try {
          if (body.trim().startsWith('{')) {
            const parsed = JSON.parse(body);
            if (parsed.concept) concept = parsed.concept;
            if (parsed.seed !== undefined) seed = parsed.seed;
          }
        } catch (_) {}

        const timeoutMs = parseInt(process.env.LARPOS_WORLD_TIMEOUT_MS, 10) || 120000;

        const newWorld = await serializeWorldGeneration(async () => {
          let world = null;
          const t0 = Date.now();
          if (!disableLLM && process.env.LLM_DISABLED !== '1') {
            try {
              world = await generateWorldWithLLM(seed, {
                concept,
                llmBase,
                timeout: timeoutMs
              });
            } catch (err) {
              console.error('[LarpOS] LLM error during boot generation:', err.message);
            }
          }
          if (!world) {
            world = generateWorld(seed, concept);
          }
          world.concept = concept;
          world.generatedAt = Date.now();
          world.worldMeta = { concept, generatedAt: world.generatedAt };
          setupWorld(world);
          const elapsed = Date.now() - t0;
          console.log(`[LarpOS] Reality manifested in ${elapsed}ms for concept "${concept}" (${world.seed}) [${world.isLLM ? 'LLM' : 'combinatorial'}]`);
          return world;
        });

        const publicWorld = serializeWorld(newWorld);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(publicWorld, null, 2));
      });
      return;
    }

    // Live App Interpreter endpoint: POST /api/app/open or POST /api/interpret
    if (req.method === 'POST' && (pathname === '/api/app/open' || pathname === '/api/interpret')) {
      if (!isWorldReady || !activeWorld) {
        res.writeHead(202, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({ booting: true, error: 'Reality matrix is materializing' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        let entityName = '';
        try {
          if (body.trim().startsWith('{')) {
            const parsed = JSON.parse(body);
            entityName = parsed.entity || parsed.app || '';
          } else {
            entityName = body.trim();
          }
        } catch (_) {
          entityName = body.trim();
        }

        const appScreen = await interpretAppWithLLM(activeWorld, entityName, {
          llmBase,
          disableLLM
        });

        // Track open app in session
        if (session) {
          const entity = activeWorld.entities.find(e => e.name === appScreen.entityName);
          if (entity) {
            session.currentApp = entity;
          }
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(appScreen, null, 2));
      });
      return;
    }

    // App interaction endpoint: POST /api/app/interact
    if (req.method === 'POST' && pathname === '/api/app/interact') {
      if (!isWorldReady || !session || !activeWorld) {
        res.writeHead(202, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({ booting: true, error: 'Reality matrix is materializing' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        let entityName = '';
        let action = '';
        try {
          if (body.trim().startsWith('{')) {
            const parsed = JSON.parse(body);
            entityName = parsed.entity || '';
            action = parsed.action || '';
          }
        } catch (_) {}

        const entity = activeWorld.entities.find(e => e.name === entityName) || session.currentApp;
        if (entity) {
          session.currentApp = entity;
        }

        const result = await session.execute(action || 'operate');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          out: result.out,
          appUpdated: true,
          elementState: 'engaged'
        }));
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/command') {
      if (!isWorldReady || !session || !activeWorld) {
        res.writeHead(202, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          booting: true,
          out: '[BOOTING] Reality substrate is materializing... Please wait.'
        }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        let commandText = '';
        try {
          if (body.trim().startsWith('{')) {
            const parsed = JSON.parse(body);
            commandText = parsed.text || '';
          } else {
            commandText = body;
          }
        } catch (_) {
          commandText = body;
        }

        const result = await session.execute(commandText);
        const payload = {
          out: result.out,
          reseeded: !!result.reseeded,
          returnToConcept: !!result.returnToConcept,
          openApp: result.openApp || null,
          app: result.app || null,
          closeApp: !!result.closeApp,
          appUpdated: !!result.appUpdated,
          elementState: result.elementState || null,
          seed: activeWorld.seed,
          cwd: result.cwd || (session.vfs ? session.vfs.pwd() : '/'),
          hallucinated: !!result.hallucinated,
          vfs: !!result.vfs,
          mutated: !!result.mutated
        };
        if ((result.reseeded && result.world) || (result.mutated && result.world)) {
          payload.world = serializeWorld(result.world);
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(payload));
      });
      return;
    }

    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.on('close', () => {
    if (larpWatcher) larpWatcher.close();
  });

  return {
    server,
    getSession: () => session,
    get session() { return session; },
    getWorld: () => activeWorld,
    isReady: () => isWorldReady,
    getActiveLarpPath: () => activeLarpPath,
    setWorld: (w) => setupWorld(w),
    close: () => {
      if (larpWatcher) larpWatcher.close();
      server.close();
    }
  };
}

async function createServerAsync(initialSeed, port = 8080, options = {}) {
  const disableLLM = !!options.disableLLM || process.env.LLM_DISABLED === '1';
  const llmBase = options.llmBase || getLLMBase();

  const worldPromise = (async () => {
    let initialWorld = null;
    if (!disableLLM) {
      try {
        initialWorld = await generateWorldWithLLM(initialSeed, {
          concept: options.concept,
          llmBase,
          timeout: 25000
        });
      } catch (_) {}
    }
    if (!initialWorld) {
      initialWorld = generateWorld(initialSeed, options.concept);
    }
    return initialWorld;
  })();

  const app = createServer(initialSeed, port, {
    ...options,
    disableLLM,
    llmBase,
    worldPromise
  });

  return app;
}

if (require.main === module) {
  const { seed, port, disableLLM, llmBase } = parseCliArgs();

  console.log(`[LarpOS] Starting system on port ${port}...`);

  // 1. Non-blocking startup probe (3s timeout) logged to /var/log/larpos-server.log
  if (!disableLLM && process.env.LLM_DISABLED !== '1') {
    (async () => {
      try {
        const { getModelName } = require('./llm');
        const model = await getModelName(llmBase, 3000);
        if (model) {
          console.log(`[LarpOS] Local LLM probe at ${llmBase}: reachable (model: ${model})`);
        } else {
          console.log(`[LarpOS] Local LLM probe at ${llmBase}: unreachable (combinatorial fallback active)`);
        }
      } catch (_) {
        console.log(`[LarpOS] Local LLM probe at ${llmBase}: unreachable (combinatorial fallback active)`);
      }
    })();
  } else {
    console.log(`[LarpOS] Local LLM disabled; combinatorial fallback active.`);
  }

  // 2. Create server without pre-boot random world shadowing user concept
  const app = createServer(seed, port, {
    disableLLM,
    llmBase,
    noInitialWorld: true
  });

  // 3. BIND HTTP PORT FIRST (listen immediately before any world generation)
  app.server.listen(port, '0.0.0.0', () => {
    console.log(`[LarpOS] World Engine online at http://0.0.0.0:${port}/ (port bound, accepting connections)`);
  });
}

module.exports = {
  createServer,
  createServerAsync,
  parseCliArgs,
  serializeWorld
};
