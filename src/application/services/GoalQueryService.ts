import { GoalRepository } from '../../infrastructure/ports/GoalRepository';
import { OccurrenceRepository } from '../../infrastructure/ports/OccurrenceRepository';
import { JournalRepository } from '../../infrastructure/ports/JournalRepository';
import { CycleInstance, GoalDefinition, GoalRevision, Occurrence } from '../../domain/types';
import { pickRevisionForDate } from '../../domain/goals/revisions';
import { generateExpectedOccurrencesForDate } from '../../domain/recurrence/occurrenceGenerator';
import { addDays, diffDays, todayLocal } from '../../domain/dates';
import { getCycleWindow } from '../../domain/recurrence/cycleEvaluator';

export type GoalDetails = {
  definition: GoalDefinition;
  revision: GoalRevision;
  cycle: CycleInstance | null;
  children: { id: string; name: string; archived: boolean }[];
  path: string[]; // nomes dos ancestrais (raiz → pai)
  history: { occurrence: Occurrence; evidenceCount: number }[];
};

export type AgendaItem = {
  goalId: string;
  name: string;
  date: string;
  status: Occurrence['status'];
  occurrenceId: string | null;
  parentName: string | null;
  isQuotaSlot: boolean;
  colorToken: string | null;
};
export type AgendaDay = { date: string; items: AgendaItem[] };

export type LibraryItem = {
  definition: GoalDefinition;
  revision: GoalRevision;
  depth: number;
  childCount: number;
  archived: boolean;
};

/** Consultas somente-leitura (não materializam ocorrências nem alteram dados). */
export class GoalQueryService {
  constructor(
    private goalRepo: GoalRepository,
    private occRepo: OccurrenceRepository,
    private journalRepo: JournalRepository,
    private today: () => string = () => todayLocal()
  ) {}

  /** Todas as metas em ordem de árvore, com a revisão vigente hoje (ou a mais recente). */
  async listLibrary(): Promise<LibraryItem[]> {
    const [defs, revs] = await Promise.all([this.goalRepo.listAllDefinitions(), this.goalRepo.listAllRevisions()]);
    const today = this.today();
    const byGoal = new Map<string, GoalRevision[]>();
    revs.forEach((r) => byGoal.set(r.goalId, [...(byGoal.get(r.goalId) ?? []), r]));
    const archivedIds = new Set(defs.filter((d) => d.archivedAt).map((d) => d.id));
    const children = new Map<string | null, GoalDefinition[]>();
    defs.forEach((d) => children.set(d.parentId, [...(children.get(d.parentId) ?? []), d]));
    children.forEach((l) => l.sort((a, b) => a.sortOrder - b.sortOrder));

    const out: LibraryItem[] = [];
    const walk = (parent: string | null, depth: number, ancestorArchived: boolean, seen: Set<string>) => {
      for (const d of children.get(parent) ?? []) {
        if (seen.has(d.id)) continue;
        const list = byGoal.get(d.id) ?? [];
        const rev = pickRevisionForDate(list, today) ?? [...list].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
        if (!rev) continue;
        const archived = ancestorArchived || archivedIds.has(d.id);
        out.push({ definition: d, revision: rev, depth, childCount: (children.get(d.id) ?? []).filter((c) => !c.archivedAt).length, archived });
        walk(d.id, depth + 1, archived, new Set(seen).add(d.id));
      }
    };
    walk(null, 0, false, new Set());
    return out;
  }

  async getGoalDetails(goalId: string, date: string): Promise<GoalDetails | null> {
    const def = await this.goalRepo.getDefinition(goalId);
    if (!def) return null;
    const revs = await this.goalRepo.listRevisionsForGoal(goalId);
    const revision =
      pickRevisionForDate(revs, date) ?? [...revs].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    if (!revision) return null;

    const allDefs = await this.goalRepo.listAllDefinitions();
    const path: string[] = [];
    let cur = def.parentId ? allDefs.find((d) => d.id === def.parentId) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const r = await this.goalRepo.getRevisionForDate(cur.id, date);
      path.unshift(r?.name ?? '—');
      cur = cur.parentId ? allDefs.find((d) => d.id === cur!.parentId) : undefined;
    }

