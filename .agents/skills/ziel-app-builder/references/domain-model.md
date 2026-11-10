# Ziel Domain Model

## Table of contents

1. Modeling principles
2. Entity overview
3. GoalDefinition
4. GoalRevision
5. ScheduleRule
6. TrackingCycleRule
7. Occurrence
8. CycleInstance
9. JournalRecord and Attachment
10. Category and settings
11. Repository contracts
12. Derived view models

## 1. Modeling principles

Model the domain independently from React, Capacitor, SQLite, IndexedDB, or any UI framework.

Prefer explicit domain types and discriminated unions over weak dictionaries. Keep dates and time zones deliberate. Store stable identifiers and immutable creation timestamps.

A parent/child relationship is organizational. It does not imply that child timing equals parent timing.

## 2. Entity overview

Conceptual relationship:

```text
GoalDefinition 1 --- N GoalRevision
GoalDefinition 1 --- N GoalDefinition(children)
GoalDefinition 1 --- N Occurrence
GoalDefinition 1 --- N CycleInstance
Occurrence     1 --- N JournalRecord
CycleInstance  1 --- N JournalRecord
JournalRecord  1 --- N Attachment
Occurrence     1 --- N StatusChange
```

A concrete implementation may optimize tables, but preserve these semantics.

## 3. GoalDefinition

Suggested conceptual fields:

```ts
type GoalDefinition = {
  id: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  sortOrder: number
  currentRevisionId: string
}
```

Keep mutable rule/configuration fields in a revision/effective-dated structure rather than allowing the definition row to rewrite historical meaning. `parentId` and `sortOrder` may represent the current tree for fast queries, but if moves/reordering must be reproduced historically, snapshot placement in the revision or in an effective-dated placement table. Past views must never be reconstructed only from today's tree.

## 4. GoalRevision

Suggested shape:

```ts
type GoalRevision = {
  id: string
  goalId: string
  effectiveFrom: string
  effectiveTo: string | null

  parentId: string | null
  sortOrder: number

  name: string
  description: string | null
  icon: string | null
  colorToken: string | null
  categoryId: string | null

  activePeriod: ActivePeriod
  trackingCycle: TrackingCycleRule
  schedule: ScheduleRule
  progressRule: ProgressRule
  completionRule: CompletionRule
  aggregationRule: AggregationRule

  isRequired: boolean
  showParentOnHome: boolean
  inherit: InheritanceRule
  reminders: ReminderRule[]
}
```

If the implementation chooses a different versioning pattern, it must still answer: "What configuration applied to this goal on a historical date?"

### ActivePeriod

```ts
type ActivePeriod = {
  startDate: string
  endDate: string | null
}
```

The active period defines validity, not the exact occurrence dates.

### InheritanceRule

```ts
type InheritanceRule = {
  period: boolean
  category: boolean
  icon: boolean
  color: boolean
  reminders: boolean
}
```

Inheritance is optional and explicit. Schedule must not be implicitly inherited as a constraint.


### ProgressRule, CompletionRule, and AggregationRule

Use explicit discriminated unions rather than loosely related booleans.

```ts
type ProgressRule =
  | { type: 'binary' }
  | { type: 'children' }
  | { type: 'quantity'; target: number; unit: string; step?: number }
  | { type: 'frequency'; targetCount: number }
  | { type: 'percentage' }
  | { type: 'time'; targetMinutes: number; stepMinutes?: number }
  | { type: 'manual' }

type CompletionRule =
  | { type: 'allRequired' }
  | { type: 'minimumCount'; count: number }
  | { type: 'minimumPercentage'; percentage: number }
  | { type: 'quantityTarget' }
  | { type: 'manual' }

type AggregationRule =
  | {
      type: 'directChildren'
      weightMode: 'equal' | 'custom'
      optionalContribution: 'include' | 'exclude'
      childWeights?: Record<string, number>
    }
  | {
      type: 'scheduledOccurrences'
      depth: 'direct' | 'descendants'
      weightMode: 'equal' | 'custom'
      occurrenceWeights?: Record<string, number>
    }
  | { type: 'quantityRollup'; unit: string }
  | { type: 'manual' }
```

This distinction is mandatory:

- `Treinar` with Football 2x, Running 4x, and Strength 3x in a week uses `scheduledOccurrences` and therefore expects nine contributions, not merely three child cards.
- A project with Planning/Development/Testing/Documentation and 10/50/25/15 weights uses `directChildren` with custom weights.
- Never count both a child aggregate and all of its descendants in the same calculation unless the rule explicitly calls for that; avoid double counting.

## 5. ScheduleRule

Use a discriminated union conceptually:

