# Progress, Status, and Aggregation

## Table of contents

1. Occurrence states
2. Default numeric contribution
3. Parent derived state
4. Progress modes
5. Completion rules
6. Aggregation rules
7. Required vs optional children
8. Daily progress
9. Finalizing expired cycles
10. Examples

## 1. Occurrence states

Manual actionable occurrence states in V1:

- `pending` -> **Pendente**
- `partial` -> **Parcial**
- `completed` -> **Concluído**
- `not_done` -> **Não realizado**

The user can revise a status later.

Status changes should update timestamps/history metadata without deleting journal records.

## 2. Default numeric contribution

Use these default values in V1 calculations:

- completed = 1.0
- partial = 0.5
- not_done = 0.0
- pending = unresolved

Keep the 0.5 mapping centralized/configurable in code even if V1 has no UI setting yet.

## 3. Parent derived state

For an automatic parent/cycle:

- **Pendente**: no relevant progress and evaluation is not yet failed/finalized.
- **Em andamento**: some progress exists but the completion rule is not met. This is a derived display state, not a manually selectable occurrence state.
- **Concluído**: configured completion criterion is met.
- **Não realizado**: cycle has ended/finalized and criterion was not met.

A percentage alone must not automatically override a stricter completion rule.

Example: if completion requires all required children to be completed, two completed + one partial may show 83% but the parent is still not completed.

## 4. Progress modes

### Binary

One occurrence contribution based on status.

### Child aggregation

Derived from child occurrences/cycles relevant to the parent's evaluation window.

### Quantity

```text
progress = clamp(actual / target, 0, 1)
```

Store actual and target in compatible units.

### Frequency

```text
progress = clamp(completedCount / requiredCount, 0, 1)
```

Partial events may contribute using the central partial weight if the product behavior calls for it.

### Percentage

User enters or system computes a normalized percentage.

### Time

Treat as quantity in a time unit after normalization.

### Manual

User directly sets progress/completion according to UI rules.

## 5. Completion rules

Support concepts:

### All required

Every required relevant child/occurrence must satisfy completion.

### Minimum count

Example: complete at least 7 of 9 expected activities.

### Minimum percentage

Example: completion at 80% aggregate progress.

### Quantity target

Example: 300 pages.

### Manual

User decides the parent/cycle is finished.

## 6. Aggregation rules

### Equal weight

Each relevant child/occurrence gets equal weight.

### Custom weight

Each child may contribute a configured weight.

Example:

```text
Planejamento     10%
Desenvolvimento  50%
Testes           25%
Documentação     15%
```

Validate or normalize weights. Do not allow surprising totals without explaining behavior.

### Quantity roll-up

Only aggregate raw quantities where semantic units match and the parent explicitly uses that rule.

### Manual

Do not auto-aggregate.

## 7. Required vs optional children

A child may be required or optional.

- Required children can block `all required` completion.
- Optional children must not block that rule.
- Decide whether optional children affect display percentage based on the aggregation configuration; do not let this be accidental.

## 8. Daily progress

Home's daily progress should be based on actionable expectations relevant to the selected day, not every configured goal in the database.

Possible V1 formula:

```text
sum(contribution of today's relevant required occurrences)
---------------------------------------------------------
count(weight of today's relevant required occurrences)
```

If parent cards group children, avoid double-counting both parent and child as separate daily items. Parent display progress can be informational while the actual daily denominator uses leaf/actionable expectations.

## 9. Finalizing expired cycles

Do not mark a pending occurrence `not_done` prematurely while its due window is still open.

When a date/cycle has passed and the product chooses to finalize it:

- unresolved required occurrences may become `not_done` or remain pending with a derived missed state, depending on implementation policy;
- apply the policy consistently and test it;
- never change historical user-entered Completed/Partial statuses.

If V1 does not auto-finalize, compute "missed" analytically in history rather than mutating records silently.

## 10. Examples

### Alimentação

```text
Café      completed = 100%
Almoço    partial   = 50%
Jantar    completed = 100%
```

Equal-weight display progress = 83.33%.

If completion rule = all required completed, parent is **Em andamento/Parcial**, not Concluído.

### Treinar weekly

9 expected occurrences, 4 completed:

```text
4 / 9 = 44.44%
```

If completion rule = minimum 7, the cycle becomes completed at 7 qualifying executions even if two expected occurrences remain incomplete.
