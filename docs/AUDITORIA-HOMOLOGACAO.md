# Ziel — Auditoria, correções e preparação para homologação

Data: 10/11/2026 · Escopo: `C:\dev\ziel` · Fonte de verdade: Skill `ziel-app-builder` (`decision-log.md` primeiro).
Este documento **não** sobrescreve a documentação da Skill; registra o que foi encontrado, corrigido e o que ainda **não** foi validado.

> O projeto **não é um repositório Git** e não havia backup. Antes de qualquer alteração foi feita uma cópia de `src/` em
> `%TEMP%\ziel-backup\src` (estado original). Nenhum dado real foi tocado; o banco usado na validação visual é o perfil de
> teste do navegador embutido, com dados fictícios.

---

## 1. Diagnóstico inicial

**O que existia e estava certo:** arquitetura em camadas (domínio puro / serviços / portas / adaptadores), tipos de domínio fiéis à Skill
(metas recursivas, revisões com vigência, ocorrências, ciclos, registros), avaliador de agenda e de ciclo semanal, agregador de progresso
puro, cenário "Treinar" semeado, tema escuro coerente com a referência.

**Estado real ao iniciar:** `typecheck` ok; `npm test`: **66 de 67 passando** — 1 falha (A32). O relatório antigo de "67 testes = A01–A60 cobertos" **não procede**:

* A50 e A53–A56 eram `expect(true).toBe(true)`; A43–A48 só criavam uma meta; A10, A12, A16, A19 testavam existência/trivialidades; A15/A57 não passavam pelo fluxo real.
* Os testes usavam a data real da máquina e dependiam do UTC.

### Bloqueadores (P0) encontrados

> Metodologia: os itens abaixo foram identificados por **leitura do código**; a maioria foi depois coberta por testes novos que exercitam o comportamento correto. Não executei o código antigo contra esses testes, então "efeito real" é a consequência deduzida do código, exceto onde indicado.

| # | Problema | Efeito real |
|---|---|---|
| 1 | `SqliteGoalRepository/Occurrence/Journal` eram **`Map` em memória**; a UI sequer os usava (instanciava IndexedDB direto, ignorando `RepositoryFactory`) | Documentação dizia "SQLite nativo no Android"; na prática era IndexedDB, e o "SQLite" era um engano que perderia tudo ao fechar o app |
| 2 | Chave da ocorrência incluía o `revisionId`; "esta e as próximas" gerava **ocorrência duplicada** no mesmo dia (o teste A36 nunca reabria o dia) | Duas linhas no mesmo dia, progresso/denominador errados |
| 3 | Metas **raiz apareciam em todos os dias** (`isRoot && cycleInstance`) | Meta única do dia 19 aparecia no dia 20; Treinar aparecia no domingo vazio; A06 falhava na Home |
| 4 | `rescheduleOneTimeGoal` movia a ocorrência mas a agenda continuava "dia 19": a ocorrência era **regenerada no dia antigo** e a chave antiga ficava órfã | A57 falhava no fluxo real |
| 5 | Anexos guardavam `blob:` object URL (morre ao fechar/reabrir) | Fotos/arquivos **desapareciam** após reiniciar |
| 6 | "Hoje" calculado com `toISOString()` (UTC) em seed/serviço/editor; `addRevision` fazia aritmética de data via UTC | Após 21h (Brasil, UTC-3) o app "virava o dia" cedo; `effectiveTo` frágil |
| 7 | `upsertOccurrence` não era atômico (lê → grava); StrictMode/duas aberturas simultâneas | `ConstraintError` / duplicata por corrida |
| 8 | Agregação do pai só olhava filhos diretos com agenda própria; `directChildren`, `depth`, pesos e cota **não eram aplicados pelo serviço** | Hierarquias profundas e projetos ponderados não agregavam; A60/A30 só passavam na função pura |
| 9 | Frequência "3x/semana" (quota) nunca aparecia na Home nem podia ser registrada | Recurso decorativo |
| 10 | Fonte via Google Fonts em `index.html` | Quebra a regra "offline" (A50) |
| 11 | `updateStatus` buscava o status anterior só em "hoje" | Trilha de status errada para datas passadas |

