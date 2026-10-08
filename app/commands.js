// app/commands.js — In-character command layer & conversation state for LarpOS
// Zero dependencies. Supports local LLM with automatic combinatorial fallback.

const { generateWorld, interpretAppCombinatorial } = require('./world');
const { generateWorldWithLLM, interpretAppWithLLM, generateCommandResponseWithLLM } = require('./llm');
const { VirtualFS } = require('./vfs');
const { appendSessionLog } = require('./storage');
const { writeWorldLarp } = require('./larp');

class CommandSession {
  constructor(world, options = {}) {
    this.world = world;
    this.history = []; // last few command records
    this.currentApp = null; // currently open app entity (if any)
    this.onReseed = options.onReseed || null;
    this.disableLLM = !!options.disableLLM;
    this.llmBase = options.llmBase || null;
    this.vfs = new VirtualFS(world);
  }

  setWorld(world) {
    this.world = world;
    this.history = [];
    this.currentApp = null;
    if (this.vfs) {
      this.vfs.setWorld(world);
    } else {
      this.vfs = new VirtualFS(world);
    }
  }

  logSession(input, output) {
    if (this.world && this.world.seed) {
      appendSessionLog(this.world.seed, {
        input,
        output,
        cwd: this.vfs ? this.vfs.pwd() : '/'
      });
    }
  }

  recordCommand(record) {
    this.history.push(record);
    if (this.history.length > 6) {
      this.history.shift();
    }
  }

  getLastCommand() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  findEntity(targetQuery) {
    if (!targetQuery) return null;
    const clean = targetQuery.toLowerCase().trim()
      .replace(/^(the|a|an|to|into|upon|on|at|with)\s+/, '')
      .trim();

    for (const entity of this.world.entities) {
      if (entity.name.toLowerCase() === clean) return entity;
      if (entity.title.toLowerCase() === clean) return entity;
      if (entity.aliases && entity.aliases.some(alias => alias.toLowerCase() === clean)) {
        return entity;
      }
    }

    // Substring matching
    for (const entity of this.world.entities) {
      if (clean.includes(entity.name.toLowerCase())) return entity;
      if (entity.aliases && entity.aliases.some(alias => clean.includes(alias.toLowerCase()))) {
        return entity;
      }
    }

    return null;
  }

  executeFallback(rawText) {
    const res = this._executeFallbackInternal(rawText);
    if (res && res.out) {
      this.logSession(rawText, res.out);
    }
    return res;
  }

