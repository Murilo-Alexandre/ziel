import React, { useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { OccurrenceStatus } from '../../domain/types';
import { Sheet } from '../ui/Sheet';
import { STATUS_META } from '../ui/status';

type Props = {
  open: boolean;
  goalName: string;
  currentStatus: OccurrenceStatus;
  quantity?: { target: number; unit: string; current: number | null } | null;
  onClose: () => void;
  onSelectStatus: (status: OccurrenceStatus) => void;
  onSaveQuantity: (value: number) => void;
  onAddEvidence: () => void;
};

const OPTIONS: OccurrenceStatus[] = ['completed', 'partial', 'not_done'];
const BLOCK: Record<OccurrenceStatus, string> = { completed: 'bg-block-green', partial: 'bg-block-yellow', not_done: 'bg-block-coral', pending: 'bg-ziel-raised' };

export const QuickStatusSheet: React.FC<Props> = ({
  open,
  goalName,
  currentStatus,
  quantity,
  onClose,
  onSelectStatus,
  onSaveQuantity,
  onAddEvidence,
}) => {
  const [qty, setQty] = useState('');
  useEffect(() => {
    if (open) setQty(quantity?.current != null ? String(quantity.current).replace('.', ',') : '');
  }, [open, quantity?.current]);

  const parsed = Number(qty.replace(',', '.'));
  const qtyValid = qty.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  return (
    <Sheet open={open} title="Como foi?" subtitle={goalName} onClose={onClose}>
      {quantity && (
        <div className="mb-4 rounded-card border border-ziel-line bg-ziel-bg p-4">
          <label htmlFor="qty" className="text-sm font-semibold text-ziel-sub">
            Quanto você fez? <span className="font-normal text-ziel-muted">(meta: {quantity.target} {quantity.unit})</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="qty"
              inputMode="decimal"
              className="field"
              placeholder={`0 ${quantity.unit}`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button type="button" className="btn-primary shrink-0" disabled={!qtyValid} onClick={() => onSaveQuantity(parsed)}>
              Salvar
            </button>
          </div>
          <p className="mt-2 text-xs text-ziel-muted">O status acompanha a quantidade: alvo atingido = Concluído, parte dele = Parcial.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((key) => {
          const m = STATUS_META[key];
          const selected = currentStatus === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectStatus(key)}
              aria-pressed={selected}
              className={`flex min-h-[54px] items-center gap-3 rounded-[22px] px-5 text-left text-ziel-ink ${BLOCK[key]} ${selected ? 'ring-2 ring-inset ring-white/80' : ''}`}
            >
              <m.Icon className="h-6 w-6 shrink-0 text-ziel-ink" />
              <span className="flex-1 text-base font-semibold">{m.label}</span>
              {selected && <span className="rounded-full bg-ziel-ink px-2.5 py-1 text-[11px] font-bold text-ziel-text">Atual</span>}
            </button>
          );
        })}
        {currentStatus !== 'pending' && (
          <button type="button" onClick={() => onSelectStatus('pending')} className="btn-ghost mt-1 text-ziel-sub">
            Voltar para pendente
          </button>
        )}
      </div>

      <button type="button" onClick={onAddEvidence} className="mt-4 flex min-h-touch w-full items-center justify-center gap-2 text-sm font-semibold text-ziel-accent">
        <MessageSquarePlus className="h-5 w-5" />
        Adicionar comentário ou evidência
      </button>
    </Sheet>
  );
};