### P1/P2 relevantes

Editor só **criava** (sem editar, sem escopo "somente esta/esta e as próximas"); controles decorativos (quantidade nunca era usada,
critério de conclusão aplicado à meta errada, peso/obrigatória/agrupar na Home sem UI); sem tela de detalhes (tocar no nome não fazia nada);
Home com recuo ilimitado, alvos de toque de 24 px, sem safe-area, `user-scalable=no`; estado "cycle custom" calculado errado;
cycleKey dependia da revisão (evidência de ciclo se perdia ao editar); sem exportação/importação (A53–A54); seed automático
criando dados de exemplo no banco real do usuário; sem tratamento de falha de abertura do banco.

---

## 2. Correções realizadas (principais arquivos)

**Domínio**
* `src/domain/dates.ts` (novo): datas de calendário sem UTC (`todayLocal`, `addDays`, `diffDays`, `isValidDateString`). `scheduleEvaluator.ts` passa a usá-lo.
* `src/domain/recurrence/occurrenceGenerator.ts`: chave **`goalId_data_slot`** (sem revisão) → editar nunca duplica; slot "quota_event" por dia para frequência flexível.
* `src/domain/recurrence/cycleEvaluator.ts`: ciclo `custom` correto (dias/semanas/meses desde a âncora); `cycleKey` sem revisão.
* `src/domain/progress/cycleAggregation.ts` (novo): agregação **recursiva** e pura (`direct`/`descendants`, contêineres atravessados, filhos de ciclos diferentes, cota por janela do próprio ciclo, `directChildren` com pesos, datas removidas por exceção, quantidade, obrigatório/opcional, ciclo vencido → "não realizado" *derivado*, nunca mutando histórico).
* `src/domain/progress/progressAggregator.ts`: `aggregateQuotaProgress`, opções (`progressOf`, `isRequiredOf`, `cycleEnded`), `optionalContribution`.
* `src/domain/goals/goalTree.ts`: Home só mostra o que é relevante no dia; `showParentOnHome=false` sobe os filhos; contagem de evidências (nunca imagens); validação de ciclo robusta; `computeDailyProgress`.
* `src/domain/goals/goalValidation.ts`, `revisions.ts` (novos): validação com mensagens PT-BR; revisão vigente sem "fallback" para datas anteriores à existência da meta.

**Serviços/aplicação**
* `OccurrenceService`: geração **idempotente e atômica** (`insertIfAbsent`), fila que serializa operações, árvore em poucas consultas, ocorrência pendente acompanha a revisão vigente (resolvidas ficam presas à revisão histórica), pendentes obsoletas somem da Home, `recordQuantity`, remarcação correta de meta única (agenda + ocorrência + `rescheduledFrom`), exceção "remover só deste dia".
* `GoalService`: validação, edição "esta e as próximas" (atualiza no lugar se a revisão começa no dia; trata revisão posterior sem sobreposição), `moveGoal` (recusa ciclo), `reorderSiblings`, `archiveGoal` (subárvore; histórico preservado).
* `BackupService` (novo): backup JSON versionado + **validação completa antes de tocar nos dados** (estrutura, versão, ids, integridade referencial) + importação atômica.
* `GoalQueryService` (novo): biblioteca, detalhes, agenda semanal (projeção somente-leitura).
* `application/container.ts` (novo): composição única; fim das instâncias duplicadas por tela.
* `SeedService`: exemplo "Treinar" **opcional** (botão), não mais automático.

