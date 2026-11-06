#!/usr/bin/env node
// Checks every skill in skills/ and the Claude Code marketplace manifest.
// Usage: node scripts/check-skills.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const warn = [];
const fail = (msg) => errors.push(msg);

const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
const listedSkillDirs = new Set(
  marketplace.plugins.flatMap((p) => (p.skills ?? []).map((s) => join(root, p.source, s).replace(/\/$/, ""))),
);

const filesUnder = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

for (const name of readdirSync(join(root, "skills"))) {
  const dir = join(root, "skills", name);
  if (!statSync(dir).isDirectory()) continue;
  const skillFile = join(dir, "SKILL.md");
  if (!existsSync(skillFile)) {
    fail(`${name}: missing SKILL.md`);
    continue;
  }
  const text = readFileSync(skillFile, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  const field = (key) => frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
  const skillName = field("name");
  const description = field("description");

  if (skillName !== name) fail(`${name}: frontmatter name "${skillName}" must equal the folder name`);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(skillName)) fail(`${name}: name must be kebab-case, at most 64 characters`);
  if (!description) fail(`${name}: missing description`);
  if (description.length > 1024) fail(`${name}: description is ${description.length} characters (max 1024)`);
  if (/[<>]/.test(description)) fail(`${name}: description must not contain angle brackets`);
  if (!listedSkillDirs.has(dir)) fail(`${name}: not listed in .claude-plugin/marketplace.json`);

  const skillLines = text.split("\n").length;
  if (skillLines > 500) warn.push(`${name}: SKILL.md has ${skillLines} lines; move detail into references/`);

  // Every file a skill's markdown mentions must exist, and every reference must be reachable from SKILL.md
  // by following mentions (SKILL.md → references/x.md → patterns/y.md …), or an agent can never find it.
  const assetNames = existsSync(join(dir, "assets")) ? new Set(filesUnder(join(dir, "assets")).map((f) => f.split("/").pop())) : new Set();
  // Project files a skill may mention by name without shipping them.
  const projectFiles = new Set(["AGENTS.md", "CLAUDE.md", "SKILL.md", "README.md"]);
  const referencesDir = join(dir, "references");

  /** Resolves a mentioned path the way a reader would: relative to the file, the skill, or references/. */
  const resolveMention = (file, ref) =>
    [join(dirname(file), ref), join(dir, ref), join(referencesDir, ref)].find((p) => existsSync(p) && statSync(p).isFile());

  const linksOf = new Map();
  for (const file of filesUnder(dir).filter((f) => f.endsWith(".md") && !f.includes("/assets/"))) {
    const content = readFileSync(file, "utf8");
    const links = [];
    // The skill's own documents are lowercase kebab-case .md files. Uppercase names (GLOSSARY.md, AGENTS.md)
    // and docs/… paths are files in the user's project, which the skill may mention without shipping.
    for (const [, ref] of content.matchAll(/`((?:[a-z0-9-]+\/)*[a-z0-9-]+\.md)`/g)) {
      const name = ref.split("/").pop();
      if (projectFiles.has(name) || ref.startsWith("docs/")) continue;
      const target = resolveMention(file, ref);
      if (target) links.push(target);
      else if (!assetNames.has(name)) fail(`${relative(root, file)}: mentions ${ref}, which doesn't exist in the skill`);
    }
    linksOf.set(file, links);
    if (file !== skillFile) {
      const lines = content.split("\n").length;
      if (lines > 100 && !/^(## )?Contents:?$/m.test(content)) warn.push(`${relative(root, file)}: ${lines} lines without a table of contents`);
    }
  }

  const reachable = new Set([skillFile]);
  const queue = [skillFile];
  while (queue.length) for (const next of linksOf.get(queue.shift()) ?? []) if (!reachable.has(next)) (reachable.add(next), queue.push(next));
  if (existsSync(referencesDir)) {
    for (const ref of filesUnder(referencesDir)) {
      if (!reachable.has(ref)) fail(`${name}: ${relative(dir, ref)} can't be reached from SKILL.md, so it can never be loaded`);
    }
  }
}

// File trees in markdown (unlabeled code blocks whose entries are paths) must be sorted the way an editor's
// file explorer shows them: folders first, then files, each alphabetically. Readers compare them with real folders.
const collator = new Intl.Collator("en", { numeric: true });
const PATH = /^[\w.<>\[\]-]+(\/[\w.<>\[\]-]*)*\/?$/;
const markdownFiles = [join(root, "README.md"), ...filesUnder(join(root, "skills")).filter((f) => f.endsWith(".md"))];
for (const file of markdownFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("```")) continue;
    const labeled = lines[i].trim() !== "```";
    const start = i + 1;
    while (++i < lines.length && !lines[i].trim().startsWith("```"));
    if (labeled) continue;
    const entries = lines
      .slice(start, i)
      .map((line, n) => ({ line: start + n + 1, indent: line.search(/\S/), tokens: line.trim().split(/ +/) }))
      .filter((e) => e.indent >= 0);
    if (!entries.length || !entries.every((e) => PATH.test(e.tokens[0])) || !entries.some((e) => e.tokens[0].includes("/"))) continue;

    const where = (e) => `${relative(root, file)}:${e.line}`;
    const isDir = (name) => name.endsWith("/");
    const outOfOrder = (a, b) =>
      isDir(a) !== isDir(b) ? isDir(b) : collator.compare(a.replace(/\/$/, ""), b.replace(/\/$/, "")) > 0;
    const levels = []; // [{ indent, name }] from the root of the tree to the current entry
    for (const e of entries) {
      while (levels.length && levels.at(-1).indent > e.indent) levels.pop();
      const name = e.tokens[0];
      if (levels.length && levels.at(-1).indent === e.indent) {
        const previous = levels.at(-1).name;
        if (outOfOrder(previous, name)) fail(`${where(e)}: "${name}" should come before "${previous}" (folders first, then files, alphabetically)`);
        levels.at(-1).name = name;
      } else levels.push({ indent: e.indent, name });
      // Several files listed on one line ("constants.ts dtos.ts errors.ts") must be in order too.
      const listed = [name];
      if (!isDir(name)) for (const t of e.tokens.slice(1)) if (/^[\w.-]+\.\w+$/.test(t)) listed.push(t); else break;
      for (let k = 1; k < listed.length; k++)
        if (collator.compare(listed[k - 1], listed[k]) > 0) fail(`${where(e)}: "${listed[k]}" should come before "${listed[k - 1]}"`);
    }
  }
}

for (const w of warn) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : "All skills OK");
process.exit(errors.length ? 1 : 0);
