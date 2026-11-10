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

export const TodayView: React.FC<{ onNewGoal: number }> = ({ onNewGoal }) => {
  const { version, bump } = useAppData();
  const { notify } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => todayLocal());
  const [tree, setTree] = useState<TodayTree | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(readExpanded);
  const reqId = useRef(0);

  const [statusNode, setStatusNode] = useState<TodayGoalNode | null>(null);
  const { openDetails, openEditor, openEvidence } = useOverlays();
  const [hasAnyGoal, setHasAnyGoal] = useState(true);

  const load = useCallback(async (date: string) => {
    const id = ++reqId.current;
    try {
      const t = await occurrenceService.getTodayGoalTree(date);
      if (id !== reqId.current) return; // resposta de uma data anterior: descarta
      setTree(t);
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

  // botão "+" central da navegação
  const lastNew = useRef(onNewGoal);
  useEffect(() => {
    if (onNewGoal !== lastNew.current) {
      lastNew.current = onNewGoal;
      openEditor({ kind: 'create', parentId: null });
    }
  }, [onNewGoal, openEditor]);

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
    <div className="pb-nav mx-auto w-full max-w-lg px-4 pt-safe">
      <header className="pb-4 pt-5">
        <p className="text-sm text-ziel-muted">{greeting()}</p>
        <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{selectedDate === todayStr ? 'Hoje' : dateLabel}</h1>
        {selectedDate === todayStr && <p className="text-sm text-ziel-muted">{dateLabel}</p>}
      </header>

      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="mt-4 space-y-4">
        <DayProgressCard progress={tree?.overallProgress ?? 0} total={tree?.totalActionable ?? 0} completed={tree?.completedActionable ?? 0} isToday={selectedDate === todayStr} />

        {selectedDate !== todayStr && (
          <button type="button" onClick={() => setSelectedDate(todayStr)} className="btn-ghost w-full">
            Voltar para hoje
          </button>
        )}

        <section aria-label="Metas do dia" className="space-y-3">
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
