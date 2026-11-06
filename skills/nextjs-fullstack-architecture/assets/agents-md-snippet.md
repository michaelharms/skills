## Architecture

This project follows the `nextjs-fullstack-architecture` skill (https://github.com/michaelharms/skills/tree/main/skills/nextjs-fullstack-architecture). Load it before writing, moving or reviewing code, and before writing specs, tickets or ADRs, whatever tool you use for them. Its `SKILL.md` says which references to read.

- Rules enforced by lint: `eslint.boundaries.mjs`. Fix violations by moving code; don't disable or loosen rules.
- Review standards: `CODING_STANDARDS.md`.
- Architecture decision and its constraints: `docs/adr/0001-follow-nextjs-fullstack-architecture.md`.

### Setup

What this project has set up. Use only these; adding another piece (or a second transport) is a decision, recorded here and, when it brings a vendor, in an ADR. Create files only when they get content: no empty placeholders.

- Transport: <tRPC | server actions | both>
- Tracing: <not set up | OpenTelemetry via @vercel/otel>
- Analytics: <not set up | set up without a provider | set up, provider: …>
- Logging: <console sink | pino | …>
- Storybook: <no | yes>
- shadcn/ui: <no | yes>

### Deviations

These project rules override the skill. Each links to its ADR.

- None yet.
