// Architecture boundaries for the project structure described in AGENTS.md.
//
// Usage in eslint.config.mjs (after your Next/TypeScript config, which provides the TS parser):
//
//   import { defineConfig } from "eslint/config";
//   import boundariesConfig from "./eslint.boundaries.mjs";
//   export default defineConfig([...nextConfig, ...boundariesConfig]);
//
// Requires: eslint-plugin-boundaries@^7, eslint-import-resolver-typescript (resolves the "@/*" alias).

import boundaries from "eslint-plugin-boundaries";

const SAME_MODULE = "{{ from.element.captured.module }}";

/** Element whose path is matched from the project root. */
const element = (type, pattern, capture) => ({
  type,
  pattern,
  partialMatch: false,
  ...(capture && { capture }),
});

/** Target selector: any element of these types. */
const to = (...types) => ({ to: { element: { types: { anyOf: types } } } });

/** Target selector: elements of these types inside the importer's own module. */
const toSameModule = (...types) => ({
  to: { element: { types: { anyOf: types }, captured: { module: SAME_MODULE } } },
});

/** Policy: elements of type `from` may import the given targets. */
const allow = (from, ...targets) => ({
  from: { element: { type: from } },
  allow: targets,
});

/** The tRPC React client is the only server file client code may import. */
const toTrpcClient = { to: { element: { type: "server", fileInternalPath: "trpc/react.tsx" } } };

const DRIZZLE = {
  group: ["drizzle-orm", "drizzle-orm/*", "drizzle-kit", "drizzle-zod"],
  message: "Drizzle is an infrastructure detail. Only src/db/** and src/modules/*/persistence/** may import it.",
};
const NEXT_RUNTIME = {
  group: ["next/*"],
  message: "Modules outside components/ and hooks/ are framework-agnostic. Resolve request data in the delivery layer and pass it in.",
};
const TRPC = {
  group: ["@trpc/*", "next-safe-action", "next-safe-action/*"],
  message: "tRPC and server actions belong to the delivery layer (src/server/). Modules expose use-cases, not procedures.",
};
const VENDORS = {
  // Logging, tracing and analytics libraries stay behind their sinks so they can be swapped per project.
  // The analytics entries are examples: add your provider's SDK here if it's missing.
  group: ["pino", "pino/*", "pino-pretty", "pino-http", "posthog-node", "@vercel/otel", "@opentelemetry/sdk-*", "@opentelemetry/exporter-*", "@sentry/*", "winston", "@segment/*", "@amplitude/*", "mixpanel"],
  message: "Vendor libraries are only imported in src/lib/logger/sinks/**, src/lib/analytics/sinks/** and src/instrumentation.ts. Use ctx.logger / ctx.events.",
};
const OTEL_API = {
  group: ["@opentelemetry/*"],
  message: "The domain is pure: no tracing. Spans are created by the delivery layer.",
};
const REACT = {
  group: ["react", "react-dom", "react/*", "react-dom/*"],
  message: "Only components/ and hooks/ may use React.",
};
const SERVER_ONLY = {
  group: ["server-only"],
  message: "The domain is client-safe. It must not import server-only.",
};

const DEEP_RELATIVE = {
  regex: "^\\.\\./\\.\\./",
  message: "Use relative imports only inside a module or folder (./x, ../x). Across modules and layers, import with the @/ alias.",
};

// Every no-restricted-imports config below replaces the previous one for its files, so each includes DEEP_RELATIVE.
const restrict = (...patterns) => ["error", { patterns: [...patterns, DEEP_RELATIVE] }];

/** Fails every file matched by the config it's used in, with the given message. */
const rejectFile = (message) => ["error", { selector: "Program", message }];

