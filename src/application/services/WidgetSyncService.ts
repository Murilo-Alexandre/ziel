import { OccurrenceService } from './OccurrenceService';
import { GoalRepository } from '../../infrastructure/ports/GoalRepository';
import { PlannedReminder } from '../../domain/notifications/reminderPlanner';
import { OccurrenceStatus } from '../../domain/types';
import { TodayGoalNode } from '../../domain/goals/goalTree';
import { addDays, todayLocal } from '../../domain/dates';
import { toneFor } from '../../shared/ui/goalIcons';
import { visibleGoals } from './ReminderService';
import { getStatusNumericWeight } from '../../domain/progress/progressAggregator';

/** Quantos dias à frente o widget recebe (o widget escolhe o dia pelo relógio do aparelho, mesmo com o app fechado). */
export const WIDGET_DAYS = 7;

export type WidgetItem = {
  id: string; // goalId
  /** Id da meta mãe (null na raiz): permite montar a hierarquia no widget. */
  pid: string | null;
  n: string; // nome
  c: string; // cor #RRGGBB
  ic: string; // chave do ícone (imagem gerada)
  d: number; // profundidade na hierarquia
  /** 'o' = tem ocorrência no dia (marcável) · 'g' = meta que só agrupa (mostra o progresso do ciclo). */
  k: 'o' | 'g';
  s: OccurrenceStatus;
  /** Progresso do ciclo (0..1), só para grupos. */
  p: number;
  /** Conta no progresso do dia? (regra "só obrigatórias" do app) */
  w: 0 | 1;
  /** Contribuição de "Parcial" no progresso (vem das regras do app). */
  pw: number;
  /** Meta por quantidade: alvo, unidade e valor registrado. */
  q: { t: number; u: string; v: number | null } | null;
  /** Ids dos lembretes pendentes desta ocorrência (o widget os cancela ao marcar). */
  r: number[];
};

export type WidgetDay = { progress: number; total: number; completed: number; items: WidgetItem[] };
export type WidgetGoal = { id: string; n: string; c: string; ic: string; pn: string | null; pid: string | null; dp: number };
export type WidgetSnapshot = { v: 1; generatedAt: number; today: string; days: Record<string, WidgetDay>; goals: WidgetGoal[] };

/** Marcação feita no widget: status, quantidade realizada ou comentário (um por ação). `id` evita aplicar o mesmo comentário duas vezes. */
export type WidgetAction = { goalId: string; date: string; status?: OccurrenceStatus; qty?: number; comment?: string; ts?: number; id?: string };

const STATUSES: OccurrenceStatus[] = ['pending', 'partial', 'completed', 'not_done'];

/** Chave estável do ícone renderizado (ícone + cor). */
export const iconKey = (icon: string | null | undefined, color: string): string => `${(icon ?? 'none').replace(/[^a-zA-Z0-9]+/g, '_')}_${color.replace('#', '')}`;

/**
 * Ponte com os widgets do Android. Gera o "retrato" (snapshot) do app — hoje e os próximos dias, usando as MESMAS
 * regras da Home (árvore do dia, status, progresso, hierarquia) — e aplica no app as marcações feitas nos widgets
 * enquanto o app estava fechado (passando pelo OccurrenceService, então histórico e progresso seguem as regras).
 */
export class WidgetSyncService {
  constructor(
    private occ: OccurrenceService,
    private goalRepo: GoalRepository,
    private plan: () => Promise<PlannedReminder[]> = async () => [],
    private now: () => string = () => todayLocal(),
    private journal: { addRecord: (t: { type: 'occurrence'; occurrenceId: string }, c: string | null) => Promise<unknown> } | null = null
  ) {}

