// app/vfs.js — Virtual Filesystem & Shell Component for LarpOS
// Zero dependencies. Holds paths/files in memory/context with hallucination mechanics and real binary slot resolution.

const path = require('path');
const { resolveBinarySlot } = require('./storage');
const { chatCompletion, getModelName, getLLMBase } = require('./llm');

class VirtualFS {
  constructor(world = null) {
    this.cwd = '/';
    this.tree = new Map(); // path -> { type: 'dir'|'file', content?: string, hallucinated?: boolean, mtime: string }
    this.world = world;
    this.initDefaultTree(world);
  }

  setWorld(world) {
    this.world = world;
    this.initDefaultTree(world);
  }

  normalizePath(targetPath) {
    if (!targetPath || targetPath === '.') return this.cwd;
    let resolved;
    if (targetPath.startsWith('/')) {
      resolved = path.posix.normalize(targetPath);
    } else if (targetPath.startsWith('~')) {
      resolved = path.posix.normalize('/home/keeper/' + targetPath.slice(1));
    } else {
      resolved = path.posix.normalize(path.posix.join(this.cwd, targetPath));
    }
    return resolved;
  }

  initDefaultTree(world) {
    this.tree.clear();
    const now = 'Oct 08 04:00';

    // Root directories
    this.tree.set('/', { type: 'dir', mtime: now });
    this.tree.set('/bin', { type: 'dir', mtime: now });
    this.tree.set('/apps', { type: 'dir', mtime: now });
    this.tree.set('/etc', { type: 'dir', mtime: now });
    this.tree.set('/log', { type: 'dir', mtime: now });
    this.tree.set('/dev', { type: 'dir', mtime: now });

    // Populate /etc/laws.conf
    const lawsText = (world && Array.isArray(world.laws))
      ? world.laws.map((l, i) => `LAW_${i + 1}=${l}`).join('\n')
      : 'LAW_1=The screen dims whenever unobserved.\nLAW_2=Nothing entered into the registry can be undone.';
    this.tree.set('/etc/laws.conf', { type: 'file', content: lawsText, mtime: now });

    // Populate /etc/interface.spec
    const ifaceText = `PARADIGM=${(world && world.interface) || 'device'}\nNAME=${(world && world.name) || 'LARPOS'}\nTHEME=${(world && world.theme) || 'Default'}\nCONCEPT=${(world && world.concept) || 'random'}`;
    this.tree.set('/etc/interface.spec', { type: 'file', content: ifaceText, mtime: now });

    // Populate /log/boot.log
    const logText = (world && Array.isArray(world.script))
      ? world.script.join('\n')
      : '[SYSTEM BOOT COMPLETED]\nHallucination core online.';
    this.tree.set('/log/boot.log', { type: 'file', content: logText, mtime: now });

    // Populate /apps
    if (world && Array.isArray(world.entities)) {
      for (const ent of world.entities) {
        const appText = `TITLE="${(ent.app && ent.app.title) || ent.title}"\nFORMAT="${(ent.app && ent.app.format) || 'gauge'}"\nDESC="${ent.desc}"\nELEMENT="${(ent.app && ent.app.element && ent.app.element.name) || 'control'}"`;
        this.tree.set(`/apps/${ent.name}.app`, { type: 'file', content: appText, mtime: now });
      }
    }

    // Populate /bin
    const stdBins = ['ls', 'cd', 'cat', 'mkdir', 'echo', 'pwd', 'touch', 'clear', 'help'];
    for (const b of stdBins) {
      this.tree.set(`/bin/${b}`, { type: 'file', content: `[BUILTIN UTILITY: ${b}]`, mtime: now });
    }
    if (world && Array.isArray(world.bin)) {
      for (const b of world.bin) {
        this.tree.set(`/bin/${b.name}`, { type: 'file', content: `[LARP SCRIPT COMMAND]: ${b.behavior}`, mtime: now });
      }
    }
  }

  pwd() {
    return this.cwd;
  }

  cd(target) {
    if (!target || target === '~') {
      this.cwd = '/';
      return { success: true, cwd: this.cwd, out: '' };
    }

    const norm = this.normalizePath(target);
    const entry = this.tree.get(norm);

    if (entry && entry.type === 'dir') {
      this.cwd = norm;
      return { success: true, cwd: this.cwd, out: '' };
    }

    if (entry && entry.type === 'file') {
      return { success: false, cwd: this.cwd, out: `cd: not a directory: ${target}` };
    }

    // HALLUCINATION MECHANIC:
    // If the folder didn't exist, the AI/engine materializes it!
    this.mkdir(norm, { hallucinated: true });
    // Populate plausible virtual content in the hallucinated folder
    const folderBase = path.posix.basename(norm);
    this.tree.set(path.posix.join(norm, 'stratum.log'), {
      type: 'file',
      content: `[RECONSTITUTED SECTOR ${folderBase.toUpperCase()}]\nPressure: nominal. Marrow density: shifting.`,
      mtime: 'Oct 08 04:00',
      hallucinated: true
    });

    this.cwd = norm;
    return {
      success: true,
      cwd: this.cwd,
      hallucinated: true,
      out: `[SECTOR MATERIALIZED: ${norm}]`
    };
  }

