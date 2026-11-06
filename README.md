# Skills

[![skills.sh](https://skills.sh/b/michaelharms/skills)](https://skills.sh/michaelharms/skills)

Agent skills I use across projects. Each skill is a folder with a `SKILL.md` that agents load when a task matches, reference files they open only when needed, and a `README.md` for humans with the skill's setup and docs.

| Skill | What it does |
|---|---|
| [`nextjs-fullstack-architecture`](skills/nextjs-fullstack-architecture/README.md) | Architecture rules for full-stack Next.js + TypeScript apps (App Router, Drizzle, Zod, Vercel, with tRPC and/or next-safe-action): where files go, layers, domain modeling, error handling, logging with optional tracing and analytics, test and story placement, lint-enforced boundaries, tickets and ADRs. Sets up a project with one prompt, and existing projects adopt it incrementally. [Setup and docs](skills/nextjs-fullstack-architecture/README.md). |
| [`epic-react-practices`](skills/epic-react-practices/README.md) | React guidelines in the style Kent C. Dodds teaches in Epic React (an unofficial distillation): where state lives, deriving instead of syncing, disciplined effects, composition over prop drilling, advanced component patterns, forms and actions, Suspense, error boundaries, measured performance work, accessibility and Testing Library. Framework-agnostic; setup adds a pointer to the project's `AGENTS.md`. [Setup and docs](skills/epic-react-practices/README.md). |

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

Deviations a project recorded in its `AGENTS.md` still win over the skill, so an update never overrides a project's decisions. Files a project copied from a skill (such as the architecture skill's ESLint config) are the project's own copies and aren't updated; each skill's README says which ones to compare after an update.

## Set up a skill in a project

Skills load on their own when a task matches their description. What a skill needs beyond that is in its README: [`nextjs-fullstack-architecture`](skills/nextjs-fullstack-architecture/README.md) sets up a project with one prompt and is adopted incrementally in existing ones, and [`epic-react-practices`](skills/epic-react-practices/README.md) adds a short section to the project's `AGENTS.md` that points agents at it and records the project's deviations.

## How the skills are organized

Skills use progressive disclosure, so an agent only reads what the task needs:

1. **Name and description** are always in the agent's context (a few hundred tokens), so it knows when to load the skill.
2. **`SKILL.md`** loads when the skill triggers. It holds the map, the rules that apply to every change, and a table that routes each kind of task to its reference files.
3. **`references/*.md`** load only when the task needs them: writing domain code reads `domain.md`, reviewing a PR reads `review-checklist.md`, writing a spec, issue or ADR reads `planning.md`.
4. **`assets/`** holds files to copy into projects (configs, templates); they're never read into context unless needed.
5. **`README.md`** is for humans: what the skill does, how to install and set it up, and what's in the folder. GitHub shows it on the skill's folder, which is the plugin's homepage. Agents don't load it.

```
.claude-plugin/
  marketplace.json                  Claude Code marketplace: one plugin entry per skill
.github/
  workflows/
    validate.yml                    Runs the checks and both installers' validation on every push
scripts/
  check-skills.mjs                  Checks frontmatter, READMEs, references, marketplace entries and file-tree order
skills/
  <skill-name>/
    assets/
    references/
    README.md
    SKILL.md
LICENSE
README.md
```

## Add a skill

1. Create `skills/<skill-name>/SKILL.md` with `name` (equal to the folder name) and `description` frontmatter. The description decides when agents load the skill: say what it does and list the situations it's for.
2. Keep `SKILL.md` short; put details in `references/` and link each reference from `SKILL.md` with when to read it.
3. Write `skills/<skill-name>/README.md` for humans: what the skill does, how to install it on its own, how to set it up in a project (or that it needs no setup), and what's in the folder. Keep it out of `SKILL.md`, which every agent that loads the skill reads. skills.sh shows `SKILL.md`, not the README.
4. Add a plugin entry to `.claude-plugin/marketplace.json`, with `"source": "./"`, `"strict": false` and `"skills": ["./skills/<skill-name>"]`, so each skill installs on its own.
5. Run the checks:

   ```bash
   node scripts/check-skills.mjs
   npx @anthropic-ai/claude-code plugin validate .
   npx skills add . --list
   ```

## License

[MIT](LICENSE)