    const children: GoalDetails['children'] = [];
    for (const c of allDefs.filter((d) => d.parentId === goalId).sort((a, b) => a.sortOrder - b.sortOrder)) {
      const r = await this.goalRepo.getRevisionForDate(c.id, date);
      const fallback = (await this.goalRepo.listRevisionsForGoal(c.id))[0];
      children.push({ id: c.id, name: (r ?? fallback)?.name ?? '—', archived: Boolean(c.archivedAt) });
    }

    const window = getCycleWindow(date, revision.trackingCycle, goalId, revision.id);
    const cycle = await this.occRepo.getCycleInstance(goalId, window.cycleKey);

    const occs = (await this.occRepo.listOccurrencesForGoal(goalId))
      .filter((o) => !o.overrideData?.isRemovedFromDate)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      .slice(0, 30);
    const counts = await this.journalRepo.countRecordsByOccurrence(occs.map((o) => o.id));
    return {
      definition: def,
      revision,
      cycle,
      children,
      path,
      history: occs.map((o) => ({ occurrence: o, evidenceCount: counts.get(o.id) ?? 0 })),
    };
  }

  /** Projeção da agenda: ocorrências esperadas pela agenda vigente + as reais. Não grava nada. */
  async getAgenda(startDate: string, endDate: string): Promise<AgendaDay[]> {
    const [defs, revs, occs] = await Promise.all([
      this.goalRepo.listAllDefinitions(),
      this.goalRepo.listAllRevisions(),
      this.occRepo.listInRange(startDate, endDate),
    ]);
    const byId = new Map(defs.map((d) => [d.id, d]));
    const hidden = (d: GoalDefinition): boolean => {
      const seen = new Set<string>();
      let c: GoalDefinition | undefined = d;
      while (c) {
        if (c.archivedAt || seen.has(c.id)) return true;
        seen.add(c.id);
        c = c.parentId ? byId.get(c.parentId) : undefined;
      }
      return false;
    };
    const active = defs.filter((d) => !hidden(d));
    const revByGoal = new Map<string, GoalRevision[]>();
    revs.forEach((r) => revByGoal.set(r.goalId, [...(revByGoal.get(r.goalId) ?? []), r]));
    const occByKey = new Map(occs.map((o) => [o.occurrenceKey, o]));

    const days: AgendaDay[] = [];
    const total = diffDays(startDate, endDate);
    for (let i = 0; i <= total; i++) {
      const date = addDays(startDate, i);
      const withRev = active
        .map((definition) => ({ definition, revision: pickRevisionForDate(revByGoal.get(definition.id) ?? [], date) }))
        .filter((x): x is { definition: GoalDefinition; revision: GoalRevision } => x.revision !== null);
      const revOf = new Map(withRev.map((x) => [x.definition.id, x.revision]));
      const items: AgendaItem[] = [];
      for (const exp of generateExpectedOccurrencesForDate(withRev, date)) {
        const real = occByKey.get(exp.occurrenceKey);
        if (real?.overrideData?.isRemovedFromDate) continue;
        const rev = revOf.get(exp.goalId)!;
        const parent = byId.get(exp.goalId)?.parentId;
        items.push({
          goalId: exp.goalId,
          name: real?.overrideData?.name ?? rev.name,
          date,
          status: real?.status ?? 'pending',
          occurrenceId: real?.id ?? null,
          parentName: parent ? (revOf.get(parent)?.name ?? null) : null,
          isQuotaSlot: exp.source === 'quota_event',
          colorToken: rev.colorToken,
        });
      }
      // ocorrências reais sem correspondência na agenda atual (ex.: concluídas antes de uma edição)
      for (const o of occs) {
        if (o.scheduledDate !== date || o.slotKey !== 'default') continue;
        if (items.some((it) => it.goalId === o.goalId)) continue;
        if (o.status === 'pending' || o.overrideData?.isRemovedFromDate) continue;
        const rev = pickRevisionForDate(revByGoal.get(o.goalId) ?? [], date);
        if (!rev || !byId.get(o.goalId) || hidden(byId.get(o.goalId)!)) continue;
        items.push({ goalId: o.goalId, name: rev.name, date, status: o.status, occurrenceId: o.id, parentName: null, isQuotaSlot: false, colorToken: rev.colorToken });
      }
      days.push({ date, items });
    }
    return days;
  }
}
