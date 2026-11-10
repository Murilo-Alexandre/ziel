# Ziel Acceptance Scenarios

Use these as product-level acceptance checks. Automate the domain-heavy scenarios wherever practical.

## Table of contents

1. Hierarchy
2. Recurrence and cycles
3. Treinar reference scenario
4. Status and progress
5. Editing and history
6. Records and attachments
7. Home and UI behavior
8. Persistence and platform
9. Rescheduling and aggregation source

## 1. Hierarchy

### A01 — Root goal
Create a goal with no parent. It appears as a root definition and can be shown on Home when relevant.

### A02 — Child goal
Create a child under a root. It retains its own ID and parent link.

### A03 — Deep nesting
Create at least five nested levels. The domain stores the tree without a hard-coded maximum depth.

### A04 — No hierarchy cycle
Attempt to move a parent under one of its descendants. The app rejects the operation.

### A05 — Reorder siblings
Reorder sibling goals. The new order persists after reload.

## 2. Recurrence and cycles

### A06 — One-time occurrence
A one-time goal scheduled for Aug 19 appears on Aug 19 and not on Aug 20.

### A07 — Daily recurrence
A daily goal produces one logical occurrence per active day.

### A08 — Weekday recurrence
A Monday/Wednesday goal appears on Monday and Wednesday only.

### A09 — Idempotent generation
Open the same date ten times. Only one occurrence exists per expected slot.

### A10 — Weekly cycle
For Wednesday Aug 19, 2026 with Monday week start, the weekly cycle resolves Aug 17–23.

### A11 — Child independent schedule
A parent scheduled Monday–Friday has a child scheduled Saturday. The Saturday child still appears on Saturday.

### A12 — Different parent/child cycles
A monthly parent can contain a weekly child without schema or calculation failure.

### A13 — Active period start
A recurring goal whose active period starts Aug 20 does not appear Aug 19.

### A14 — Active period end
A recurring goal ending Aug 20 does not generate future occurrences after the end date.

### A15 — Interval anchor
A goal every 2 days anchored Aug 1 keeps the same cadence after app restart.

### A16 — Quota differs from weekdays
`Academia 3x por semana` does not automatically create Monday/Wednesday/Friday dates.

### A17 — Monthly missing date
A monthly day-31 rule follows the documented policy for a month without day 31 and does not crash.

## 3. Treinar reference scenario

Create:

```text
Treinar — weekly cycle
  Futebol — Monday, Wednesday
  Corrida — Tuesday, Wednesday, Thursday, Friday
  Musculação — Wednesday, Thursday, Friday
```

### A18 — Weekly expectation count
The cycle contains/derives 9 expected scheduled executions: Football 2, Running 4, Strength 3.

### A19 — Monday Home
On Monday, `Treinar` can appear grouped with only Football as today's actionable child.

### A20 — Tuesday Home
On Tuesday, `Treinar` shows only Running as today's actionable child.

### A21 — Wednesday Home
On Wednesday, it shows Football, Running, and Strength.

### A22 — Today's completion != weekly completion
Completing all three Wednesday activities completes the day's set but does not complete the weekly parent if the weekly criterion is not yet met.

### A23 — Parent threshold
If parent completion is configured to minimum 7 of 9, reaching seven qualifying executions completes the weekly parent even if two expected executions remain.

## 4. Status and progress

### A24 — Default status
A new actionable occurrence begins as Pendente.

### A25 — Completed contribution
Completed contributes 100% to default arithmetic.

### A26 — Partial contribution
Partial contributes 50% in V1 default arithmetic.

### A27 — Not done contribution
Not Done contributes 0%.

### A28 — Parent all-required rule
Three equal children: Completed, Partial, Completed produce about 83% display progress but the parent is not Completed when rule requires all required children Completed.

### A29 — Optional child
An optional incomplete child does not block a parent rule configured as "all required".

### A30 — Weighted aggregation
Children weighted 10/50/25/15 contribute according to weights, not as equal 25% slices.

### A31 — Quantity goal
A quantity target 4 L with actual 2.5 L reports 62.5% before clamping/rounding for display.

### A32 — Status revision
Change an occurrence from Completed to Partial. The new status persists and existing journal records remain.

## 5. Editing and history

### A33 — Only this occurrence
Editing only today's occurrence changes today's expected data without modifying tomorrow's recurring definition.

### A34 — This and future
Changing a Monday/Wednesday schedule to Monday/Friday effective Aug 19 preserves historical occurrences before Aug 19 and applies the new rule forward.

### A35 — Historical revision
Opening an old occurrence can still resolve the rule/revision that applied on that date.

### A36 — No duplicate after revision
A metadata/revision edit does not duplicate an already existing logical occurrence for the same date/slot.

## 6. Records and attachments

### A37 — Multiple records
One occurrence can contain multiple timestamped journal records.

### A38 — Comment only
A record with comment and no attachment saves and displays.

### A39 — Image only
A record with image and no comment saves and displays.

### A40 — Multiple attachments
A record can contain more than one attachment.

### A41 — Record before status
User can add a record while occurrence is still Pending, then complete it later without losing the earlier record.

### A42 — Cycle-level evidence
A parent/cycle instance can receive a journal record even if it is not a leaf occurrence.

## 7. Home and UI behavior

### A43 — Chevron interaction
Tapping only the chevron expands/collapses the node without opening details.

### A44 — Name interaction
Tapping the goal name opens details without toggling status.

### A45 — Status interaction
Tapping status opens quick actions for Completed/Partial/Not Done.

### A46 — Collapsed density
With many configured goals, Home can keep root cards collapsed and does not render all deep descendants expanded by default.

### A47 — Grouping toggle
When `showParentOnHome` is disabled, due child occurrences can appear independently while still aggregating into the parent cycle.

### A48 — Evidence compactness
Home shows counts/indicators rather than large inline images.

## 8. Persistence and platform

### A49 — Restart persistence
After changing statuses and adding records, restart/reload the app. Data remains.

### A50 — Offline core
Create/edit/status/history operations work without network access.

### A51 — Camera denied
Deny camera permission. The app shows a recoverable error and still allows status/comment-only flow.

### A52 — File selection
Choose a file attachment through the platform adapter and persist its metadata/reference.

### A53 — Backup export
Export produces a versioned portable backup of local domain data.

### A54 — Invalid import safety
An invalid/corrupt backup does not destroy existing data.

### A55 — Fresh install migration
A fresh database initializes to the latest schema successfully.

### A56 — Upgrade migration
A database from the previous schema version upgrades without losing goals, occurrences, or journal records.


## 9. Rescheduling and aggregation source

### A57 — One-time reschedule
Reschedule a one-time goal from Aug 19 to Aug 20. It no longer appears as actionable on Aug 19, appears on Aug 20, and the operation does not create an unrelated recurring series.

### A58 — Recurring occurrence isolation
Apply a one-off exception to Wednesday's recurring occurrence. Thursday and later occurrences keep the reusable schedule unchanged.

### A59 — Treinar counts occurrences, not child cards
With Football 2x, Running 4x, and Strength 3x, the weekly parent configured for scheduled-occurrence aggregation uses nine expected contributions rather than averaging only the three child definitions.

### A60 — Direct-child weighted project
A project configured for direct-child aggregation with 10/50/25/15 weights counts each immediate child once and does not also count the descendants of those children in the same denominator.