const NO_BARRELS = [
  "error",
  {
    selector: "ExportAllDeclaration",
    message: "No barrels or re-exports: export from the file that defines the thing, and import from that file.",
  },
  {
    selector: "ExportNamedDeclaration[source]",
    message: "No barrels or re-exports: export from the file that defines the thing, and import from that file.",
  },
];

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        element("app", "src/app"),
        element("screen", "src/screens"),
        element("primitive", "src/components/primitives"),
        element("pattern", "src/components/patterns"),
        element("shell", "src/components/shells"),
        element("domain", "src/modules/*/domain", ["module"]),
        element("use-case", "src/modules/*/use-cases", ["module"]),
        element("persistence", "src/modules/*/persistence", ["module"]),
        element("module-ui", "src/modules/*/components", ["module"]),
        element("module-hooks", "src/modules/*/hooks", ["module"]),
        element("module-utils", "src/modules/*/utils", ["module"]),
        // Everything else in a module (schemas, dtos, errors, constants, urls, and their folders once promoted).
        element("module", "src/modules/*", ["module"]),
        element("server", "src/server"),
        element("db", "src/db"),
        element("lib", "src/lib"),
      ],
      "boundaries/files": [
        { category: "test", pattern: "**/*.test.{ts,tsx}" },
        { category: "story", pattern: "**/*.stories.{ts,tsx}" },
        { category: "fixture", pattern: "**/*.fixtures.{ts,tsx}" },
        // Next.js entry files that must sit directly in src/.
        { category: "next-entry", pattern: ["src/proxy.ts", "src/instrumentation.ts", "src/instrumentation-client.ts"] },
      ],
    },
    rules: {
      // Files must live in a known place: no new top-level folders without updating AGENTS.md and this config.
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.types.[0] }} may not import {{ to.element.types.[0] }} ({{ dependency.source }}). See 'Import rules' in AGENTS.md.",
          policies: [
            allow("app", to("app", "screen", "shell", "primitive", "pattern", "module", "module-ui", "module-hooks", "server", "lib")),
            allow("screen", to("screen", "shell", "primitive", "pattern", "module", "module-ui", "module-hooks", "module-utils", "domain", "use-case", "server", "lib")),
            allow("shell", to("shell", "primitive", "pattern", "module", "module-ui", "lib")),
            allow("pattern", to("pattern", "primitive", "lib")),
            allow("primitive", to("primitive", "lib")),

            allow("module-ui", to("primitive", "pattern", "module", "module-ui", "domain", "lib"), toSameModule("module-hooks", "module-utils"), toTrpcClient),
            allow("module-hooks", to("module", "domain", "lib"), toSameModule("module-hooks", "module-utils"), toTrpcClient),
            allow("module-utils", to("lib"), toSameModule("domain", "module", "module-utils")),
            allow("module", to("module", "lib"), toSameModule("domain")),
            allow("domain", to("domain"), {
              // The domain may use its own module's errors and constants, nothing else from the module root.
              to: {
                element: {
                  type: "module",
                  captured: { module: SAME_MODULE },
                  fileInternalPath: ["errors.ts", "errors/**", "constants.ts", "constants/**"],
                },
              },
            }),
            allow("use-case", to("module", "domain", "use-case", "lib"), toSameModule("persistence")),
            allow("persistence", to("domain", "db", "lib"), toSameModule("module", "persistence")),

            allow("server", to("server", "module", "use-case", "db", "lib")),
            allow("db", to("db", "lib")),
            allow("lib", to("lib")),
            { from: { file: { categories: "next-entry" } }, allow: [to("server", "lib", "module")] },

            // Type-only imports of the router and DB types (AppRouter, Db) are fine outside the pure layers.
            {
              from: { element: { types: { noneOf: ["domain", "module", "module-utils", "primitive", "pattern"] } } },
              allow: { to: { element: { types: { anyOf: ["server", "db"] } } }, dependency: { kind: "type" } },
            },
            // lib/app-context.ts types the current user with domain value objects (UserId).
            { from: { element: { type: "lib" } }, allow: { to: { element: { type: "domain" } }, dependency: { kind: "type" } } },

            // Production code never imports tests, stories or fixtures...
            {
              disallow: { to: { file: { categories: { anyOf: ["test", "story", "fixture"] } } } },
              message: "Production code may not import tests, stories or fixtures ({{ dependency.source }}).",
            },
            // ...but tests, stories and fixtures may import anything they need to set up (including each other).
            {
              from: { file: { categories: { anyOf: ["test", "story", "fixture"] } } },
              allow: { to: { element: { isUnknown: false } } },
            },
          ],
        },
      ],
      // Drizzle stays inside db/ and persistence/; vendor SDKs stay inside their sinks.
      "no-restricted-imports": restrict(DRIZZLE, VENDORS),
      // Logging goes through ctx.logger (or rootLogger outside requests), never console.
      "no-console": "error",
      "no-restricted-syntax": NO_BARRELS,
    },
  },
  {
    files: ["src/db/**", "src/modules/*/persistence/**"],
    rules: { "no-restricted-imports": restrict(VENDORS) },
  },
  {
    // The only places that know which logging, tracing and analytics libraries are used.
    files: ["src/lib/logger/sinks/**", "src/lib/analytics/sinks/**", "src/instrumentation.ts"],
    rules: { "no-restricted-imports": restrict(DRIZZLE) },
  },
  {
    files: ["src/lib/logger/sinks/console-sink.ts", "**/*.test.{ts,tsx}", "src/app/**/error.tsx", "src/app/**/global-error.tsx"],
    rules: { "no-console": "off" },
  },
  {
    // Module contract files and utils: client-safe and framework-agnostic.
    // (`import type { Route } from "next"` in urls.ts stays allowed; only next/* is blocked.)
    files: ["src/modules/*/**"],
    ignores: [
      "src/modules/*/components/**",
      "src/modules/*/hooks/**",
      "src/modules/*/persistence/**",
    ],
    rules: { "no-restricted-imports": restrict(DRIZZLE, VENDORS, NEXT_RUNTIME, TRPC, REACT) },
  },
  {
    files: ["src/modules/*/domain/**"],
    rules: { "no-restricted-imports": restrict(DRIZZLE, VENDORS, NEXT_RUNTIME, TRPC, REACT, SERVER_ONLY, OTEL_API) },
  },
  {
    // No index files: they only exist to make barrels or folder-per-file imports.
    files: ["src/**/index.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": rejectFile(
        "No index files. Name the file after what it contains (task-card.tsx) and import it by that name.",
      ),
    },
  },
  {
    // Layer folders stay flat: a file per thing, siblings with a shared prefix, no folder per component.
    files: [
      "src/modules/*/{domain,use-cases,persistence,components,hooks,utils}/*/**",
      "src/components/*/*/**",
    ],
    rules: {
      "no-restricted-syntax": rejectFile(
        "Layer folders are flat: put the file directly in the layer folder (task-card.tsx, task-card-menu.tsx). If the folder gets crowded, split the module.",
      ),
    },
  },
  {
    // Tests, stories and mocks live next to the file they cover, never in separate folders.
    files: ["src/**/__tests__/**", "src/**/__stories__/**", "src/**/__mocks__/**", "src/**/tests/**", "src/**/stories/**"],
    rules: {
      "no-restricted-syntax": rejectFile(
        "Tests and stories live next to the file they cover (task-card.tsx → task-card.test.tsx, task-card.stories.tsx). Move this file and delete the folder.",
      ),
    },
  },
];