**Persistência** (`src/infrastructure/persistence/`)
* Removido o "SQLite" falso. `RepositoryFactory` assume **IndexedDB** em web **e** no WebView Android, sem fallback silencioso; falha de abertura aparece ao usuário.
* `indexeddb/database.ts`: **esquema v2** com migração v1→v2 que funde duplicatas, re-liga evidências/trilha à ocorrência sobrevivente e normaliza chaves; `requestPersistentStorage()`.
* Transações atômicas (registro+anexos, revisão+definição, importação); anexos agora são **Blob duráveis** no banco.
* `IndexedDbBackupStore`, índice `by-targetKey` (fim do `getAll` de todo o diário).

**Interface (mobile-first, um único design system)**
* Tokens em `tailwind.config.js`/`index.css` (cores semânticas, raios, tipografia do sistema — sem fonte externa, `touch` 44 px, safe-area, `dvh`, `prefers-reduced-motion`).
* `shared/ui/*` (Sheet com Esc só na folha do topo e fundo `inert`, status/progresso, toast, miniatura de anexo com `revokeObjectURL`), `shared/Overlays.tsx`, `shared/AppData.tsx`.
* Home: saudação, faixa de dias rolável, progresso do dia, árvore (chevron = expandir, nome = detalhes, círculo = status), recuo limitado a 3 níveis, raízes expandidas/níveis fundos recolhidos (estado salvo), resumo do ciclo "Na semana · 4 de 9", contagem de registros, estados vazio/carregando/erro.
* Novos: folha "Como foi?" (com quantidade), **detalhes da meta**, **editor** (criar/editar, escopo, validação, "opções avançadas", prévia pela mesma engine, pesos), **evidências** (comentário, foto, galeria, arquivo; erro de permissão recuperável), **Agenda** semanal, **Metas** (ativas/arquivadas), **Ajustes** (exportar/importar com pré-visualização e confirmação), `ErrorBoundary`.
* Navegação: Hoje · Agenda · **+** · Metas · Ajustes.
* Removido `@capacitor/camera` (nunca era usado; a captura usa o seletor nativo via `<input capture>`).

**Testes:** suíte antiga (4 arquivos, 67 casos) substituída por 3 arquivos / **78 casos** com dados, ações e assertions reais.

---

## 3. Funcionalidades validadas — por nível

Legenda: **U** = domínio/serviços (memória, relógio injetado) · **I** = integração em IndexedDB real (fake-indexeddb) · **B** = navegador real (Chromium embutido, executado nesta sessão) · **A** = Android real.

| Item | Nível | Evidência |
|---|---|---|
| A01–A05 hierarquia (inclui 8 níveis, recusa de ciclo, reordenar) | U | `acceptance.a01-a60.test.ts` |
| A06–A17 recorrência (única, diária, dias, idempotência concorrente, ciclo 17–23/08, filho independente, pai mensal/filho semanal, período, intervalo após "reinício", **cota 3x**, dia 31) | U (+I p/ A09) | idem |
| A18–A23 Treinar (9 execuções; seg/ter/qua; qua completa ≠ semana completa; vencida→não realizada; mínimo 7/9) + avô→pai-contêiner→3 filhos | U, **B** | teste + Home real |
| A24–A32 status/progresso (83% ≠ concluído, opcional, pesos 10/50/25/15, 2,5/4 L, revisão com trilha, data passada) | U | idem |
| A33–A36 edição/histórico (só esta ocorrência, esta+próximas sem duplicar, revisão histórica) | U, I, **B** (editar nome) | idem |
| A37–A42 registros (vários, só texto, só imagem, vários anexos, antes do status, **nível de ciclo**) | U, I; **B** (ciclo) | idem |
| A43–A45 chevron/nome/status | **B** (cliques reais) + teste de contrato de código | ver nota |
| A46–A48 densidade, `showParentOnHome=false`, contagem compacta | U + **B** | idem |
| A49 persistência após reiniciar | I (conexão fechada/reaberta) + **B** (recarga da página) | `persistence.idb.test.ts` |
| A50 offline | U (sem rede + `index.html` sem recurso externo) | **fonte externa removida** |
| A51 câmera negada → erro recuperável | U (contrato) — **não testado com permissão real** | |
| A52 arquivo/foto persistem (bytes e metadados) | I + **B** (Blob de 4 KB íntegro após recarga) | |
| A53 exportação versionada / A54 importação inválida e falha no meio sem perda | I | 10 cenários inválidos + abort de transação |
| A55 banco novo no esquema atual / A56 migração v1→v2 com duplicata | I | banco v1 real criado e migrado |
| A57 remarcar meta única / A58 exceção não vaza / A59 9 contribuições / A60 filhos diretos sem contar netos | U (+I p/ A57) | |

