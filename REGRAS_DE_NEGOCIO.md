# Regras de Negócio — Sistema Financeiro (CashFlow)

> **Instrução Permanente para o Agente:**
> Este arquivo é a fonte oficial da verdade sobre as regras de negócio do sistema.
> 1. **Sempre consulte este arquivo** antes de implementar qualquer alteração ou nova funcionalidade.
> 2. **Sempre salve aqui** toda nova informação ou decisão de regra de negócio fornecida pelo usuário.
> 3. **Caso qualquer requisito ou impacto fique ambíguo, pergunte ao usuário** antes de assumir um comportamento.

---

## 1. Navegação e Seleção de Data
- **RN-01 (Data definida pelo clique na tabela):** O modal de lançamento/transações do dia **não deve conter seletores de data** (nem campo `<input type="date">`, nem botões de atalho como `Hoje`, `Amanhã`, `Fim Mês`).
- **RN-02 (Troca de data e abertura do modal):** O usuário escolhe a data clicando diretamente na linha/célula da data desejada na tabela principal. Se quiser operar em outra data, ele fecha o modal e clica na outra data na tabela. Não deve haver botões genéricos de `Simular` e `Lançar` no cabeçalho superior direito da tela.

## 2. Lançamentos e Transações do Dia (Saída, Diário, Entrada)
- **RN-03 (Sem "Definir valor/total do dia"):** Não existe a funcionalidade de "Definir Total do Dia" nem "Somar ao Diário" como um valor único sobrescrito (`daily_override`).
- **RN-04 (Transações individuais um a um):** Todos os lançamentos do dia — inclusive os do tipo **Diário** (`expense_daily`) — são adicionados **um a um como transações individuais** na tabela `transactions`. Cada transação pode ser editada ou excluída individualmente.
- **RN-05 (Propriedades de uma transação do tipo Diário):** Cada transação individual do tipo **Diário** possui **Valor, Descrição e Categoria** (mesmas propriedades de uma Saída à vista, sem opção de parcelamento no cartão de crédito).
- **RN-06 (Comportamento da coluna Diário e Meta Diária):**
  - O valor da coluna **Diário** de um dia é a **soma das transações individuais do tipo Diário** lançadas naquele dia.
  - Em **dias passados ou hoje** sem transações do tipo Diário lançadas, o valor da coluna Diário é `R$ 0,00`.
  - Em **dias futuros** que ainda não possuem nenhuma transação do tipo Diário lançada, o sistema projeta automaticamente o valor da **Meta Diária** (configurada em Configurações) para efeito de projeção de saldo. Assim que o usuário lançar transações do tipo Diário naquele dia futuro, o valor passa a ser a soma das transações lançadas.
  - Os valores históricos importados da planilha original para a coluna Diário são armazenados como transações individuais do tipo `Diário` (`expense_daily`), podendo ser editados ou excluídos normalmente.

## 3. Edição de Transações e Feedback Visual
- **RN-07 (Edição Inline no próprio card clicado):** Ao clicar em **Editar** em uma transação na lista do dia, **o próprio card da transação se transforma inline nos campos editáveis** (Tipo: `Saída` / `Diário` / `Entrada`, Valor, Descrição, Categoria e botões **Salvar** e **Cancelar** ali mesmo), com forte destaque visual indicando que aquele item está em edição.

---

## 4. Regras Gerais do Fluxo de Caixa (Referência)
- **RN-08 (Faixas de Liquidez do Saldo):**
  - `> R$ 3.000`: Excelente (Verde escuro)
  - `R$ 2.000 a R$ 3.000`: Seguro (Verde claro)
  - `R$ 1.500 a R$ 1.999,99`: Atenção (Amarelo)
  - `R$ 1.000 a R$ 1.499,99`: Crítico (Laranja)
  - `< R$ 1.000`: Perigo (Vermelho)