```ts
type ScheduleRule =
  | { type: 'once'; date: string; time?: string }
  | { type: 'daily'; time?: string }
  | { type: 'weekdays'; weekdays: Weekday[]; time?: string }
  | { type: 'interval'; every: number; unit: 'day' | 'week' | 'month'; anchorDate: string; time?: string }
  | { type: 'monthlyDate'; dayOfMonth: number; time?: string }
  | { type: 'monthlyNthWeekday'; ordinal: 1 | 2 | 3 | 4 | 5 | -1; weekday: Weekday; time?: string }
  | { type: 'annual'; month: number; day: number; time?: string }
  | { type: 'quota'; count: number; per: 'day' | 'week' | 'month' | 'year' }
  | { type: 'custom'; expression: string; metadata?: Record<string, unknown> }
```

For a quota rule, there may not be a fixed due weekday. Represent the expected count inside the cycle separately from fixed calendar occurrences.

## 6. TrackingCycleRule

```ts
type TrackingCycleRule =
  | { type: 'single' }
  | { type: 'daily'; dayBoundary?: string }
  | { type: 'weekly'; weekStartsOn: Weekday }
  | { type: 'monthly' }
  | { type: 'annual' }
  | { type: 'custom'; duration: number; unit: 'day' | 'week' | 'month'; anchorDate: string }
```

The tracking cycle answers when evaluation resets or rolls over. It does not define the occurrence schedule.

## 7. Occurrence

An occurrence is a concrete expected execution.

Suggested conceptual fields:

```ts
type Occurrence = {
  id: string
  goalId: string
  revisionId: string
  cycleInstanceId: string | null

  scheduledDate: string
  scheduledTime: string | null
  slotKey: string
  occurrenceKey: string
  source: 'generated' | 'quota_event' | 'manual'

  status: 'pending' | 'partial' | 'completed' | 'not_done'
  progressValue: number | null
  quantityValue: number | null

  completedAt: string | null
  lastStatusChangedAt: string | null
  createdAt: string
  updatedAt: string

  overrideData?: OccurrenceOverride | null
}
```

`occurrenceKey` must be deterministic enough to enforce uniqueness for generated fixed-date occurrences, for example a composition/hash of goal, revision lineage, date, and slot identity.

For quota-based goals, individual completion events may be user-created within a cycle rather than pre-materialized on fixed weekdays. Keep the domain flexible enough to count them.

## 8. CycleInstance

A cycle instance gives a parent or recurring goal a concrete evaluation window.

```ts
type CycleInstance = {
  id: string
  goalId: string
  revisionId: string
  startAt: string
  endAt: string
  cycleKey: string

  computedProgress: number
  computedStatus: 'pending' | 'in_progress' | 'completed' | 'not_done'

  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}
```

The computed status may be recalculated from children/occurrences until the cycle is finalized. Do not confuse `in_progress` here with a manually selected occurrence status.

## 9. JournalRecord and Attachment

Records form a timeline. Support targets at either occurrence or cycle level.

```ts
type JournalTarget =
  | { type: 'occurrence'; occurrenceId: string }
  | { type: 'cycle'; cycleInstanceId: string }

type JournalRecord = {
  id: string
  target: JournalTarget
  comment: string | null
  createdAt: string
  updatedAt: string
}

type Attachment = {
  id: string
  recordId: string
  kind: 'image' | 'file'
  uri: string
  displayName: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
}
```

A record should not be forced to contain text if it has an attachment, and vice versa. Reject a truly empty record.


### StatusChange

Keep at least lightweight audit data for status revisions so the system can explain when a result changed without deleting evidence.

```ts
type StatusChange = {
  id: string
  occurrenceId: string
  fromStatus: Occurrence['status'] | null
  toStatus: Occurrence['status']
  changedAt: string
}
```

V1 does not need to expose the full audit trail in every screen, but changing `completed` to `partial` must preserve journal records and create/update auditable status metadata.

## 10. Category and settings

```ts
type Category = {
  id: string
  name: string
  icon: string | null
  colorToken: string | null
  sortOrder: number
}
```

App settings may include:

- locale;
- week start;
- partial progress weight (fixed at 0.5 in V1 UI, future-configurable);
- theme;
- backup preferences;
- future notification preferences.

## 11. Repository contracts

Prefer interfaces such as:

```ts
interface GoalRepository {
  getDefinition(id: string): Promise<GoalDefinition | null>
  getRevisionForDate(goalId: string, date: string): Promise<GoalRevision | null>
  listChildren(parentId: string): Promise<GoalDefinition[]>
  saveDefinition(input: ...): Promise<...>
  addRevision(input: ...): Promise<...>
}

interface OccurrenceRepository {
  findByDate(date: string): Promise<Occurrence[]>
  getByKey(key: string): Promise<Occurrence | null>
  upsertGeneratedOccurrence(input: ...): Promise<Occurrence>
  updateStatus(id: string, ...): Promise<Occurrence>
}
```

Repositories should expose domain intent, not raw UI storage operations.

## 12. Derived view models

Build screen-specific view models in application/query services rather than contaminating persisted entities.

Examples:

- `TodayGoalNode`
- `GoalDetailSummary`
- `CycleProgressSummary`
- `AgendaItem`
- `OccurrenceTimelineView`

A `TodayGoalNode` should be able to contain children recursively while filtering out children that are not relevant to the selected date.