  ls(target = '') {
    const norm = target ? this.normalizePath(target) : this.cwd;
    const entry = this.tree.get(norm);

    if (entry && entry.type === 'file') {
      return `${path.posix.basename(norm)}`;
    }

    if (!entry) {
      // Check real binary slot first
      const binCheck = resolveBinarySlot(target);
      if (binCheck) {
        return `-rwxr-xr-x 1 root root ${binCheck.size} ${binCheck.name} [REAL BINARY]`;
      }
      return `ls: cannot access '${target}': No such file or directory`;
    }

    const prefix = norm === '/' ? '/' : norm + '/';
    const items = [];

    for (const [key, val] of this.tree.entries()) {
      if (key === norm) continue;
      if (key.startsWith(prefix)) {
        const sub = key.slice(prefix.length);
        if (!sub.includes('/')) {
          items.push({
            name: sub,
            type: val.type,
            size: val.type === 'dir' ? 4096 : (val.content ? Buffer.byteLength(val.content) : 0),
            mtime: val.mtime || 'Oct 08 04:00',
            hallucinated: !!val.hallucinated
          });
        }
      }
    }

    if (items.length === 0) {
      return '(empty directory)';
    }

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const lines = items.map(item => {
      const mode = item.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
      const sizeStr = String(item.size).padStart(6, ' ');
      const tag = item.hallucinated ? ' [hallucinated]' : '';
      return `${mode} 1 keeper keeper ${sizeStr} ${item.mtime} ${item.name}${item.type === 'dir' ? '/' : ''}${tag}`;
    });

    return lines.join('\n');
  }

  cat(target) {
    if (!target) return 'cat: missing operand';
    const norm = this.normalizePath(target);
    const entry = this.tree.get(norm);

    if (entry && entry.type === 'file') {
      return entry.content || '';
    }

    if (entry && entry.type === 'dir') {
      return `cat: ${target}: Is a directory`;
    }

    // Check real binary slot
    const binName = path.posix.basename(target);
    const realBin = resolveBinarySlot(binName);
    if (realBin) {
      let out = `[REAL BINARY SLOT: ${realBin.name}]\nPath: ${realBin.path}\nSize: ${realBin.size} bytes\nExecutable: ${realBin.isExecutable ? 'YES' : 'NO'}\nHead (hex): ${realBin.headHex}\nHead (text): "${realBin.headText}"`;
      if (realBin.execOutput) {
        out += `\nOutput: ${realBin.execOutput}`;
      }
      return out;
    }

    // Hallucinate file content if in hallucinated directory
    if (this.cwd !== '/') {
      const halluContent = `[RECONSTITUTED RECORD // ${binName.toUpperCase()}]\nThe text was recorded prior to the flood. It reads only: "Do not open the third valve."`;
      this.tree.set(norm, { type: 'file', content: halluContent, mtime: 'Oct 08 04:00', hallucinated: true });
      return halluContent;
    }

    return `cat: ${target}: No such file or directory`;
  }

  mkdir(target, options = {}) {
    if (!target) return 'mkdir: missing operand';
    const norm = this.normalizePath(target);
    if (this.tree.has(norm)) return `mkdir: cannot create directory '${target}': File exists`;

    // Ensure parents exist
    const parts = norm.split('/').filter(Boolean);
    let curr = '';
    for (let i = 0; i < parts.length - 1; i++) {
      curr += '/' + parts[i];
      if (!this.tree.has(curr)) {
        this.tree.set(curr, { type: 'dir', mtime: 'Oct 08 04:00', ...options });
      }
    }

    this.tree.set(norm, { type: 'dir', mtime: 'Oct 08 04:00', ...options });
    return '';
  }

  touch(target) {
    if (!target) return 'touch: missing operand';
    const norm = this.normalizePath(target);
    if (!this.tree.has(norm)) {
      this.tree.set(norm, { type: 'file', content: '', mtime: 'Oct 08 04:00' });
    } else {
      const e = this.tree.get(norm);
      e.mtime = 'Oct 08 04:00';
    }
    return '';
  }