Não existe teste **A** (Android real) para nada: veja §7.
Nota A43–A45: não há biblioteca de testes de DOM instalada; o teste só confere que os três controles são distintos no código. A verificação de verdade foi manual no navegador.

Também validado em **B**: criar meta pelo editor (frequência 3x/semana), contagem "0 de 3 na semana", concluir e ver 1/3, abrir detalhes, registro de ciclo com timeline, editar nome (esta e as próximas) preservando o status, Treinar seg/qua e progresso 4/9 = 44%.

---

## 4. Revisão visual

Telas avaliadas: Hoje (vazio, com dados, árvore, folha de status), editor (nova meta, frequência, avançadas), detalhes, evidências, Agenda, Metas, Ajustes.
Larguras medidas por script nas 4 abas (sem rolagem horizontal, nenhum elemento fora da tela, nenhum controle com menos de 40 px): **320, 375, 412 e paisagem 844×390**. 360 foi verificado por captura de tela e 390 só no teste funcional do Treinar (sem a medição de overflow). Capturas de tela feitas a 320 (editor, Home, detalhes, evidências).

Problemas encontrados e corrigidos: fonte externa, recuo infinito, alvos de 24 px, sem safe-area, `user-scalable=no`, selects e placeholders truncados a 320 px (textos encurtados; não reverifiquei visualmente depois do ajuste), barra de ciclo redundante em cartões-folha, Esc fechando todas as folhas empilhadas, fundo focável atrás do sheet.

**Não verificado:** safe-area real (no emulador `env()` é 0), comportamento do teclado virtual do Android, navegação por gestos, contraste medido por ferramenta (as cores seguem tokens, mas não rodei verificador WCAG), leitor de tela.

---

## 5. Testes e comandos executados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK, sem erros |
| `npm test` | **3 arquivos / 78 testes — todos passam** |
| `npm run test:tz` (novo: UTC, America/Sao_Paulo, America/Los_Angeles, Pacific/Kiritimati UTC+14, Australia/Lord_Howe) | 78/78 em cada fuso |
| `npm run build` | OK (JS 329 kB / 98 kB gzip; CSS 23 kB) |
| `npx cap sync android` | OK (plugins: nenhum; assets copiados) |
| Lint | **não existe ESLint no projeto** — não executado |
| Testes de interface automatizados (DOM) | **não existem** — validação visual foi manual no navegador |
| `npm audit` | não executado |

Falhas remanescentes: nenhuma conhecida na suíte. A falha original (A32) era um teste que usava data real e não gerava a ocorrência.

---

## 6. Builds

* Web: ✅ `dist/`.
* Capacitor: ✅ sincronizado em `android/app/src/main/assets/public`.
* **APK: ❌ NÃO gerado.** O ambiente atual **não tem** JDK, Android SDK/Studio, `adb` nem `JAVA_HOME`/`ANDROID_HOME` (verifiquei variáveis, PATH e pastas usuais; `gradlew --version` falha por falta de Java). Nada foi instalado nem alterado no sistema.
* SQLite nativo Android: **não existe e não é afirmado**; o armazenamento no Android é o IndexedDB do WebView (ver `RepositoryFactory.ts`).

---

## 7. Pendências

