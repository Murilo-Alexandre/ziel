# Ziel Local Database Blueprint

## Table of contents

1. Purpose and constraints
2. Storage strategy
3. Core tables
4. Suggested SQLite DDL
5. JSON rule payloads
6. Uniqueness and indexes
7. Transactions
8. Historical queries
9. IndexedDB mapping
10. Media storage
11. Migration rules
12. Data integrity checklist

## 1. Purpose and constraints

Use this blueprint as a strong starting point, not as permission to leak persistence details into the domain or UI.

The local database must preserve:

- the stable identity of every goal;
- a recursive tree with no fixed depth;
- the configuration that was effective on any historical date;
- concrete tracking cycles;
- concrete scheduled or user-created occurrences;
- current status and status changes;
- multiple timeline records per occurrence or cycle;
- multiple attachments per record;
- safe schema migrations and backup metadata.

The schema must also make occurrence generation idempotent through deterministic unique keys.

## 2. Storage strategy

Recommended platform split:

- Android/native: SQLite behind repository interfaces.
- Browser/PWA: IndexedDB behind the same repository contracts.
- Attachments: files/blobs outside normal relational rows, with metadata and durable references in the database.

Do not force a single storage library across platforms if it makes Android or PWA fragile. The shared contract is the domain/repository API, not the physical engine.

## 3. Core tables

Minimum logical tables:

```text
schema_meta
goal_definitions
goal_revisions
categories
goal_pauses            optional in first UI, useful in schema
cycle_instances
occurrences
occurrence_overrides
status_changes
journal_records
attachments
app_settings
```

Optional later tables:

```text
reminders
notification_deliveries
templates
backup_history
sync_metadata
```

## 4. Suggested SQLite DDL

Adapt column types to the selected adapter, but preserve constraints and semantics.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE schema_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color_token TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE goal_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  current_parent_id TEXT,
  current_sort_order INTEGER NOT NULL DEFAULT 0,
  current_revision_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (current_parent_id) REFERENCES goal_definitions(id)
);

CREATE TABLE goal_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,

  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color_token TEXT,
  category_id TEXT,

  active_start_date TEXT NOT NULL,
  active_end_date TEXT,

  tracking_cycle_json TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  progress_rule_json TEXT NOT NULL,
  completion_rule_json TEXT NOT NULL,
  aggregation_rule_json TEXT NOT NULL,
  inheritance_json TEXT NOT NULL,
  reminders_json TEXT NOT NULL DEFAULT '[]',

  is_required INTEGER NOT NULL DEFAULT 1,
  show_parent_on_home INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL,

  FOREIGN KEY (goal_id) REFERENCES goal_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES goal_definitions(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE goal_pauses (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (goal_id) REFERENCES goal_definitions(id) ON DELETE CASCADE
);

CREATE TABLE cycle_instances (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL,
  cycle_key TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rule_revision_id TEXT,

  computed_progress REAL NOT NULL DEFAULT 0,
  computed_status TEXT NOT NULL DEFAULT 'pending',
  expected_count REAL,
  achieved_count REAL,
  finalized_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (goal_id) REFERENCES goal_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_revision_id) REFERENCES goal_revisions(id),
  UNIQUE (goal_id, cycle_key)
);

CREATE TABLE occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  cycle_instance_id TEXT,

  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT,
  slot_key TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'generated',

  status TEXT NOT NULL DEFAULT 'pending',
  progress_value REAL,
  quantity_value REAL,
  quantity_unit TEXT,

  completed_at TEXT,
  last_status_changed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (goal_id) REFERENCES goal_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id) REFERENCES goal_revisions(id),
  FOREIGN KEY (cycle_instance_id) REFERENCES cycle_instances(id),
  UNIQUE (occurrence_key)
);

CREATE TABLE occurrence_overrides (
  occurrence_id TEXT PRIMARY KEY NOT NULL,
  override_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (occurrence_id) REFERENCES occurrences(id) ON DELETE CASCADE
);

CREATE TABLE status_changes (
  id TEXT PRIMARY KEY NOT NULL,
  occurrence_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (occurrence_id) REFERENCES occurrences(id) ON DELETE CASCADE
);