  echo(text, redirectFile = null) {
    if (!redirectFile) return text;
    const norm = this.normalizePath(redirectFile);
    this.tree.set(norm, { type: 'file', content: text, mtime: 'Oct 08 04:00' });
    return '';
  }

  executeSync(cmdLine) {
    const raw = (cmdLine || '').trim();
    if (!raw) return { out: '' };

    // Check redirection
    let commandStr = raw;
    let redirectTarget = null;
    if (raw.includes('>')) {
      const parts = raw.split('>');
      commandStr = parts[0].trim();
      redirectTarget = parts.slice(1).join('>').trim();
    }

    const tokens = commandStr.split(/\s+/);
    const verb = tokens[0].toLowerCase();
    const args = tokens.slice(1);
    const argStr = args.join(' ').trim();

    if (verb === 'pwd') {
      return { out: this.pwd() };
    }
    if (verb === 'cd') {
      const res = this.cd(args[0]);
      return { out: res.out || '', cwd: res.cwd, hallucinated: res.hallucinated };
    }
    if (verb === 'ls') {
      return { out: this.ls(args[0] || '') };
    }
    if (verb === 'cat') {
      return { out: this.cat(args[0] || '') };
    }
    if (verb === 'mkdir') {
      return { out: this.mkdir(args[0] || '') };
    }
    if (verb === 'touch') {
      return { out: this.touch(args[0] || '') };
    }
    if (verb === 'echo') {
      const echoed = args.join(' ');
      if (redirectTarget) {
        this.echo(echoed, redirectTarget);
        return { out: '' };
      }
      return { out: echoed };
    }

    // Check custom world.bin commands
    if (this.world && Array.isArray(this.world.bin)) {
      const customBin = this.world.bin.find(b => b.name.toLowerCase() === verb);
      if (customBin) {
        return {
          out: `[${customBin.name.toUpperCase()}]: ${customBin.behavior}`
        };
      }
    }

    // Check real binary slot
    const realBin = resolveBinarySlot(verb);
    if (realBin) {
      let out = `[EXECUTING REAL BINARY: ${realBin.name}]\nSize: ${realBin.size} bytes | Path: ${realBin.path}`;
      if (realBin.execOutput) {
        out += `\nOutput: ${realBin.execOutput}`;
      } else {
        out += `\nHead: ${realBin.headText}`;
      }
      return { out };
    }

    return null; // Not a built-in shell command
  }

  async executeAsync(cmdLine, options = {}) {
    // 1. Fast combinatorial execution
    const syncRes = this.executeSync(cmdLine);

    // If it's a known deterministic command (e.g. cd, pwd, mkdir, echo), return immediately!
    const tokens = cmdLine.trim().split(/\s+/);
    const verb = tokens[0].toLowerCase();
    if (['pwd', 'mkdir', 'touch', 'echo', 'clear'].includes(verb)) {
      return syncRes;
    }

    // Minimal-thinking feel rule:
    // If LLM is enabled and up, probe shell pattern-completion with sub-second (~1000ms) timeout
    const disableLLM = options.disableLLM || process.env.LLM_DISABLED === '1';
    if (!disableLLM) {
      const baseUrl = options.llmBase || getLLMBase();
      try {
        const model = await getModelName(baseUrl, options.probeTimeout || 800);
        if (model) {
          const systemPrompt = [
            `You are the LarpOS terminal shell in world "${(this.world && this.world.name) || 'LARPOS'}".`,
            `Virtual CWD is "${this.cwd}".`,
            `Theme: ${(this.world && this.world.theme) || 'retro system'}.`,
            `Keeper: ${(this.world && this.world.keeper && this.world.keeper.name) || 'Keeper'}.`,
            `Instructions:`,
            `- Do not deliberate or think. Pattern-complete this shell command immediately.`,
            `- Output 1-3 concise lines of authentic terminal or in-world shell response.`,
            `- If navigating or listing, treat nonexistent folders as eerie hallucinated areas.`
          ].join('\n');

          const llmPromise = chatCompletion(baseUrl, model, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: cmdLine }
          ], {
            reasoning_effort: 'none',
            temperature: 0.3,
            max_tokens: 180,
            timeout: 1000 // Sub-second feel rule!
          });

          // Race with 1000ms timeout
          const llmResult = await Promise.race([
            llmPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
          ]);

          if (llmResult && llmResult.trim()) {
            return {
              out: llmResult.trim(),
              cwd: this.cwd,
              isLLM: true
            };
          }
        }
      } catch (_) {
        // Fall back seamlessly to instant combinatorial response
      }
    }

    return syncRes;
  }
}

module.exports = {
  VirtualFS
};
