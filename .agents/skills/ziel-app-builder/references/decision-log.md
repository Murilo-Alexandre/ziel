# Ziel Decision Log

This file records the latest product decisions that should win when earlier brainstorming conflicts with later refinements.

## Table of contents

1. Product identity
2. Unified goal model
3. Hierarchy
4. Time model
5. Status model
6. Evidence model
7. Home behavior
8. Delivery targets
9. Rescheduling and one-off actions
10. Earlier ideas that are not core V1 rules

## 1. Product identity

**Latest decision:** Ziel is a generic personal manager of hierarchical, configurable goals. It is not specifically a habits, fitness, diet, tasks, calendar, study, or productivity app.

Examples such as water, diet, football, running, books, projects, finance, and study are validation scenarios only. Never create domain-specific entities or rules for them.

## 2. Unified goal model

Earlier brainstorming separated habits/goals, tasks, and appointments. The later design generalizes the model: **everything is represented by the same goal definition engine**.

A one-off task is a goal with a one-time schedule. A commitment is a goal with date/time. A habit is a recurring goal. A project is a parent goal with children. The UI may offer friendly creation presets, but the domain should not require separate task/habit/appointment tables.

## 3. Hierarchy

Latest decision: goals are recursively nestable with no fixed model depth.

- `parentId = null` means root.
- A child can have children.
- Children may be one-off steps or recurring definitions.
- The UI should remain readable with progressive disclosure, but the data model must not impose a shallow limit.

## 4. Time model

Latest decision: separate **active period**, **tracking cycle**, and **schedule/agenda**.

- Active period: when the definition is valid.
- Tracking cycle: the window in which progress is evaluated/reset, such as daily, weekly, monthly, annual, custom, or single.
- Schedule: when occurrences are expected, such as specific weekdays, every N days, a monthly date, nth weekday, a quota per cycle, or one date.

A child schedule is independent of its parent. Optional inheritance may copy period, reminders, category, icon, or color, but should not silently constrain a child.

## 5. Status model

Earlier brainstorming included states such as "ignored" and "in progress". The later execution model settles V1 manual occurrence states as:

- **Pendente**
- **Parcial**
- **Concluído**
- **Não realizado**

For progress arithmetic in V1, use the default mapping:

- Concluído = 1.0
- Parcial = 0.5
- Não realizado = 0.0
- Pendente = unresolved / not finalized

Do not treat a parent as concluded merely because its numerical percentage reached a high value if its configured completion criterion is not met.

Parent state is normally computed. "Em andamento" may be displayed as a friendly derived label for a parent/cycle with progress that has not met completion criteria, but it is not a separate manually selected occurrence state.

"Ignorar hoje" may be reconsidered later, but it is not a core final V1 state from the latest design.

## 6. Evidence model

Latest decision: notes are not one mutable observation field. Each occurrence or relevant cycle can receive a timeline of records.

A record may contain:

- comment only;
- image only;
- comment plus images;
- multiple attachments;
- file attachment;
- timestamp.

User can add records before or after finalizing status. Changing status later must not erase records.

Evidence can be attached at any goal level by targeting the occurrence or cycle instance relevant to that level.

## 7. Home behavior

Latest decision:

- Daily Home shows what is relevant for the selected day.
- Parent goals can group only the children due that day while still showing parent cycle progress.
- Example: `Treinar` is weekly; on Monday only Football appears inside it; on Wednesday Football + Running + Strength appear.
- Parent remains incomplete for the weekly cycle even if today's children are all complete.
- Hierarchy is expandable/collapsible with chevrons.
- Chevron toggles children; name opens detail; status control opens quick status action.
- Parent grouping is on by default but can be disabled per goal.

## 8. Delivery targets

Latest decision:

- First target: installable Android APK for personal use.
- Architecture: React + TypeScript + Vite + Capacitor.
- Data: local-first/offline-first, no login/backend required in V1.
- Future: PWA for iPhone/browser, possible Play Store publication, cloud backup/sync later.
- Platform features must be accessed through adapters rather than directly from UI components.

## 9. Rescheduling and one-off actions

Earlier planning included an `Adiar` action. Preserve it as a behavior of one-time goals or explicit one-off occurrence overrides, not as a new entity type.

- A one-time goal can be moved to tomorrow or another date through a reschedule/override flow.
- A recurring occurrence belongs to its configured date and should not be silently moved as if the reusable series changed. Offer a one-off exception only when explicitly designed, and preserve the original historical expectation.
- Rescheduling must not mutate unrelated future occurrences.

## 10. Earlier ideas that are not core V1 rules

These ideas remain useful backlog items but should not distort the foundation:

- intelligent notifications;
- Android widgets;
- advanced charts/analytics;
- reusable routine templates;
- cloud sync;
- AI coaching;
- configurable percentage value for Partial;
- gamification such as Perfect Day and weighted daily score.

Basic history, progress, recurrence, hierarchy, timeline records, attachments, local persistence, and backup/export are part of the intended first product direction. Advanced polish can follow the core vertical slice.
