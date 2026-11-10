# Notificações e ícones (beta.3)

## Notificações locais (Android)
* **Motor:** `@capacitor/local-notifications` (AlarmManager). Os avisos ficam agendados **no sistema**: disparam com o app fechado, sem internet, e são reagendados após reiniciar o aparelho (receiver do plugin).
* **Modelo:** cada meta tem `notify` (opcional) na revisão: `{ enabled, time, beforeMin, afterMin, everyMin }`. Exemplo do almoço: `12:00`, 60 antes, 60 depois, a cada 30 → 11:00, 11:30, 12:00, 12:30, 13:00.
* **Planejador puro** (`src/domain/notifications/reminderPlanner.ts`): para cada dia da janela (7 dias à frente) e cada ocorrência esperada **ainda pendente**, gera os avisos futuros. Ocorrência concluída/parcial/não realizada, removida do dia ou meta arquivada → nenhum aviso. Ids são determinísticos (ocorrência + deslocamento + horário + texto): sem duplicação e edição substitui os antigos.
* **Sincronização** (`ReminderService.sync`): calcula o plano, compara com os agendamentos pendentes, **cancela** o que ficou obsoleto e **agenda** o que falta. Roda a cada mudança de dados (cancelamento imediato ao registrar a meta), ao abrir o app e ao voltar para ele. Idempotente.
* **Limites para evitar excesso:** padrão = nenhum aviso (cada meta precisa ser ligada); ao ligar, o padrão é um aviso só, no horário. Máximo 12 avisos por ocorrência, teto diário (padrão 12), teto total 120 agendamentos, silêncio noturno opcional.
* **Global (Ajustes → Notificações):** liga/desliga tudo, silêncio à noite, máximo por dia, próximos lembretes e notificação de teste. Salvo no aparelho (não vai no backup).
* **Permissões:** POST_NOTIFICATIONS (pedida ao ligar um lembrete), USE_EXACT_ALARM (Android 13+; no 12, SCHEDULE_EXACT_ALARM). Sem alarme exato o Android pode atrasar o aviso alguns minutos.

### Limitações conhecidas (dependem de teste físico)
* A janela é de 7 dias: se o app **não for aberto por mais de 7 dias**, os avisos acabam até a próxima abertura.
* Fabricantes com economia de bateria agressiva (Xiaomi, Huawei, Samsung "dormindo") podem bloquear alarmes: libere o Ziel da otimização de bateria.
* Metas de **frequência flexível** (3x por semana) e agrupadores sem agenda própria não têm lembretes (não há horário/dia fixo).
* Na web/PWA não há agendamento com o app fechado; a prévia dos próximos lembretes funciona.
* Tocar na notificação abre os detalhes da meta; não há botão "Concluir" na notificação nesta versão.

## Ícones
* **Biblioteca:** Phosphor Icons (MIT), peso regular, 329 ícones curados com nomes e palavras-chave em português, em 15 categorias. Gerados por `scripts/build-icon-catalog.py` + `scripts/gen-icons.mjs` (somente o que o catálogo usa entra no app; sem peso de 3000 ícones).
* **Compatibilidade:** ícones salvos antes (`Target`, `Dumbbell`, …) continuam funcionando. Novos usam `ph:<nome>`.
* **Seletor:** tela cheia, pesquisa sem acento por início de palavra, categorias, recentes, grade, prévia e confirmação.
