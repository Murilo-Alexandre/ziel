"""Gera os vetores do ícone Matriz (Z de pontos) para o Android + uma página de pré-visualização
que usa exatamente os mesmos dados (o que se vê é o que vai no APK).

Geometria (viewport 108dp, zona segura = círculo de 66dp no centro):
  grade 5x5, passo P, pontos acesos de raio R, apagados de raio r.
  O ponto mais distante do centro (cantos do Z) fica a 2*sqrt(2)*P + R de distância e precisa caber
  dentro do raio seguro (33) com folga para máscaras circulares agressivas de alguns launchers.
"""
import io, math, os

P, R, r = 8.4, 3.75, 1.45
C = 54.0
LIT = {(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (3, 1), (2, 2), (1, 3), (0, 4), (1, 4), (2, 4), (3, 4), (4, 4)}
corner = 2 * math.sqrt(2) * P + R
assert corner <= 28.5, corner  # folga de ~4,5dp dentro do círculo seguro de 33dp


def circ(x, y, rad):
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    return f"M{f(x - rad)},{f(y)}a{f(rad)},{f(rad)} 0 1,0 {f(2 * rad)},0a{f(rad)},{f(rad)} 0 1,0 {f(-2 * rad)},0z"


def grid(rad, lit):
    d = ''
    for j in range(5):
        for i in range(5):
            if ((i, j) in LIT) == lit:
                d += circ(C + (i - 2) * P, C + (j - 2) * P, rad)
    return d


def vec(size, vp, body):
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="{size}dp" android:height="{size}dp" '
            f'android:viewportWidth="{vp}" android:viewportHeight="{vp}">\n{body}</vector>\n')


def path(color, d):
    return f'    <path android:fillColor="{color}" android:pathData="{d}" />\n'


RES = 'android/app/src/main/res/drawable/'
FG_UNLIT = grid(r, False)
FG_LIT = grid(R, True)
MONO_LIT = grid(R + 0.2, True)
files = {
    'ic_launcher_foreground.xml': vec(108, 108, '    <!-- Z pingado (Matriz): 13 luzes acesas numa grade 5x5, as demais só um sopro -->\n' + path('#33FF7A59', FG_UNLIT) + path('#FFFF7A59', FG_LIT)),
    'ic_launcher_monochrome.xml': vec(108, 108, path('#FF000000', MONO_LIT)),
}
for name, content in files.items():
    io.open(RES + name, 'w', encoding='utf-8', newline='\n').write(content)

# notificação (24dp): mesma lógica, 5x5 em 24
NP, NR = 3.6, 1.45
nd = ''.join(circ(12 + (i - 2) * NP, 12 + (j - 2) * NP, NR) for j in range(5) for i in range(5) if (i, j) in LIT)
io.open(RES + 'ic_stat_ziel.xml', 'w', encoding='utf-8', newline='\n').write(vec(24, 24, '    <!-- Ícone de notificação: o Z pingado -->\n' + path('#FFFFFFFF', nd)))

# ---------- pré-visualização ----------
bg = 'linear-gradient(135deg,#2E3760,#141926)'
svg_fg = f'<svg viewBox="0 0 108 108" width="100%" height="100%"><path fill="#FF7A59" fill-opacity=".22" d="{FG_UNLIT}"/><path fill="#FF7A59" d="{FG_LIT}"/></svg>'
svg_mono = lambda col: f'<svg viewBox="0 0 108 108" width="100%" height="100%"><path fill="{col}" d="{MONO_LIT}"/></svg>'


def icon(size, shape, fg=svg_fg, bgc=bg, zoom=1.0):
    # a camada de 108dp aparece recortada: janela visível = 72dp (66 seguros + 3 de cada lado)
    inner = size * 108 / 72 * zoom
    radius = {'circle': '50%', 'squircle': '34%', 'round': '22%', 'tear': '50% 50% 8% 50%'}[shape]
    return (f'<div style="width:{size}px;height:{size}px;border-radius:{radius};overflow:hidden;position:relative;background:{bgc};flex:none">'
            f'<div style="position:absolute;left:50%;top:50%;width:{inner}px;height:{inner}px;transform:translate(-50%,-50%)">{fg}</div></div>')


rows = []
rows.append('<h3>Camada completa 108dp (círculo = zona segura 66dp)</h3>')
rows.append(f'<div style="position:relative;width:216px;height:216px;background:{bg};border-radius:8px">{svg_fg.replace("100%", "216")}'
            '<div style="position:absolute;left:42px;top:42px;width:132px;height:132px;border:1px dashed #ffffff88;border-radius:50%"></div></div>')
rows.append('<h3>Máscaras (real, escala de launcher 1.0)</h3><div class="r">' + ''.join(icon(88, s) for s in ('circle', 'squircle', 'round', 'tear')) + '</div>')
rows.append('<h3>Launcher mais "ampliado" (zoom 1.15) — pior caso</h3><div class="r">' + ''.join(icon(88, s, zoom=1.15) for s in ('circle', 'squircle')) + '</div>')
rows.append('<h3>Tamanhos pequenos (círculo)</h3><div class="r">' + ''.join(icon(s, 'circle') for s in (72, 56, 48, 40, 32, 24)) + '</div>')
rows.append('<h3>Tema monocromático (Android 13+): claro / escuro / dinâmico</h3><div class="r">'
            + icon(88, 'circle', svg_mono('#1C2250'), '#D9DEFF') + icon(88, 'circle', svg_mono('#E1E6FF'), '#2C3560')
            + icon(88, 'circle', svg_mono('#3B2A00'), '#F5E0A8') + icon(48, 'circle', svg_mono('#1C2250'), '#D9DEFF') + icon(32, 'circle', svg_mono('#1C2250'), '#D9DEFF') + '</div>')
ghost = '<div style="width:56px;height:56px;border-radius:50%;background:#3a4256"></div>'
cell = lambda ic, t: f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:72px">{ic}<span style="font-size:11px;color:#fff;text-shadow:0 1px 2px #000">{t}</span></div>'
home = ('<div style="display:flex;gap:6px;background:linear-gradient(160deg,#3d6b3a,#1f3d2b 60%,#0f1f18);padding:18px 8px;border-radius:14px">'
        + cell(ghost, 'Chrome') + cell(ghost, 'Fotos') + cell(icon(56, 'circle'), 'Ziel') + cell(ghost, 'Relógio') + '</div>')
rows.append('<h3>Tela inicial (fundo claro/escuro)</h3>' + home)
rows.append('<h3>Splash (círculo 2/3)</h3><div class="r">' + icon(120, 'circle', svg_fg, '#141926') + '</div>')
html = ('<!doctype html><meta charset="utf-8"><title>Ícone Ziel</title><style>body{background:#10131c;color:#cfd6e6;font:14px system-ui;padding:16px}'
        '.r{display:flex;gap:14px;align-items:center;flex-wrap:wrap}h3{margin:18px 0 8px;font-size:13px;color:#9aa4bd}</style>' + ''.join(rows))
io.open('scripts/_icon-preview.html', 'w', encoding='utf-8').write(html)
print('ok corner', round(corner, 2))
