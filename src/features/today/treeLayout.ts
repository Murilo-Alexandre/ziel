/** Regras puras de layout da árvore da Home (testáveis sem DOM). */

/** Raízes mostram o que vence hoje; níveis mais fundos começam recolhidos (Home enxuta com estruturas grandes). */
export function defaultExpanded(depth: number): boolean {
  return depth === 0;
}

export const INDENT_STEP_PX = 12;
export const MAX_INDENT_LEVELS = 3;

/** Recuo lateral em px; satura em MAX_INDENT_LEVELS níveis para nunca estourar telas de 320 px. */
export function indentFor(depth: number): number {
  return Math.min(depth, MAX_INDENT_LEVELS) * INDENT_STEP_PX;
}
