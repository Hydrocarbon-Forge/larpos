// app/server.js — Plain Node.js HTTP server for LarpOS
// Zero npm dependencies. Serves /, /api/world, and /api/command on port 8080.
// Integrates local LLM API (OpenAI-compatible) with automatic combinatorial fallback.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateWorld, interpretAppCombinatorial } = require('./world');
const { CommandSession } = require('./commands');
const { getLLMBase, generateWorldWithLLM, interpretAppWithLLM } = require('./llm');
const { writeWorldLarp, readWorldLarp, watchWorldLarp, getWorldLarpPath } = require('./larp');

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
  return {
    name: world.name,
    theme: world.theme,
    concept: world.concept || 'random',
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
    isParsedFromLarp: !!world.isParsedFromLarp
  };
}

function createServer(initialSeed, port = 8080, options = {}) {
  const disableLLM = !!options.disableLLM;
  const llmBase = options.llmBase || getLLMBase();

  // Baseline fallback world
  let activeWorld = options.initialWorld || generateWorld(initialSeed, options.concept);

  // Write .larp file at boot and re-parse as source of truth
  let activeLarpPath = writeWorldLarp(activeWorld);
  const parsedFromLarp = readWorldLarp(activeLarpPath);
  if (parsedFromLarp) {
    activeWorld = parsedFromLarp;
  }

  let larpWatcher = null;
  const setupWatcher = (filePath) => {
    if (larpWatcher) larpWatcher.close();
    larpWatcher = watchWorldLarp(filePath, (updatedWorld) => {
      activeWorld = updatedWorld;
      session.setWorld(updatedWorld);
      console.log(`[LarpOS] Live reloaded active world from ${filePath}: "${updatedWorld.name}"`);
    });
  };

  setupWatcher(activeLarpPath);

  const session = new CommandSession(activeWorld, {
    disableLLM,
    llmBase,
    onReseed: (newWorld) => {
      activeWorld = newWorld;
      activeLarpPath = writeWorldLarp(newWorld);
      setupWatcher(activeLarpPath);
      console.log(`[LarpOS] Reality reseeded: "${activeWorld.name}" (${activeWorld.seed}) [${activeWorld.isLLM ? 'LLM' : 'combinatorial'}]`);
    }
  });

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

    if (req.method === 'GET' && pathname === '/api/world') {
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

        let newWorld = null;
        if (!disableLLM && process.env.LLM_DISABLED !== '1') {
          try {
            newWorld = await generateWorldWithLLM(seed, { concept, llmBase, timeout: 25000 });
          } catch (_) {}
        }
        if (!newWorld) {
          newWorld = generateWorld(seed, concept);
        }

        activeWorld = newWorld;
        activeLarpPath = writeWorldLarp(newWorld);
        const parsed = readWorldLarp(activeLarpPath);
        if (parsed) activeWorld = parsed;
        setupWatcher(activeLarpPath);
        session.setWorld(activeWorld);

        const publicWorld = serializeWorld(activeWorld);
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
        const entity = activeWorld.entities.find(e => e.name === appScreen.entityName);
        if (entity) {
          session.currentApp = entity;
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
    session,
    getWorld: () => activeWorld,
    getActiveLarpPath: () => activeLarpPath,
    setWorld: (w) => {
      activeWorld = w;
      session.setWorld(w);
    },
    close: () => {
      if (larpWatcher) larpWatcher.close();
      server.close();
    }
  };
}

async function createServerAsync(initialSeed, port = 8080, options = {}) {
  const disableLLM = !!options.disableLLM || process.env.LLM_DISABLED === '1';
  const llmBase = options.llmBase || getLLMBase();

  let initialWorld = null;
  if (!disableLLM) {
    try {
      initialWorld = await generateWorldWithLLM(initialSeed, {
        concept: options.concept,
        llmBase,
        timeout: 25000
      });
      if (initialWorld) {
        console.log(`[LarpOS] Generated initial world via local LLM at ${llmBase}`);
      }
    } catch (_) {
      // Fallback
    }
  }

  if (!initialWorld) {
    initialWorld = generateWorld(initialSeed, options.concept);
  }

  return createServer(initialSeed, port, {
    ...options,
    disableLLM,
    llmBase,
    initialWorld
  });
}

if (require.main === module) {
  const { seed, port, disableLLM, llmBase } = parseCliArgs();

  (async () => {
    console.log(`[LarpOS] Booting system... (LLM API: ${disableLLM ? 'DISABLED' : llmBase})`);
    const app = await createServerAsync(seed, port, { disableLLM, llmBase });

    app.server.listen(port, '0.0.0.0', () => {
      const world = app.getWorld();
      console.log(`[LarpOS] World Engine online at http://0.0.0.0:${port}/`);
      console.log(`[LarpOS] Active Reality: "${world.name}" [source: ${world.isLLM ? 'LLM' : 'combinatorial'}]`);
      console.log(`[LarpOS] Concept: "${world.concept}"`);
      console.log(`[LarpOS] Seed: ${world.seed}`);
      console.log(`[LarpOS] Resident Keeper: ${world.keeper.name}`);
    });
  })();
}

module.exports = {
  createServer,
  createServerAsync,
  parseCliArgs,
  serializeWorld
};