**Críticas (impedem declarar o APK homologado)**
1. Gerar e instalar o APK debug (precisa de JDK 17 + Android SDK 35 — `variables.gradle` usa compileSdk/targetSdk 35, minSdk 23).
2. Teste em aparelho/emulador: abrir, criar meta, mudar status, **encerrar à força e reabrir** (persistência no WebView), câmera, galeria, arquivo, permissões negadas.

**Importantes**
3. Câmera/arquivo usam `<input type=file capture>` no WebView do Capacitor. Funciona em teoria; **não testado em Android**. Se falhar, o plano é um adaptador com `@capacitor/camera` atrás da `CameraPort` já existente.
4. Fotos são guardadas **sem redimensionar** (limite 25 MB por arquivo). Em uso intenso o banco cresce rápido; recomenda-se reduzir fotos (ex.: lado maior 1600 px) antes de salvar.
5. IndexedDB do WebView pode ser limpo pelo sistema em falta extrema de espaço; o app pede armazenamento persistente (o resultado aparece em Ajustes), mas **o backup manual é a proteção real** — considerar lembrete periódico.
6. Anexos grandes entram no JSON de backup em base64 (+33%); backups com muitas fotos ficam pesados.
7. Aba **Progresso** (métricas 7/30 dias, sequência) do `roadmap.md` Fase 6 não foi feita; o mesmo vale para lembretes/notificações (pós-V1).

**Limitações conhecidas (decisões documentadas)**
* Dentro da janela de um ciclo usa-se a revisão do último dia da janela para decidir a agenda esperada das submetas (edição no meio do ciclo é refletida pela revisão vigente no fim da janela).
* Remarcar meta única atualiza a revisão **no lugar** (a data original fica em `rescheduledFrom` na ocorrência).
* "Não realizado" de ciclos vencidos é **derivado** (não grava status em ocorrências pendentes passadas).
* `weightMode`/`depth` do domínio existem; a UI expõe agregação por ocorrências e por submetas com pesos. Pesos de ocorrências individuais não têm UI.
* Metas de cota com ciclo menor que o período da cota (ex.: "3x por semana" com ciclo diário) não são impedidas na UI além da sugestão automática de ciclo.
* Cobertura A43–A45 é manual (sem testes de componente).

---

## 8. Próxima etapa para você instalar e homologar

1. Instalar **JDK 17** e **Android Studio** (SDK Platform 35 + Build-Tools) e definir `JAVA_HOME`/`ANDROID_HOME`. (Não alterei nada disso.)
2. Na pasta do projeto:
   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleDebug      # no Windows: gradlew.bat assembleDebug
   ```
   APK esperado em `android/app/build/outputs/apk/debug/app-debug.apk`. Instale com `adb install -r app-debug.apk` ou copie para o celular.
3. Roteiro manual no celular (marque o que falhar):
   * Abrir; Ajustes mostra "Armazenamento persistente".
   * "Carregar exemplo Treinar" → segunda: só Futebol; quarta: 3 atividades; concluir as 3 → Treinar ≠ concluído (4 de 9 se a segunda/terça foram feitas).
   * Criar meta com submeta e "3x por semana"; alterar status; **fechar o app pelo gerenciador de tarefas e reabrir** → dados iguais.
   * Registro com foto da câmera, imagem da galeria e PDF; reabrir e abrir os anexos.
   * Negar a permissão de câmera → mensagem amigável; comentário ainda salva.
   * Editar "esta e as próximas" e "somente este dia"; remarcar uma meta de data única.
   * Teclado aberto no editor (campos não ficam escondidos, botões Salvar/Cancelar visíveis); giro para paisagem.
   * Exportar backup, apagar dados do app, importar de volta.
4. Se tudo passar: só então marcar "APK homologado". Se algo falhar, anote a tela e o passo.

---

## 9. Como reproduzir esta auditoria

```bash
npm run typecheck
npm test                # 78 testes
npm run test:tz         # mesma suíte em 5 fusos
npm run build
npx cap sync android
npm run dev             # http://localhost:5173
```