  _executeFallbackInternal(rawText) {
    const text = (rawText || '').trim();
    if (!text) {
      return {
        out: `${this.world.keeper.prefix}: "The silence is thick enough to carve with a knife. Speak, or the chamber forgets you."`
      };
    }

    const lower = text.toLowerCase();
    const lastCmd = this.getLastCommand();

    // 1. Reseed check: "new world", "new-world", "reseed", or world's reseed verb
    const isReseed = (
      lower === 'new world' ||
      lower === 'new-world' ||
      lower === 'reseed' ||
      lower.startsWith('new world ') ||
      lower === (this.world.reseedVerb || '').toLowerCase()
    );

    if (isReseed) {
      let concept = this.world.concept || 'random';
      if (lower.startsWith('new world ')) {
        const extra = text.slice(10).trim();
        if (extra) concept = extra;
      }

      const oldKeeper = this.world.keeper;
      const oldName = this.world.name;
      const nextSeed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
      const newWorld = generateWorld(nextSeed, concept);
      this.setWorld(newWorld);
      if (this.onReseed) {
        this.onReseed(newWorld);
      }

      const out = [
        `[SYSTEM DISSONANCE: REBOOTING REALITY]`,
        `${oldKeeper.prefix}: "The seal breaks. ${oldName} dissolves back into the dark."`,
        `...`,
        `[BOOT SEQUENCE INITIALIZED // SEED: ${newWorld.seed}]`,
        `NAME: ${newWorld.name}`,
        `THEME: ${newWorld.theme}`,
        `CONCEPT: ${newWorld.concept}`,
        `KEEPER: ${newWorld.keeper.name}`,
        `---`,
        ...newWorld.script
      ].join('\n');

      return {
        out,
        reseeded: true,
        returnToConcept: true,
        world: newWorld
      };
    }

    // 2. Go Home check: return to system overview from open app
    const isHome = (
      lower === 'home' ||
      lower === 'overview' ||
      lower === 'close' ||
      lower === (this.world.homeVerb || '').toLowerCase()
    );

    if (isHome) {
      const prevApp = this.currentApp;
      this.currentApp = null;
      const appName = prevApp ? (prevApp.app ? prevApp.app.title : prevApp.title) : 'apparatus';
      const out = `${this.world.keeper.prefix}: "You step back from the ${appName} and return to the central overview."`;
      this.recordCommand({ text, verb: 'home', out, failed: false });
      return { out, closeApp: true };
    }

    // 2.5 Live mutation check
    if (lower.startsWith('rewrite law ') || lower.startsWith('add law ')) {
      const newLaw = text.replace(/^(rewrite|add)\s+law\s+/i, '').trim();
      if (newLaw) {
        if (lower.startsWith('rewrite law ') && Array.isArray(this.world.laws) && this.world.laws.length > 0) {
          this.world.laws[this.world.laws.length - 1] = newLaw;
        } else {
          if (!Array.isArray(this.world.laws)) this.world.laws = [];
          this.world.laws.push(newLaw);
        }
        writeWorldLarp(this.world);
        const out = `${this.world.keeper.prefix}: "The operational law has been rewritten:\n  -> ${newLaw}"`;
        this.recordCommand({ text, verb: 'rewrite', out, failed: false });
        return { out, mutated: true, world: this.world };
      }
    }

    if (lower.startsWith('add bin ') || lower.startsWith('new bin ')) {
      const rest = text.replace(/^(add|new)\s+bin\s+/i, '').trim();
      const bparts = rest.split(/\s+/);
      const bName = bparts[0];
      const bBehavior = bparts.slice(1).join(' ').trim() || 'A dynamically added binary utility.';
      if (bName) {
        if (!this.world.bin) this.world.bin = [];
        this.world.bin.push({ name: bName.toLowerCase(), behavior: bBehavior });
        if (!this.world.verbs.some(v => v.name.toLowerCase() === bName.toLowerCase())) {
          this.world.verbs.push({ name: bName.toLowerCase(), help: `${bName} — ${bBehavior}` });
        }
        this.vfs.setWorld(this.world);
        writeWorldLarp(this.world);
        const out = `${this.world.keeper.prefix}: "Utility '${bName}' inscribed into /bin and .larp manifest."`;
        this.recordCommand({ text, verb: 'add-bin', out, failed: false });
        return { out, mutated: true, world: this.world };
      }
    }

    // 2.6 Virtual filesystem & shell check
    const vfsCheck = this.vfs.executeSync(text);
    if (vfsCheck !== null) {
      const out = vfsCheck.out || (vfsCheck.cwd ? `[CWD: ${vfsCheck.cwd}]` : '');
      this.recordCommand({ text, verb: text.split(/\s+/)[0], out, failed: false });
      return {
        out,
        cwd: this.vfs.pwd(),
        hallucinated: vfsCheck.hallucinated,
        vfs: true
      };
    }

    // Parse leading verb + args
    const parts = text.split(/\s+/);
    const verb = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    // 3. Open App check: "open <target>" or world's openVerb "<target>"
    const isOpenVerb = (verb === 'open' || verb === (this.world.openVerb || '').toLowerCase());
    if (isOpenVerb) {
      const targetEntity = this.findEntity(args);
      if (targetEntity) {
        this.currentApp = targetEntity;
        const appScreen = interpretAppCombinatorial(this.world, targetEntity.name);
        const out = [
          `[OPENING APPARATUS: ${appScreen.title}]`,
          appScreen.screen,
          `${this.world.keeper.prefix}: "You stand before the ${appScreen.title}. Control: '${appScreen.element.label}' [action: ${appScreen.element.action}]. Return via '${this.world.homeVerb}'."`
        ].join('\n');
        this.recordCommand({ text, verb: 'open', entity: targetEntity.name, out, failed: false });
        return {
          out,
          openApp: targetEntity.name,
          app: appScreen
        };
      }
      if (!args) {
        const appList = this.world.entities.map(e => `  - ${e.name} (${e.app ? e.app.title : e.title}) [${e.app ? e.app.format : 'gauge'}]`).join('\n');
        const out = `${this.world.keeper.prefix}: "Which apparatus do you wish to ${verb}? Available catalog:\n${appList}\nUse '${verb} <name>'."`;
        this.recordCommand({ text, verb: 'open', out, failed: false });
        return { out };
      }
    }

    // 4. Element interaction within open app
    if (this.currentApp) {
      const appSpec = this.currentApp.app || {};
      const elem = appSpec.element || {};
      const actionName = (elem.action || '').toLowerCase();
      const elemName = (elem.name || '').toLowerCase();

      if (verb === actionName || lower === actionName || text.toLowerCase().includes(actionName) || (args && args.toLowerCase() === elemName)) {
        const responseText = (elem.responses && elem.responses[actionName]) || `You activate the ${elem.label || elem.name}. The mechanism responds.`;
        const out = `${responseText}\n[STATUS: ENGAGED // ACTIVE TELEMETRY]`;
        this.recordCommand({ text, verb: actionName, entity: this.currentApp.name, out, failed: false });
        return {
          out,
          appUpdated: true,
          elementState: 'engaged'
        };
      }
    }

    const isKnownVerb = this.world.verbs.some(v => v.name.toLowerCase() === verb);
    const isHelpVerb = (verb === 'help' || verb === '?' || verb === (this.world.helpVerb || '').toLowerCase());

    // 5. Help request
    if (isHelpVerb) {
      if (args) {
        const targetVerb = this.world.verbs.find(v => v.name.toLowerCase() === args.toLowerCase());
        if (targetVerb) {
          const out = `${this.world.keeper.prefix}: "${targetVerb.help}"`;
          this.recordCommand({ text, verb, out, failed: false });
          return { out };
        }
      }

      const verbList = this.world.verbs.map(v => `  - ${v.name.toUpperCase()}: ${v.help}`).join('\n');
      const lawsList = this.world.laws.map((l, i) => `  [Law ${i + 1}] ${l}`).join('\n');
      const appList = this.world.entities.map(e => `  * ${e.name} — ${e.app ? e.app.title : e.title} [${e.app ? e.app.format : 'app'}]`).join('\n');

      let contextNote = '';
      if (lastCmd && lastCmd.failed) {
        contextNote = `\n${this.world.keeper.prefix}: "You seemed confused by your last motion. Study these guidelines."\n`;
      }

      const out = [
        `[${this.world.name} // SYSTEM REGISTER]`,
        `${this.world.keeper.name} presiding.`,
        `Idiom: ${this.world.keeper.idiom}.`,
        contextNote,
        `SYSTEM LAWS:`,
        lawsList,
        ``,
        `GENERATED APPLICATIONS (OPEN VIA '${(this.world.openVerb || 'open').toUpperCase()} <name>'):`,
        appList,
        ``,
        `OPERATIONAL VERBS:`,
        verbList,
        `  - ${(this.world.openVerb || 'open').toUpperCase()} [app]: Open an apparatus into its running screen.`,
        `  - ${(this.world.homeVerb || 'home').toUpperCase()}: Step back to the system overview.`,
        `  - NEW WORLD / ${(this.world.reseedVerb || 'reseed').toUpperCase()}: Dissolve this world and return to concept prompt.`,
        ``,
        `${this.world.keeper.prefix}: "Use the verbs as they are meant to be used. The system does not negotiate."`
      ].filter(Boolean).join('\n');

      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 6. System inquiries: "laws", "entities", "apps", "look"
    if (verb === 'laws') {
      const lawsList = this.world.laws.map((l, i) => `  [Law ${i + 1}] ${l}`).join('\n');
      const out = `${this.world.keeper.prefix}: "The operational laws of this station are binding:"\n${lawsList}`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    if (verb === 'entities' || verb === 'apps' || verb === 'manifest' || verb === 'things' || (verb === 'look' && !args) || (verb === 'ls' && !args)) {
      const appList = this.world.entities.map(e => `  * ${e.name} (${e.app ? e.app.title : e.title}): ${e.desc} [${e.app ? e.app.format : 'app'}]`).join('\n');
      const out = `${this.world.keeper.prefix}: "These applications inhabit the immediate station:\n${appList}\nOpen any with '${this.world.openVerb || 'open'} <name>'."`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 7. Known verb on its own (no args)
    if (isKnownVerb && !args) {
      const verbObj = this.world.verbs.find(v => v.name.toLowerCase() === verb);
      const out = `${this.world.keeper.prefix}: "${verbObj.help}"`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 8. Entity query or interaction
    let targetEntity = this.findEntity(args);
    let effectiveVerb = verb;

    if (!targetEntity) {
      targetEntity = this.findEntity(text);
      if (targetEntity) {
        const verbsReachable = targetEntity.reachVerbs || [];
        const out = [
          `[ENTITY: ${targetEntity.title.toUpperCase()}]`,
          targetEntity.desc,
          `${this.world.keeper.prefix}: "This entity responds to: ${verbsReachable.join(', ')}. Open screen via '${this.world.openVerb || 'open'} ${targetEntity.name}'."`
        ].join('\n');
        this.recordCommand({ text, verb: 'query', entity: targetEntity.name, out, failed: false });
        return { out };
      }
    }

    if (targetEntity) {
      if (targetEntity.responses && targetEntity.responses[effectiveVerb]) {
        let prefixContext = '';
        if (lastCmd && lastCmd.entity === targetEntity.name) {
          prefixContext = `You press further upon the ${targetEntity.title}.\n`;
        } else if (lastCmd && lastCmd.entity) {
          prefixContext = `Leaving the ${lastCmd.entity} behind, you approach the ${targetEntity.title}.\n`;
        }

        const out = `${prefixContext}${targetEntity.responses[effectiveVerb]}`;
        this.recordCommand({ text, verb: effectiveVerb, entity: targetEntity.name, out, failed: false });
        return { out };
      }

      if (['inspect', 'examine', 'view', 'read', 'check', 'look'].includes(effectiveVerb)) {
        const verbsReachable = targetEntity.reachVerbs || [];
        const out = [
          `[${targetEntity.title.toUpperCase()}]`,
          targetEntity.desc,
          `${this.world.keeper.prefix}: "You may reach it with: ${verbsReachable.join(', ')}. Open app screen via '${this.world.openVerb || 'open'} ${targetEntity.name}'."`
        ].join('\n');
        this.recordCommand({ text, verb: effectiveVerb, entity: targetEntity.name, out, failed: false });
        return { out };
      }

      if (isKnownVerb) {
        const out = `${this.world.keeper.prefix}: "You cannot '${effectiveVerb}' the ${targetEntity.title}. It does not answer to that motion. Try: ${(targetEntity.reachVerbs || []).join(', ')}."`;
        this.recordCommand({ text, verb: effectiveVerb, entity: targetEntity.name, out, failed: true });
        return { out };
      }
    }

    // 9. Unknown verb or unrecognizable syntax
    if (this.world.unknownResponseGenerators && this.world.unknownResponseGenerators.length > 0) {
      const generatorIndex = (text.length + this.history.length) % this.world.unknownResponseGenerators.length;
      const generator = this.world.unknownResponseGenerators[generatorIndex];
      const out = generator(text);
      this.recordCommand({ text, verb, out, failed: true });
      return { out };
    }

    const validVerbNames = this.world.verbs.map(v => v.name).join(', ');
    const out = `${this.world.keeper.prefix}: "I have no ear for '${text}'. This place only understands ${validVerbNames}, or '${this.world.helpVerb}' for instruction."`;
    this.recordCommand({ text, verb, out, failed: true });
    return { out };
  }

  executeSync(rawText) {
    return this.executeFallback(rawText);
  }

  async execute(rawText, options = {}) {
    const text = (rawText || '').trim();
    if (!text) {
      return this.executeFallback(rawText);
    }

    const lower = text.toLowerCase();
    const isReseed = (
      lower === 'new world' ||
      lower === 'new-world' ||
      lower === 'reseed' ||
      lower.startsWith('new world ') ||
      lower === (this.world.reseedVerb || '').toLowerCase()
    );

    if (isReseed) {
      let concept = this.world.concept || 'random';
      if (lower.startsWith('new world ')) {
        const extra = text.slice(10).trim();
        if (extra) concept = extra;
      }

      const oldKeeper = this.world.keeper;
      const oldName = this.world.name;
      const nextSeed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

      let newWorld = null;
      const useLLM = !this.disableLLM && !options.disableLLM && process.env.LLM_DISABLED !== '1';
      if (useLLM) {
        newWorld = await generateWorldWithLLM(nextSeed, {
          concept,
          llmBase: this.llmBase,
          timeout: 25000
        });
      }

      if (!newWorld) {
        newWorld = generateWorld(nextSeed, concept);
      }

      this.setWorld(newWorld);
      if (this.onReseed) {
        this.onReseed(newWorld);
      }

      const out = [
        `[SYSTEM DISSONANCE: REBOOTING REALITY]`,
        `${oldKeeper.prefix}: "The seal breaks. ${oldName} dissolves back into the dark."`,
        `...`,
        `[BOOT SEQUENCE INITIALIZED // SEED: ${newWorld.seed}]`,
        `NAME: ${newWorld.name}`,
        `THEME: ${newWorld.theme}`,
        `CONCEPT: ${newWorld.concept}`,
        `KEEPER: ${newWorld.keeper.name}`,
        `---`,
        ...newWorld.script
      ].join('\n');

      return {
        out,
        reseeded: true,
        returnToConcept: true,
        world: newWorld
      };
    }

    // Go Home check
    const isHome = (
      lower === 'home' ||
      lower === 'overview' ||
      lower === 'close' ||
      lower === (this.world.homeVerb || '').toLowerCase()
    );

    if (isHome) {
      const prevApp = this.currentApp;
      this.currentApp = null;
      const appName = prevApp ? (prevApp.app ? prevApp.app.title : prevApp.title) : 'apparatus';
      const out = `${this.world.keeper.prefix}: "You step back from the ${appName} and return to the central overview."`;
      this.recordCommand({ text, verb: 'home', out, failed: false });
      this.logSession(text, out);
      return { out, closeApp: true };
    }

    // Live mutation check
    if (lower.startsWith('rewrite law ') || lower.startsWith('add law ') || lower.startsWith('add bin ') || lower.startsWith('new bin ')) {
      return this.executeFallback(rawText);
    }

    // Virtual filesystem & shell check
    if (this.vfs.executeSync(text) !== null) {
      const vfsRes = await this.vfs.executeAsync(text, {
        disableLLM: this.disableLLM || options.disableLLM,
        llmBase: this.llmBase
      });
      const out = (vfsRes && vfsRes.out) || (vfsRes && vfsRes.cwd ? `[CWD: ${vfsRes.cwd}]` : '');
      this.recordCommand({ text, verb: text.split(/\s+/)[0], out, failed: false });
      this.logSession(text, out);
      return {
        out,
        cwd: this.vfs.pwd(),
        hallucinated: vfsRes ? vfsRes.hallucinated : false,
        vfs: true
      };
    }

    // Open App check: live-interpreted via LLM if available
    const parts = text.split(/\s+/);
    const verb = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();
    const isOpenVerb = (verb === 'open' || verb === (this.world.openVerb || '').toLowerCase());

    if (isOpenVerb && args) {
      const targetEntity = this.findEntity(args);
      if (targetEntity) {
        this.currentApp = targetEntity;
        const appScreen = await interpretAppWithLLM(this.world, targetEntity.name, {
          llmBase: this.llmBase,
          disableLLM: this.disableLLM || options.disableLLM
        });

        const out = [
          `[OPENING APPARATUS: ${appScreen.title}]`,
          appScreen.screen,
          `${this.world.keeper.prefix}: "The ${appScreen.title} is live. Control: '${appScreen.element.label}' [action: ${appScreen.element.action}]. Return via '${this.world.homeVerb}'."`
        ].join('\n');

        this.recordCommand({ text, verb: 'open', entity: targetEntity.name, out, failed: false });
        this.logSession(text, out);
        return {
          out,
          openApp: targetEntity.name,
          app: appScreen
        };
      }
    }

    // Standard in-character command generation via LLM
    const useLLM = !this.disableLLM && !options.disableLLM && process.env.LLM_DISABLED !== '1';
    if (useLLM) {
      try {
        const llmOut = await generateCommandResponseWithLLM(this.world, text, this.history, {
          llmBase: this.llmBase,
          timeout: 8000,
          fallback: () => this.executeFallback(rawText).out
        });

        if (llmOut && typeof llmOut === 'string' && llmOut.trim().length > 0) {
          this.recordCommand({ text, out: llmOut.trim(), failed: false });
          this.logSession(text, llmOut.trim());
          return { out: llmOut.trim() };
        }
      } catch (_) {
        // Fall back cleanly
      }
    }

    // Fallback to deterministic engine
    return this.executeFallback(rawText);
  }
}

module.exports = {
  CommandSession
};
