# Skills

[![skills.sh](https://skills.sh/b/michaelharms/skills)](https://skills.sh/michaelharms/skills)

Agent skills I use across projects. Each skill is a folder with a `SKILL.md` that agents load when a task matches, plus reference files they open only when needed.

| Skill | What it does |
|---|---|
| [`nextjs-fullstack-architecture`](skills/nextjs-fullstack-architecture/SKILL.md) | Architecture rules for full-stack Next.js + TypeScript apps (App Router, Drizzle, Zod, Vercel, with tRPC and/or next-safe-action): where files go, layers, domain modeling, error handling, logging with optional tracing and analytics, test and story placement, lint-enforced boundaries, tickets and ADRs. Projects set up only the pieces they need. Includes an ESLint config that enforces the boundaries, and templates for specs, tickets, ADRs and `CODING_STANDARDS.md`. |
| [`epic-react-practices`](skills/epic-react-practices/SKILL.md) | React guidelines in the style Kent C. Dodds teaches in Epic React (an unofficial distillation): where state lives, deriving instead of syncing, disciplined effects, composition over prop drilling, advanced component patterns, forms and actions, Suspense, error boundaries, measured performance work, accessibility and Testing Library. Framework-agnostic. |

## Install

### Claude Code

```bash
/plugin marketplace add michaelharms/skills
/plugin install nextjs-fullstack-architecture@michaelharms
/plugin install epic-react-practices@michaelharms
```

Or from a shell: `claude plugin marketplace add michaelharms/skills` and `claude plugin install <skill>@michaelharms`. Each skill is its own plugin, so install only the ones you want.

**For a whole team**, commit this to the project's `.claude/settings.json`, so everyone who opens the project gets the marketplace and the skill:

```json
{
  "extraKnownMarketplaces": {
    "michaelharms": { "source": { "source": "github", "repo": "michaelharms/skills" } }
  },
  "enabledPlugins": {
    "nextjs-fullstack-architecture@michaelharms": true,
    "epic-react-practices@michaelharms": true
  }
}
```

### Other agents (Codex, Cursor, GitHub Copilot, …)

```bash
npx skills add michaelharms/skills --skill nextjs-fullstack-architecture --skill epic-react-practices
```

Run `npx skills add michaelharms/skills --list` to see all skills in this repo.

The skills are listed on [skills.sh](https://skills.sh/michaelharms/skills). There's nothing to submit: skills.sh lists a public repo's skills once they've been installed with `npx skills add`, and ranks them by those installs.

### Manually

Copy `skills/<name>/` into `.claude/skills/` in a project (or `~/.claude/skills/` for all projects), or wherever your agent reads skills from.

## Update

The plugins carry no version number, so every commit to `main` counts as a new version.

### Claude Code

```bash
claude plugin marketplace update michaelharms                     # fetch the latest catalog
claude plugin update nextjs-fullstack-architecture@michaelharms   # update an installed skill
claude plugin update epic-react-practices@michaelharms
```

Then run `/reload-plugins` or restart Claude Code; open sessions keep the version they started with.

**Automatic updates** are off by default for marketplaces outside Anthropic's own. Turn them on in `/plugin` → Marketplaces → Enable auto-update, or for a whole team with `"autoUpdate": true` in the marketplace entry of `.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "michaelharms": { "source": { "source": "github", "repo": "michaelharms/skills" }, "autoUpdate": true }
}
```

Claude Code then refreshes the marketplace and updates installed skills in the background shortly after startup, and offers `/reload-plugins` when something changed.

### Other agents

```bash
npx skills update
```

This updates every skill installed with `npx skills add`; add skill names to update only those, or `-g` / `-p` to limit it to global or project skills.

### Manually

Copy the skill folder again. Delete the old one first, so files that were removed or renamed don't stay behind.

### After updating

Deviations a project recorded in its `AGENTS.md` still win over the skill, so an update never overrides a project's decisions. Files a project copied from `assets/` (the ESLint config, `CODING_STANDARDS.md`, the adoption ADR) are the project's own copies and aren't updated; compare them with the new versions when an update changes them.

## Use a skill from a project's AGENTS.md

Skills load on their own when a task matches their description. To make sure every agent working in a project uses the right one, and to record project-specific deviations, add a section to the project's `AGENTS.md`. For the architecture skill:

1. Copy [`assets/agents-md-snippet.md`](skills/nextjs-fullstack-architecture/assets/agents-md-snippet.md) into the project's `CLAUDE.md` or `AGENTS.md` (whichever exists). It's a few navigation pointers plus the project's list of deviations.
2. Copy [`assets/templates/adr-adopt-architecture.md`](skills/nextjs-fullstack-architecture/assets/templates/adr-adopt-architecture.md) to `docs/adr/0001-follow-nextjs-fullstack-architecture.md`, so tools that read ADRs see the architecture's constraints even when the skill isn't loaded.
3. Copy [`assets/templates/coding-standards.md`](skills/nextjs-fullstack-architecture/assets/templates/coding-standards.md) to `CODING_STANDARDS.md`, so review tools that read standards files apply the judgement calls lint can't enforce.

The full setup is in [`references/setup.md`](skills/nextjs-fullstack-architecture/references/setup.md).

## Works with other skills and tools

`nextjs-fullstack-architecture` defines what a spec, ticket or ADR must settle for the architecture (rules, failures, permissions, events, data changes, test seams), not which tool writes it, so it works with any planning, implementation or review skill. Other tools see the architecture through the files most of them read: the project's `AGENTS.md`/`CLAUDE.md`, `GLOSSARY.md`, ADRs in `docs/adr/` and `CODING_STANDARDS.md`. Without a planning tool, it brings its own spec, ticket and ADR templates. See [`references/planning.md`](skills/nextjs-fullstack-architecture/references/planning.md).

## How the skills are organized

Skills use progressive disclosure, so an agent only reads what the task needs:

1. **Name and description** are always in the agent's context (a few hundred tokens), so it knows when to load the skill.
2. **`SKILL.md`** loads when the skill triggers. It holds the map, the rules that apply to every change, and a table that routes each kind of task to its reference files.
3. **`references/*.md`** load only when the task needs them: writing domain code reads `domain.md`, reviewing a PR reads `review-checklist.md`, writing a spec, issue or ADR reads `planning.md`.
4. **`assets/`** holds files to copy into projects (configs, templates); they're never read into context unless needed.

```
.claude-plugin/
  marketplace.json                  Claude Code marketplace: one plugin entry per skill
.github/
  workflows/
    validate.yml                    Runs the checks and both installers' validation on every push
scripts/
  check-skills.mjs                  Checks frontmatter, references, marketplace entries and file-tree order
skills/
  <skill-name>/
    assets/
    references/
    SKILL.md
LICENSE
README.md
```

## Add a skill

1. Create `skills/<skill-name>/SKILL.md` with `name` (equal to the folder name) and `description` frontmatter. The description decides when agents load the skill: say what it does and list the situations it's for.
2. Keep `SKILL.md` short; put details in `references/` and link each reference from `SKILL.md` with when to read it.
3. Add a plugin entry to `.claude-plugin/marketplace.json`, with `"source": "./"`, `"strict": false` and `"skills": ["./skills/<skill-name>"]`, so each skill installs on its own.
4. Run the checks:

   ```bash
   node scripts/check-skills.mjs
   npx @anthropic-ai/claude-code plugin validate .
   npx skills add . --list
   ```

## License

[MIT](LICENSE)
