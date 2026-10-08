// app/server.js — Plain Node.js HTTP server for LarpOS
// Zero npm dependencies. Serves /, /api/world, and /api/command on port 8080.
// Integrates local LLM API (OpenAI-compatible) with automatic combinatorial fallback.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateWorld } = require('./world');
const { CommandSession } = require('./commands');
const { getLLMBase, generateWorldWithLLM } = require('./llm');

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

function createServer(initialSeed, port = 8080, options = {}) {
  const disableLLM = !!options.disableLLM;
  const llmBase = options.llmBase || getLLMBase();

  // Baseline fallback world
  let activeWorld = options.initialWorld || generateWorld(initialSeed);

  const session = new CommandSession(activeWorld, {
    disableLLM,
    llmBase,
    onReseed: (newWorld) => {
      activeWorld = newWorld;
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
      const publicWorld = {
        name: activeWorld.name,
        theme: activeWorld.theme,
        palette: activeWorld.palette,
        keeper: activeWorld.keeper,
        entities: activeWorld.entities.map(e => ({
          name: e.name,
          title: e.title,
          kind: e.kind,
          desc: e.desc,
          reachVerbs: e.reachVerbs
        })),
        laws: activeWorld.laws,
        verbs: activeWorld.verbs,
        script: activeWorld.script,
        seed: activeWorld.seed,
        source: activeWorld.isLLM ? 'llm' : 'combinatorial'
      };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(publicWorld, null, 2));
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
          seed: activeWorld.seed
        };
        if (result.reseeded && result.world) {
          payload.world = {
            name: result.world.name,
            theme: result.world.theme,
            palette: result.world.palette,
            keeper: result.world.keeper,
            entities: result.world.entities.map(e => ({
              name: e.name,
              title: e.title,
              kind: e.kind,
              desc: e.desc,
              reachVerbs: e.reachVerbs
            })),
            laws: result.world.laws,
            verbs: result.world.verbs,
            script: result.world.script,
            seed: result.world.seed,
            source: result.world.isLLM ? 'llm' : 'combinatorial'
          };
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

  return {
    server,
    session,
    getWorld: () => activeWorld,
    setWorld: (w) => {
      activeWorld = w;
      session.setWorld(w);
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
    initialWorld = generateWorld(initialSeed);
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
      console.log(`[LarpOS] Seed: ${world.seed}`);
      console.log(`[LarpOS] Resident Keeper: ${world.keeper.name}`);
    });
  })();
}

module.exports = {
  createServer,
  createServerAsync,
  parseCliArgs
};
