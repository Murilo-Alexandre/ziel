import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { TodayTree } from '../../application/services/OccurrenceService';
import { goalRepo, occurrenceService, seedService } from '../../application/container';
import { TodayGoalNode } from '../../domain/goals/goalTree';
import { OccurrenceStatus } from '../../domain/types';
import { parseLocalDate, todayLocal } from '../../domain/dates';
import { DateStrip } from './DateStrip';
import { DayProgressCard } from './DayProgressCard';
import { GoalNodeCard } from './GoalNodeCard';
import { defaultExpanded } from './treeLayout';
import { QuickStatusSheet } from '../../shared/components/QuickStatusSheet';
import { useOverlays } from '../../shared/Overlays';
import { UpdateBanner, UpdateSheet } from '../update/UpdateUi';
import { useRevealOnKey } from '../../shared/motion';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';

const EXPANDED_KEY = 'ziel.expanded.v1';

function readExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const TodayView: React.FC = () => {
  const { version, bump } = useAppData();
  const { notify } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => todayLocal());
  const [tree, setTree] = useState<TodayTree | null>(null);
  const [treeDate, setTreeDate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(readExpanded);
  const reqId = useRef(0);

  const [statusNode, setStatusNode] = useState<TodayGoalNode | null>(null);
  const { openDetails, openEditor, openEvidence } = useOverlays();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [hasAnyGoal, setHasAnyGoal] = useState(true);

  const load = useCallback(async (date: string) => {
    const id = ++reqId.current;
    try {
      const t = await occurrenceService.getTodayGoalTree(date);
      if (id !== reqId.current) return; // resposta de uma data anterior: descarta
      setTree(t);
      setTreeDate((prev) => (prev === date ? prev : date));
      setLoadError(null);
      if (t.nodes.length === 0) {
        const all = await goalRepo.listAllDefinitions();
        if (id === reqId.current) setHasAnyGoal(all.some((g) => !g.archivedAt));
      } else setHasAnyGoal(true);
    } catch (e) {
      if (id === reqId.current) setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
  }, [selectedDate, version, load]);

  const isExpanded = useCallback((goalId: string, depth: number) => expandedMap[goalId] ?? defaultExpanded(depth), [expandedMap]);
  const onToggle = useCallback((goalId: string, depth: number) => {
    setExpandedMap((prev) => {
      const next = { ...prev, [goalId]: !(prev[goalId] ?? defaultExpanded(depth)) };
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível: só não persiste a preferência */
      }
      return next;
    });
  }, []);

  const mutate = async (fn: () => Promise<unknown>, okMsg?: string) => {
    try {
      await fn();
      bump();
      if (okMsg) notify(okMsg, 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  const changeStatus = (status: OccurrenceStatus) => {
    const occ = statusNode?.occurrence;
    setStatusNode(null);
    if (occ) mutate(() => occurrenceService.updateStatus(occ.id, status));
  };

  const saveQuantity = (value: number) => {
    const occ = statusNode?.occurrence;
    setStatusNode(null);
    if (occ) mutate(() => occurrenceService.recordQuantity(occ.id, value));
  };

  const todayStr = todayLocal();
  const revealRef = useRevealOnKey(treeDate ?? '', treeDate !== null);
  const dateLabel = useMemo(() => {
    const d = parseLocalDate(selectedDate);
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [selectedDate]);

  const quantityOf = (n: TodayGoalNode | null) =>
    n && n.revision.progressRule.type === 'quantity'
      ? { target: n.revision.progressRule.target, unit: n.revision.progressRule.unit, current: n.occurrence?.quantityValue ?? null }
      : null;


  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-5 pt-safe">
      <header className="pb-5 pt-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => openEditor({ kind: 'create', parentId: null })} className="flex min-h-[48px] items-center gap-2.5 rounded-full bg-ziel-accent py-1.5 pl-1.5 pr-5 text-sm font-extrabold text-ziel-ink active:opacity-80">
            <span className="orb !h-9 !w-9"><Plus className="h-5 w-5" /></span>
            Nova meta
          </button>
          <p className="text-sm font-semibold text-ziel-muted">{greeting()}</p>
        </div>
        <h1 className="mt-6 text-[34px] font-extrabold leading-[1.05] tracking-tight">{selectedDate === todayStr ? 'Suas metas de hoje' : 'Metas do dia'}</h1>
        <p className="mt-1.5 text-[15px] font-medium text-ziel-muted">{dateLabel}</p>
      </header>

      <UpdateBanner onOpen={() => setUpdateOpen(true)} />

      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div ref={revealRef} className="mt-5 space-y-4">
        <DayProgressCard progress={tree?.overallProgress ?? 0} total={tree?.totalActionable ?? 0} completed={tree?.completedActionable ?? 0} isToday={selectedDate === todayStr} />

        {selectedDate !== todayStr && (
          <button type="button" onClick={() => setSelectedDate(todayStr)} className="btn-ghost w-full">
            Voltar para hoje
          </button>
        )}

        <section aria-label="Metas do dia" className="space-y-4">
          {loadError ? (
            <div role="alert" className="card space-y-3 p-5 text-center">
              <p className="font-semibold text-ziel-danger">Não foi possível carregar suas metas</p>
              <p className="text-sm text-ziel-muted">{loadError}</p>
              <button type="button" className="btn-primary" onClick={() => load(selectedDate)}>
                Tentar de novo
              </button>
            </div>
          ) : !tree ? (
            <div className="space-y-3" aria-busy="true" aria-label="Carregando">
              {[0, 1].map((i) => (
                <div key={i} className="card h-24 animate-pulse bg-ziel-raised" />
              ))}
            </div>
          ) : tree.nodes.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 px-5 py-9 text-center">
              <Sparkles className="h-8 w-8 text-ziel-accent opacity-70" />
              <p className="text-base font-semibold">{hasAnyGoal ? 'Nada planejado para este dia' : 'Comece criando sua primeira meta'}</p>
              <p className="max-w-xs text-sm text-ziel-muted">
                {hasAnyGoal ? 'Escolha outro dia na faixa acima ou crie uma nova meta.' : 'Metas podem ter submetas, agendas próprias e ciclos de acompanhamento.'}
              </p>
              <div className="flex w-full flex-col gap-2 pt-1">
                <button type="button" className="btn-primary" onClick={() => openEditor({ kind: 'create', parentId: null })}>
                  <Plus className="h-4 w-4" /> Criar meta
                </button>
                {!hasAnyGoal && (
                  <button type="button" className="btn-ghost" onClick={() => mutate(() => seedService.seedTreinarScenario(), 'Exemplo “Treinar” criado')}>
                    Carregar exemplo “Treinar”
                  </button>
                )}
              </div>
            </div>
          ) : (
            tree.nodes.map((node) => (
              <GoalNodeCard
                key={node.goal.id}
                node={node}
                isExpanded={isExpanded}
                onToggle={onToggle}
                onOpenDetails={(n) => openDetails({ goalId: n.goal.id, date: selectedDate, occurrenceId: n.occurrence?.id ?? null })}
                onSelectStatus={setStatusNode}
                onOpenEvidence={(n) => n.occurrence && openEvidence({ target: { type: 'occurrence', occurrenceId: n.occurrence.id }, title: n.revision.name })}
              />
            ))
          )}
        </section>
      </div>

      <UpdateSheet open={updateOpen} onClose={() => setUpdateOpen(false)} />

      <QuickStatusSheet
        open={Boolean(statusNode)}
        goalName={statusNode?.occurrence?.overrideData?.name ?? statusNode?.revision.name ?? ''}
        currentStatus={statusNode?.occurrence?.status ?? 'pending'}
        quantity={quantityOf(statusNode)}
        onClose={() => setStatusNode(null)}
        onSelectStatus={changeStatus}
        onSaveQuantity={saveQuantity}
        onAddEvidence={() => {
          const n = statusNode;
          setStatusNode(null);
          if (n?.occurrence) openEvidence({ target: { type: 'occurrence', occurrenceId: n.occurrence.id }, title: n.revision.name });
        }}
      />

    </div>
  );
};
