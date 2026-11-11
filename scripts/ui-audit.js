// Auditoria funcional da interface (rodar no console/Browser pane com o app aberto em viewport mobile).
// Ações reais de clique + verificação de que nenhum elemento sobreposto intercepta o toque.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { w: innerWidth, checks: [], fails: [] };
  const ok = (name, cond, extra = '') => { out.checks.push(name); if (!cond) out.fails.push(name + (extra ? ' :: ' + extra : '')); };
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const hit = (el) => { // o toque no centro do elemento chega nele?
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (el === t || el.contains(t) || t.contains(el));
  };
  const stuck = () => ({ inert: qa('[inert]').length, ov: document.body.style.overflow, dlg: qa('[role=dialog]').length });
  const tab = async (n) => { q(`nav button[aria-label="${n}"]`).click(); await sleep(450); };
  const sheet = () => q('[role=dialog][aria-label="Como foi?"]');
  const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  await tab('Hoje'); await sleep(600);
  // --- overflow horizontal em todas as abas
  for (const t of ['Hoje', 'Agenda', 'Metas', 'Ajustes']) {
    await tab(t); await sleep(500);
    ok(`sem rolagem horizontal em ${t}`, document.documentElement.scrollWidth <= innerWidth + 1, `${document.documentElement.scrollWidth}>${innerWidth}`);
  }
  await tab('Hoje'); await sleep(500);

  // --- hierarquia: expandir/recolher repetido
  const toggles = () => qa('button[aria-expanded]');
  for (let k = 0; k < 4; k++) { qa('button[aria-label="Expandir submetas"]').forEach((b) => b.click()); await sleep(450); }
  const expanded = qa('button[aria-label="Recolher submetas"]').length;
  ok('hierarquia expande (vários níveis)', expanded >= 2, 'expandidos=' + expanded);
  ok('botões de expandir recebem o toque', toggles().every((b) => { b.scrollIntoView({ block: 'center' }); return hit(b); }));
  const sizes = toggles().map((b) => b.getBoundingClientRect()).filter((r) => r.width);
  ok('alvo de toque do expandir >= 32px', sizes.every((r) => r.width >= 31 && r.height >= 31));
  qa('button[aria-label="Recolher submetas"]').reverse().forEach((b) => b.click()); await sleep(600);
  ok('hierarquia recolhe', qa('button[aria-label="Recolher submetas"]').length === 0);
  qa('button[aria-label="Expandir submetas"]').forEach((b) => b.click()); await sleep(600);

  // --- modal "Como foi?": concluir, X, Esc, fundo
  const ring = () => qa('button[aria-label^="Status:"]').find((b) => hit(b)) || qa('button[aria-label^="Status:"]')[0];
  for (let round = 0; round < 3; round++) {
    const r = ring(); r.scrollIntoView({ block: 'center' }); await sleep(250); r.click(); await sleep(700);
    ok(`modal Como foi? abre (rodada ${round})`, !!sheet());
    const dlg = sheet(); if (!dlg) break;
    ok('modal não está inerte', !dlg.closest('[inert]'));
    const btns = qa('button', dlg);
    const conc = btns.find((b) => /Concluído/.test(b.textContent)); const xb = btns.find((b) => b.getAttribute('aria-label') === 'Fechar');
    ok('Concluído recebe o toque', hit(conc)); ok('X recebe o toque', hit(xb));
    if (round === 0) { conc.click(); await sleep(900); ok('modal fecha ao concluir', !sheet()); ok('nada travado após concluir', stuck().inert === 0 && stuck().ov === ''); }
    if (round === 1) { xb.click(); await sleep(700); ok('X fecha o modal', !sheet()); }
    if (round === 2) { esc(); await sleep(700); ok('Esc fecha o modal', !sheet()); }
  }
  ok('sem camada/inert sobrando', stuck().inert === 0 && stuck().dlg === 0 && stuck().ov === '', JSON.stringify(stuck()));

  // --- toque no fundo fecha; reabrir rápido
  for (let i = 0; i < 4; i++) { const r = ring(); r.click(); await sleep(60 + i * 40); (q('[role=dialog][aria-label="Como foi?"] button[aria-label="Fechar"]'))?.click(); await sleep(40); r.click(); await sleep(500); q('[role=dialog] button[aria-label="Fechar"]')?.click(); await sleep(600); }
  ok('abrir/fechar rápido não trava', stuck().inert === 0 && stuck().dlg === 0 && stuck().ov === '', JSON.stringify(stuck()));

  // --- navegação rápida entre abas
  for (let i = 0; i < 12; i++) { for (const t of ['Agenda', 'Metas', 'Ajustes', 'Hoje']) { q(`nav button[aria-label="${t}"]`).click(); await sleep(30); } }
  await sleep(800);
  ok('navegação rápida mantém abas clicáveis', hit(q('nav button[aria-label="Metas"]')) && stuck().inert === 0);

  // --- Agenda: contraste (nenhum texto sobre fundo coral sólido)
  await tab('Agenda'); await sleep(700);
  const coral = qa('section[data-day]').filter((s) => getComputedStyle(s).backgroundColor === 'rgb(242, 139, 130)');
  ok('Agenda sem cartão coral sólido', coral.length === 0);
  const weekBtn = q('button[aria-label="Próxima semana"]'); ok('Agenda: próxima semana recebe toque', hit(weekBtn)); weekBtn.click(); await sleep(400);

  // --- Metas: abrir detalhe e fechar
  await tab('Metas'); await sleep(900);
  const open1 = qa('main button').find((b) => /^Abrir /.test(b.getAttribute('aria-label') || ''));
  open1?.click(); await sleep(800);
  ok('Metas: detalhes abrem', !!q('[role=dialog]'));
  q('[role=dialog] button[aria-label="Fechar"]')?.click(); await sleep(700);
  ok('Metas: detalhes fecham', !q('[role=dialog]') && stuck().inert === 0);

  // --- editor + seletor único de ícone e cor
  await tab('Hoje'); q('button[aria-label="Nova meta"]').click(); await sleep(800);
  ok('editor abre', !!q('[role=dialog][aria-label="Nova meta"]'));
  const picker = qa('[role=dialog] button').find((b) => /Personalizar/.test(b.getAttribute('aria-label') || ''));
  ok('botão ícone+cor recebe toque', hit(picker)); picker.click(); await sleep(800);
  const pk = q('[role=dialog][aria-label="Ícone e cor"]'); ok('seletor de tela cheia abre', !!pk);
  qa('[role=tab]', pk).find((t) => t.textContent === 'Cor').click(); await sleep(300);
  const sw = qa('[role=radio]', pk); ok('paleta rica (60+ cores, linhas de 6)', sw.length >= 60 && sw.length % 6 === 0, 'n=' + sw.length);
  ok('todas as cores recebem toque', sw.every((s) => { s.scrollIntoView({ block: 'nearest' }); return hit(s); }));
  sw[40].click(); await sleep(200);
  qa('[role=tab]', pk).find((t) => t.textContent === 'Ícone').click(); await sleep(300);
  const search = q('input[type=search]', pk); search.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(search, 'moto'); search.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
  const tile = qa('[role=option]', pk)[0]; ok('pesquisa de ícone retorna resultados', !!tile); tile?.click(); await sleep(200);
  qa('button', pk).find((b) => /Aplicar/.test(b.textContent)).click(); await sleep(800);
  ok('seletor fecha e editor segue ativo', !q('[role=dialog][aria-label="Ícone e cor"]') && !!q('[role=dialog][aria-label="Nova meta"]'));
  // --- lembretes: janelas independentes e prévia
  {
    const dlg = q('[role=dialog][aria-label="Nova meta"]');
    const sw = qa('button[role=switch]', dlg).find((b) => /lembretes/i.test(b.getAttribute('aria-label') || ''));
    ok('interruptor de lembretes existe', !!sw);
    if (sw) {
      sw.scrollIntoView({ block: 'center' }); await sleep(200); sw.click(); await sleep(500);
      ok('lista de janelas aparece', !!q('[aria-label="Janelas de lembrete"]', dlg));
      const addBtn = qa('button', dlg).find((b) => /Nova janela/.test(b.textContent));
      addBtn.scrollIntoView({ block: 'center' }); await sleep(250); ok('Nova janela recebe toque', hit(addBtn)); addBtn.click(); await sleep(300); addBtn.click(); await sleep(300);
      ok('3 janelas após adicionar 2', qa('[role=listitem]', dlg).length === 3, 'n=' + qa('[role=listitem]', dlg).length);
      const rm = qa('button', dlg).filter((b) => /Remover janela/.test(b.getAttribute('aria-label') || ''));
      rm[2]?.scrollIntoView({ block: 'center' }); await sleep(250); ok('remover recebe toque', rm.length === 3 && hit(rm[2])); rm[2].click(); await sleep(300);
      ok('2 janelas após remover', qa('[role=listitem]', dlg).length === 2);
      const down = qa('button', dlg).find((b) => /Descer janela 1/.test(b.getAttribute('aria-label') || '')); down?.click(); await sleep(200);
      const prev = q('[aria-label="Prévia dos lembretes"]', dlg); ok('prévia dos horários', !!prev && /\d\d:\d\d/.test(prev.textContent));
      const dia = qa('button', dlg).find((b) => /dia inteiro/i.test(b.getAttribute('aria-label') || '')); dia?.click(); await sleep(300);
      ok('dia inteiro gera janela única', qa('[role=listitem]', dlg).length === 1);
    }
  }
  const sel = q('[role=dialog][aria-label="Nova meta"] [aria-haspopup=listbox]'); sel.click(); await sleep(600);
  const lbOpt = q('[role=listbox][aria-label="Faz parte de"] [role=option]');
  ok('seletor de opções abre e recebe toque', !!lbOpt && hit(lbOpt));
  esc(); await sleep(600);
  q('[role=dialog][aria-label="Nova meta"] footer button')?.click(); await sleep(800); // Cancelar
  ok('editor fecha sem travar', !q('[role=dialog]') && stuck().inert === 0 && stuck().ov === '', JSON.stringify(stuck()));
  return JSON.stringify({ w: out.w, total: out.checks.length, fails: out.fails });
})();
