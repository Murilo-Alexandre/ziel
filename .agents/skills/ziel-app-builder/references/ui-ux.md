# Ziel UI and UX

## Table of contents

1. Visual direction
2. Navigation
3. Home layout
4. Goal tree card behavior
5. Status interaction
6. Goal details
7. Records/evidence timeline
8. Agenda
9. Progress
10. Goals library
11. Empty/loading/error states
12. Accessibility and interaction quality

## 1. Visual direction

Use `assets/reference-home.png` as inspiration for the visual language:

- near-black background;
- slightly lighter cards;
- rounded corners;
- restrained borders/shadows;
- strong typography hierarchy;
- generous but efficient spacing;
- progress bars and large percentage emphasis where useful;
- horizontal date strip;
- compact bottom navigation;
- personal premium feel.

Do not copy health metrics, calorie cards, muscle-plan language, or any content category from the reference.

### Status color semantics

Use theme tokens rather than hard-coded colors in components.

Intended semantics:

- completed: positive/green role;
- partial/in-progress: warning or information role, selected consistently;
- pending: neutral gray;
- not done: negative/red role;
- blue/accent: selection/information.

Reserve destructive red for destructive/failed states, not decorative noise.

## 2. Navigation

Recommended bottom navigation:

- Hoje
- Agenda
- central `+`
- Progresso
- Metas

Settings can live behind profile/avatar or overflow menu.

The central `+` opens creation presets but all presets map to the same goal engine.

## 3. Home layout

Recommended order:

1. Greeting/time-of-day
2. Selected calendar date
3. Horizontal date strip
4. Progress card for selected day
5. `Hoje` / selected-day goal tree
6. Bottom navigation

The selected date strip must allow reviewing prior/future planned dates without losing the clean one-day focus.

### Daily progress card

Show a concise summary such as:

- percentage;
- completed/relevant count;
- optional parent-cycle context;
- later: streak/score.

Avoid overloading the first screen with charts.

## 4. Goal tree card behavior

Root parent card example on Wednesday:

```text
Treinar                              44%
Esta semana · 4 de 9
[progress]

  ○ Futebol
  ○ Corrida
  ○ Musculação

Hoje · 0 de 3
```

On Monday, only the Monday-relevant child appears under the same weekly parent:

```text
Treinar
Esta semana · 0 de 9

  ○ Futebol
```

### Expand/collapse

- right/down chevron controls expansion;
- parent can be collapsed to a compact progress summary;
- multiple roots can be expanded independently;
- nested indentation must be subtle and scalable;
- do not show 40 fully expanded items by default.

### Hit targets

Each interaction has one clear target:

- chevron -> expand/collapse;
- name/content -> details;
- status circle/icon -> quick status action;
- evidence count -> open timeline/details when useful.

Do not make one ambiguous entire card perform multiple hidden actions.

### Parent grouping

Default `showParentOnHome = true` groups children under parent.

If disabled, due child occurrences may appear as independent Home items while still belonging to their parent for aggregation.

## 5. Status interaction

Tapping status opens a compact bottom sheet/action menu:

**Como foi?**

- Concluído
- Parcial
- Não realizado

Pending is the default unresolved state. Provide reset-to-pending from details or edit action if needed.

Below status options, offer:

`+ Adicionar comentário ou evidência`

Adding evidence is optional; status change should remain fast.

## 6. Goal details

A goal details screen should adapt to leaf or parent goals.

Possible sections:

- name, icon, description;
- current status/progress;
- current cycle label;
- target/deadline;
- schedule summary;
- nested structure;
- current cycle occurrences;
- history;
- evidence timeline;
- settings/edit.

For a parent goal, show a recursive structure with collapsed future/empty branches.

Example:

```text
Ler um livro                         68%
Prazo: 31 de agosto
13 / 20 capítulos

Estrutura
v Semana 1                          ✓
  ✓ Capítulo 1
  ✓ Capítulo 2
> Semana 2                          80%
> Semana 3                           0%
```

## 7. Records/evidence timeline

Do not use one `Observação` textarea.

A record composer should offer:

- Comentário
- Tirar foto
- Escolher imagem
- Anexar arquivo

Timeline entry includes timestamp, text if any, and attachment thumbnails/list.

Home displays only compact indicators such as:

- `2 registros`
- comment count icon
- camera/image count icon

Open detail/timeline for actual media.

Changing status must not delete or replace the timeline.

## 8. Agenda

Agenda is another projection of occurrences.

Views:

- Dia
- Semana
- Mês

Timed items show time. Untimed scheduled occurrences may show in an all-day section.

Do not create a separate appointment database unless required by a future feature; use goal definitions/occurrences with date/time.

## 9. Progress

V1 progress can start with:

- Hoje
- Últimos 7 dias
- Últimos 30 dias
- current streak where meaningful
- completion rate by root goal/category

Later add richer visualizations, perfect-day streaks, weighted score, best/worst consistency.

All metrics must derive from persisted history rather than from current definition rules alone.

## 10. Goals library

Filters:

- Ativas
- Pausadas
- Arquivadas/Concluídas
- category filters

Show root goals primarily, with a way to navigate the tree.

A one-time completed goal can remain in history/library without appearing on future Home dates.

## 11. Empty/loading/error states

### Empty Home

Explain that no goals are planned for the selected day and offer `Criar meta`.

### New user

Offer one short example/template only as education; do not seed health-specific permanent data.

### Permission denied

If camera/files permission is denied, explain why and allow continuing without attachment.

### Persistence error

Never discard the user's input silently. Keep draft state where possible and surface a retry.

## 12. Accessibility and interaction quality

- Use adequate touch target sizes.
- Do not rely on color alone for status.
- Preserve readable contrast in dark mode.
- Support dynamic text reasonably.
- Use semantic labels for icons/status controls.
- Keep animation subtle and optional; respect reduced motion.
- Avoid hidden long-press-only critical actions; long press can be a shortcut but not the only path.