- **RN-09 (Cartão de Crédito):** Aplicável apenas a transações do tipo **Saída** (`expense_fixed`). Compras no cartão respeitam o dia de fechamento e o dia de vencimento configurados (compras até o dia de fechamento caem no vencimento do ciclo atual; após o fechamento, deslocam para o próximo mês).
- **RN-10 (Cadastro e Seleção de Tags / Categorias):** O sistema deve permitir ao usuário cadastrar e remover tags personalizadas (persistidas no banco de dados), além de selecionar ou criar novas tags rapidamente tanto na aprovação de notificações quanto nos modais de lançamento, edição inline e configurações.
- **RN-11 (Integração MacroDroid e Notificações Bancárias / NuPay):**
  - No MacroDroid, a variável Magic Text correta para o corpo/texto da notificação é `{notification}` (e `{not_sub_text}` para texto complementar), e para o horário é `{hour}:{minute}:{second}` (não `{not_text}` nem `{hour_00}:{minute_00}:{second_00}`).
  - O parser deve limpar automaticamente placeholders não expandidos do MacroDroid e suportar notificações de pagamento via NuPay (ex.: `"Pagamento com NuPay aprovado"` / `"R$ 50,42 no débito com NuPay APROVADO em iFood."`), extraindo valor, estabelecimento e sugerindo a tag correspondente.
  - **Filtro Estrito de Transações Efetivadas:** Notificações em que **não houve compra/transação efetivada** — tais como compras negadas/recusadas/canceladas (ex.: `"Compra no crédito negada: Compra de R$ 7,95 NEGADA em ..."`), cupons promocionais, ofertas, cashback e propagandas (ex.: `"Black Friday Shopee com R$20 OFF: Resgate seu cupom..."`), códigos de verificação, lembretes de fatura ou avisos de limite — **devem ser descartadas automaticamente no recebimento e nunca aparecer na aba de Notificações** (nem em Pendentes, nem em Recusadas).
- **RN-12 (Drag-and-Drop de Entrada, Saída e Diário entre Datas e Tipos na Tabela):**
  - Ao arrastar qualquer um dos 3 campos (`Entrada`, `Saída` ou `Diário`) de uma data de origem (`sourceDate`) e soltar em outra data (`targetDate`) e/ou em outra coluna (`Entrada`, `Saída` ou `Diário`):
    - As transações daquele campo na data de origem são movidas para a data de destino e convertidas para o tipo da coluna de destino (`Diário` ↔ `Saída` ↔ `Entrada`), zerando o campo na origem (inclusive mantendo `R$ 0,00` caso a origem seja um dia futuro de `Diário`) e **incrementando (somando)** ao valor já existente na coluna de destino.
    - Também é permitido arrastar entre colunas do **mesmo dia** (ex.: converter o `Diário` de um dia diretamente em `Saída` ou `Entrada`, e vice-versa).

---

## 5. Arquitetura Personal Hub & Módulo Samsung Health
- **RN-13 (Personal Hub Multi-Módulos):**
  - O sistema funciona como um **Personal Hub** modularizado por domínio (`src/core` + `src/modules/{finance,health,bujo}`), com seletor global de módulos no topo (`Hub` • `BuJo` • `Financeiro` • `Saúde`).
  - A rota raiz `/` é o **Personal Hub (Cockpit de Hoje + Visão dos Módulos)**. O módulo **Financeiro** vive em `/financeiro` (com redirecionamentos em `/insights` e `/notificacoes` para `/financeiro/insights` e `/financeiro/notificacoes`), mantendo todas as regras `RN-01` a `RN-12` intactas.
  - O módulo **Samsung Health** (`/saude`) recebe dados do app Android em Kotlin (`bernardomerlo/automacao_samsung_health`) via `POST /api/health/sync` (ou `POST /api/health`).
  - O contrato JSON (`SyncBatchPayload`) recebe `device`, `syncedAt`, `sleeps` e `exercises`, fazendo **upsert idempotente por `uid`** (`ON CONFLICT(uid) DO UPDATE`), preservando `sleepScore` consolidado posteriormente e respeitando `is_manual_override = 1` caso o usuário tenha editado o registro na interface web.
- **RN-14 (Módulo Bullet Journal — `/bujo`):**
  - **Diário (`/bujo` e `/bujo/YYYY-MM-DD`):** Integra automaticamente Sono/Score (`health_sleeps`), Academia & Cardio (`health_exercises`, permitindo override manual `Auto / Sim / Não`), resumo financeiro do dia (`transactions`), toggles rápidos de Vitamina e Leitura, compromissos agendados no `Log Anual`, tarefas pendentes roladas de dias anteriores (com ação de migrar para o dia atual), tarefas + subtarefas e Considerações (`Ontem` herdado automaticamente do dia anterior + `Hoje` em Markdown com detecção de `[[Wikilinks]]` em `bujo_entity_links`).
  - **Visão Mensal (`/bujo/mes/YYYY-MM`):** Calendário em grid (Dom–Sáb) com tarefas pendentes e ícones de hábitos, gráficos de Horas de Sono (faixa ideal `7h–10h`) e Nota Sono (`75–100`), tabela consolidada do mês e considerações mensais (`bujo_months`).
  - **Log Anual (`/bujo/anual/YYYY`):** Objetivos Anuais (`source = 'goal'`), Heatmap Anual (verde `>= 75`, vermelho `< 75`) e Log Mensal (Jan–Dez) de compromissos futuros vinculados automaticamente às datas e ao calendário mensal.
