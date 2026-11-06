## Architecture

This project follows the `nextjs-fullstack-architecture` skill (https://github.com/michaelharms/skills/tree/main/skills/nextjs-fullstack-architecture). Load it before writing, moving or reviewing code, and before writing specs, tickets or ADRs, whatever tool you use for them. Its `SKILL.md` says which references to read.

- Rules enforced by lint: `eslint.boundaries.mjs`. Fix violations by moving code; don't disable or loosen rules.
- Review standards: `CODING_STANDARDS.md`.
- Architecture decision and its constraints: `docs/adr/0001-follow-nextjs-fullstack-architecture.md`.

### Setup

What this project uses. Use only these; adding another piece (or a second transport) is a decision, recorded here and, when it brings a vendor, in an ADR. A piece listed here is built by the first change that needs it, so check the code for what exists already. Create files only when they get content: no empty placeholders.

- Transport: <tRPC | server actions | both | undecided: ask the user before the first procedure or action>
- Tracing: <no | OpenTelemetry via @vercel/otel>
- Analytics: <no | yes, without a provider | yes, provider: …>
- Logging: <console sink | pino | …>
- Storybook: <no | yes>
- shadcn/ui: <no | yes>

### Deviations

These project rules override the skill. Each links to its ADR.

- None yet.
