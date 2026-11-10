// Ziel Core Domain Types

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, ..., 6=Saturday

export type ActivePeriod = {
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null for indefinite
};

export type ScheduleRule =
  | { type: 'once'; date: string; time?: string }
  | { type: 'daily'; time?: string }
  | { type: 'weekdays'; weekdays: Weekday[]; time?: string }
  | { type: 'interval'; every: number; unit: 'day' | 'week' | 'month'; anchorDate: string; time?: string }
  | { type: 'monthlyDate'; dayOfMonth: number; time?: string }
  | { type: 'monthlyNthWeekday'; ordinal: 1 | 2 | 3 | 4 | 5 | -1; weekday: Weekday; time?: string }
  | { type: 'annual'; month: number; day: number; time?: string }
  | { type: 'quota'; count: number; per: 'day' | 'week' | 'month' | 'year' }
  | { type: 'custom'; expression: string; metadata?: Record<string, unknown> };

export type TrackingCycleRule =
  | { type: 'single' }
  | { type: 'daily'; dayBoundary?: string }
  | { type: 'weekly'; weekStartsOn: Weekday } // default 1 (Monday)
  | { type: 'monthly' }
  | { type: 'annual' }
  | { type: 'custom'; duration: number; unit: 'day' | 'week' | 'month'; anchorDate: string };

export type ProgressRule =
  | { type: 'binary' }
  | { type: 'children' }
  | { type: 'quantity'; target: number; unit: string; step?: number }
  | { type: 'frequency'; targetCount: number }
  | { type: 'percentage' }
  | { type: 'time'; targetMinutes: number; stepMinutes?: number }
  | { type: 'manual' };

export type CompletionRule =
  | { type: 'allRequired' }
  | { type: 'minimumCount'; count: number }
  | { type: 'minimumPercentage'; percentage: number }
  | { type: 'quantityTarget' }
  | { type: 'manual' };

export type AggregationRule =
  | {
      type: 'directChildren';
      weightMode: 'equal' | 'custom';
      optionalContribution: 'include' | 'exclude';
      childWeights?: Record<string, number>; // goalId -> weight
    }
  | {
      type: 'scheduledOccurrences';
      depth: 'direct' | 'descendants';
      weightMode: 'equal' | 'custom';
      occurrenceWeights?: Record<string, number>;
    }
  | { type: 'quantityRollup'; unit: string }
  | { type: 'manual' };

export type InheritanceRule = {
  period: boolean;
  category: boolean;
  icon: boolean;
  color: boolean;
  reminders: boolean;
};

export type ReminderRule = {
  id: string;
  time: string; // HH:mm
  daysOfWeek?: Weekday[];
};

/** Lembretes locais de uma meta: horário estimado + janela de avisos antes/depois, repetidos a cada N minutos. */
export type NotifyConfig = {
  enabled: boolean;
  time: string; // HH:mm - horário estimado da execução
  beforeMin: number; // começa a avisar X min antes
  afterMin: number; // para de avisar Y min depois
  everyMin: number; // intervalo entre avisos
};

export type GoalRevision = {
  id: string;
  goalId: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD or null

  parentId: string | null;
  sortOrder: number;

  name: string;
  description: string | null;
  icon: string | null;
  colorToken: string | null;
  categoryId: string | null;

  activePeriod: ActivePeriod;
  trackingCycle: TrackingCycleRule;
  schedule: ScheduleRule;
  progressRule: ProgressRule;
  completionRule: CompletionRule;
  aggregationRule: AggregationRule;

  isRequired: boolean;
  showParentOnHome: boolean;
  inherit: InheritanceRule;
  reminders: ReminderRule[];
  /** Lembretes por ocorrência (opcional; ausente = sem lembretes). */
  notify?: NotifyConfig | null;
};

export type GoalDefinition = {
  id: string;
  parentId: string | null;
  createdAt: string; // ISO string
  updatedAt: string;
  archivedAt: string | null;
  sortOrder: number;
  currentRevisionId: string;
};

export type OccurrenceStatus = 'pending' | 'partial' | 'completed' | 'not_done';

export type OccurrenceOverride = {
  name?: string;
  description?: string;
  quantityValue?: number;
  scheduledTime?: string;
  isRemovedFromDate?: boolean;
};

export type Occurrence = {
  id: string;
  goalId: string;
  revisionId: string;
  cycleInstanceId: string | null;

  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null;
  slotKey: string;
  occurrenceKey: string; // Determinística: goalId_scheduledDate_slotKey (independe da revisão => sem duplicar após editar)
  source: 'generated' | 'quota_event' | 'manual';

  status: OccurrenceStatus;
  progressValue: number | null;
  quantityValue: number | null;

  completedAt: string | null;
  lastStatusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;

  overrideData?: OccurrenceOverride | null;
  /** Data originalmente esperada quando uma meta única foi remarcada. */
  rescheduledFrom?: string | null;
};

export type CycleComputedStatus = 'pending' | 'in_progress' | 'completed' | 'not_done';

export type CycleInstance = {
  id: string;
  goalId: string;
  revisionId: string;
  startAt: string; // YYYY-MM-DD
  endAt: string; // YYYY-MM-DD
  cycleKey: string; // goalId_tipo_inicio_fim (independe da revisao)

  computedProgress: number; // 0.0 to 1.0
  computedStatus: CycleComputedStatus;
  completedCount?: number;
  expectedCount?: number;

  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JournalTarget =
  | { type: 'occurrence'; occurrenceId: string }
  | { type: 'cycle'; cycleInstanceId: string };

export type AttachmentKind = 'image' | 'file';

export type Attachment = {
  id: string;
  recordId: string;
  kind: AttachmentKind;
  uri: string;
  displayName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Conteúdo durável do anexo (Blob no IndexedDB). `uri` é apenas uma referência de exibição legada. */
  blob?: Blob | null;
  createdAt: string;
};

export type JournalRecord = {
  id: string;
  target: JournalTarget;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
};

export type StatusChange = {
  id: string;
  occurrenceId: string;
  fromStatus: OccurrenceStatus | null;
  toStatus: OccurrenceStatus;
  changedAt: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  colorToken: string | null;
  sortOrder: number;
};
