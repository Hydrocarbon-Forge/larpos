# The `.larp` File Format

A `.larp` file is a **loose text document** that defines a LarpOS reality.

There is **no required schema** and **no rigid layout**. The point of `.larp` is that you can write *whatever* — from structured-looking sections to raw paragraphs, notes, or half-finished fragments — and the AI world engine interprets it into a running operating system.

---

## Reader-Not-Validator Philosophy

The parser **is the interpreter**, not a regex or JSON-lines parser. The reader-not-validator policy applies to the file itself:

1. **Loose text is native**: Hand-authored `.larp` files can be anything, including just a single paragraph of narrative prose.
2. **Structure is optional and non-normative**: A file *may* use section labels, bullet points, or JSON-like blocks when convenient, but these are cues for the interpreter, not a schema contract.
3. **Subjective interpretation**:
   - A chunk of text that reads like an apparatus or machinery becomes an inhabited **app**.
   - A command-like line or tool description becomes a **bin** command.
   - A rule, warning, or operational constraint becomes a world **law**.
   - Garbled, corrupted, or incoherent text is interpreted as in-world damage, glitched lore, or an uncanny artifact — **never a parse error**.
4. **Nothing is rejected**: The interpreter never aborts, rejects, or throws on invalid syntax. It makes sense of whatever text it is handed.

---

## Generator Convenience vs. Format Contract

When the LarpOS engine boots and generates a world, it writes an initial `.larp` document to `<state_dir>/world-<seed>.larp`.

The generator writes this boot file with a readable, structured shape (with sections for world metadata, laws, apps, bin commands, and monologue scenes) because the generator knows what an operating system needs to function. **However, that structure is a generator convenience, not a format contract.**

The engine reads this file through the AI interpreter as its **authoritative source of truth**.

---

## Live Rewriting & Dynamic Mutation

The LarpOS engine watches the active `.larp` file (`fs.watch` with mtime polling fallback). When the file is edited on disk — by a human editor, by the resident keeper, or by an external tool:

1. The file watcher detects the change.
2. The AI interpreter reads the revised text and subjectively re-interprets it into the updated world spec.
3. The running operating system changes shape live, without restarting the server or breaking kiosk state.

In-world verbs (such as `rewrite law <text>` or `add bin <name> <behavior>`) also update the active `.larp` file directly, demonstrating a live self-rewriting operating system.
