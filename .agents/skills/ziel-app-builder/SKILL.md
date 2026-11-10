---
name: ziel-app-builder
description: Build, extend, refactor, debug, test, or review Ziel, a local-first mobile goal-management app whose core is recursively nested goals, independent schedules and tracking cycles, generated occurrences, aggregate progress, historical records, comments, photos, files, and a clean expandable daily Home. Use for any work on the Ziel Android APK, future PWA, domain model, recurrence engine, persistence, UI/UX, tests, migrations, build pipeline, or product behavior. Preserve Ziel as a generic goal engine rather than hard-coding fitness, diet, study, task, or calendar-specific rules.
---

# Ziel App Builder

## Mission

Develop Ziel as a generic personal goal engine, not as a checklist app tied to one life domain. Treat the bundled references as the product source of truth and preserve historical correctness from the first implementation.

The essential product equation is:

**recursive goals + independent schedules + independent tracking cycles + generated occurrences + aggregation + historical evidence**

Do not reduce this to a CRUD of tasks with `parentId`.

## Working rules

1. Read `references/decision-log.md` first whenever product behavior is ambiguous. Later decisions there override earlier ideas.
2. Read only the detailed references needed for the current task, but consult all relevant references before changing domain behavior.
3. Keep domain rules independent of React, Capacitor, storage libraries, and native plugins.
4. Preserve Android-first delivery while keeping the same core usable by a future PWA.
5. Prefer local-first behavior. V1 requires no login and no backend.
6. Never rewrite historical occurrences silently when a recurring goal definition changes.
7. Make occurrence generation idempotent. Reopening a date must not create duplicate occurrences.
8. Support real recursive goal depth in the model even if the UI progressively reveals only a few levels at a time.
9. Keep every child goal temporally independent unless the user explicitly enables inheritance.
10. Use Portuguese (Brazil) for user-facing strings unless the task explicitly requests another locale.

## Required references

- Product scope, concepts, screens, and features: `references/product-spec.md`
- Current product decisions and superseded ideas: `references/decision-log.md`
- Domain entities and relationships: `references/domain-model.md`
- Cycles, schedules, recurrence, and occurrence generation: `references/recurrence-and-cycles.md`
- Progress, status, parent aggregation, weights, and completion: `references/progress-and-status.md`
- Create/Edit Goal flow and recurrence editing semantics: `references/create-goal-flow.md`
- Home, navigation, interaction, visual language, details, history, and evidence timeline: `references/ui-ux.md`
- Technical architecture, adapters, storage, Android/PWA strategy, and quality gates: `references/architecture.md`
- Data persistence, revisions, migrations, IDs, and history preservation: `references/persistence-and-versioning.md`
- Suggested SQLite/IndexedDB tables, indexes, transactions, and media storage: `references/database-schema.md`
- Mandatory behavior scenarios: `references/acceptance-tests.md`
- Delivery phases and implementation sequence: `references/roadmap.md`

The original complete planning conversation is archived at `references/source-conversation.txt` for traceability. Consult it only when a nuance is missing from the distilled references. The final decisions in `references/decision-log.md` and the structured specifications override earlier brainstorming or contradictions in that archive.

Use `assets/reference-home.png` as a **visual-language reference only**. Reuse its dark premium feel, spacing, card treatment, typography hierarchy, progress presentation, date strip, and bottom navigation inspiration. Do not copy its health-specific content or make Ziel a fitness dashboard.

## Core domain invariants

Maintain these invariants in every implementation:

- Everything the user plans is modeled from the same generic goal definition concept.
- A goal may have `parentId = null` or another goal as parent; depth is not fixed.
- A parent goal may aggregate children, but a child schedule is not constrained by the parent schedule by default.
- Tracking cycle and occurrence schedule are separate concepts.
- A recurring definition produces dated occurrences; the definition itself is not "completed today".
- Parent cycles may aggregate many child occurrences across different dates.
- Occurrence status is historical data. Parent status is normally computed from aggregation unless the goal explicitly uses manual completion.
- Records/evidence are timeline entries, not one mutable notes field.
- Comments and attachments may be added before or after status changes.
- A user may revise a status later without deleting prior records.
- Editing a recurring goal must distinguish a one-off occurrence override from a change that applies from a date forward.

## Implementation workflow

For implementation tasks, follow this sequence unless the user asks for a narrower change:

1. **Inspect**
   - Inspect the existing repository, package manager, platform folders, data layer, tests, and current implementation.
   - Identify what is already compatible with the Ziel references and preserve it.

2. **Model before UI**
   - Update domain types/entities and pure business rules first.
   - Add persistence schema/migrations second.
   - Add application services/use-cases third.
   - Wire React screens/components last.

3. **Implement a vertical slice early**
   - Create goal.
   - Add recurring children.
   - Configure independent days.
   - Save.
   - Materialize or resolve occurrences idempotently.
   - Render today's expandable hierarchy.
   - Change occurrence status.
   - Persist and reload it.

4. **Add evidence flow**
   - Add timeline record.
   - Add camera/gallery/file adapters.
   - Associate attachments with the correct occurrence/cycle target.
   - Persist and display history.

5. **Validate**
   - Run typecheck.
   - Run unit tests.
   - Run recurrence/aggregation acceptance tests.
   - Run web build.
   - Sync Capacitor when platform changes apply.
   - Attempt Android build when an Android SDK is available.
   - Fix failures before claiming the phase is complete.

## Design constraints

- Mobile-first, dark, clean, premium, and personal.
- Avoid a corporate dashboard look.
- Keep the Home compact even with many configured goals.
- Use progressive disclosure with chevrons for nested goals.
- Do not put large photos directly in Home cards; show compact evidence counts and open details for full media.
- Tapping the chevron expands/collapses, tapping the name opens details, tapping the status affordance opens quick status actions.
- Group children beneath their parent on Home by default, but support a per-goal setting to show them independently.

## Data and history constraints

- Use stable IDs and uniqueness rules that prevent duplicate occurrences.
- Store definition revisions or equivalent effective-dated changes so future edits do not rewrite past truth.
- Keep historical snapshots sufficient to explain what the user was expected to do on an old date.
- Treat attachment storage paths/URIs as platform-specific data behind an adapter.
- Keep persistence behind repositories so native SQLite and web IndexedDB implementations can differ without changing domain logic.

## Scope discipline

Prioritize V1 core behavior over novelty. Do not block the foundation on cloud sync, social features, AI coaching, advanced analytics, or widgets.

Build hooks/interfaces for future notifications, backup/sync, PWA, and widgets where low-cost, but do not compromise V1 simplicity.

## Completion report

When finishing a meaningful implementation pass, report:

- what changed;
- important files/modules created or modified;
- domain decisions made;
- tests/typecheck/build commands run and their results;
- what can now be tested manually;
- known limitations or deferred roadmap items;
- the next recommended implementation step.

Do not claim a build or test passed unless it was actually run.
