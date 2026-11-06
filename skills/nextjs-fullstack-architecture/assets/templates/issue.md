# <Verb phrase from the user's perspective, e.g. "Archive completed tasks">

## Parent

<Link to the spec or parent issue, if any.>

## What to build

<The end-to-end behavior this slice adds, demoable on its own.>

<Names, not file paths: module, state or transition, use-case, error codes, events, procedure or action.>

## Rules

| Rule | Kind | When broken, the user sees (kind: message) |
|---|---|---|
| <Only completed tasks can be archived> | precondition | <conflict: "Only completed tasks can be archived."> |

## Analytics events

<Only if the project has analytics set up; otherwise delete this section.>

| Event | When | Properties |
|---|---|---|
| <task.archived> | <after a task is archived> | <taskId, daysSinceCompleted> |

## Acceptance criteria

- [ ] <Observable outcome.>
- [ ] <One criterion per rule above, stating what the user sees.>
- [ ] <Each event is recorded once per occurrence (with analytics).>

## Blocked by

<Link to the blocking issue, or "None, can start immediately".>
