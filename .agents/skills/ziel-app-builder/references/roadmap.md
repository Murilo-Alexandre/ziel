# Ziel Development Roadmap

## Table of contents

1. Delivery principle
2. Phase 0 — Repository foundation
3. Phase 1 — Domain core
4. Phase 2 — Local persistence
5. Phase 3 — First vertical slice
6. Phase 4 — Goal editor depth
7. Phase 5 — Evidence timeline
8. Phase 6 — History, agenda, progress
9. Phase 7 — Backup and Android hardening
10. Phase 8 — APK milestone
11. Post-V1

## 1. Delivery principle

Reach a real end-to-end flow early. Do not spend weeks on static screens before recurrence and persistence work.

Target vertical slice:

**Criar meta -> criar submetas -> configurar dias -> salvar -> gerar ocorrências -> visualizar Home -> expandir árvore -> alterar status -> persistir/recarregar**

Then extend it with:

**comentários -> câmera -> anexos -> timeline -> histórico**

## 2. Phase 0 — Repository foundation

- Inspect workspace.
- Initialize React + TypeScript + Vite if empty.
- Add Capacitor and Android platform.
- Establish formatting/lint/typecheck/test commands.
- Create layered folder structure.
- Add app theme tokens and basic mobile shell.
- Add navigation skeleton.

Exit criteria:

- web app builds;
- test runner works;
- typecheck works;
- Capacitor project can sync.

## 3. Phase 1 — Domain core

Implement pure types/rules for:

- GoalDefinition and revisions;
- parent/child tree validation;
- active period;
- tracking cycle windows;
- weekday recurrence;
- one-time schedule;
- deterministic occurrence identity;
- statuses;
- equal-weight aggregation;
- completion all-required;
- quantity progress.

Automate core acceptance tests.

Exit criteria:

- Treinar recurrence can be evaluated in pure tests;
- Home-relevant nodes can be derived from sample data.

## 4. Phase 2 — Local persistence

- Create schema/migrations.
- Implement repositories.
- Add native/web storage abstraction.
- Add transactions.
- Test idempotent occurrence upsert.
- Test definition revision preservation.

Exit criteria:

- persisted goal tree survives reload;
- repeated generation does not duplicate occurrences;
- historical revision query works.

## 5. Phase 3 — First vertical slice

Implement:

- Today/Home shell matching visual direction;
- horizontal date selector;
- progress card;
- recursive grouped goal nodes;
- create simple root goal;
- add recurring children with weekday selection;
- save;
- generate/resolve selected-day occurrences;
- quick status bottom sheet;
- persist status;
- reload state.

Use `Treinar` as mandatory smoke scenario.

Exit criteria:

- Monday and Wednesday show correct children;
- Wednesday all-done does not incorrectly finish weekly parent;
- reload preserves status.

## 6. Phase 4 — Goal editor depth

Add:

- description/icon/category;
- active period;
- cycle selection;
- one-time vs recurring child mode;
- quantity goals;
- frequency quota model/UI as feasible;
- completion thresholds;
- required/optional;
- equal/custom weights;
- parent grouping toggle;
- preview driven by recurrence engine;
- edit scope: only this vs this and future.

Exit criteria:

- no destructive history rewrites;
- editor validates incompatible/invalid rules.

## 7. Phase 5 — Evidence timeline

Add ports/adapters and UI for:

- comment record;
- camera capture;
- gallery image selection;
- file selection;
- multiple records;
- multiple attachments;
- occurrence-level records;
- cycle-level records where applicable;
- compact evidence counts on Home;
- timeline in details.

Exit criteria:

- status can be changed with or without evidence;
- records survive reload;
- permission denial is handled gracefully.

## 8. Phase 6 — History, agenda, progress

Add:

- goal details;
- occurrence history;
- nested structure detail;
- Agenda day/week/month projections;
- basic progress metrics for today/7/30 days;
- basic streak/consistency if data model supports it cleanly;
- goals library with active/paused/archived filters.

Exit criteria:

- history reflects persisted past occurrences/revisions;
- agenda is a projection of occurrences, not a parallel data silo.

## 9. Phase 7 — Backup and Android hardening

- Export versioned backup.
- Validate/import backup safely.
- Verify attachment backup behavior.
- Test offline flows.
- Test camera/file permissions.
- Verify Android storage URIs.
- Improve empty/error/loading states.
- Accessibility pass.
- Performance pass for many goals.

Exit criteria:

- core use works offline;
- invalid import cannot wipe data;
- Android permissions do not break core usage.

## 10. Phase 8 — APK milestone

- Run typecheck/tests/build.
- Capacitor sync.
- Build debug/release APK according to available toolchain.
- Install smoke test on Android if environment/device allows.
- Document APK generation commands.
- Do not require Play Store release signing for first personal APK unless requested.

## 11. Post-V1

Prioritized candidates:

1. notifications/reminders;
2. richer recurrence editor;
3. advanced analytics;
4. routine templates;
5. Android widgets;
6. configurable Partial weight;
7. Perfect Day / weighted score;
8. PWA offline hardening;
9. cloud backup/sync and optional account;
10. Play Store release pipeline;
11. optional AI insights/coaching.
