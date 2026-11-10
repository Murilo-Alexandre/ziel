let counter = 0;

/** Id único e ordenável (prefixo + instante + contador + aleatório). Evita colisões no mesmo milissegundo. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}_${rand}`;
}