CREATE TABLE journal_records (
  id TEXT PRIMARY KEY NOT NULL,
  occurrence_id TEXT,
  cycle_instance_id TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (occurrence_id) REFERENCES occurrences(id) ON DELETE CASCADE,
  FOREIGN KEY (cycle_instance_id) REFERENCES cycle_instances(id) ON DELETE CASCADE,
  CHECK (
    (occurrence_id IS NOT NULL AND cycle_instance_id IS NULL)
    OR
    (occurrence_id IS NULL AND cycle_instance_id IS NOT NULL)
  )
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  uri TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  checksum TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES journal_records(id) ON DELETE CASCADE
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

After both tables exist, link the current revision pointer if the adapter handles cyclic DDL cleanly:

```sql
-- Enforce in repository/domain if adding this foreign key is awkward in the adapter.
-- goal_definitions.current_revision_id -> goal_revisions.id
```

## 5. JSON rule payloads

Store discriminated-union rules as validated JSON when the local adapter does not benefit from many nullable columns.

Examples:

```json
{
  "type": "weekly",
  "weekStartsOn": "monday"
}
```

```json
{
  "type": "weekdays",
  "weekdays": ["monday", "wednesday"],
  "time": "19:00"
}
```

```json
{
  "type": "scheduledOccurrences",
  "depth": "descendants",
  "weightMode": "equal"
}
```

Validate every payload at repository boundaries. Never trust arbitrary JSON from import or old migrations.

## 6. Uniqueness and indexes

Create indexes appropriate to the selected adapter:

```sql
CREATE UNIQUE INDEX idx_goal_revision_effective
  ON goal_revisions(goal_id, effective_from);

CREATE INDEX idx_goal_revision_parent_date
  ON goal_revisions(parent_id, effective_from, effective_to);

CREATE INDEX idx_occurrences_date
  ON occurrences(scheduled_date);

CREATE INDEX idx_occurrences_goal_date
  ON occurrences(goal_id, scheduled_date);

CREATE INDEX idx_occurrences_cycle
  ON occurrences(cycle_instance_id);

CREATE INDEX idx_cycle_window
  ON cycle_instances(goal_id, start_date, end_date);

CREATE INDEX idx_journal_occurrence
  ON journal_records(occurrence_id, created_at);

CREATE INDEX idx_journal_cycle
  ON journal_records(cycle_instance_id, created_at);

CREATE INDEX idx_status_changes_occurrence
  ON status_changes(occurrence_id, changed_at);
```

Required uniqueness behavior:

- one logical fixed occurrence per deterministic `occurrence_key`;
- one logical cycle per `goal_id + cycle_key`;
- no overlapping effective revisions for the same goal;
- no parent cycle in the recursive hierarchy.

Some constraints, such as no overlapping effective ranges and no tree cycles, are best enforced in a domain transaction plus tests.

## 7. Transactions

Use a transaction for:

- creating a goal and its initial revision;
- creating a parent plus nested children from the editor;
- applying a `this and future` revision split;
- moving a goal and updating effective placement;
- upserting a cycle plus expected occurrences;
- status update plus status-change audit;
- journal record plus attachment metadata;
- archive/pause operations;
- backup import.

Never leave half-created children, orphan attachments, or a revision gap after failure.

## 8. Historical queries

The data layer must answer these queries without guessing from current configuration:

1. Which revision applied to goal G on date D?
2. Which parent/placement applied to G on date D?
3. What was expected on date D?
4. What actually happened on date D?
5. Which cycle contained D for goal G?
6. Which evidence records belonged to that occurrence/cycle?
7. Which current goal replaced or continued a historical revision?

A revision lookup should conceptually use:

```sql
SELECT *
FROM goal_revisions
WHERE goal_id = :goalId
  AND effective_from <= :date
  AND (effective_to IS NULL OR effective_to >= :date)
ORDER BY effective_from DESC
LIMIT 1;
```

Avoid storing dates as ambiguous locale strings. Use `YYYY-MM-DD` for calendar dates and ISO UTC strings for real timestamps.

## 9. IndexedDB mapping

The PWA adapter may use object stores corresponding to the same logical records:

```text
goalDefinitions
goalRevisions
categories
cycleInstances
occurrences
occurrenceOverrides
statusChanges
journalRecords
attachments
settings
```

Use compound indexes for date, goal/date, parent/effective date, and cycle keys. Preserve the same deterministic IDs and logical uniqueness as SQLite even if enforcement occurs in application transactions.

Do not expose IndexedDB records directly to React components. Convert through repositories/domain mappers.

## 10. Media storage

Do not store full image/file bytes in a normal SQLite text/blob column unless the chosen implementation has a strong reason.

Recommended:

- native: copy media into an app-owned directory using generated IDs; persist URI/path and metadata;
- web/PWA: store Blob data in IndexedDB or an origin-private file system where supported; persist a logical media ID;
- render thumbnails/lazy media in details, not large files on Home;
- delete file and metadata together through a media service;
- tolerate a missing file by showing a recoverable placeholder rather than crashing history.

Never persist temporary camera URIs without copying them into durable app storage.

## 11. Migration rules

- Maintain an integer schema version.
- Use monotonic, deterministic migrations.
- Test fresh install and upgrade from the immediately previous version.
- Prefer additive migrations before destructive transformations.
- Validate JSON rule payloads after migration.
- Never use `DROP ALL AND RECREATE` as a normal production upgrade strategy.
- Back up or use transactions before risky imports/migrations.

## 12. Data integrity checklist

Before considering persistence complete, verify:

- reopening the same date ten times does not duplicate occurrences;
- changing only metadata does not create a second logical occurrence;
- changing recurrence from a date forward preserves old occurrences;
- moving a goal does not make old history appear under the wrong parent when historical placement is expected;
- changing status does not delete timeline records;
- deleting one record removes only its attachments;
- an invalid import cannot wipe existing data;
- archive stops future generation but leaves history readable;
- current Home queries load evidence counts, not full image payloads;
- all repository operations work offline.
