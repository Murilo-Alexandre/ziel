# Ziel Technical Architecture

## Table of contents

1. Baseline stack
2. Architectural layers
3. Suggested folder structure
4. State and data flow
5. Persistence adapters
6. Native capability adapters
7. Recurrence engine placement
8. Android target
9. PWA target
10. Backup/export
11. Testing strategy
12. Build quality gates
13. Dependency guidelines

## 1. Baseline stack

Use the agreed baseline unless an existing repository already contains a compatible alternative that should be preserved:

- React
- TypeScript
- Vite
- Capacitor

Choose stable, mutually compatible dependency versions at implementation time.

First shipping target: Android APK.

Future target: PWA/browser/iPhone usage without rewriting core business logic.

## 2. Architectural layers

Keep dependencies pointing inward.

```text
UI / React
   |
Application / use-cases / queries
   |
Domain / pure rules
   |
Ports (repositories, media, clock, backup)
   |
Adapters (SQLite, IndexedDB, Capacitor Camera, Filesystem, browser APIs)
```

Domain must not import React, Capacitor, SQLite, IndexedDB, or browser APIs.

## 3. Suggested folder structure

Adapt to the repository, but a strong default is:

```text
src/
  app/
    navigation/
    providers/
  domain/
    goals/
    recurrence/
    cycles/
    progress/
    journal/
  application/
    commands/
    queries/
    services/
  infrastructure/
    persistence/
      repositories/
      sqlite/
      indexeddb/
      migrations/
    platform/
      camera/
      files/
      notifications/
      clock/
    backup/
  features/
    today/
    agenda/
    goals/
    goal-editor/
    goal-details/
    progress/
    settings/
  shared/
    components/
    theme/
    utils/
```

Do not create giant feature files that mix SQL, recurrence math, and JSX.

## 4. State and data flow

Prefer persisted domain state as source of truth.

A typical flow:

```text
UI action
 -> application command
 -> domain validation/calculation
 -> repository transaction
 -> query/cache invalidation
 -> UI refresh
```

Use local component state for draft forms and transient UI state. Use a query/cache layer or application state library only where it reduces complexity; do not make it the authoritative database.

## 5. Persistence adapters

Recommended architecture:

### Android/native

Use a SQLite-capable Capacitor adapter/plugin compatible with the chosen Capacitor version.

### Web/PWA

Use IndexedDB through a small persistence adapter, potentially via a stable library.

Do not force the same storage technology if that creates platform fragility. Keep repository contracts shared and implement platform-specific adapters.

Use schema migrations from the beginning.

## 6. Native capability adapters

Create ports such as:

```ts
interface CameraPort {
  capturePhoto(): Promise<CapturedMedia | null>
  pickImage(): Promise<CapturedMedia | null>
}

interface FilePickerPort {
  pickFile(): Promise<PickedFile | null>
}
```

Then implement with Capacitor/native/browser mechanisms.

Never call camera/filesystem directly from reusable goal components.

Future notification support should follow the same pattern.

## 7. Recurrence engine placement

Recurrence, cycle boundaries, occurrence keys, and aggregation should be pure/testable domain functions/services wherever possible.

Examples:

- `getCycleWindow(date, rule)`
- `scheduleMatchesDate(date, schedule, activePeriod)`
- `expectedDates(range, schedule, activePeriod)`
- `occurrenceKey(goalId, revisionId, date, slot)`
- `aggregateCycleProgress(inputs, rule)`

The UI preview must call these rules rather than implement a second recurrence algorithm.

## 8. Android target

Initial development should support:

- Capacitor Android project;
- camera permission/capture;
- image/file selection;
- local persistent database;
- attachment storage/URI handling;
- offline use;
- APK build when Android SDK is available.

Do not assume Play Store signing/release configuration is required for the first personal APK.

## 9. PWA target

Architect now for:

- responsive mobile layout;
- browser storage adapter;
- service worker/offline shell later;
- browser file/image selection;
- graceful feature detection where native capabilities differ.

Do not let Android-only plugin types leak into domain/application interfaces.

## 10. Backup/export

V1 should be able to export a portable backup containing:

- goal definitions/revisions;
- cycles/occurrences;
- records;
- attachment metadata;
- attachments themselves when feasible.

A robust format is a versioned ZIP or JSON-plus-files package, but choose an implementation appropriate to the app stack.

Import must validate schema version and avoid partial destructive overwrite on failure.

## 11. Testing strategy

### Unit tests

Prioritize pure rules:

- recurrence;
- cycle windows;
- occurrence keys;
- active period;
- aggregation;
- completion criteria;
- revision selection;
- edit scope semantics.

### Repository tests

Test idempotency and transactional history behavior against the chosen local persistence implementation.

### Component tests

Cover critical interaction:

- expand/collapse;
- quick status sheet;
- goal editor validation;
- evidence composer.

### End-to-end/manual smoke

Vertical slice:

Create `Treinar` -> add Football/Running/Strength schedules -> open Monday/Wednesday -> update status -> restart/reload -> history persists.

## 12. Build quality gates

At meaningful milestones run:

1. TypeScript typecheck
2. unit tests
3. relevant component/integration tests
4. production web build
5. Capacitor sync if native files changed
6. Android build if SDK/toolchain is available

Record exact results. Do not claim success without execution.

## 13. Dependency guidelines

- Prefer fewer, well-maintained dependencies.
- Avoid libraries that own the domain model.
- Isolate recurrence libraries behind adapters if one is used.
- Centralize date utilities.
- Avoid multiple competing date libraries unless necessary.
- Choose dependencies that support the current stable stack at implementation time.
- Do not commit secrets, private signing keys, or machine-specific paths.
