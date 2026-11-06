# nextjs-fullstack-architecture

Architecture rules for full-stack Next.js + TypeScript apps on the App Router, with Drizzle, Zod and Vercel, and tRPC and/or server actions (`next-safe-action`). The skill tells your agent where files go, how the layers depend on each other, how to model the domain, how to handle errors, log and trace, where tests and stories live, and how to write specs, tickets and ADRs that fit. An ESLint config enforces the boundaries, so violations show up in lint instead of in review.

Projects set up only the pieces they need, and the code for each piece is written by the first feature that needs it. Existing projects adopt it incrementally: no big-bang refactor.

## Contents

- What you get
- Install
- Set up a new project
- Adopt in an existing project
- Record deviations
- After updating the skill
- Works with other skills and tools
- What's inside

## What you get

- **A map of the codebase**: vertical modules (`src/modules/<domain>/`) with a pure `domain/`, `use-cases/` that get everything through a context, and `persistence/` as the only module code that touches Drizzle. Thin tRPC procedures and server actions in `src/server/`, routing only in `src/app/`.
- **Rules that hold for every change**, and a routing table that sends the agent to the one reference the task needs, so it doesn't read the whole skill every time.
- **Lint-enforced boundaries**: `assets/eslint.boundaries.mjs` fails on files outside the known layers, on imports that cross layers the wrong way, on barrels and on vendor SDKs outside their sinks.
- **Errors, logging, tracing and analytics** that work the same across transports: errors with a code and a kind, one outcome log line per operation, debug lines that are only written when a request fails, and business events that are only sent on success.
- **Planning support**: what a spec, ticket or ADR must settle for this architecture, with templates for projects that don't use a planning tool.

## Install

Claude Code:

```bash
/plugin marketplace add michaelharms/skills
/plugin install nextjs-fullstack-architecture@michaelharms
```

Codex, Cursor, GitHub Copilot and other agents:

```bash
npx skills add michaelharms/skills --skill nextjs-fullstack-architecture
```

