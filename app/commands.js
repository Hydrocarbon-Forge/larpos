// app/commands.js — In-character command layer & conversation state for LarpOS
// Zero dependencies. Supports local LLM with automatic combinatorial fallback.

const { generateWorld } = require('./world');
const { generateWorldWithLLM, generateCommandResponseWithLLM } = require('./llm');

class CommandSession {
  constructor(world, options = {}) {
    this.world = world;
    this.history = []; // last few command records
    this.onReseed = options.onReseed || null;
    this.disableLLM = !!options.disableLLM;
    this.llmBase = options.llmBase || null;
  }

  setWorld(world) {
    this.world = world;
    this.history = [];
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
    const text = (rawText || '').trim();
    if (!text) {
      return {
        out: `${this.world.keeper.prefix}: "The silence is thick enough to carve with a knife. Speak, or the chamber forgets you."`
      };
    }

    const lower = text.toLowerCase();
    const lastCmd = this.getLastCommand();

    // 1. Reseed check: "new world", "new-world", "reseed", or world's reseed verb
    if (lower === 'new world' || lower === 'new-world' || lower === 'reseed' || lower === this.world.reseedVerb) {
      const oldKeeper = this.world.keeper;
      const oldName = this.world.name;
      const nextSeed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
      const newWorld = generateWorld(nextSeed);
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
        `KEEPER: ${newWorld.keeper.name}`,
        `---`,
        ...newWorld.script
      ].join('\n');

      return {
        out,
        reseeded: true,
        world: newWorld
      };
    }

    // Parse leading verb + args
    const parts = text.split(/\s+/);
    const verb = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    const isKnownVerb = this.world.verbs.some(v => v.name.toLowerCase() === verb);
    const isHelpVerb = (verb === 'help' || verb === '?' || verb === this.world.helpVerb.toLowerCase());

    // 2. Help request
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
      const entityList = this.world.entities.map(e => `  * ${e.name} (${e.title}) — ${e.kind}`).join('\n');

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
        `INHABITED ENTITIES:`,
        entityList,
        ``,
        `OPERATIONAL VERBS:`,
        verbList,
        `  - NEW WORLD / ${this.world.reseedVerb.toUpperCase()}: Dissolve this world and boot a fresh reality.`,
        ``,
        `${this.world.keeper.prefix}: "Use the verbs as they are meant to be used. The system does not negotiate."`
      ].filter(Boolean).join('\n');

      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 2b. System inquiries: "laws", "entities", "look"
    if (verb === 'laws') {
      const lawsList = this.world.laws.map((l, i) => `  [Law ${i + 1}] ${l}`).join('\n');
      const out = `${this.world.keeper.prefix}: "The operational laws of this station are binding:"\n${lawsList}`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    if (verb === 'entities' || verb === 'manifest' || verb === 'things' || (verb === 'look' && !args) || (verb === 'ls' && !args)) {
      const entityList = this.world.entities.map(e => `  * ${e.name} (${e.title}): ${e.desc}`).join('\n');
      const out = `${this.world.keeper.prefix}: "These entities inhabit the immediate space:"\n${entityList}`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 3. Known verb on its own (no args)
    if (isKnownVerb && !args) {
      const verbObj = this.world.verbs.find(v => v.name.toLowerCase() === verb);
      const out = `${this.world.keeper.prefix}: "${verbObj.help}"`;
      this.recordCommand({ text, verb, out, failed: false });
      return { out };
    }

    // 4. Entity query or interaction
    let targetEntity = this.findEntity(args);
    let effectiveVerb = verb;

    if (!targetEntity) {
      targetEntity = this.findEntity(text);
      if (targetEntity) {
        const verbsReachable = targetEntity.reachVerbs || [];
        const out = [
          `[ENTITY: ${targetEntity.title.toUpperCase()}]`,
          targetEntity.desc,
          `${this.world.keeper.prefix}: "This entity responds to: ${verbsReachable.join(', ')}."`
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
          `${this.world.keeper.prefix}: "You may reach it with: ${verbsReachable.join(', ')}."`
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

    // 5. Unknown verb or unrecognizable syntax
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
    const isReseed = (lower === 'new world' || lower === 'new-world' || lower === 'reseed' || lower === this.world.reseedVerb);

    if (isReseed) {
      const oldKeeper = this.world.keeper;
      const oldName = this.world.name;
      const nextSeed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

      let newWorld = null;
      const useLLM = !this.disableLLM && !options.disableLLM && process.env.LLM_DISABLED !== '1';
      if (useLLM) {
        newWorld = await generateWorldWithLLM(nextSeed, {
          llmBase: this.llmBase,
          timeout: 25000
        });
      }

      if (!newWorld) {
        newWorld = generateWorld(nextSeed);
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
        `KEEPER: ${newWorld.keeper.name}`,
        `---`,
        ...newWorld.script
      ].join('\n');

      return {
        out,
        reseeded: true,
        world: newWorld
      };
    }

    // For standard commands, prefer LLM in-character response if available
    const useLLM = !this.disableLLM && !options.disableLLM && process.env.LLM_DISABLED !== '1';
    if (useLLM) {
      try {
        const llmOut = await generateCommandResponseWithLLM(this.world, text, this.history, {
          llmBase: this.llmBase,
          timeout: 8000
        });

        if (llmOut && typeof llmOut === 'string' && llmOut.trim().length > 0) {
          this.recordCommand({ text, out: llmOut.trim(), failed: false });
          return { out: llmOut.trim() };
        }
      } catch (_) {
        // Fall back cleanly
      }
    }

    // Automatic fallback to deterministic engine
    return this.executeFallback(rawText);
  }
}

module.exports = {
  CommandSession
};
