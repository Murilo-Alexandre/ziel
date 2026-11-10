# Persistence, Versioning, and Historical Integrity

## Table of contents

1. Persistence goals
2. Schema responsibilities
3. Definition revisions
4. Occurrence identity
5. Cycle identity
6. Transactions
7. Overrides
8. Archive/pause semantics
9. Attachment persistence
10. Backup/import
11. Migration discipline
12. Query strategy

## 1. Persistence goals

The database must preserve both:

- what the user intended at the time;
- what actually happened.

Current configuration alone is not enough to reconstruct trustworthy history after recurring rules are edited.

## 2. Schema responsibilities

The physical schema should support at least:

- goal identity/tree;
- effective-dated goal configuration/revisions;
- cycle instances;
- occurrences;
- occurrence overrides where needed;
- journal records;
- attachments;
- categories/settings;
- schema migration metadata.

Use foreign keys/constraints where the chosen storage layer supports them reliably.

## 3. Definition revisions

When "this and future" changes a recurring goal:

1. identify effective date D;
2. close old revision at D-1 / immediately before D using date-safe semantics;
3. create new revision effective at D;
4. point newly generated occurrences at new revision;
5. leave past occurrences linked to old revision;
6. avoid deleting or rewriting past occurrences.

Name/icon/category-only changes can still use revisioning so old history can optionally display historical metadata. If V1 chooses to show current display metadata for old history, document that choice, but do not compromise recurrence history.

## 4. Occurrence identity

A fixed schedule occurrence needs a deterministic uniqueness key.

Conceptual components:

```text
goalId + logical schedule slot + scheduledDate
```

Do not make a volatile revision ID the only determinant if a revision changes metadata without changing the logical scheduled slot and could create duplicates. Design the key to match actual generation semantics.

Enforce uniqueness in storage where possible.

## 5. Cycle identity

A cycle key should deterministically represent:

```text
goalId + cycleStart + cycleEnd
```

Version association may be stored separately. If a revision changes mid-cycle, decide explicitly how the cycle behaves. Recommended approach for V1:

- retain one logical cycle window;
- occurrences within it can reference different revisions;
- parent aggregation uses the applicable expectations in that cycle;
- avoid duplicating the same goal/week cycle solely because configuration changed on Wednesday.

Test this case.

## 6. Transactions

Use transactions for operations that must remain consistent, including:

- create goal + initial revision;
- create parent with nested children when saved atomically;
- apply "this and future" revision boundary;
- update status + status audit metadata;
- add journal record + attachment metadata;
- import backup.

If a transaction fails, do not leave half-created hierarchy or orphan metadata.

## 7. Overrides

Occurrence override data should be explicit rather than mutating the base revision.

Possible override fields:

- display name/description for this occurrence;
- target value;
- scheduled time;
- suppression/cancel for this occurrence;
- exception children/extra one-off occurrence.

Start with only the override fields required by V1. Keep the design extensible.

## 8. Archive/pause semantics

### Archive

Stops future expectations after archive/effective end date while preserving all history.

### Pause

Temporarily prevents expected occurrences for a date range, then resumes the same definition. A pause can be deferred if not in initial UI, but avoid deleting definitions as a substitute.

Completed one-off goals remain in history/library.

## 9. Attachment persistence

Store attachment bytes/files outside large relational rows when appropriate.

Database keeps metadata and a durable local URI/path/reference.

When an attachment is deleted:

- remove metadata and local file deliberately;
- handle missing file gracefully in history;
- do not delete shared files if the storage design allows multiple references.

Use generated filenames/IDs to avoid collisions.

## 10. Backup/import

Backup must be versioned.

Include metadata such as:

```json
{
  "format": "ziel-backup",
  "version": 1,
  "createdAt": "...",
  "appSchemaVersion": 1
}
```

Validate before import.

Prefer import into a temporary/staging representation first, then transactionally replace/merge according to product policy.

Never destroy current data before confirming the backup is valid.

## 11. Migration discipline

- Maintain monotonically increasing schema versions.
- Test fresh install and upgrade from prior schema.
- Back up or make migrations transactional where possible.
- Do not use destructive reset migrations in normal production code.
- Keep migrations deterministic.

## 12. Query strategy

Avoid recursively loading the entire database for Home.

A good Home query/service can:

1. determine roots relevant to selected date or parents of relevant descendants;
2. resolve due descendants for selected date;
3. fetch current cycle summaries;
4. build a compact recursive view model;
5. load evidence counts, not full media payloads.

Goal detail/history may fetch deeper data on demand.
