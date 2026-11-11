// Extrai o miolo SVG (peso "regular") dos ícones do catálogo a partir de @phosphor-icons/core (MIT).
// Gera src/shared/icons/phosphor.generated.ts. Rodar: python scripts/build-icon-catalog.py && node scripts/gen-icons.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const cat = JSON.parse(readFileSync('src/shared/icons/catalog.json', 'utf-8'));
const dir = 'node_modules/@phosphor-icons/core/assets/regular';
const out = {};
const missing = [];
for (const i of cat.icons) {
  if (!i.ph) continue; // ícone desenhado à mão (svg embutido no catálogo)
  const f = `${dir}/${i.ph}.svg`;
  if (!existsSync(f)) {
    missing.push(i.ph);
    continue;
  }
  const svg = readFileSync(f, 'utf-8');
  out[i.ph] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}
if (missing.length) {
  console.error('Ícones inexistentes no Phosphor:', missing.join(', '));
  process.exit(1);
}
writeFileSync(
  'src/shared/icons/phosphor.generated.ts',
  `// GERADO por scripts/gen-icons.mjs a partir de @phosphor-icons/core (MIT). Não editar à mão.\nexport const PHOSPHOR_PATHS: Record<string, string> = ${JSON.stringify(out)};\n`
);
console.log(Object.keys(out).length, 'ícones gerados');
