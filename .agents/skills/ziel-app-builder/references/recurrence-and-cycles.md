# Recurrence, Schedules, Cycles, and Occurrences

## Table of contents

1. Three distinct time concepts
2. Schedule evaluation
3. Tracking cycle evaluation
4. Occurrence generation
5. Parent/child independence
6. Quota recurrence
7. Time zones and date boundaries
8. Editing rules
9. Example: Treinar
10. Example: Ler livro
11. Edge cases

## 1. Three distinct time concepts

Always distinguish:

### Active period

When a goal definition/revision is valid.

Example: August 1 through August 31.

### Tracking cycle

The window in which progress is evaluated.

Example: weekly, Monday through Sunday.

### Schedule

When actionable execution should happen.

Example: Monday and Wednesday.

These concepts can differ at every goal level.

## 2. Schedule evaluation

Implement pure functions that answer questions such as:

- Is this revision active on date D?
- Does this schedule create a fixed occurrence on date D?
- Which dates in range A..B are expected?
- What schedule label should the UI show?

Do not generate fixed occurrences for quota rules that intentionally allow flexible dates unless the chosen UX requires placeholder slots. Prefer cycle-level expected counts.

### Weekdays

A selected-weekday rule should only create occurrences on selected weekdays inside the active period.

### Interval

Anchor interval recurrence to an explicit date so edits and device restarts do not change the cadence.

### Monthly date

Decide and test behavior for impossible dates. Recommended V1 behavior: skip a month if the configured calendar date does not exist rather than silently moving it, unless the UI explicitly offers "last day" semantics.

### Nth weekday

Support positive ordinal and `-1` for last weekday when implemented.

## 3. Tracking cycle evaluation

Provide pure functions that resolve a date to a concrete cycle window.

Examples:

- daily: 2026-08-19 -> 2026-08-19
- weekly with Monday start: 2026-08-19 -> 2026-08-17 through 2026-08-23
- monthly: 2026-08-19 -> 2026-08-01 through 2026-08-31

A parent weekly cycle can aggregate children scheduled on multiple dates in that week.

## 4. Occurrence generation

Occurrence generation/resolution must be idempotent.

Recommended flow for selected date D:

1. Find goal revisions active on D.
2. Determine which fixed-date schedules match D.
3. Resolve/create the corresponding cycle instance where relevant.
4. Compute deterministic occurrence key.
5. Upsert by unique occurrence key.
6. Return persisted occurrence.

Do not create another occurrence simply because Home was opened again.

For performance, occurrences may be generated lazily for a date/range rather than materializing years ahead.

## 5. Parent/child independence

A parent schedule must not automatically constrain child schedules.

Example:

```text
Preparar apresentação
  parent schedule: Monday-Friday
  child: Revisão final
  child schedule: Saturday
```

Saturday must remain valid.

Optional inheritance may initialize child fields from parent, but once explicitly configured the child stands on its own.

## 6. Quota recurrence

Calendar schedule and quota are different.

### Calendar rule

`Futebol` every Monday and Wednesday means two specific expected dates.

### Quota rule

`Academia` 3 times per week means the user can satisfy the weekly cycle on any three valid days, unless another constraint is added.

For quotas:

- store expected count on the cycle/revision;
- count completion events/occurrences associated with the cycle;
- show progress `2 / 3`;
- do not invent Monday/Wednesday/Friday unless user configured those days.

## 7. Time zones and date boundaries

V1 is personal/local-first but still requires consistent local date behavior.

- Keep an explicit app/user time zone abstraction if possible.
- Use local calendar date for Home and schedule matching.
- Store instants in ISO UTC where timestamps represent real moments.
- Store schedule dates as calendar dates, not midnight UTC timestamps that can shift a day.
- Avoid depending on browser/device locale parsing of ambiguous date strings.

## 8. Editing rules

When editing a recurring definition, support scopes:

### Only this occurrence

Create an occurrence override. Examples:

- change only today's title/details;
- remove only one expected child today;
- change only today's target.

Do not mutate the reusable definition.

### This and future occurrences

Close the current revision immediately before the effective date and create a new revision effective from that date.

Past occurrences continue pointing to the historical revision.

A future implementation may also support "entire series" where safe, but never silently rewrite history.

## 9. Example: Treinar

Definition tree:

```text
Treinar
tracking cycle: weekly
completion: all scheduled activities (or configurable threshold)

  Futebol
  schedule: Monday, Wednesday

  Corrida
  schedule: Tuesday, Wednesday, Thursday, Friday

  Musculação
  schedule: Wednesday, Thursday, Friday
```

Expected fixed occurrences in a normal week:

- Futebol: 2
- Corrida: 4
- Musculação: 3
- total: 9

On Monday Home should show:

```text
Treinar — week 0/9
  Futebol
```

On Wednesday:

```text
Treinar — week progress
  Futebol
  Corrida
  Musculação
```

Completing all Wednesday items completes today's set but not necessarily the weekly `Treinar` cycle.

## 10. Example: Ler livro

The engine must support both compact and structured modeling.

### Compact

```text
Ler livro
  target: 20 chapters by Aug 31
```

### Recurring child

```text
Ler livro
  child: Leitura
  schedule: Monday-Friday
  target: 1 chapter per occurrence
```

### Deep hierarchy

```text
Ler livro
  Semana 1
    Capítulo 1
    Capítulo 2
  Semana 2
    ...
```

The app must not force one methodology.

## 11. Edge cases

Test at least:

- opening the same day repeatedly;
- app restart after some statuses are set;
- goal begins mid-cycle;
- goal ends mid-cycle;
- child occurs outside parent's schedule;
- parent and child have different cycle lengths;
- monthly date 29/30/31;
- leap day if annual/monthly logic supports it;
- edited series effective from today;
- one-off override does not affect tomorrow;
- archived goal stops future generation but preserves history;
- schedule with no expected occurrence in selected day does not appear as an actionable child on Home.
