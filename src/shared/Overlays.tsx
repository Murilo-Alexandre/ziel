import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { JournalTarget } from '../domain/types';
import { GoalDetailSheet } from '../features/goal-detail/GoalDetailSheet';
import { GoalEditorSheet, EditorMode } from '../features/goal-editor/GoalEditorSheet';
import { EvidenceSheet } from '../features/journal/EvidenceSheet';

type DetailsReq = { goalId: string; date: string; occurrenceId: string | null };
type EvidenceReq = { target: JournalTarget; title: string };

type Ctx = {
  openDetails: (req: DetailsReq) => void;
  openEditor: (mode: EditorMode) => void;
  openEvidence: (req: EvidenceReq) => void;
};

const OverlayContext = createContext<Ctx>({ openDetails: () => undefined, openEditor: () => undefined, openEvidence: () => undefined });
export const useOverlays = () => useContext(OverlayContext);

/** Hospeda as folhas compartilhadas (detalhes, editor, evidências) para qualquer aba abri-las. */
export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [details, setDetails] = useState<DetailsReq | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [evidence, setEvidence] = useState<EvidenceReq | null>(null);

  const openDetails = useCallback((r: DetailsReq) => setDetails(r), []);
  const openEditor = useCallback((m: EditorMode) => setEditor(m), []);
  const openEvidence = useCallback((r: EvidenceReq) => setEvidence(r), []);
  const value = useMemo(() => ({ openDetails, openEditor, openEvidence }), [openDetails, openEditor, openEvidence]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <GoalDetailSheet
        open={details !== null}
        goalId={details?.goalId ?? null}
        date={details?.date ?? ''}
        occurrenceId={details?.occurrenceId ?? null}
        onClose={() => setDetails(null)}
        onEdit={() => {
          if (!details) return;
          setEditor({ kind: 'edit', goalId: details.goalId, date: details.date, occurrenceId: details.occurrenceId });
          setDetails(null);
        }}
        onAddSubgoal={() => {
          if (!details) return;
          setEditor({ kind: 'create', parentId: details.goalId });
          setDetails(null);
        }}
        onOpenEvidence={(target, title) => setEvidence({ target, title })}
      />
      {editor && <GoalEditorSheet open mode={editor} onClose={() => setEditor(null)} onSaved={() => undefined} />}
      <EvidenceSheet open={evidence !== null} title={evidence?.title ?? ''} target={evidence?.target ?? null} onClose={() => setEvidence(null)} />
    </OverlayContext.Provider>
  );
};
