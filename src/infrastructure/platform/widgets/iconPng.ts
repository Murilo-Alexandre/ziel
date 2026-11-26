import { iconMarkup } from '../../../shared/icons/registry';

const INK = '#0F1320';

/**
 * Desenha o "azulejo" da meta (quadrado arredondado na cor da meta + ícone escuro) como PNG base64 (sem prefixo).
 * O widget do Android não desenha SVG, então o app gera a imagem e entrega pronta. Falhou? devolve null e o widget
 * usa um azulejo liso na cor da meta.
 */
export async function renderTilePng(icon: string, color: string, size = 96): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = color;
    const r = size * 0.28;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();

    const inner = iconMarkup(icon);
    if (inner) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size * 0.6}" height="${size * 0.6}" fill="${INK}" color="${INK}">${inner.replace(/currentColor/g, INK)}</svg>`;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const s = size * 0.6;
      ctx.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
    }
    return canvas.toDataURL('image/png').split(',')[1] ?? null;
  } catch {
    return null;
  }
}
