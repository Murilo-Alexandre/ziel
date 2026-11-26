# Widgets do Android

## Como funciona
- Os dados do Ziel ficam no IndexedDB do WebView, que o widget nativo não lê. Por isso o app entrega ao widget um **retrato** (JSON) de hoje e dos próximos 7 dias, gerado com as mesmas regras da Home (`WidgetSyncService.buildSnapshot`: árvore do dia, status, progresso, hierarquia, "só obrigatórias").
- O retrato fica em `files/widget_state.json`; os ícones das metas, como PNG em `files/widget_icons/` (gerados pelo app).
- Marcar pelo widget altera o retrato na hora e acrescenta a marcação em `files/widget_pending.json`. **Nada se perde**: o app lê a fila, aplica pelo `OccurrenceService` (histórico + progresso) e só então confirma (`ackPending`).
- O dia exibido vem do relógio do aparelho. Receptores de `DATE_CHANGED`, `TIME_SET`, `TIMEZONE_CHANGED`, `BOOT_COMPLETED` e um alarme impreciso logo após a meia-noite redesenham tudo.
- Ao concluir/marcar pelo widget, os lembretes pendentes da ocorrência são cancelados (ids vêm no retrato).

## Consumo de bateria
Sem serviço em segundo plano e sem consulta periódica ao app: o widget só desenha quando (a) você toca nele, (b) o app sincroniza, (c) o dia/hora muda, (d) o sistema pede a atualização periódica (30 min, leitura de arquivo local). Tudo é leitura/gravação de um JSON pequeno.

## Limitações conhecidas
- Voltar uma meta para pendente pelo widget não recria os lembretes até o Ziel ser aberto.
- O percentual das metas que só agrupam (ex.: "Semana top 25%") é o do ciclo e só é recalculado quando o app sincroniza.
- Se o aparelho for "forçar parada" nas configurações do Android, o sistema desativa os widgets até o app ser aberto.
- O retrato cobre 7 dias: se o app não for aberto por mais que isso, o widget pede "Abra o Ziel para atualizar o dia".

## Testes
- `src/test/widgets.test.ts`: retrato (hierarquia, progresso, quantidade, obrigatórias, lembretes) e aplicação das marcações.
- `android/app/src/test/.../WidgetModelTest.java` (JUnit): dia, toque, progresso, fila.
- `scripts/cdp.mjs`: controla o WebView do app no emulador/aparelho (depuração) para testes de ponta a ponta.
