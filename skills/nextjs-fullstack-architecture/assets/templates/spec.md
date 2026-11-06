# <Feature name, in the glossary's terms>

## Problem Statement

<The problem the user faces, from the user's perspective.>

## Solution

<The solution, from the user's perspective.>

## User Stories

1. As a <role>, I want <capability>, so that <benefit>.
2. <Include stories for what happens when something isn't allowed or goes wrong.>

## Rules

| Rule | Kind (invariant / precondition / policy / external data / concurrency) | When broken, the user sees (kind: message) |
|---|---|---|
| <Only the owner can archive a task> | policy | <not_found: "This task doesn't exist or was deleted."> |

## Analytics events

<Only if the project has analytics set up; otherwise delete this section.>

| Event | When | Properties (no personal data) |
|---|---|---|
| <task.archived> | <after a task is archived> | <taskId, daysSinceCompleted> |

## Implementation Decisions

<Names, not file paths: modules, entities and states, transitions, use-cases, error codes and kinds, events, data changes and migrations, and the procedure, action or route handler (in a transport the project uses).>

## Testing Decisions

<What is tested and how, following the project's testing approach.>

## Out of Scope

<What this spec deliberately leaves out.>

## Further Notes

<Open questions, links, related ADRs.>
