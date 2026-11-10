# Create and Edit Goal Flow

## Table of contents

1. UX objective
2. Creation modes
3. Form structure
4. Identity section
5. Structure/children section
6. Active period and cycle
7. Schedule editor
8. Progress and completion
9. Inheritance
10. Preview
11. Validation
12. Editing an existing recurring goal
13. One-off occurrence overrides

## 1. UX objective

Creating a powerful goal must not feel like configuring an enterprise workflow. Use progressive disclosure: show the common fields first, keep advanced recurrence/completion options behind expandable sections, and provide a preview before save.

The engine remains generic even if the UI offers friendly presets.

## 2. Creation modes

The `+` action may offer shortcuts such as:

- Meta simples
- Meta com etapas
- Meta por quantidade
- Evento/compromisso

These are UI presets only. They should all produce the same domain entities.

When adding a child, offer a simple semantic choice:

- **Etapa única** — happens once or is manually completed.
- **Recorrente** — generates occurrences by its own schedule.

Internally both remain GoalDefinition records.

## 3. Form structure

Recommended sections:

1. Informações
2. Estrutura
3. Período e ciclo
4. Quando acontece
5. Progresso e conclusão
6. Exibição e organização
7. Lembretes (optional/deferred)
8. Prévia

Avoid forcing the user through irrelevant sections. For example, a simple one-time goal can be created quickly.

## 4. Identity section

Fields:

- Nome — required
- Descrição — optional
- Ícone — optional
- Categoria — optional, user-created
- Cor — optional token/theme role

In lists, show description through an info/detail affordance rather than permanently expanding long text.

## 5. Structure/children section

Controls:

- `+ Adicionar submeta`
- list of current children
- drag handle to reorder siblings
- expand child editor inline or navigate to nested editor
- required/optional toggle where applicable
- delete/archive child action with confirmation

The UI must allow arbitrary nested structure over time without rendering all levels fully expanded by default.

## 6. Active period and cycle

### Active period

Fields:

- Data inicial — required/default today
- Data final — optional

### Tracking cycle

Label this concept clearly, for example:

**Ciclo de acompanhamento**

Options:

- Único
- Diário
- Semanal
- Mensal
- Anual
- Personalizado

Helper text should explain that the cycle controls how progress is evaluated/reset, not the exact days on which the goal appears.

Examples:

- `Treinar`: cycle weekly
- `Futebol`: schedule Monday/Wednesday

## 7. Schedule editor

Label: **Quando esta meta acontece?**

Common options:

### Uma vez

- date
- optional time

### Todos os dias

- optional time

### Dias específicos

Weekday selector:

`SEG TER QUA QUI SEX SÁB DOM`

### Intervalo

- every N
- unit day/week/month
- anchor/start date

### Meta por frequência

Example: `3 vezes por semana`.

Fields:

- count
- per day/week/month/year

Explain that this does not fix which weekdays are used.

### Mensal

Common submodes:

- day N of month
- nth weekday
- last weekday when supported

### Anual

- month + day

### Personalizado

Keep as advanced. Do not expose a raw rule string to normal users unless a future design specifically wants it.

## 8. Progress and completion

### Progress mode

Options:

- Concluir / não concluir
- Pelas submetas
- Quantidade
- Frequência
- Percentual
- Tempo
- Manual

### Quantity fields

- target value
- unit label, e.g. L, pages, minutes
- optional step/increment

### Parent aggregation

If goal has children:

- equal weights
- custom weights
- manual

### Completion rule

Options depending on mode:

- Todas as obrigatórias
- Pelo menos N de M
- Atingir X%
- Atingir quantidade alvo
- Manual

Keep incompatible combinations disabled with explanatory text.

## 9. Inheritance

When creating a child, offer optional shortcuts:

- Usar mesmo período da meta superior
- Herdar categoria
- Herdar ícone/cor
- Herdar lembretes

If enabled, be explicit whether inheritance is dynamic or copied. Recommended: treat most as effective inherited configuration until overridden, but implement semantics consistently.

Do **not** force child schedule to fit the parent schedule.

## 10. Preview

For complex schedules show a preview before save.

Example:

```text
Prévia da rotina
SEG  Futebol
TER  Corrida
QUA  Futebol, Corrida, Musculação
QUI  Corrida, Musculação
SEX  Corrida, Musculação
SÁB  —
DOM  —
```

For monthly/custom rules show the next several expected dates.

Preview should use the same recurrence engine as production, not duplicate UI-only date logic.

## 11. Validation

Validate at minimum:

- non-empty name;
- active period end not before start;
- weekday rule has at least one day;
- interval N > 0;
- quota count > 0;
- quantity target > 0 where required;
- completion threshold within valid range;
- weights valid/normalizable;
- no parent relationship cycle in the goal tree;
- child cannot become its own ancestor;
- monthly calendar values valid;
- recurring schedule cannot be impossible due to missing required fields.

## 12. Editing an existing recurring goal

When a change affects recurrence or expected execution, prompt for scope:

- **Somente esta ocorrência**
- **Esta e as próximas**

For non-recurring display metadata, the UI may still ask scope when historical representation could change.

### This occurrence

Create an override/snapshot linked to the existing occurrence. Do not change the reusable definition.

### This and future

Create a new effective-dated revision starting from the selected effective date. Preserve past revision references.

Never silently regenerate history against the new rule.

## 13. One-off occurrence overrides

An override can support scenarios such as:

- skip/remove only one child today;
- change only today's target;
- change today's time;
- adjust title/description for today;
- reschedule a one-time goal to tomorrow or another date while preserving an auditable original expectation;
- add an exceptional child occurrence.

The exact V1 UI can start small, but the persistence model should not make future one-off overrides impossible.
