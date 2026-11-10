# Ziel Product Specification

## Table of contents

1. Product statement
2. Goals and non-goals
3. Core concepts
4. User capabilities
5. Core screens
6. Goal types as configurations
7. Recurrence capabilities
8. Progress capabilities
9. History and evidence
10. Analytics and secondary features
11. V1 and future scope

## 1. Product statement

Ziel is a personal manager of hierarchical, flexible goals. A user can break any objective into smaller goals, define when each should happen, track execution over time, and preserve evidence of what actually happened.

The same engine must support use cases such as:

- a one-time task;
- a scheduled appointment;
- a daily habit;
- a weekly training routine;
- a book-reading plan;
- a multi-step project;
- a quantity target;
- an activity target such as 3 times per week;
- nested objectives with different schedules at each level.

## 2. Goals and non-goals

### Goals

- Make complex routines configurable without requiring the user to manually create every dated task.
- Keep the daily Home fast and visually clean.
- Preserve the distinction between plan and execution.
- Make historical data trustworthy after recurring rules are edited.
- Work offline on Android.
- Keep the domain portable to PWA.

### Non-goals for the foundation

- Do not model fitness, nutrition, books, or tasks as privileged domains.
- Do not require a server or account for V1.
- Do not make gamification the core interaction.
- Do not create a giant all-in-one dashboard on Home.

## 3. Core concepts

### Goal definition

A persistent rule describing what the user wants to accomplish. It may be root or child, one-time or recurring, manually evaluated or automatically aggregated.

### Tracking cycle

The period over which the goal's progress and completion are evaluated. Examples: single, day, week, month, year, custom range.

### Schedule

The rule determining when actionable occurrences are expected. It is independent from the tracking cycle.

### Occurrence

A dated execution instance generated or resolved from a goal definition. Status and actual progress live here for leaf/actionable work.

### Cycle instance

A concrete cycle window for a definition, such as the weekly cycle of `Treinar` from Monday to Sunday. Parent aggregation is evaluated within it.

### Record

A timeline entry attached to an occurrence or cycle instance, containing optional text and attachments.

### Attachment

An image or file captured/selected by the user and linked to a record.

## 4. User capabilities

The user must be able to:

- create a root goal;
- create children at any nested level;
- reorder children;
- give every goal a name and optional description, icon, category, and visual metadata;
- configure active period;
- configure tracking cycle;
- configure independent schedule;
- choose progress mode;
- choose completion rule;
- optionally inherit selected properties from parent;
- preview a complex schedule before saving;
- view only relevant occurrences for a selected day;
- expand/collapse nested goals;
- mark an occurrence Pending/Partial/Completed/Not Done;
- change a prior status later;
- add multiple timestamped records;
- capture a camera photo;
- choose an existing image;
- attach a file;
- review occurrence history;
- review a goal's structure and cycle progress;
- export/backup local data in a portable form;
- edit recurring definitions without silently rewriting history.

## 5. Core screens

### Home / Hoje

- greeting and date;
- horizontal date selector;
- daily progress summary;
- optional streak/summary metrics when implemented;
- list/tree of goals relevant for selected day;
- grouped parent cards by default;
- progress bars and cycle context;
- compact evidence count indicators;
- quick status actions;
- bottom navigation.

### Agenda

- day/week/month views;
- shows timed or dated occurrences;
- remains a view over the same goal/occurrence engine, not a separate domain model.

### Create / Edit Goal

- multi-section form or wizard;
- nested child management;
- schedule and cycle configuration;
- completion/progress rules;
- preview before save;
- versioning scope when editing recurrence.

### Goal Details

- title, description, category, icon;
- current cycle progress;
- active period / schedule summary;
- nested structure;
- occurrence history;
- records/evidence timeline;
- edit/pause/archive actions.

### Progress

- today, recent periods, streaks, completion rates;
- best/worst consistency when enough data exists;
- must be derived from persisted historical occurrences/cycles.

### Goals Library

- all active/paused/archived or completed one-off definitions;
- filters and categories;
- search can be added later.

### Settings

- profile/display preferences;
- appearance;
- categories;
- data export/import;
- notification settings when notifications arrive;
- future sync settings.

## 6. Goal types as configurations

Do not create separate domain entities for these. They are presets over the same goal model.

### Binary

Example: `Enviar documento`. One occurrence is either done, partial, not done, or pending.

### Children / steps

Example: `Construir site` with Design, Development, Test, Publish.

### Quantity

Example: `Ler 300 páginas` or `Beber 4 L`. Track current value, target, unit, and optional increments.

### Frequency quota

Example: `Academia 3x por semana`. It is not tied to specific weekdays unless the user chooses a calendar schedule.

### Percentage

Example: manual or computed completion percentage.

### Time

Example: `Estudar 10 horas` with minutes/hours as a quantity dimension.

### Manual

The user explicitly decides completion/progress even when children exist.

## 7. Recurrence capabilities

Support the domain model for:

- one-time date;
- every day;
- selected weekdays;
- every N days/weeks/months;
- fixed day of month;
- nth weekday of month;
- annual date;
- frequency quota per cycle such as 3 times/week;
- custom recurrence rules that can be extended later.

The UI may ship advanced recurrence progressively, but the architecture should not force a schema redesign for common future rules.

## 8. Progress capabilities

A goal may use:

- binary progress;
- child aggregation;
- numeric quantity;
- frequency completion count;
- percentage;
- time quantity;
- manual progress.

Parent aggregation options:

- equal weight among relevant children/occurrences;
- custom weights;
- quantity roll-up where compatible;
- manual parent progress.

Completion options:

- all required children/occurrences;
- minimum N of M;
- minimum percentage;
- quantity target;
- manual completion.

Optional children may contribute display progress but must not block a rule that explicitly ignores optional items.

## 9. History and evidence

Every recurring definition creates a history of expectations and results.

For an occurrence the user can see:

- expected date/time;
- final/current status;
- progress value;
- status change timestamps if stored;
- timeline records;
- attachments.

A record is appendable. Do not overwrite old comments merely because a new comment is added.

Example timeline:

- 12:37 — image + "Feito conforme planejado"
- 14:10 — image + "Depois aconteceu algo fora do plano"
- 18:22 — comment only

## 10. Analytics and secondary features

Once the core data is correct, support:

- daily completion percentage;
- completion by week/month;
- streaks;
- consistency;
- weighted score;
- "Perfect Day" based on user-selected essential goals;
- best/worst performing goals;
- richer graphs.

Do not hard-code these into the initial recurrence engine.

## 11. V1 and future scope

### Core V1 direction

- Android APK;
- Home;
- create/edit goals;
- recursive children;
- binary, child, and quantity progress;
- recurring weekdays and core recurrence;
- tracking cycles;
- idempotent occurrences;
- parent aggregation;
- status workflow;
- records/comments;
- camera, gallery, and file attachments;
- history;
- local persistence;
- basic progress summaries;
- backup/export;
- dark theme and polished mobile UI.

### Later

- intelligent notifications;
- Android widgets;
- advanced charts;
- templates;
- cloud backup/sync;
- PWA hardening and iPhone usage;
- Play Store release workflow;
- configurable Partial weight;
- advanced recurrence editor;
- optional AI insights.
