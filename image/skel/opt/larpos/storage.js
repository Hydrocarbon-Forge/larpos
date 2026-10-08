// app/storage.js — Local state and binary slot storage for LarpOS
// Zero dependencies. Supports image (/var/larpos) and host (~/.larpos) environments.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function getStateDir() {
  if (process.env.LARPOS_STATE) {
    fs.mkdirSync(process.env.LARPOS_STATE, { recursive: true });
    return process.env.LARPOS_STATE;
  }
  try {
    if (fs.existsSync('/var/larpos/state')) {
      return '/var/larpos/state';
    }
  } catch (_) {}

  const home = os.homedir() || process.env.HOME || '/tmp';
  const localDir = path.join(home, '.larpos', 'state');
  fs.mkdirSync(localDir, { recursive: true });
  return localDir;
}

function getBinsDir() {
  if (process.env.LARPOS_BINS) {
    fs.mkdirSync(process.env.LARPOS_BINS, { recursive: true });
    return process.env.LARPOS_BINS;
  }
  try {
    if (fs.existsSync('/var/larpos/bins')) {
      return '/var/larpos/bins';
    }
  } catch (_) {}

  const home = os.homedir() || process.env.HOME || '/tmp';
  const localDir = path.join(home, '.larpos', 'bins');
  fs.mkdirSync(localDir, { recursive: true });
  return localDir;
}

function getSessionLogPath(seed) {
  const cleanSeed = String(seed || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(getStateDir(), `session-${cleanSeed}.jsonl`);
}

function appendSessionLog(seed, entry) {
  try {
    const filePath = getSessionLogPath(seed);
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      seed,
      ...entry
    }) + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (err) {
    // Non-fatal, storage should never crash the engine
  }
}

function readSessionLog(seed) {
  try {
    const filePath = getSessionLogPath(seed);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return { raw: line };
      }
    });
  } catch (_) {
    return [];
  }
}

function resolveBinarySlot(binName) {
  if (!binName || typeof binName !== 'string') return null;
  const cleanName = path.basename(binName.trim());
  const binsDir = getBinsDir();
  const filePath = path.join(binsDir, cleanName);

  try {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return null;

    // Read head bytes (up to 128 bytes)
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(128);
    const bytesRead = fs.readSync(fd, buffer, 0, 128, 0);
    fs.closeSync(fd);
    const headBytes = buffer.slice(0, bytesRead);

    // Check executable permission
    const isExecutable = !!(stats.mode & 0o111);

    let execOutput = null;
    if (isExecutable) {
      try {
        // Run with short timeout if safe
        execOutput = execFileSync(filePath, [], { timeout: 1000, maxBuffer: 1024, encoding: 'utf8' }).trim();
      } catch (execErr) {
        execOutput = execErr.stdout ? execErr.stdout.toString().trim() : (execErr.message || 'Execution error');
      }
    }

    return {
      name: cleanName,
      path: filePath,
      size: stats.size,
      mtime: stats.mtime,
      isExecutable,
      headHex: headBytes.toString('hex').slice(0, 32),
      headText: headBytes.toString('utf8').replace(/[^\x20-\x7E\r\n\t]/g, '.'),
      execOutput
    };
  } catch (_) {
    return null;
  }
}

module.exports = {
  getStateDir,
  getBinsDir,
  getSessionLogPath,
  appendSessionLog,
  readSessionLog,
  resolveBinarySlot
};
