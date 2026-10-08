# The `.larp` File Format Specification

The `.larp` format defines the entire hallucinated operating system as a single, human-readable structured document.

The file format uses **JSON-lines (`.larp`)**, where each line represents a distinct system section.

---

## File Structure

A `.larp` document consists of top-level section lines:

1. **`world`** — The global OS definition:
   ```json
   {
     "section": "world",
     "name": "PHAROS IX // THE GLASS REACHES",
     "theme": "brine-crusted sounding pulpit perched over an ocean that has forgotten waves",
     "concept": "submarine",
     "interface": "device",
     "palette": ["#09131b", "#0f2537", "#4ecdc4", "#cbe3db", "#e07a5f"],
     "keeper": {
       "name": "Maura of the Fog Signals",
       "personality": "tarred shears tied to wrist; listens for drops in pressure",
       "idiom": "foghorn resonance, barometer drops, and tallow grease",
       "prefix": "Maura"
     },
     "seed": "0x00000065",
     "openVerb": "unveil",
     "homeVerb": "watch",
     "helpVerb": "hail",
     "reseedVerb": "cast"
   }
   ```

2. **`law`** — System laws binding the reality:
   ```json
   {
     "section": "law",
     "rule": "The water depth increases by four fathoms whenever spoken into the brass funnel."
   }
   ```

3. **`scene`** — Boot telemetry / monologue lines:
   ```json
   {
     "section": "scene",
     "line": "MAURA: \"Keep your boots off the brass pipe. The sea went hard three months ago.\""
   }
   ```

4. **`app`** — Generated application script definitions:
   ```json
   {
     "section": "app",
     "name": "mercury-phial",
     "title": "QUICKSILVER SOUNDING COLUMN",
     "format": "gauge",
     "kind": "sealed hydrographic column",
     "desc": "A four-foot column of cold green glass encased in perforated brass.",
     "reachVerbs": ["unseal", "listen", "strike"],
     "screen": "The meniscus pulses at forty fathoms beneath blackened tallow markings.",
     "element": {
       "name": "quicksilver-petcock",
       "label": "Bleed Hydrographic Petcock",
       "type": "valve",
       "state": "seated",
       "action": "turn",
       "responses": {
         "turn": "Quicksilver surges upward: FORTY-ONE FATHOMS."
       }
     }
   }
   ```

5. **`bin`** — Custom in-world commands executable in the shell:
   ```json
   {
     "section": "bin",
     "name": "sounding-ping",
     "behavior": "Emits three acoustic pulses into the deep silt; returns depth reflection."
   }
   ```

---

## Authoritative Source of Truth & Live Rewriting

1. On boot, the world is written to `<state_dir>/world-<seed>.larp`.
2. The world engine parses this file as the **authoritative source of truth**.
3. The engine monitors `<state_dir>/world-<seed>.larp` using `fs.watch` and mtime polling. Any external edits (by human editor, keeper command, or another process) immediately re-parse and live-update the running operating system.
4. **Interpretation Policy**: If a line is corrupt, garbled, or invalid JSON, the parser does not abort or throw. In accordance with the *reader-not-validator* policy, it interprets corrupt entries as uncanny in-world artifacts (e.g. damaged apparatus or glitched telemetry lines).