  async buildSnapshot(days: number = WIDGET_DAYS): Promise<WidgetSnapshot> {
    const today = this.now();
    let reminders: PlannedReminder[] = [];
    try {
      reminders = await this.plan();
    } catch {
      /* sem plano de lembretes: o widget apenas não cancela avisos */
    }
    const remindersBy = new Map<string, number[]>();
    for (const r of reminders) remindersBy.set(`${r.goalId}|${r.date}`, [...(remindersBy.get(`${r.goalId}|${r.date}`) ?? []), r.id]);

    const out: Record<string, WidgetDay> = {};
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      const tree = await this.occ.getTodayGoalTree(date);
      const hasRequired = this.anyRequired(tree.nodes);
      const items: WidgetItem[] = [];
      const walk = (list: TodayGoalNode[], depth: number) => {
        for (const n of list) {
          const rev = n.revision;
          const color = toneFor(rev.colorToken, n.goal.id).hex;
          const occ = n.occurrence;
          const q = rev.progressRule.type === 'quantity' ? { t: rev.progressRule.target, u: rev.progressRule.unit, v: occ?.quantityValue ?? null } : null;
          if (occ || n.children.length > 0 || n.hasChildrenDueToday) {
            items.push({
              id: n.goal.id,
              pid: n.goal.parentId ?? null,
              n: occ?.overrideData?.name ?? rev.name,
              c: color,
              ic: iconKey(rev.icon, color),
              d: depth,
              k: occ ? 'o' : 'g',
              s: occ?.status ?? 'pending',
              p: n.cycleInstance?.computedProgress ?? 0,
              w: occ && (!hasRequired || rev.isRequired) ? 1 : 0,
              pw: getStatusNumericWeight('partial'),
              q,
              r: remindersBy.get(`${n.goal.id}|${date}`) ?? [],
            });
          }
          walk(n.children, depth + 1);
        }
      };
      walk(tree.nodes, 0);
      out[date] = { progress: tree.overallProgress, total: tree.totalActionable, completed: tree.completedActionable, items };
    }
    return { v: 1, generatedAt: Date.now(), today, days: out, goals: await this.listGoals() };
  }

  /** Ícones (chave -> {icon, color}) usados no retrato, para o app gerar as imagens que o widget desenha. */
  async iconsNeeded(): Promise<Map<string, { icon: string; color: string }>> {
    const defs = visibleGoals(await this.goalRepo.listAllDefinitions());
    const m = new Map<string, { icon: string; color: string }>();
    for (const d of defs) {
      const rev = await this.goalRepo.getRevision(d.currentRevisionId);
      if (!rev) continue;
      const color = toneFor(rev.colorToken, d.id).hex;
      m.set(iconKey(rev.icon, color), { icon: rev.icon ?? '', color });
    }
    return m;
  }

  private anyRequired(nodes: TodayGoalNode[]): boolean {
    return nodes.some((n) => (n.occurrence && n.revision.isRequired) || this.anyRequired(n.children));
  }

  private async listGoals(): Promise<WidgetGoal[]> {
    const defs = visibleGoals(await this.goalRepo.listAllDefinitions());
    const byId = new Map(defs.map((d) => [d.id, d]));
    const kids = new Map<string | null, typeof defs>();
    for (const d of defs) {
      const parent = d.parentId && byId.has(d.parentId) ? d.parentId : null;
      kids.set(parent, [...(kids.get(parent) ?? []), d]);
    }
    const out: WidgetGoal[] = [];
    const names = new Map<string, string>();
    const walk = async (parent: string | null, depth: number) => {
      const list = [...(kids.get(parent) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
      for (const d of list) {
        const rev = await this.goalRepo.getRevision(d.currentRevisionId);
        if (rev) {
          names.set(d.id, rev.name);
          const color = toneFor(rev.colorToken, d.id).hex;
          out.push({ id: d.id, n: rev.name, c: color, ic: iconKey(rev.icon, color), pn: parent ? (names.get(parent) ?? null) : null, pid: parent, dp: depth });
        }
        await walk(d.id, depth + 1);
      }
    };
    await walk(null, 0);
    return out;
  }

  /**
   * Aplica, na ordem, as marcações feitas nos widgets com o app fechado. Ignora metas que deixaram de existir,
   * estão arquivadas ou não têm ocorrência no dia. Devolve quantas mudaram de fato.
   */
  async applyActions(actions: WidgetAction[]): Promise<number> {
    let applied = 0;
    const done = this.loadApplied();
    const sorted = [...actions].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    for (const a of sorted) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) continue;
      if (a.status !== undefined && !STATUSES.includes(a.status)) continue;
      if (a.comment !== undefined && a.id && done.has(a.id)) continue; // comentário já gravado (reentrega da fila)
      try {
        const def = await this.goalRepo.getDefinition(a.goalId);
        if (!def || def.archivedAt) continue;
        const occs = await this.occ.getOrGenerateOccurrencesForDate(a.date);
        const o = occs.find((x) => x.goalId === a.goalId && x.slotKey === 'default');
        if (!o) continue;
        if (a.qty !== undefined) {
          if (!Number.isFinite(a.qty) || a.qty < 0) continue;
          if (o.quantityValue === a.qty) continue;
          await this.occ.recordQuantity(o.id, a.qty);
          applied++;
        } else if (a.comment !== undefined) {
          const text = a.comment.trim();
          if (!text || !this.journal) continue;
          await this.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, text);
          if (a.id) done.add(a.id);
          applied++;
        } else if (a.status !== undefined) {
          if (o.status === a.status) continue;
          await this.occ.updateStatus(o.id, a.status);
          applied++;
        }
      } catch {
        /* uma ação inválida não impede as demais */
      }
    }
    this.saveApplied(done);
    return applied;
  }

  /** Ids de comentários já gravados: em memória e, quando possível, no aparelho (sobrevive a reinício do app). */
  private appliedMem = new Set<string>();

  private loadApplied(): Set<string> {
    try {
      return new Set<string>([...this.appliedMem, ...JSON.parse(localStorage.getItem('ziel.widget.applied') ?? '[]')]);
    } catch {
      return new Set(this.appliedMem);
    }
  }

  private saveApplied(s: Set<string>) {
    this.appliedMem = new Set([...s].slice(-300));
    try {
      localStorage.setItem('ziel.widget.applied', JSON.stringify([...s].slice(-300)));
    } catch {
      /* sem armazenamento: só não deduplica reentregas */
    }
  }
}