For a whole team on Claude Code, commit this to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "michaelharms": { "source": { "source": "github", "repo": "michaelharms/skills" } }
  },
  "enabledPlugins": { "nextjs-fullstack-architecture@michaelharms": true }
}
```

Updating, automatic updates and manual installs are covered in the [repository README](../../README.md).

## Set up a new project

### With one prompt

Open an empty folder (or a fresh `create-next-app` project) with the skill installed and ask your agent:

> Set up nextjs-fullstack-architecture in this project.

The agent follows the setup workflow in [`references/setup.md`](references/setup.md):

1. **Asks you** which optional pieces the project uses (see below), in one round of questions with a default for each.
2. **Scaffolds** the app with `create-next-app` if there isn't one (TypeScript, App Router, `src/`, the `@/*` alias).
3. **Installs the lint tooling** (`eslint-plugin-boundaries`, `eslint-import-resolver-typescript`), copies the boundaries config and wires it into `eslint.config.mjs`, and turns on `typedRoutes`. If you chose Storybook or shadcn/ui, it runs their init commands.
4. **Points the project's agents at the skill**: a section in `AGENTS.md` (or `CLAUDE.md`) with your choices, `docs/adr/0001-follow-nextjs-fullstack-architecture.md`, and `CODING_STANDARDS.md` for review tools.
5. **Verifies** that lint, the type check and `next build` pass with the boundary rules at error level.
6. **Reports** what it set up and what's left for you.

What's left for you comes later, when the code first needs it: creating the Postgres database and setting `DATABASE_URL` once the first table exists, and adding keys once tracing or an analytics provider is built.

### What setup doesn't do

Setup writes no infrastructure code. The error classes, the logger, the request context, the Drizzle client and the tRPC or server-action plumbing are built by the first feature that needs them, together with their dependencies and environment variables. Ask for a feature ("users can create tasks") right after setup, and the agent builds the shared pieces that feature uses first.

This keeps the project free of empty placeholders and unused dependencies, and every piece is written for the choices the project actually made: without analytics there's no event buffer, without tracing no spans.

### The optional pieces

| Piece | Choose it when |
|---|---|
| tRPC | Client components fetch and cache data: lists that refetch, optimistic updates |
| Server actions (`next-safe-action`) | Mutations come from forms, or end in a redirect or revalidation |
| Tracing (OpenTelemetry) | You need to see which steps a request ran and how long each took |
| Analytics | The product needs business events |
| Analytics provider (PostHog, Segment, …) | Events should reach an analytics tool, not only the logs |
| Logging library (pino, …) | JSON lines on stdout (enough on Vercel) aren't enough |
| Storybook | Components' visual states should be built and reviewed in isolation |
| shadcn/ui | You want its primitives |

Most projects use at least one of tRPC and server actions; both is fine too. Adding a piece later is a decision: tell the agent, and it updates the "Setup" list and writes an ADR when the piece brings a vendor or a second transport.

### By hand

1. `npx create-next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*"`
2. `npm i -D eslint-plugin-boundaries eslint-import-resolver-typescript`
3. Copy [`assets/eslint.boundaries.mjs`](assets/eslint.boundaries.mjs) to the project root and spread it into `eslint.config.mjs` after the Next config (the snippet is in "Configuration" in [`references/setup.md`](references/setup.md)). Set `typedRoutes: true` in `next.config.ts`.
4. Add [`assets/agents-md-snippet.md`](assets/agents-md-snippet.md) to the project's `AGENTS.md` or `CLAUDE.md` and fill in its "Setup" list.
5. Copy [`assets/templates/adr-adopt-architecture.md`](assets/templates/adr-adopt-architecture.md) to `docs/adr/0001-follow-nextjs-fullstack-architecture.md` and [`assets/templates/coding-standards.md`](assets/templates/coding-standards.md) to `CODING_STANDARDS.md`.

## Adopt in an existing project

The architecture is adopted incrementally. It never needs a big-bang refactor: old and new structure live side by side, and the project keeps shipping while it migrates.

- **The same prompt works**, and setup touches only configuration and docs. It doesn't move, rewrite or delete existing code; it lists what isn't migrated yet instead.
- **Lint starts as warnings**, so CI stays green from the first day. Warnings in new code still get fixed.
- **Legacy code is recorded as a temporary exemption** in `AGENTS.md`, so agents follow the rules in new code without copying old patterns or "fixing" code the task doesn't touch.
- **Modules migrate as features touch them**, one reviewable change at a time, starting with the modules that change most. When no warnings are left, the exemption goes and the rules become errors again.

If the app isn't under `src/` yet, the agent proposes moving it as a first, mechanical step, and waits for your go-ahead. The details are in "Adopting in an existing project" in [`references/setup.md`](references/setup.md).

## Record deviations

The project's `AGENTS.md` section has a "Deviations" list. Anything listed there overrides the skill, and agents follow it instead of "fixing" it. Record each deviation with a link to the ADR that explains it, so the next reader knows it's deliberate.

## After updating the skill

Deviations in the project's `AGENTS.md` still win, so an update never overrides the project's decisions. The files a project copied from `assets/` (the ESLint config, `CODING_STANDARDS.md`, the adoption ADR) are the project's own copies and aren't updated; compare them with the new versions when an update changes them.

## Works with other skills and tools

The skill defines what a spec, ticket or ADR must settle for the architecture (rules, failures, permissions, events, data changes, test seams), not which tool writes it, so it works with any planning, implementation or review skill. Other tools see the architecture through the files most of them read: the project's `AGENTS.md` or `CLAUDE.md`, `GLOSSARY.md`, the ADRs in `docs/adr/` and `CODING_STANDARDS.md`. Without a planning tool, the skill brings its own spec, ticket and ADR templates. See [`references/planning.md`](references/planning.md).

## What's inside

`SKILL.md` is what the agent loads: the map, the rules for every change, and which reference to read for which task. References load only when a task needs them; assets are copied into projects.

```
nextjs-fullstack-architecture/
  assets/
    templates/
      adr-adopt-architecture.md   The ADR recording that a project follows this architecture
      adr.md                      ADR template, for projects without a planning tool
      coding-standards.md         The project's CODING_STANDARDS.md: judgement calls lint can't enforce
      issue.md                    Ticket template
      spec.md                     Spec template
    agents-md-snippet.md          The section a project adds to its AGENTS.md
    eslint.boundaries.mjs         Lint config enforcing layers, flat folders and vendor isolation
  references/
    contracts.md                  Input schemas, DTOs, constants
    decisions.md                  Why the architecture is this way
    delivery.md                   tRPC, server actions, route handlers, auth and request context
    domain.md                     Entities, value objects, invariants, transitions
    error-handling.md             Error classes, kinds, mapping and messages
    import-rules.md               What may import what
    observability.md              Logs, tracing, analytics events, debugging
    planning.md                   Specs, tickets and ADRs
    review-checklist.md           Reviewing code against the architecture
    setup.md                      Setting up, adopting, and building shared pieces on first use
    stories.md                    Storybook stories
    structure.md                  Where files go
    test-files.md                 Where tests, stories and fixtures go
    ui-and-routing.md             Pages, screens, components, forms, links
    use-cases-and-persistence.md  Use-cases, AppContext, Drizzle queries
  README.md
  SKILL.md
```

## License

[MIT](../../LICENSE)
